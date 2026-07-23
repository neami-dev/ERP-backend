import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryRunner, EntityManager } from 'typeorm';

import { DocumentSequence } from './document-sequence.entity';
import { DocumentType } from './document-type.enum';

@Injectable()
export class DocumentNumberService {
  constructor(
    @InjectRepository(DocumentSequence)
    private readonly sequenceRepo: Repository<DocumentSequence>,
  ) { }

  /**
 * Generates the next document number for a specific company and document type.
 *
 * This method acquires a pessimistic write lock on the document sequence
 * to prevent duplicate document numbers when multiple requests are processed
 * concurrently.
 *
 * Workflow:
 * - Locks the sequence row.
 * - Increments the current sequence number.
 * - Persists the updated sequence.
 * - Formats and returns the generated document number.
 *
 * @param companyId The company identifier.
 * @param documentType The type of document (e.g. Purchase Order, Sales Order).
 * @param queryRunner The active QueryRunner used within the current transaction.
 *
 * @returns A formatted document number (e.g. PO-2026-000001).
 *
 * @throws {NotFoundException} If no document sequence exists for the given
 * company and document type.
 */
  async generate(
    companyId: string,
    documentType: DocumentType,
    queryRunner: QueryRunner,
  ): Promise<string> {

    const sequence = await queryRunner.manager
      .getRepository(DocumentSequence)
      .createQueryBuilder('sequence')
      .setLock('pessimistic_write')
      .where('sequence.company_id = :companyId', { companyId })
      .andWhere('sequence.documentType = :documentType', { documentType })
      .getOne();

    if (!sequence) {
      throw new NotFoundException(
        `Sequence not found for ${documentType}`,
      );
    }

    sequence.currentNumber++;

    await queryRunner.manager.save(sequence);

    return this.format(sequence);
  }

  /**
   * PO-2026-000001
   */
  private format(sequence: DocumentSequence): string {
    const year = new Date().getFullYear();

    const number = sequence.currentNumber
      .toString()
      .padStart(sequence.padding, '0');

    return `${sequence.prefix}-${year}-${number}`;
  }

  async createDefaultSequences(
    companyId: string,
    manager: EntityManager,
  ) {
    const documentTypes = [
      DocumentType.PURCHASE_ORDER,
      DocumentType.SALES_ORDER,
      DocumentType.INVOICE,
    ];

    const sequences = documentTypes.map((type) =>
      manager.create(DocumentSequence, {
        company_id: companyId,
        documentType: type,
        currentNumber: 0,
        prefix: type.charAt(0),
        padding: 6,
      }),
    );

    await manager.save(sequences);
  }
}