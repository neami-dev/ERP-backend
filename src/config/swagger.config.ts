
import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule, getSchemaPath } from '@nestjs/swagger';

import { ApiErrorDto } from 'src/common/dto/api-error.dto';

export function setupSwagger(app: INestApplication) {
  const errorResponse = (description: string) => ({
    description,
    schema: { $ref: getSchemaPath(ApiErrorDto) },
  });

  const config = new DocumentBuilder()
    .setTitle('ERP API')
    .setDescription(
      [
        'ERP REST API.',
        '',
        '**Authentication.** Every route needs `Authorization: Bearer <token>`,',
        'except `POST /auth/signup`, `POST /auth/login` and `GET /`.',
        'Get a token from signup or login, then press **Authorize** above.',
        '',
        '**Multi-company.** The token carries your `companyId`. You only ever see',
        'and change data of your own company — never send a company id in a body.',
        '',
        '**Lists** return `{ data, meta: { page, limit, total, totalPages } }`.',
        '',
        '**Errors** always have the same shape: `statusCode`, `error`, `message`',
        '(always one string), optional `details` for validation, `path`, `timestamp`.',
      ].join('\n'),
    )
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
    // Declared once here rather than on 51 handlers: every route can answer
    // these, and they all share the one error shape.
    .addGlobalResponse(
      { status: 400, ...errorResponse('Invalid input.') },
      { status: 401, ...errorResponse('Missing, invalid or expired token.') },
      { status: 404, ...errorResponse('Not found, or not in your company.') },
      { status: 500, ...errorResponse('Unexpected server error.') },
    )
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    extraModels: [ApiErrorDto],
  });

  SwaggerModule.setup('api', app, document, {
    swaggerOptions: {
      // Keeps the token after a page reload, so you do not have to paste it
      // again on every refresh.
      persistAuthorization: true,
    },
  });
}
