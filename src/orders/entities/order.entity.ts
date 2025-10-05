import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { UsersEntity } from '../../users/entitites/users.entity';
import { PackageTemplate } from '../../package-template/entities/package-template.entity';
import { Usage } from '../../usage/entities/usage.entity';
import { PromoCode } from '../../promo-codes/entities/promo-code.entity';

export enum OrderStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum OrderType {
  ONE_TIME = 'one_time',
  RECURRING = 'recurring',
  TOPUP = 'topup',
}

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  orderNumber: string;

  @Column()
  userId: string;

  @ManyToOne(() => UsersEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: UsersEntity;

  @Column()
  packageTemplateId: string;

  @ManyToOne(() => PackageTemplate, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'packageTemplateId' })
  packageTemplate: PackageTemplate;

  @Column({
    type: 'enum',
    enum: OrderType,
    default: OrderType.ONE_TIME,
  })
  orderType: OrderType;

  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.PENDING,
  })
  status: OrderStatus;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', length: 8, default: 'USD' })
  currency: string;

  // Subscriber information
  @Column({ type: 'bigint', nullable: true })
  subscriberId: number;

  @Column({ type: 'varchar', length: 20, nullable: true })
  imsi: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  iccid: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  msisdn: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  activationCode: string;

  // Package configuration
  @Column({ type: 'int', nullable: true })
  validityPeriod: number; // in days

  @Column({ type: 'timestamp', nullable: true })
  activePeriodStart: Date;

  @Column({ type: 'timestamp', nullable: true })
  activePeriodEnd: Date;

  // Recurring package specific fields
  @Column({ type: 'timestamp', nullable: true })
  startTimeUTC: Date;

  @Column({ type: 'boolean', default: false })
  activationAtFirstUse: boolean;

  // OCS Response data
  @Column({ type: 'json', nullable: true })
  ocsResponse: any;

  @Column({ type: 'bigint', nullable: true })
  subsPackageId: number;

  @Column({ type: 'bigint', nullable: true })
  esimId: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  smdpServer: string;

  @Column({ type: 'text', nullable: true })
  urlQrCode: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  userSimName: string;

  // Error handling
  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  @Column({ type: 'json', nullable: true })
  errorDetails: any;

  // Payment information
  @Column({ nullable: true })
  paymentIntentId: string;

  @Column({
    type: 'enum',
    enum: ['pending', 'processing', 'succeeded', 'failed', 'canceled'],
    nullable: true,
  })
  paymentStatus: string;

  // Promo code pricing fields
  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  subtotal_amount: number | null;

  @ManyToOne(() => PromoCode, { nullable: true })
  @JoinColumn({ name: 'promo_code_id' })
  promoCode: PromoCode;

  @Column({ type: 'char', length: '36', nullable: true })
  promo_code_id: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  promo_code_code: string | null;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  discount_percent: number | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0.0 })
  discount_amount: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  total_amount: number | null;

  // Usage tracking relationship
  @OneToMany(() => Usage, (usage) => usage.order)
  usage: Usage[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
