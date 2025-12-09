import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableIndex,
  TableForeignKey,
} from 'typeorm';

export class CreateOrders1754800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'orders',
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
            name: 'orderNumber',
            type: 'varchar',
            length: '50',
            isUnique: true,
          },
          {
            name: 'userId',
            type: 'varchar',
            length: '36',
          },
          {
            name: 'packageTemplateId',
            type: 'varchar',
            length: '36',
          },
          {
            name: 'orderType',
            type: 'enum',
            enum: ['one_time', 'recurring'],
            default: "'one_time'",
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
            default: "'pending'",
          },
          {
            name: 'amount',
            type: 'decimal',
            precision: 12,
            scale: 2,
          },
          {
            name: 'currency',
            type: 'varchar',
            length: '8',
            default: "'USD'",
          },
          {
            name: 'subscriberId',
            type: 'bigint',
            isNullable: true,
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
            name: 'activationCode',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'validityPeriod',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'activePeriodStart',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'activePeriodEnd',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'startTimeUTC',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'activationAtFirstUse',
            type: 'boolean',
            default: false,
          },
          {
            name: 'ocsResponse',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'subsPackageId',
            type: 'bigint',
            isNullable: true,
          },
          {
            name: 'esimId',
            type: 'bigint',
            isNullable: true,
          },
          {
            name: 'smdpServer',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'urlQrCode',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'userSimName',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'errorMessage',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'errorDetails',
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
      true,
    );

    // Create indexes
    await queryRunner.createIndex(
      'orders',
      new TableIndex({
        name: 'IDX_ORDERS_USER_ID',
        columnNames: ['userId'],
      }),
    );

    await queryRunner.createIndex(
      'orders',
      new TableIndex({
        name: 'IDX_ORDERS_PACKAGE_TEMPLATE_ID',
        columnNames: ['packageTemplateId'],
      }),
    );

    await queryRunner.createIndex(
      'orders',
      new TableIndex({
        name: 'IDX_ORDERS_STATUS',
        columnNames: ['status'],
      }),
    );

    await queryRunner.createIndex(
      'orders',
      new TableIndex({
        name: 'IDX_ORDERS_ORDER_TYPE',
        columnNames: ['orderType'],
      }),
    );

    await queryRunner.createIndex(
      'orders',
      new TableIndex({
        name: 'IDX_ORDERS_CREATED_AT',
        columnNames: ['created_at'],
      }),
    );

    // Create foreign keys
    await queryRunner.createForeignKey(
      'orders',
      new TableForeignKey({
        columnNames: ['userId'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'orders',
      new TableForeignKey({
        columnNames: ['packageTemplateId'],
        referencedTableName: 'package_templates',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('orders');
  }
}
