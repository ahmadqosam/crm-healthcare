import { NestFactory } from '@nestjs/core';
import { AuthServiceModule } from './auth-service.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AuthServiceModule);
  app.useGlobalPipes(new ValidationPipe());

  const port = process.env.AUTH_PORT || 3001;
  await app.listen(port);
  console.log(`Auth Service is running on: http://localhost:${port}/graphql`);
}
bootstrap();
