import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddIsDeletedToTemplatesAndZones1764800000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'location_zones',
      new TableColumn({
        name: 'isDeleted',
        type: 'boolean',
        default: false,
        isNullable: false,
      }),
    );

    await queryRunner.addColumn(
      'package_templates',
      new TableColumn({
        name: 'isDeleted',
        type: 'boolean',
        default: false,
        isNullable: false,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('package_templates', 'isDeleted');
    await queryRunner.dropColumn('location_zones', 'isDeleted');
  }
}
