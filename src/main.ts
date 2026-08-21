import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

import { setupSwagger } from './config/swagger.config';
import { ValidationPipe } from '@nestjs/common';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3001',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Gives every error the same shape, whatever raised it.
  app.useGlobalFilters(new HttpExceptionFilter());

  setupSwagger(app);

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
