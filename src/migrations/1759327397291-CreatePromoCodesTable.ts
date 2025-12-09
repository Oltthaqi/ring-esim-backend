import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreatePromoCodesTable1759327397291 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create promo_codes table
    await queryRunner.createTable(
      new Table({
        name: 'promo_codes',
        columns: [
          {
            name: 'id',
            type: 'char',
            length: '36',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'code',
            type: 'varchar',
            length: '50',
            isUnique: true,
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'percent_off',
            type: 'numeric',
            precision: 5,
            scale: 2,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['ACTIVE', 'INACTIVE'],
            default: "'ACTIVE'",
          },
          {
            name: 'start_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'end_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'created_by',
            type: 'char',
            length: '36',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Note: The unique constraint on 'code' column handles uniqueness
    // Case-insensitive comparison is handled in the service layer
    // by normalizing codes to uppercase before storage

    // Create composite index on (status, start_at, end_at) for validation queries
    await queryRunner.createIndex(
      'promo_codes',
      new TableIndex({
        name: 'IDX_promo_codes_status_dates',
        columnNames: ['status', 'start_at', 'end_at'],
      }),
    );

    // Add foreign key to users table (created_by)
    await queryRunner.query(
      `ALTER TABLE \`promo_codes\` ADD CONSTRAINT \`FK_promo_codes_created_by\` 
       FOREIGN KEY (\`created_by\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key
    await queryRunner.query(
      `ALTER TABLE \`promo_codes\` DROP FOREIGN KEY \`FK_promo_codes_created_by\``,
    );

    // Drop indexes
    await queryRunner.dropIndex('promo_codes', 'IDX_promo_codes_status_dates');

    // Drop table
    await queryRunner.dropTable('promo_codes');
  }
}
