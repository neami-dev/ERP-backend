import {
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    OneToMany,
    Entity,
    Unique,
} from 'typeorm';
import { Company } from 'src/companies/entities/company.entity';

@Entity("categories")
// Scoped to the company. Note: Postgres treats NULLs as distinct, so this
// constraint does not catch two *root* categories with the same name — the
// service checks that case explicitly.
@Unique(['company', 'parent', 'name'])
export class Category {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({
        type: 'varchar',
        length: 255
    })
    name: string;

    @ManyToOne(() => Category, category => category.children, {
        nullable: true,
    })
    @JoinColumn({ name: 'parent_id' })
    parent: Category | null;

    @Column({ name: 'parent_id', nullable: true })
    parentId: string | null;

    @OneToMany(() => Category, category => category.parent)
    children: Category[];

    @Column({
        type: 'text',
        nullable: true,
    })
    description?: string;

    @ManyToOne(() => Company, { nullable: false })
    @JoinColumn({ name: 'company_id' })
    company: Company;

    @Column({ name: 'company_id' })
    companyId: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
