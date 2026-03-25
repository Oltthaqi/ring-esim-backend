import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
  TableUnique,
} from 'typeorm';

export class CreateResellersAndRetailOverrides1764900000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'resellers',
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
            name: 'telco_reseller_id',
            type: 'int',
            isUnique: true,
            isNullable: false,
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'currency',
            type: 'varchar',
            length: '8',
            default: "'EUR'",
          },
          {
            name: 'contact_email',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'credit_limit',
            type: 'decimal',
            precision: 14,
            scale: 4,
            isNullable: true,
          },
          {
            name: 'internal_ledger_balance',
            type: 'decimal',
            precision: 14,
            scale: 4,
            default: "'0.0000'",
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

    await queryRunner.createTable(
      new Table({
        name: 'reseller_retail_overrides',
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
            name: 'reseller_id',
            type: 'char',
            length: '36',
          },
          {
            name: 'package_template_id',
            type: 'char',
            length: '36',
          },
          {
            name: 'mode',
            type: 'varchar',
            length: '32',
          },
          {
            name: 'retail_price',
            type: 'decimal',
            precision: 14,
            scale: 4,
            isNullable: true,
          },
          {
            name: 'markup_percent',
            type: 'decimal',
            precision: 10,
            scale: 4,
            isNullable: true,
          },
          {
            name: 'wholesale_reference_price',
            type: 'decimal',
            precision: 14,
            scale: 4,
            isNullable: true,
          },
          {
            name: 'currency',
            type: 'varchar',
            length: '8',
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
            name: 'UQ_reseller_retail_overrides_reseller_package',
            columnNames: ['reseller_id', 'package_template_id'],
          }),
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'reseller_retail_overrides',
      new TableForeignKey({
        name: 'FK_reseller_retail_overrides_reseller_id',
        columnNames: ['reseller_id'],
        referencedTableName: 'resellers',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'reseller_retail_overrides',
      new TableForeignKey({
        name: 'FK_reseller_retail_overrides_package_template_id',
        columnNames: ['package_template_id'],
        referencedTableName: 'package_templates',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      }),
    );

    await queryRunner.createIndex(
      'reseller_retail_overrides',
      new TableIndex({
        name: 'IDX_reseller_retail_overrides_reseller_id',
        columnNames: ['reseller_id'],
      }),
    );

    await queryRunner.createIndex(
      'reseller_retail_overrides',
      new TableIndex({
        name: 'IDX_reseller_retail_overrides_package_template_id',
        columnNames: ['package_template_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('reseller_retail_overrides');
    for (const fk of table?.foreignKeys ?? []) {
      await queryRunner.dropForeignKey('reseller_retail_overrides', fk);
    }
    await queryRunner.dropTable('reseller_retail_overrides');
    await queryRunner.dropTable('resellers');
  }
}
