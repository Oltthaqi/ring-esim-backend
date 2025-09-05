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
import { Order } from '../../orders/entities/order.entity';

export enum UsageType {
  MOC = 1, // Mobile Originated Call
  MTC = 15, // Mobile Terminated Call
  MO_SMS = 21, // Mobile Originated SMS
  MT_SMS = 22, // Mobile Terminated SMS
  DATA = 33, // Data usage
  MOC_VOIP = 40, // Mobile Originated VoIP Call
  MTC_VOIP = 41, // Mobile Terminated VoIP Call
}

@Entity('usage')
export class Usage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Link to the order that created this subscription
  @Column()
  orderId: string;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  // Subscriber identification
  @Index()
  @Column({ type: 'bigint' })
  subscriberId: number;

  @Column({ type: 'varchar', length: 20, nullable: true })
  imsi: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  iccid: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  msisdn: string | null;

  // Usage tracking
  @Column({ type: 'decimal', precision: 15, scale: 0, default: 0 })
  totalDataUsed: number; // in bytes

  @Column({ type: 'decimal', precision: 15, scale: 0, default: 0 })
  totalDataAllowed: number; // package limit in bytes

  @Column({ type: 'decimal', precision: 15, scale: 0, default: 0 })
  totalDataRemaining: number; // remaining data in bytes

  @Column({ type: 'int', default: 0 })
  totalCallDuration: number; // in seconds

  @Column({ type: 'int', default: 0 })
  totalSmsCount: number;

  // Cost tracking
  @Column({ type: 'decimal', precision: 12, scale: 6, default: 0 })
  totalResellerCost: number;

  @Column({ type: 'decimal', precision: 12, scale: 6, default: 0 })
  totalSubscriberCost: number;

  // Period tracking
  @Column({ type: 'timestamp', nullable: true })
  firstUsageDate: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  lastUsageDate: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  packageStartDate: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  packageEndDate: Date | null;

  // Status
  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'varchar', length: 50, default: 'active' })
  status: string; // active, expired, suspended, etc.

  // Last sync with OCS
  @Column({ type: 'timestamp', nullable: true })
  lastSyncedAt: Date | null;

  // Country and operator info from last usage
  @Column({ type: 'varchar', length: 3, nullable: true })
  lastUsageCountry: string | null; // country alpha2 code

  @Column({ type: 'int', nullable: true })
  lastUsageMcc: number | null; // Mobile Country Code

  @Column({ type: 'int', nullable: true })
  lastUsageMnc: number | null; // Mobile Network Code

  @Column({ type: 'varchar', length: 255, nullable: true })
  lastUsageOperator: string | null;

  // Raw OCS response for debugging
  @Column({ type: 'json', nullable: true })
  lastOcsResponse: any;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
