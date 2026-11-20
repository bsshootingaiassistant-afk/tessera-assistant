import { Module } from '@nestjs/common';
import { ChatController } from './chat/chat.controller';
import { ChatService } from './chat/chat.service';
import { HealthController } from './health.controller';
import { ModulesController } from './modules/modules.controller';

@Module({
  controllers: [ChatController, ModulesController, HealthController],
  providers: [ChatService],
})
export class AppModule {}
