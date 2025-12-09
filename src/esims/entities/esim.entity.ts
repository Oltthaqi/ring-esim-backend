import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('esims')
export class Esim {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'bigint', unique: true })
  subscriberId: number;

  @Column({ type: 'varchar', length: 20, nullable: true })
  imsi: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  iccid: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phoneNumber: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  smdpServer: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  activationCode: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  batchId: string | null;

  @Column({ type: 'int' })
  accountId: number;

  @Column({ type: 'int' })
  resellerId: number;

  @Column({ type: 'boolean', default: true })
  prepaid: boolean;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  balance: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  simStatus: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  status: string | null;

  @Column({ type: 'timestamp', nullable: true })
  activationDate: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
