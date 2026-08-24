import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * The one error shape the API ever returns.
 *
 * Nest's defaults are close but not consistent: a 401 raised with no message
 * omits `error`, and validation failures put an **array** in `message` while
 * every other error puts a **string** there. A frontend then has to branch on
 * the type of `message` before it can show anything.
 *
 * Here `message` is always a single human-readable string, and the per-field
 * validation messages move to `details`.
 */
export interface ApiErrorResponse {
  statusCode: number;
  error: string;
  message: string;
  /** Per-field validation messages. Present only on a 400 from the ValidationPipe. */
  details?: string[];
  path: string;
  timestamp: string;
}

/**
 * Node's HTTP-adjacent errors (body-parser among them) attach `status` and
 * `expose` to a plain `Error` rather than throwing a class this filter could
 * `instanceof` against — this is the narrowest check that reaches them.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // A request over `useBodyParser`'s limit throws before Nest's routing
    // ever runs, so it can never become an HttpException — but body-parser
    // marks it `expose: true`, its own way of saying "safe to show the
    // client", same as Nest's HttpException is for everything below it. Not
    // recognising this shape would report a client sending too much data as
    // a 500 bug in this server, and log it as one.
    const isExposedHttpError =
      isRecord(exception) &&
      exception.expose === true &&
      typeof exception.status === 'number';

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : isExposedHttpError
          ? (exception.status as number)
          : HttpStatus.INTERNAL_SERVER_ERROR;

    const { message, details, error } = this.describe(exception, status);

    // Anything that is neither a deliberate HttpException nor one of the few
    // errors above is a bug, not a rejected request — log the whole thing so
    // it is not lost behind a generic 500.
    if (!(exception instanceof HttpException) && !isExposedHttpError) {
      this.logger.error(
        `Unhandled error on ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: ApiErrorResponse = {
      statusCode: status,
      error,
      message,
      ...(details && { details }),
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    response.status(status).json(body);
  }

  private describe(exception: unknown, status: number) {
    const error = this.reasonPhrase(status);

    if (isRecord(exception) && exception.expose === true) {
      // body-parser's own message is already written for a client — unlike
      // an arbitrary thrown Error, it was explicitly marked safe to show.
      const message =
        typeof exception.message === 'string'
          ? exception.message
          : 'Request could not be processed.';

      return { message, details: undefined, error };
    }

    if (!(exception instanceof HttpException)) {
      // Never leak an internal stack or driver message to the client.
      return { message: 'Internal server error', details: undefined, error };
    }

    const payload = exception.getResponse();

    if (typeof payload === 'string') {
      return { message: payload, details: undefined, error };
    }

    const record = payload as Record<string, unknown>;
    const rawMessage = record.message;

    // The ValidationPipe puts one string per broken rule in an array.
    if (Array.isArray(rawMessage)) {
      const details = rawMessage.map(String);

      return {
        message:
          details.length === 1
            ? details[0]
            : `Validation failed: ${details.length} problems`,
        details,
        error: typeof record.error === 'string' ? record.error : error,
      };
    }

    return {
      message: typeof rawMessage === 'string' ? rawMessage : exception.message,
      details: undefined,
      error: typeof record.error === 'string' ? record.error : error,
    };
  }

  private reasonPhrase(status: number): string {
    const name = Object.keys(HttpStatus).find(
      (key) => HttpStatus[key as keyof typeof HttpStatus] === status,
    );

    if (!name) {
      return 'Error';
    }

    // BAD_REQUEST -> Bad Request
    return name
      .toLowerCase()
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}
