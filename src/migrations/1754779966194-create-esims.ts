import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableIndex,
  TableUnique,
} from 'typeorm';

export class CreateEsims1754779966194 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'esims',
        columns: [
          // UUID PK like your users table style (char(36))
          {
            name: 'id',
            type: 'char',
            length: '36',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'subscriberId',
            type: 'bigint',
            isNullable: false,
          },
          {
            name: 'imsi',
            type: 'varchar',
            length: '32',
            isNullable: true,
            default: null,
          },
          {
            name: 'iccid',
            type: 'varchar',
            length: '32',
            isNullable: true,
            default: null,
          },
          {
            name: 'phoneNumber',
            type: 'varchar',
            length: '32',
            isNullable: true,
            default: null,
          },
          {
            name: 'smdpServer',
            type: 'varchar',
            length: '128',
            isNullable: true,
            default: null,
          },
          {
            name: 'activationCode',
            type: 'varchar',
            length: '128',
            isNullable: true,
            default: null,
          },
          {
            name: 'batchId',
            type: 'varchar',
            length: '128',
            isNullable: true,
            default: null,
          },
          {
            name: 'accountId',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'resellerId',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'prepaid',
            type: 'boolean',
            isNullable: false,
            default: true,
          },
          {
            name: 'balance',
            type: 'decimal',
            precision: 12,
            scale: 2,
            isNullable: false,
            default: 0,
          },
          {
            name: 'simStatus',
            type: 'varchar',
            length: '24',
            isNullable: true,
            default: null,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '24',
            isNullable: true,
            default: null,
          },
          {
            name: 'activationDate',
            type: 'datetime',
            isNullable: true,
            default: null,
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
        uniques: [
          new TableUnique({
            name: 'UQ_esims_subscriberId',
            columnNames: ['subscriberId'],
          }),
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'esims',
      new TableIndex({
        name: 'IDX_esims_simStatus',
        columnNames: ['simStatus'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('esims', 'IDX_esims_simStatus');
    await queryRunner.dropTable('esims');
  }
}
