import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

export class AddAppleIdToUsers1765200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'apple_id',
        type: 'varchar',
        isNullable: true,
        default: null,
      }),
    );

    await queryRunner.createIndex(
      'users',
      new TableIndex({
        name: 'IDX_USERS_APPLE_ID',
        columnNames: ['apple_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('users', 'IDX_USERS_APPLE_ID');
    await queryRunner.dropColumn('users', 'apple_id');
  }
}
