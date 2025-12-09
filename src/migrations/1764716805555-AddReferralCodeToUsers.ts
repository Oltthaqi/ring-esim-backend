import { MigrationInterface, QueryRunner, TableColumn, TableIndex, TableForeignKey } from 'typeorm';

export class AddReferralCodeToUsers1764716805555 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add referral_code column
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'referral_code',
        type: 'varchar',
        length: '6',
        isNullable: true,
        isUnique: true,
      }),
    );

    // Add referred_by_user_id column
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'referred_by_user_id',
        type: 'char',
        length: '36',
        isNullable: true,
      }),
    );

    // Create index on referral_code for faster lookups
    await queryRunner.createIndex(
      'users',
      new TableIndex({
        name: 'IDX_USERS_REFERRAL_CODE',
        columnNames: ['referral_code'],
      }),
    );

    // Create foreign key constraint for referred_by_user_id
    await queryRunner.createForeignKey(
      'users',
      new TableForeignKey({
        columnNames: ['referred_by_user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
        name: 'FK_USERS_REFERRED_BY_USER',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key
    const table = await queryRunner.getTable('users');
    const foreignKey = table?.foreignKeys.find(
      (fk) => fk.name === 'FK_USERS_REFERRED_BY_USER',
    );
    if (foreignKey) {
      await queryRunner.dropForeignKey('users', foreignKey);
    }

    // Drop index
    await queryRunner.dropIndex('users', 'IDX_USERS_REFERRAL_CODE');

    // Drop columns
    await queryRunner.dropColumn('users', 'referred_by_user_id');
    await queryRunner.dropColumn('users', 'referral_code');
  }
}
