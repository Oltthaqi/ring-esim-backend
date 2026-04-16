import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Reseller } from './reseller.entity';
import { UsersEntity } from '../../users/entitites/users.entity';

export enum BalanceTransactionType {
  TOPUP = 'TOPUP',
  ADJUSTMENT = 'ADJUSTMENT',
  ORDER_DEBIT = 'ORDER_DEBIT',
  ORDER_REFUND = 'ORDER_REFUND',
}

@Entity('balance_transactions')
export class BalanceTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'reseller_id', type: 'char', length: 36 })
  resellerId: string;

  @ManyToOne(() => Reseller)
  @JoinColumn({ name: 'reseller_id' })
  reseller: Reseller;

  @Column({
    type: 'enum',
    enum: BalanceTransactionType,
  })
  type: BalanceTransactionType;

  @Column({ type: 'decimal', precision: 12, scale: 4 })
  amount: string;

  @Column({ name: 'balance_after', type: 'decimal', precision: 12, scale: 4 })
  balanceAfter: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'order_id', type: 'char', length: 36, nullable: true })
  orderId: string | null;

  @Column({ name: 'performed_by', type: 'char', length: 36 })
  performedBy: string;

  @ManyToOne(() => UsersEntity)
  @JoinColumn({ name: 'performed_by' })
  performedByUser: UsersEntity;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}
