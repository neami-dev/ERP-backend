import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

import { setupSwagger } from './config/swagger.config';
import { ValidationPipe } from '@nestjs/common';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  // The default body parser is disabled here so it can be reinstalled below
  // with a higher limit. Registering a second parser on top of the default
  // one would not work: Nest installs the default before any module or
  // route runs, so a 512 KB logo would already have been rejected — with a
  // bare Express error, not the API's error shape — before this line had a
  // chance to matter.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });

  // 2 MB is a backstop, not the real limit: a base64 logo is capped at ~700 KB
  // by UploadCompanyLogoDto, which answers a clean 400. This only exists so
  // that boundary is reachable at all, and stays generous enough that no
  // other endpoint's body should ever come near it.
  app.useBodyParser('json', { limit: '2mb' });
  app.useBodyParser('urlencoded', { extended: true, limit: '2mb' });

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
