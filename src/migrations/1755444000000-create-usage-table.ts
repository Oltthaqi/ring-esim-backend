import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableIndex,
  TableForeignKey,
} from 'typeorm';

export class CreateUsageTable1755444000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'usage',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: '(UUID())',
          },
          {
            name: 'orderId',
            type: 'varchar',
            length: '36',
          },
          {
            name: 'subscriberId',
            type: 'bigint',
          },
          {
            name: 'imsi',
            type: 'varchar',
            length: '20',
            isNullable: true,
          },
          {
            name: 'iccid',
            type: 'varchar',
            length: '20',
            isNullable: true,
          },
          {
            name: 'msisdn',
            type: 'varchar',
            length: '20',
            isNullable: true,
          },
          {
            name: 'totalDataUsed',
            type: 'decimal',
            precision: 15,
            scale: 0,
            default: 0,
          },
          {
            name: 'totalDataAllowed',
            type: 'decimal',
            precision: 15,
            scale: 0,
            default: 0,
          },
          {
            name: 'totalDataRemaining',
            type: 'decimal',
            precision: 15,
            scale: 0,
            default: 0,
          },
          {
            name: 'totalCallDuration',
            type: 'int',
            default: 0,
          },
          {
            name: 'totalSmsCount',
            type: 'int',
            default: 0,
          },
          {
            name: 'totalResellerCost',
            type: 'decimal',
            precision: 12,
            scale: 6,
            default: 0,
          },
          {
            name: 'totalSubscriberCost',
            type: 'decimal',
            precision: 12,
            scale: 6,
            default: 0,
          },
          {
            name: 'firstUsageDate',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'lastUsageDate',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'packageStartDate',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'packageEndDate',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'isActive',
            type: 'boolean',
            default: true,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '50',
            default: "'active'",
          },
          {
            name: 'lastSyncedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'lastUsageCountry',
            type: 'varchar',
            length: '3',
            isNullable: true,
          },
          {
            name: 'lastUsageMcc',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'lastUsageMnc',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'lastUsageOperator',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'lastOcsResponse',
            type: 'json',
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
    );

    // Create indexes
    await queryRunner.createIndex(
      'usage',
      new TableIndex({
        name: 'IDX_USAGE_ORDER_ID',
        columnNames: ['orderId'],
      }),
    );

    await queryRunner.createIndex(
      'usage',
      new TableIndex({
        name: 'IDX_USAGE_SUBSCRIBER_ID',
        columnNames: ['subscriberId'],
      }),
    );

    await queryRunner.createIndex(
      'usage',
      new TableIndex({
        name: 'IDX_USAGE_ICCID',
        columnNames: ['iccid'],
      }),
    );

    await queryRunner.createIndex(
      'usage',
      new TableIndex({
        name: 'IDX_USAGE_IS_ACTIVE',
        columnNames: ['isActive'],
      }),
    );

    await queryRunner.createIndex(
      'usage',
      new TableIndex({
        name: 'IDX_USAGE_STATUS',
        columnNames: ['status'],
      }),
    );

    await queryRunner.createIndex(
      'usage',
      new TableIndex({
        name: 'IDX_USAGE_LAST_SYNCED_AT',
        columnNames: ['lastSyncedAt'],
      }),
    );

    // Create foreign key constraint
    await queryRunner.createForeignKey(
      'usage',
      new TableForeignKey({
        columnNames: ['orderId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'orders',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key first
    const table = await queryRunner.getTable('usage');
    const foreignKey = table!.foreignKeys.find(
      (fk) => fk.columnNames.indexOf('orderId') !== -1,
    );
    if (foreignKey) {
      await queryRunner.dropForeignKey('usage', foreignKey);
    }

    // Drop indexes
    await queryRunner.dropIndex('usage', 'IDX_USAGE_ORDER_ID');
    await queryRunner.dropIndex('usage', 'IDX_USAGE_SUBSCRIBER_ID');
    await queryRunner.dropIndex('usage', 'IDX_USAGE_ICCID');
    await queryRunner.dropIndex('usage', 'IDX_USAGE_IS_ACTIVE');
    await queryRunner.dropIndex('usage', 'IDX_USAGE_STATUS');
    await queryRunner.dropIndex('usage', 'IDX_USAGE_LAST_SYNCED_AT');

    // Drop table
    await queryRunner.dropTable('usage');
  }
}
