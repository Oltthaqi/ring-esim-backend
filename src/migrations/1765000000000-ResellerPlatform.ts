import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class ResellerPlatform1765000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add RESELLER to users.role enum
    await queryRunner.query(
      `ALTER TABLE \`users\` MODIFY COLUMN \`role\` ENUM('USER','ADMIN','SUPER_ADMIN','RESELLER') NOT NULL DEFAULT 'USER'`,
    );

    // 2. Add reseller_id FK to users
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'reseller_id',
        type: 'char',
        length: '36',
        isNullable: true,
        default: null,
      }),
    );
    await queryRunner.createForeignKey(
      'users',
      new TableForeignKey({
        name: 'FK_users_reseller_id',
        columnNames: ['reseller_id'],
        referencedTableName: 'resellers',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      }),
    );

    // 3. Add new columns to resellers table
    await queryRunner.addColumns('resellers', [
      new TableColumn({
        name: 'discount_pct',
        type: 'decimal',
        precision: 5,
        scale: 2,
        default: "'0.00'",
      }),
      new TableColumn({
        name: 'allow_debt',
        type: 'boolean',
        default: false,
      }),
      new TableColumn({
        name: 'is_active',
        type: 'boolean',
        default: true,
      }),
    ]);

    // 4. Create balance_transactions table
    await queryRunner.createTable(
      new Table({
        name: 'balance_transactions',
        columns: [
          {
            name: 'id',
            type: 'char',
            length: '36',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          { name: 'reseller_id', type: 'char', length: '36' },
          {
            name: 'type',
            type: 'enum',
            enum: ['TOPUP', 'ADJUSTMENT', 'ORDER_DEBIT', 'ORDER_REFUND'],
          },
          { name: 'amount', type: 'decimal', precision: 12, scale: 4 },
          {
            name: 'balance_after',
            type: 'decimal',
            precision: 12,
            scale: 4,
          },
          { name: 'description', type: 'text', isNullable: true },
          {
            name: 'order_id',
            type: 'char',
            length: '36',
            isNullable: true,
          },
          { name: 'performed_by', type: 'char', length: '36' },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );
    await queryRunner.createIndex(
      'balance_transactions',
      new TableIndex({
        name: 'IDX_balance_transactions_reseller_id',
        columnNames: ['reseller_id'],
      }),
    );
    await queryRunner.createForeignKey(
      'balance_transactions',
      new TableForeignKey({
        name: 'FK_balance_transactions_reseller_id',
        columnNames: ['reseller_id'],
        referencedTableName: 'resellers',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createForeignKey(
      'balance_transactions',
      new TableForeignKey({
        name: 'FK_balance_transactions_performed_by',
        columnNames: ['performed_by'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
      }),
    );

    // 5. Create reseller_orders table
    await queryRunner.createTable(
      new Table({
        name: 'reseller_orders',
        columns: [
          {
            name: 'id',
            type: 'char',
            length: '36',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          { name: 'reseller_id', type: 'char', length: '36' },
          { name: 'user_id', type: 'char', length: '36' },
          {
            name: 'status',
            type: 'enum',
            enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED'],
            default: "'PENDING'",
          },
          { name: 'upstream_template_id', type: 'int' },
          {
            name: 'upstream_template_name',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'upstream_template_cost',
            type: 'decimal',
            precision: 12,
            scale: 4,
          },
          {
            name: 'our_sell_price',
            type: 'decimal',
            precision: 12,
            scale: 4,
          },
          {
            name: 'discount_pct_applied',
            type: 'decimal',
            precision: 5,
            scale: 2,
          },
          {
            name: 'reseller_price',
            type: 'decimal',
            precision: 12,
            scale: 4,
          },
          {
            name: 'iccid',
            type: 'varchar',
            length: '20',
            isNullable: true,
          },
          {
            name: 'smdp_server',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'activation_code',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          { name: 'qr_url', type: 'text', isNullable: true },
          { name: 'subscriber_id', type: 'bigint', isNullable: true },
          { name: 'esim_id', type: 'bigint', isNullable: true },
          { name: 'subs_package_id', type: 'bigint', isNullable: true },
          { name: 'upstream_response', type: 'json', isNullable: true },
          { name: 'error_message', type: 'text', isNullable: true },
          { name: 'validity_days', type: 'int', isNullable: true },
          { name: 'notes', type: 'text', isNullable: true },
          {
            name: 'refunded_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'refunded_by',
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
    await queryRunner.createIndex(
      'reseller_orders',
      new TableIndex({
        name: 'IDX_reseller_orders_reseller_id',
        columnNames: ['reseller_id'],
      }),
    );
    await queryRunner.createForeignKey(
      'reseller_orders',
      new TableForeignKey({
        name: 'FK_reseller_orders_reseller_id',
        columnNames: ['reseller_id'],
        referencedTableName: 'resellers',
        referencedColumnNames: ['id'],
      }),
    );
    await queryRunner.createForeignKey(
      'reseller_orders',
      new TableForeignKey({
        name: 'FK_reseller_orders_user_id',
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
      }),
    );

    // 6. Create package_visibility table
    await queryRunner.createTable(
      new Table({
        name: 'package_visibility',
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
            name: 'upstream_template_id',
            type: 'int',
            isUnique: true,
          },
          {
            name: 'hidden',
            type: 'boolean',
            default: false,
          },
          { name: 'updated_by', type: 'char', length: '36' },
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
    await queryRunner.createForeignKey(
      'package_visibility',
      new TableForeignKey({
        name: 'FK_package_visibility_updated_by',
        columnNames: ['updated_by'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
      }),
    );

    // 7. Create upstream_api_logs table
    await queryRunner.createTable(
      new Table({
        name: 'upstream_api_logs',
        columns: [
          {
            name: 'id',
            type: 'char',
            length: '36',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          { name: 'method_name', type: 'varchar', length: '100' },
          { name: 'request_body', type: 'json', isNullable: true },
          { name: 'response_body', type: 'json', isNullable: true },
          { name: 'status_code', type: 'int', isNullable: true },
          { name: 'duration_ms', type: 'int', isNullable: true },
          {
            name: 'reseller_order_id',
            type: 'char',
            length: '36',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('upstream_api_logs');
    await queryRunner.dropTable('package_visibility');

    const roTable = await queryRunner.getTable('reseller_orders');
    for (const fk of roTable?.foreignKeys ?? []) {
      await queryRunner.dropForeignKey('reseller_orders', fk);
    }
    await queryRunner.dropTable('reseller_orders');

    const btTable = await queryRunner.getTable('balance_transactions');
    for (const fk of btTable?.foreignKeys ?? []) {
      await queryRunner.dropForeignKey('balance_transactions', fk);
    }
    await queryRunner.dropTable('balance_transactions');

    await queryRunner.dropColumns('resellers', [
      'discount_pct',
      'allow_debt',
      'is_active',
    ]);

    const usersFk = (await queryRunner.getTable('users'))?.foreignKeys.find(
      (fk) => fk.name === 'FK_users_reseller_id',
    );
    if (usersFk) await queryRunner.dropForeignKey('users', usersFk);
    await queryRunner.dropColumn('users', 'reseller_id');

    await queryRunner.query(
      `ALTER TABLE \`users\` MODIFY COLUMN \`role\` ENUM('USER','ADMIN','SUPER_ADMIN') NOT NULL DEFAULT 'USER'`,
    );
  }
}
