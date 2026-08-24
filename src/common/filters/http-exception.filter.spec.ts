import {
  ArgumentsHost,
  BadRequestException,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { HttpExceptionFilter } from './http-exception.filter';

function fakeHost() {
  const response = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const request = { method: 'PUT', url: '/companies/me/logo' };

  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;

  return { host, response };
}

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;

  beforeAll(() => {
    // A deliberately unhandled exception is meant to be logged — silence it
    // here so a passing run stays readable, without hiding the assertions
    // below that check whether logging happened at all.
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    // `jest.spyOn` on an already-spied method returns the same mock rather
    // than a fresh one, so call counts from one test would otherwise leak
    // into the next — this keeps the no-op implementation from `beforeAll`
    // but clears what was recorded.
    jest.clearAllMocks();
  });

  it('keeps the existing shape for an ordinary HttpException', () => {
    const { host, response } = fakeHost();

    filter.catch(new NotFoundException('Company not found'), host);

    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 404,
        error: 'Not Found',
        message: 'Company not found',
      }),
    );
  });

  it('collapses a validation array into one message plus details', () => {
    const { host, response } = fakeHost();

    filter.catch(
      new BadRequestException({
        message: ['ICE must be exactly 15 digits.'],
        error: 'Bad Request',
      }),
      host,
    );

    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'ICE must be exactly 15 digits.',
        details: ['ICE must be exactly 15 digits.'],
      }),
    );
  });

  it('reports an unrecognised error as a plain 500, and logs it', () => {
    const { host, response } = fakeHost();
    const logSpy = jest.spyOn(Logger.prototype, 'error');

    filter.catch(new Error('a real bug'), host);

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        message: 'Internal server error',
      }),
    );
    expect(logSpy).toHaveBeenCalled();
  });

  it('recognises an exposed body-parser error by shape, without HttpException', () => {
    const { host, response } = fakeHost();
    const logSpy = jest.spyOn(Logger.prototype, 'error');

    // What body-parser actually throws when useBodyParser's limit is
    // exceeded: a plain Error with `status`/`expose` bolted on, not a class
    // this filter — or anything else in the app — can `instanceof` against.
    const payloadTooLarge = Object.assign(
      new Error('request entity too large'),
      {
        status: 413,
        expose: true,
        type: 'entity.too.large',
      },
    );

    filter.catch(payloadTooLarge, host);

    expect(response.status).toHaveBeenCalledWith(413);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 413,
        message: 'request entity too large',
      }),
    );
    // This is an expected condition — a client sending too much data — not
    // a defect in this server, so it must not be logged as one.
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('does not trust an exposed error with a non-numeric status', () => {
    const { host, response } = fakeHost();

    const malformed = Object.assign(new Error('odd'), {
      status: 'nope',
      expose: true,
    });

    filter.catch(malformed, host);

    expect(response.status).toHaveBeenCalledWith(500);
  });
});
