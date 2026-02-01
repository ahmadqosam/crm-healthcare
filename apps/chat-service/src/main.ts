import { NestFactory } from '@nestjs/core';
import { ChatServiceModule } from './chat-service.module';

import { Transport } from '@nestjs/microservices';

async function bootstrap() {
  const app = await NestFactory.create(ChatServiceModule);

  app.connectMicroservice({
    transport: Transport.RMQ,
    options: {
      urls: [`amqp://${process.env.RABBITMQ_USER || 'guest'}:${process.env.RABBITMQ_PASS || 'guest'}@${process.env.RABBITMQ_HOST || 'localhost'}:5672`],
      queue: 'chat_queue',
      noAck: false,
      queueOptions: {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': 'chat_dlx',
          'x-dead-letter-routing-key': 'chat_dlq',
        },
      },
    },
  });

  // Enable CORS/Validation if needed
  app.enableCors({
    origin: ['http://localhost:4000', 'http://localhost:4001', 'http://localhost:3000'],
    credentials: true,
  });

  await app.startAllMicroservices();

  const port = process.env.CHAT_PORT || 3002;
  await app.listen(port, '0.0.0.0');
  console.log(`Chat Service is running on: http://localhost:${port}/graphql`);
}
bootstrap();
