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
import { UsersEntity } from '../../users/entitites/users.entity';

@Entity('package_visibility')
export class PackageVisibility {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ name: 'upstream_template_id', type: 'int' })
  upstreamTemplateId: number;

  @Column({ type: 'boolean', default: false })
  hidden: boolean;

  @Column({ name: 'updated_by', type: 'char', length: 36 })
  updatedBy: string;

  @ManyToOne(() => UsersEntity)
  @JoinColumn({ name: 'updated_by' })
  updatedByUser: UsersEntity;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
