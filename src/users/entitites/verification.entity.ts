import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UsersEntity } from './users.entity';

@Entity({ name: 'verification' })
export class VerificationEntity {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty({
    description: 'User UUID',
    type: String,
  })
  id: string;

  @Column({ type: 'varchar', nullable: true, default: null })
  @ApiProperty({
    description: 'The email address',
    type: String,
  })
  email: string;

  @Column({ type: 'varchar', nullable: true, default: null })
  @ApiProperty({
    description: 'The code',
    type: String,
  })
  code: string;

  @ManyToOne(() => UsersEntity, (user) => user.verificationCodes, {
    eager: true,
  })
  @JoinColumn({ name: 'user_id' })
  @ApiProperty({ description: 'Related user entity' })
  user: UsersEntity;

  @Column({ name: 'user_id', type: 'char', length: 36 })
  user_id: string;

  @CreateDateColumn()
  @ApiProperty({ description: 'Created at', type: Date })
  created_at: Date;

  @UpdateDateColumn()
  @ApiProperty({ description: 'Updated at', type: Date })
  updated_at: Date;

  @Column({ type: 'boolean', nullable: true, default: null })
  @ApiProperty({
    description: 'The is deleted',
    type: Boolean,
  })
  is_deleted: boolean;

  @Column({ type: 'timestamp', nullable: true, default: null })
  @ApiProperty({ description: 'Expiration time for the code', type: Date })
  expires_at: Date;
}
