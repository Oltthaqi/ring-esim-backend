import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Gender } from '../enums/gender.enum';
import { VerificationEntity } from './verification.entity';
import { Status } from 'src/common/enums/status.enum';
import { Role } from '../enums/role.enum';
import { NotificationsEntity } from 'src/notifications/entities/notification.entity';

@Entity({ name: 'users' })
export class UsersEntity {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty({
    description: 'User UUID',
    type: String,
  })
  id: string;

  @Column({ type: 'varchar', nullable: true, default: null })
  @ApiProperty({
    description: 'The first name',
    type: String,
  })
  first_name: string;

  @Column({ type: 'varchar', nullable: true, default: null })
  @ApiProperty({
    description: 'The last name',
    type: String,
  })
  last_name: string;

  @Column({ type: 'varchar', nullable: true, default: null })
  @ApiProperty({
    description: 'The email',
    type: String,
  })
  email: string;

  @Column({ type: 'varchar', nullable: true, default: null })
  @ApiProperty({
    description: 'The phone number',
    type: String,
  })
  phone_number: string;

  @Column({ type: 'enum', enum: Gender, nullable: true, default: null })
  @ApiProperty({
    description: 'The gender',
    enum: Gender,
  })
  gender: Gender;

  @Column({ type: 'varchar', nullable: true, default: null })
  @ApiProperty({
    description: 'The password',
    type: String,
  })
  password: string;

  @Column({ type: 'boolean', nullable: true, default: null })
  @ApiProperty({
    description: 'The is verified',
    type: Boolean,
  })
  is_verified: boolean;

  @Column({ type: 'enum', enum: Status, default: Status.ACTIVE })
  @ApiProperty({
    description: 'The status',
    enum: Status,
  })
  status: Status;
  @OneToMany(() => VerificationEntity, (verification) => verification.user)
  verificationCodes: VerificationEntity[];

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

  @Column({
    type: 'enum',
    enum: Role,
    default: Role.USER,
  })
  @ApiProperty({
    description: 'The role of the user',
    enum: Role,
  })
  role: Role;
  @OneToMany(() => NotificationsEntity, (notification) => notification.user)
  notifications: NotificationsEntity[];
}
