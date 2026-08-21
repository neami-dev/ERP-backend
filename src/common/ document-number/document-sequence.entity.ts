import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { DocumentType } from "./document-type.enum";
import { Company } from "src/companies/entities/company.entity";

@Index(['company_id', 'documentType'], {
  unique: true,
})
@Entity('document_sequences')
export class DocumentSequence {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: DocumentType,
  })
  documentType: DocumentType;

  @Column()
  prefix: string;

  @Column({ default: 0 })
  currentNumber: number;

  @Column({ default: 6 })
  padding: number;

  @ManyToOne(() => Company, (company) => company.documentSequences, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'company_id' })
  company: Company;
  @Column('uuid')
  company_id: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}