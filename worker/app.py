"""Tessera worker: local models, Python execution and long-running jobs.

Runs on the home PC and is exposed through Cloudflare Tunnel (or Tailscale
Funnel). All endpoints except /api/health require a Bearer token.
"""

from __future__ import annotations

import asyncio
import json
import os
import subprocess
import sys
import tempfile
import threading
import time
import uuid
from dataclasses import dataclass, field
from typing import Any

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

OLLAMA = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/")
TOKEN = os.getenv("WORKER_TOKEN", "")
DEFAULT_MODEL = os.getenv("WORKER_MODEL", "gpt-oss:20b")
ALLOWED_MODELS = [
    "gpt-oss:20b",
    "gpt-oss-128k:latest",
    "qwen2.5-coder:14b",
    "qwen3:14b",
    "gemma3:12b",
]

app = FastAPI(title="Tessera Worker", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def require_token(authorization: str | None = Header(default=None)) -> None:
    if not TOKEN:
        return
    expected = f"Bearer {TOKEN}"
    if authorization != expected:
        raise HTTPException(status_code=401, detail="invalid worker token")


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(default_factory=list)
    model: str | None = None
    temperature: float = 0.3
    think: bool = False


class PythonRequest(BaseModel):
    code: str
    timeout: int = 15


class JobRequest(BaseModel):
    prompt: str
    model: str | None = None
    think: bool = True
    timeout: int = 600


@dataclass
class Job:
    id: str
    prompt: str
    model: str
    status: str = "queued"
    result: str = ""
    error: str = ""
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)


JOBS: dict[str, Job] = {}
JOBS_LOCK = threading.Lock()


def pick_model(requested: str | None) -> str:
    if requested and requested in ALLOWED_MODELS:
        return requested
    return DEFAULT_MODEL


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "service": "tessera-worker",
        "model": DEFAULT_MODEL,
        "models": ALLOWED_MODELS,
        "time": time.time(),
    }


@app.get("/api/models", dependencies=[Depends(require_token)])
def models() -> dict[str, Any]:
    return {"models": ALLOWED_MODELS, "default": DEFAULT_MODEL}


@app.post("/api/chat", dependencies=[Depends(require_token)])
async def chat(body: ChatRequest) -> StreamingResponse:
    model = pick_model(body.model)
    payload = {
        "model": model,
        "messages": [m.model_dump() for m in body.messages],
        "stream": True,
        "think": body.think,
        "options": {"temperature": body.temperature},
    }

    async def events():
        try:
            async with httpx.AsyncClient(timeout=None) as client:
                async with client.stream("POST", f"{OLLAMA}/api/chat", json=payload) as response:
                    if response.status_code >= 400:
                        detail = (await response.aread()).decode("utf-8", "replace")
                        yield f"data: {json.dumps({'error': f'Ollama {response.status_code}: {detail[:300]}'})}\n\n"
                        return
                    async for line in response.aiter_lines():
                        if not line.strip():
                            continue
                        try:
                            item = json.loads(line)
                        except json.JSONDecodeError:
                            continue
                        delta = (item.get("message") or {}).get("content") or ""
                        if delta:
                            yield f"data: {json.dumps({'delta': delta})}\n\n"
                        if item.get("done"):
                            break
            yield "data: [DONE]\n\n"
        except Exception as exc:  # pragma: no cover - network failure path
            yield f"data: {json.dumps({'error': str(exc)[:300]})}\n\n"

    return StreamingResponse(events(), media_type="text/event-stream")


@app.post("/api/python", dependencies=[Depends(require_token)])
def run_python(body: PythonRequest) -> dict[str, Any]:
    code = body.code.strip()
    if not code:
        raise HTTPException(status_code=400, detail="code is empty")
    if len(code) > 20000:
        raise HTTPException(status_code=400, detail="code is too long")
    timeout = max(1, min(int(body.timeout or 15), 30))

    with tempfile.TemporaryDirectory(prefix="tessera-py-") as workdir:
        env = {
            "PYTHONIOENCODING": "utf-8",
            "PYTHONUTF8": "1",
            "PATH": os.environ.get("PATH", ""),
            "TEMP": workdir,
            "TMP": workdir,
        }
        started = time.perf_counter()
        try:
            proc = subprocess.run(
                [sys.executable, "-I", "-"],
                input=code,
                text=True,
                capture_output=True,
                timeout=timeout,
                cwd=workdir,
                env=env,
            )
        except subprocess.TimeoutExpired:
            return {
                "ok": False,
                "error": f"timeout after {timeout}s",
                "stdout": "",
                "stderr": "",
                "seconds": round(time.perf_counter() - started, 3),
            }

        return {
            "ok": proc.returncode == 0,
            "returncode": proc.returncode,
            "stdout": proc.stdout[-20000:],
            "stderr": proc.stderr[-20000:],
            "seconds": round(time.perf_counter() - started, 3),
        }


def run_job(job: Job) -> None:
    with JOBS_LOCK:
        job.status = "running"
        job.updated_at = time.time()
    try:
        with httpx.Client(timeout=600) as client:
            response = client.post(
                f"{OLLAMA}/api/chat",
                json={
                    "model": job.model,
                    "messages": [{"role": "user", "content": job.prompt}],
                    "stream": False,
                    "think": True,
                },
            )
            response.raise_for_status()
            data = response.json()
            job.result = (data.get("message") or {}).get("content") or ""
            job.status = "done"
    except Exception as exc:  # pragma: no cover
        job.error = str(exc)[:500]
        job.status = "failed"
    finally:
        job.updated_at = time.time()


@app.post("/api/jobs", dependencies=[Depends(require_token)])
def create_job(body: JobRequest) -> dict[str, Any]:
    prompt = body.prompt.strip()
    if len(prompt) < 3:
        raise HTTPException(status_code=400, detail="prompt is too short")
    job = Job(id=uuid.uuid4().hex, prompt=prompt, model=pick_model(body.model))
    with JOBS_LOCK:
        JOBS[job.id] = job
    thread = threading.Thread(target=run_job, args=(job,), daemon=True)
    thread.start()
    return {"id": job.id, "status": job.status, "model": job.model}


@app.get("/api/jobs/{job_id}", dependencies=[Depends(require_token)])
def get_job(job_id: str) -> dict[str, Any]:
    with JOBS_LOCK:
        job = JOBS.get(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="job not found")
        return {
            "id": job.id,
            "status": job.status,
            "model": job.model,
            "result": job.result,
            "error": job.error,
            "created_at": job.created_at,
            "updated_at": job.updated_at,
        }
