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

@Entity("categories")
@Unique(['parent', 'name'])
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

    @OneToMany(() => Category, category => category.parent)
    children: Category[];

    @Column({
        type: 'text',
        nullable: true,
    })
    description?: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;


}
