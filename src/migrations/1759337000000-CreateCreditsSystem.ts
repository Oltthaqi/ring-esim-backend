import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateCreditsSystem1759337000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. user_credits_balances
    await queryRunner.createTable(
      new Table({
        name: 'user_credits_balances',
        columns: [
          {
            name: 'user_id',
            type: 'char',
            length: '36',
            isPrimary: true,
          },
          {
            name: 'balance',
            type: 'decimal',
            precision: 12,
            scale: 2,
            default: 0.0,
          },
          {
            name: 'currency',
            type: 'char',
            length: '3',
            default: "'EUR'",
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
      'user_credits_balances',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );

    // 2. user_credits_ledger (append-only)
    await queryRunner.createTable(
      new Table({
        name: 'user_credits_ledger',
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
            name: 'user_id',
            type: 'char',
            length: '36',
          },
          {
            name: 'type',
            type: 'enum',
            enum: [
              'RESERVATION',
              'DEBIT',
              'CREDIT',
              'RELEASE',
              'ADJUSTMENT',
              'EXPIRE',
            ],
          },
          {
            name: 'amount',
            type: 'decimal',
            precision: 12,
            scale: 2,
          },
          {
            name: 'currency',
            type: 'char',
            length: '3',
            default: "'EUR'",
          },
          {
            name: 'order_id',
            type: 'char',
            length: '36',
            isNullable: true,
          },
          {
            name: 'note',
            type: 'text',
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

    await queryRunner.createForeignKey(
      'user_credits_ledger',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'user_credits_ledger',
      new TableForeignKey({
        columnNames: ['order_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'orders',
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.createIndex(
      'user_credits_ledger',
      new TableIndex({
        name: 'IDX_user_credits_ledger_user_id',
        columnNames: ['user_id'],
      }),
    );

    await queryRunner.createIndex(
      'user_credits_ledger',
      new TableIndex({
        name: 'IDX_user_credits_ledger_order_id',
        columnNames: ['order_id'],
      }),
    );

    // 3. user_credits_reservations
    await queryRunner.createTable(
      new Table({
        name: 'user_credits_reservations',
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
            name: 'user_id',
            type: 'char',
            length: '36',
          },
          {
            name: 'order_id',
            type: 'char',
            length: '36',
          },
          {
            name: 'amount',
            type: 'decimal',
            precision: 12,
            scale: 2,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['ACTIVE', 'RELEASED', 'CONVERTED'],
            default: "'ACTIVE'",
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

    await queryRunner.createForeignKey(
      'user_credits_reservations',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'user_credits_reservations',
      new TableForeignKey({
        columnNames: ['order_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'orders',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createIndex(
      'user_credits_reservations',
      new TableIndex({
        name: 'IDX_user_credits_reservations_user_id',
        columnNames: ['user_id'],
      }),
    );

    await queryRunner.createIndex(
      'user_credits_reservations',
      new TableIndex({
        name: 'IDX_user_credits_reservations_order_id',
        columnNames: ['order_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('user_credits_reservations');
    await queryRunner.dropTable('user_credits_ledger');
    await queryRunner.dropTable('user_credits_balances');
  }
}
