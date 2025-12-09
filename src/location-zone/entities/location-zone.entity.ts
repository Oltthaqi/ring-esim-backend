import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';

@Entity('location_zones')
export class LocationZone {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'bigint' })
  zoneId: string; // BIGINT → string in JS

  @Column({ type: 'varchar', length: 255 })
  zoneName: string;

  @Column({ type: 'json', nullable: true })
  countriesIso2!: string[] | null;

  @Column({ type: 'json', nullable: true })
  countryNames!: string[] | null;
}
