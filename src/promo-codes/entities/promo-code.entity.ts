import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { UsersEntity } from '../../users/entitites/users.entity';

export enum PromoCodeStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

@Entity('promo_codes')
export class PromoCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'numeric', precision: 5, scale: 2 })
  percent_off: number;

  @Column({
    type: 'enum',
    enum: PromoCodeStatus,
    default: PromoCodeStatus.ACTIVE,
  })
  status: PromoCodeStatus;

  @Column({ type: 'timestamp', nullable: true })
  start_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  end_at: Date | null;

  @ManyToOne(() => UsersEntity, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdBy: UsersEntity;

  @Column({ type: 'char', length: '36', nullable: true })
  created_by: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
