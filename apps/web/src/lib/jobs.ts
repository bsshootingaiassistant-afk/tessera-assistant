import { RemoteJob, Settings } from '../types';
import { normalizeBase } from './utils';

const KEY = 'tessera.jobs.v1';

export function loadJobs(): RemoteJob[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RemoteJob[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveJobs(jobs: RemoteJob[]): void {
  localStorage.setItem(KEY, JSON.stringify(jobs.slice(0, 50)));
}

export function workerReady(settings: Settings): boolean {
  return Boolean(normalizeBase(settings.apiBase) && settings.apiKey.trim());
}

export async function submitJob(settings: Settings, prompt: string): Promise<RemoteJob> {
  const base = normalizeBase(settings.apiBase);
  if (!base) throw new Error('Укажите Base URL сервера в настройках.');
  if (!settings.apiKey.trim()) throw new Error('Укажите API-ключ worker-а в настройках.');

  const response = await fetch(`${base}/api/jobs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      prompt,
      model: settings.model,
      think: true,
      timeout: 600,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Worker ${response.status}: ${detail.slice(0, 200)}`);
  }

  const data = (await response.json()) as { id: string; status: RemoteJob['status']; model: string };
  return {
    id: data.id,
    prompt,
    model: data.model ?? settings.model,
    status: data.status ?? 'queued',
    result: '',
    error: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export async function fetchJob(settings: Settings, id: string): Promise<Partial<RemoteJob>> {
  const base = normalizeBase(settings.apiBase);
  const response = await fetch(`${base}/api/jobs/${id}`, {
    headers: { Authorization: `Bearer ${settings.apiKey}` },
  });
  if (!response.ok) throw new Error(`Worker ${response.status}`);
  return (await response.json()) as Partial<RemoteJob>;
}
