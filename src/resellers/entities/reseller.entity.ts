import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('resellers')
export class Reseller {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'telco_reseller_id', type: 'int' })
  telcoResellerId: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 8, default: 'EUR' })
  currency: string;

  @Column({
    name: 'contact_email',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  contactEmail: string | null;

  @Column({
    name: 'credit_limit',
    type: 'decimal',
    precision: 14,
    scale: 4,
    nullable: true,
  })
  creditLimit: string | null;

  @Column({
    name: 'internal_ledger_balance',
    type: 'decimal',
    precision: 14,
    scale: 4,
    default: '0.0000',
  })
  balance: string;

  @Column({
    name: 'discount_pct',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: '0.00',
  })
  discountPct: string;

  @Column({
    name: 'allow_debt',
    type: 'boolean',
    default: false,
  })
  allowDebt: boolean;

  @Column({
    name: 'is_active',
    type: 'boolean',
    default: true,
  })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
