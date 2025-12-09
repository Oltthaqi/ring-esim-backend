import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateOrderTypeEnum1754860000000 implements MigrationInterface {
  name = 'UpdateOrderTypeEnum1754860000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Update the orderType enum to include 'topup'
    await queryRunner.query(
      `ALTER TABLE \`orders\` MODIFY COLUMN \`orderType\` enum('one_time', 'recurring', 'topup') NOT NULL`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert back to original enum values
    await queryRunner.query(
      `ALTER TABLE \`orders\` MODIFY COLUMN \`orderType\` enum('one_time', 'recurring') NOT NULL`
    );
  }
}
