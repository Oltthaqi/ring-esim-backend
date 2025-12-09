import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableUnique,
} from 'typeorm';

export class CreatePackageTemplates1754783854513 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'package_templates',
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
            name: 'packageTemplateId',
            type: 'varchar',
            length: '64',
            isNullable: false,
          },
          {
            name: 'packageTemplateName',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          { name: 'periodDays', type: 'int', isNullable: true },
          { name: 'volume', type: 'varchar', length: '64', isNullable: true },
          {
            name: 'price',
            type: 'decimal',
            precision: 12,
            scale: 2,
            isNullable: true,
          },
          { name: 'currency', type: 'varchar', length: '8', isNullable: true },
          { name: 'zoneId', type: 'bigint', isNullable: false }, // must match parent
          {
            name: 'zoneName',
            type: 'varchar',
            length: '255',
            isNullable: false,
            default: "''",
          },
          { name: 'countriesIso2', type: 'json', isNullable: true }, // keep JSON (not simple-array)
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
            name: 'UQ_package_templates_packageTemplateId',
            columnNames: ['packageTemplateId'],
          }),
        ],
      }),
      true,
    );

    // FK (no extra manual index needed; InnoDB will create it)
    await queryRunner.createForeignKey(
      'package_templates',
      new TableForeignKey({
        name: 'FK_package_templates_zoneId_location_zones_zoneId',
        columnNames: ['zoneId'],
        referencedTableName: 'location_zones',
        referencedColumnNames: ['zoneId'],
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('package_templates');
    const fk = table?.foreignKeys.find(
      (f) =>
        f.name === 'FK_package_templates_zoneId_location_zones_zoneId' ||
        f.columnNames.includes('zoneId'),
    );
    if (fk) {
      await queryRunner.dropForeignKey('package_templates', fk);
    }
    await queryRunner.dropTable('package_templates');
  }
}
