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
import { NotificationType } from '../enum/notification-type.enum';
import { UsersEntity } from 'src/users/entitites/users.entity';
import { NotificationStatus } from '../enum/notification-status.enum';

@Entity({ name: 'notifications' })
export class NotificationsEntity {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty({ description: 'UUID', type: String })
  id: string;

  @ManyToOne(() => UsersEntity, (user) => user.notifications, {
    eager: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  @ApiProperty({
    description: 'User associated with the notification',
    type: () => UsersEntity,
  })
  user: UsersEntity;

  @Column({ name: 'user_id', type: 'char', length: 36 })
  @ApiProperty({ description: 'User ID', type: String })
  user_id: string;

  @Column({ type: 'varchar', length: 255 })
  @ApiProperty({ description: 'Title of the notification', type: String })
  title: string;

  @Column({ type: 'text' })
  @ApiProperty({ description: 'Body of the notification', type: String })
  body: string;

  @Column({ name: 'device_id', type: 'varchar', length: 255, nullable: true })
  @ApiProperty({ description: 'Device ID for the notification', type: String })
  device_id: string;

  @Column({ type: 'enum', enum: NotificationType, nullable: true })
  @ApiProperty({
    description: 'Type of the notification',
    enum: NotificationType,
  })
  notification_type: NotificationType;

  @Column({
    type: 'enum',
    enum: NotificationStatus,
    default: NotificationStatus.UNREAD,
  })
  @ApiProperty({
    description: 'Status of the notification',
    enum: NotificationStatus,
    default: NotificationStatus.UNREAD,
  })
  status: NotificationStatus;

  @CreateDateColumn({ name: 'created_at' })
  @ApiProperty({ description: 'Created at', type: Date })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  @ApiProperty({ description: 'Updated at', type: Date })
  updated_at: Date;

  @Column({ name: 'is_deleted', type: 'boolean', default: false })
  @ApiProperty({ description: 'Is deleted flag', type: Boolean })
  is_deleted: boolean;
}
