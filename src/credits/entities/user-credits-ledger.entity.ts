import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { UsersEntity } from '../../users/entitites/users.entity';
import { Order } from '../../orders/entities/order.entity';

export enum CreditLedgerType {
  RESERVATION = 'RESERVATION',
  DEBIT = 'DEBIT',
  CREDIT = 'CREDIT',
  RELEASE = 'RELEASE',
  ADJUSTMENT = 'ADJUSTMENT',
  EXPIRE = 'EXPIRE',
}

@Entity('user_credits_ledger')
export class UserCreditsLedger {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'char', length: 36 })
  user_id: string;

  @Column({ type: 'enum', enum: CreditLedgerType })
  type: CreditLedgerType;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'char', length: 3, default: 'EUR' })
  currency: string;

  @Column({ type: 'char', length: 36, nullable: true })
  order_id: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  stripe_payment_intent_id: string | null;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => UsersEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UsersEntity;

  @ManyToOne(() => Order, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'order_id' })
  order: Order;
}
