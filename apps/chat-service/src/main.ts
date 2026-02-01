import { NestFactory } from '@nestjs/core';
import { ChatServiceModule } from './chat-service.module';

async function bootstrap() {
  const app = await NestFactory.create(ChatServiceModule);
  // Enable CORS/Validation if needed
  app.enableCors({
    origin: ['http://localhost:4000', 'http://localhost:4001', 'http://localhost:3000'],
    credentials: true,
  });

  const port = process.env.CHAT_PORT || 3002;
  await app.listen(port);
  console.log(`Chat Service is running on: http://localhost:${port}/graphql`);
}
bootstrap();
