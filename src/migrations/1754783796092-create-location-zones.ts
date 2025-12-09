import { MigrationInterface, QueryRunner, Table, TableUnique } from 'typeorm';

export class CreateLocationZones1754783796092 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'location_zones',
        columns: [
          {
            name: 'id',
            type: 'char',
            length: '36',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          { name: 'zoneId', type: 'bigint', isNullable: false },
          {
            name: 'zoneName',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          { name: 'countriesIso2', type: 'json', isNullable: true },
          { name: 'countryNames', type: 'json', isNullable: true },
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
            name: 'UQ_location_zones_zoneId',
            columnNames: ['zoneId'],
          }),
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('location_zones');
  }
}
