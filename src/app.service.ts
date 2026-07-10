import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getApiInfo(): { message: string; version: string; description: string; documentation: string } {
    return {
      message: 'Welcome to the ERP API',
      version: '1.0.0',
      description: 'This is the ERP API built with NestJS',
      documentation: '/api',
    };
  }
}
