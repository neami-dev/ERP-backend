import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

export const DATABASE_CONNECTION = 'DATABASE_CONNECTION';

export const databaseProvider: Provider = {
  provide: DATABASE_CONNECTION,

  inject: [ConfigService],

  useFactory: (configService: ConfigService) => {
    const connectionString = configService.get<string>('database.url');

    const client = postgres(connectionString!);

    return drizzle(client);
  },
};