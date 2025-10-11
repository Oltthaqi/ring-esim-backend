import {
  Entity,
  Column,
  PrimaryColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { UsersEntity } from '../../users/entitites/users.entity';

@Entity('user_credits_balances')
export class UserCreditsBalance {
  @PrimaryColumn({ type: 'char', length: 36 })
  user_id: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0.0 })
  balance: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0.0 })
  lifetime_earned: number;

  @Column({ type: 'char', length: 3, default: 'EUR' })
  currency: string;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => UsersEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UsersEntity;
}
