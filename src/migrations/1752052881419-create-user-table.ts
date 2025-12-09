import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateUserTable1752052881419 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'users',
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
            name: 'first_name',
            type: 'varchar',
            isNullable: true,
            default: null,
          },
          {
            name: 'last_name',
            type: 'varchar',
            isNullable: true,
            default: null,
          },
          {
            name: 'email',
            type: 'varchar',
            isNullable: true,
            default: null,
          },
          {
            name: 'phone_number',
            type: 'varchar',
            isNullable: true,
            default: null,
          },
          {
            name: 'gender',
            type: 'enum',
            enum: ['female', 'male'],
            isNullable: true,
            default: null,
          },
          {
            name: 'password',
            type: 'varchar',
            isNullable: true,
            default: null,
          },
          {
            name: 'is_verified',
            type: 'boolean',
            isNullable: true,
            default: null,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['ACTIVE', 'INACTIVE'],
            default: `'ACTIVE'`,
          },
          {
            name: 'role',
            type: 'enum',
            enum: ['USER', 'ADMIN', 'SUPER_ADMIN'],
            default: `'USER'`,
          },
          {
            name: 'is_deleted',
            type: 'boolean',
            isNullable: true,
            default: false,
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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('users');
  }
}
