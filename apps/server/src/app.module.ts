import { Module } from '@nestjs/common';
import { ChatController } from './chat/chat.controller';
import { ChatService } from './chat/chat.service';
import { FeedbackController } from './feedback/feedback.controller';
import { HealthController } from './health.controller';
import { ModulesController } from './modules/modules.controller';

@Module({
  controllers: [ChatController, ModulesController, FeedbackController, HealthController],
  providers: [ChatService],
})
export class AppModule {}
