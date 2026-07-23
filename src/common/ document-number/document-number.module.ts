import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DocumentSequence } from './document-sequence.entity';
import { DocumentNumberService } from './document-number.service';

@Module({
  imports: [TypeOrmModule.forFeature([DocumentSequence])],
  providers: [DocumentNumberService],
  exports: [DocumentNumberService],
})
export class DocumentNumberModule {}