import { Body, Controller, Get, Post } from '@nestjs/common';

interface ValidateRequest {
  endpoint?: string;
  token?: string;
  headers?: Record<string, string>;
}

@Controller('modules')
export class ModulesController {
  @Get()
  catalog() {
    return {
      kinds: [
        { id: 'rest', label: 'REST API', description: 'HTTP-сервис с токеном или без.' },
        { id: 'webhook', label: 'Webhook', description: 'Приём событий по URL.' },
        { id: 'oauth', label: 'OAuth', description: 'Вход через сторонний аккаунт.' },
        { id: 'mcp', label: 'MCP', description: 'Сервер инструментов Model Context Protocol.' },
        { id: 'builtin', label: 'Встроенный', description: 'Локальный коннектор Tessera.' },
      ],
    };
  }

  @Post('validate')
  async validate(@Body() body: ValidateRequest) {
    if (!body?.endpoint) {
      return { ok: false, status: 0, message: 'Endpoint не указан.' };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    try {
      const headers: Record<string, string> = {
        Accept: 'application/json',
        ...(body.headers ?? {}),
      };
      if (body.token) headers.Authorization = `Bearer ${body.token}`;

      const response = await fetch(body.endpoint, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      return {
        ok: response.ok,
        status: response.status,
        message: response.ok
          ? `Сервис ответил ${response.status}.`
          : `Сервис ответил ${response.status}. Проверьте токен и права.`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        ok: false,
        status: 0,
        message: message.includes('abort')
          ? 'Таймаут: сервис не ответил за 8 секунд.'
          : 'Не удалось подключиться к endpoint.',
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
