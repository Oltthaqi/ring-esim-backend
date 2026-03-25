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

  @Index({ unique: true })
  @Column({ name: 'telco_reseller_id', type: 'int' })
  telcoResellerId: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 8, default: 'EUR' })
  currency: string;

  @Column({ name: 'contact_email', type: 'varchar', length: 255, nullable: true })
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
  internalLedgerBalance: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
