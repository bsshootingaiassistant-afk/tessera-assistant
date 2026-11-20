import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      ok: true,
      service: 'tessera-api',
      time: new Date().toISOString(),
      llm: process.env.OPENAI_API_KEY ? 'configured' : 'offline-fallback',
    };
  }
}
