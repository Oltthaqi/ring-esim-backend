import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('upstream_api_logs')
export class UpstreamApiLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'method_name', type: 'varchar', length: 100 })
  methodName: string;

  @Column({ name: 'request_body', type: 'json', nullable: true })
  requestBody: Record<string, unknown> | null;

  @Column({ name: 'response_body', type: 'json', nullable: true })
  responseBody: Record<string, unknown> | null;

  @Column({ name: 'status_code', type: 'int', nullable: true })
  statusCode: number | null;

  @Column({ name: 'duration_ms', type: 'int', nullable: true })
  durationMs: number | null;

  @Column({
    name: 'reseller_order_id',
    type: 'char',
    length: 36,
    nullable: true,
  })
  resellerOrderId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}
