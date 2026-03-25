import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { Reseller } from './reseller.entity';
import { PackageTemplate } from '../../package-template/entities/package-template.entity';

export type RetailOverrideMode = 'fixed_retail' | 'markup_percent';

@Entity('reseller_retail_overrides')
@Unique('UQ_reseller_retail_overrides_reseller_package', [
  'resellerId',
  'packageTemplateId',
])
export class ResellerRetailOverride {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'reseller_id', type: 'char', length: 36 })
  resellerId: string;

  @ManyToOne(() => Reseller, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'reseller_id' })
  reseller?: Reseller;

  @Index()
  @Column({ name: 'package_template_id', type: 'char', length: 36 })
  packageTemplateId: string;

  @ManyToOne(() => PackageTemplate, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'package_template_id' })
  packageTemplate?: PackageTemplate;

  @Column({ type: 'varchar', length: 32 })
  mode: RetailOverrideMode;

  @Column({
    name: 'retail_price',
    type: 'decimal',
    precision: 14,
    scale: 4,
    nullable: true,
  })
  retailPrice: string | null;

  @Column({
    name: 'markup_percent',
    type: 'decimal',
    precision: 10,
    scale: 4,
    nullable: true,
  })
  markupPercent: string | null;

  @Column({
    name: 'wholesale_reference_price',
    type: 'decimal',
    precision: 14,
    scale: 4,
    nullable: true,
  })
  wholesaleReferencePrice: string | null;

  @Column({ type: 'varchar', length: 8 })
  currency: string;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
