import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Reseller } from '../../resellers/entities/reseller.entity';
import { UsersEntity } from '../../users/entitites/users.entity';

export enum ResellerOrderStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

@Entity('reseller_orders')
export class ResellerOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'reseller_id', type: 'char', length: 36 })
  resellerId: string;

  @ManyToOne(() => Reseller)
  @JoinColumn({ name: 'reseller_id' })
  reseller: Reseller;

  @Column({ name: 'user_id', type: 'char', length: 36 })
  userId: string;

  @ManyToOne(() => UsersEntity)
  @JoinColumn({ name: 'user_id' })
  user: UsersEntity;

  @Column({
    type: 'enum',
    enum: ResellerOrderStatus,
    default: ResellerOrderStatus.PENDING,
  })
  status: ResellerOrderStatus;

  @Column({ name: 'upstream_template_id', type: 'int' })
  upstreamTemplateId: number;

  @Column({ name: 'upstream_template_name', type: 'varchar', length: 255 })
  upstreamTemplateName: string;

  @Column({
    name: 'upstream_template_cost',
    type: 'decimal',
    precision: 12,
    scale: 4,
  })
  upstreamTemplateCost: string;

  @Column({ name: 'our_sell_price', type: 'decimal', precision: 12, scale: 4 })
  ourSellPrice: string;

  @Column({
    name: 'discount_pct_applied',
    type: 'decimal',
    precision: 5,
    scale: 2,
  })
  discountPctApplied: string;

  @Column({
    name: 'reseller_price',
    type: 'decimal',
    precision: 12,
    scale: 4,
  })
  resellerPrice: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  iccid: string | null;

  @Column({ name: 'smdp_server', type: 'varchar', length: 255, nullable: true })
  smdpServer: string | null;

  @Column({
    name: 'activation_code',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  activationCode: string | null;

  @Column({ name: 'qr_url', type: 'text', nullable: true })
  qrUrl: string | null;

  @Column({ name: 'subscriber_id', type: 'bigint', nullable: true })
  subscriberId: string | null;

  @Column({ name: 'esim_id', type: 'bigint', nullable: true })
  esimId: string | null;

  @Column({ name: 'subs_package_id', type: 'bigint', nullable: true })
  subsPackageId: string | null;

  @Column({ name: 'upstream_response', type: 'json', nullable: true })
  upstreamResponse: Record<string, unknown> | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ name: 'validity_days', type: 'int', nullable: true })
  validityDays: number | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'refunded_at', type: 'timestamp', nullable: true })
  refundedAt: Date | null;

  @Column({ name: 'refunded_by', type: 'char', length: 36, nullable: true })
  refundedBy: string | null;

  @ManyToOne(() => UsersEntity)
  @JoinColumn({ name: 'refunded_by' })
  refundedByUser: UsersEntity;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
