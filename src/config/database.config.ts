
import { TypeOrmModuleAsyncOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

export const DatabaseConfig: TypeOrmModuleAsyncOptions = {
  inject: [ConfigService],

  useFactory: (config: ConfigService) => ({
    type: 'postgres',

    host: config.getOrThrow<string>('DB_HOST'),

    port: config.getOrThrow<number>('DB_PORT'),

    username: config.getOrThrow<string>('DB_USERNAME'),
    password: config.getOrThrow<string>('DB_PASSWORD'),

    database: config.getOrThrow<string>('DB_NAME'),

    autoLoadEntities: true,

    synchronize: true,
  }),
};