import { NestFactory } from '@nestjs/core';
import { GatewayModule } from './gateway.module';

async function bootstrap() {
  const app = await NestFactory.create(GatewayModule);
  // Gateway typically runs on 3000
  app.enableCors({
    origin: true, // Allow all origins with credentials for development
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Accept, Authorization',
  });
  await app.listen(3000, '0.0.0.0');
  console.log(`Gateway is running on: http://localhost:3000/graphql`);
}
bootstrap();
