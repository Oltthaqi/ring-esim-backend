import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { LocationZone } from '../../location-zone/entities/location-zone.entity';

@Entity('package_templates')
export class PackageTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  packageTemplateId: string;

  @Column({ type: 'varchar', length: 255 })
  packageTemplateName: string;

  @Index()
  @Column({ type: 'bigint' })
  zoneId: string; // FK business key

  @ManyToOne(() => LocationZone, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'zoneId', referencedColumnName: 'zoneId' })
  zone?: LocationZone;

  @Column({ type: 'varchar', length: 255 })
  zoneName: string;

  @Column({ type: 'json', nullable: true })
  countriesIso2: string[] | null;

  @Column({ type: 'int', nullable: true })
  periodDays: number | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  volume: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  price: number | null;

  @Column({ type: 'varchar', length: 8, nullable: true })
  currency: string | null;
}
