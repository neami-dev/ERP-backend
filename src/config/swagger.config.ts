
import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('ERP API')
    .setDescription('ERP REST API Documentation')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter JWT token',
      },
      'access_token',
    )
    // Applies the bearer scheme to every documented route, mirroring the
    // global AuthGuard. Without this the lock icon would only appear on the
    // controllers that remembered to add @ApiBearerAuth().
    .addSecurityRequirements('access_token')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api', app, document, {
    swaggerOptions: {
      // Keeps the token after a page reload, so you do not have to paste it
      // again on every refresh.
      persistAuthorization: true,
    },
  });
}