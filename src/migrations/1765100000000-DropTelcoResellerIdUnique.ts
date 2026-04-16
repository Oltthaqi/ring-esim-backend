import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropTelcoResellerIdUnique1765100000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop the unique index on telco_reseller_id — all resellers share the same upstream ID (590)
    const table = await queryRunner.getTable('resellers');
    const uniqueIndex = table?.indices.find((idx) =>
      idx.columnNames.includes('telco_reseller_id'),
    );
    if (uniqueIndex) {
      await queryRunner.dropIndex('resellers', uniqueIndex);
    }
    // Also check for a unique constraint (TypeORM may create either)
    const uniqueConstraint = table?.uniques.find((uq) =>
      uq.columnNames.includes('telco_reseller_id'),
    );
    if (uniqueConstraint) {
      await queryRunner.dropUniqueConstraint('resellers', uniqueConstraint);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE UNIQUE INDEX IDX_resellers_telco_reseller_id ON resellers (telco_reseller_id)`,
    );
  }
}
