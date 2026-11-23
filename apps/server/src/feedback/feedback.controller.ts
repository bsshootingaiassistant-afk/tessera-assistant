import { Body, Controller, HttpStatus, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

interface FeedbackBody {
  id?: string;
  kind?: string;
  message?: string;
  contact?: string;
  page?: string;
  diagnostics?: Record<string, unknown>;
}

@Controller('feedback')
export class FeedbackController {
  @Post()
  async create(@Body() body: FeedbackBody, @Res() res: Response): Promise<void> {
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    if (message.length < 5 || message.length > 4000) {
      res.status(HttpStatus.BAD_REQUEST).json({ error: 'message must be 5..4000 characters' });
      return;
    }

    const entry = {
      id: body.id ?? `feedback_${Date.now()}`,
      kind: body.kind ?? 'other',
      message,
      contact: typeof body.contact === 'string' ? body.contact.slice(0, 200) : '',
      page: typeof body.page === 'string' ? body.page.slice(0, 120) : '',
      diagnostics: body.diagnostics ?? {},
      receivedAt: new Date().toISOString(),
    };

    try {
      const dir = process.env.FEEDBACK_DIR ?? path.join(process.cwd(), 'data');
      await mkdir(dir, { recursive: true });
      await appendFile(path.join(dir, 'feedback.ndjson'), `${JSON.stringify(entry)}\n`, 'utf8');
      res.status(HttpStatus.CREATED).json({ ok: true, id: entry.id });
    } catch {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: 'failed to store feedback' });
    }
  }
}
