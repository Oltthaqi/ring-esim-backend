import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AlterOrdersAddPromoFields1759327433470
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add promo code pricing fields to orders table
    await queryRunner.addColumns('orders', [
      new TableColumn({
        name: 'subtotal_amount',
        type: 'numeric',
        precision: 12,
        scale: 2,
        isNullable: true, // Nullable for existing orders
      }),
      new TableColumn({
        name: 'promo_code_id',
        type: 'char',
        length: '36',
        isNullable: true,
      }),
      new TableColumn({
        name: 'promo_code_code',
        type: 'varchar',
        length: '50',
        isNullable: true,
      }),
      new TableColumn({
        name: 'discount_percent',
        type: 'numeric',
        precision: 5,
        scale: 2,
        isNullable: true,
      }),
      new TableColumn({
        name: 'discount_amount',
        type: 'numeric',
        precision: 12,
        scale: 2,
        default: 0.0,
      }),
      new TableColumn({
        name: 'total_amount',
        type: 'numeric',
        precision: 12,
        scale: 2,
        isNullable: true, // Nullable for existing orders
      }),
    ]);

    // Add foreign key to promo_codes table
    await queryRunner.query(
      `ALTER TABLE \`orders\` ADD CONSTRAINT \`FK_orders_promo_code_id\` 
       FOREIGN KEY (\`promo_code_id\`) REFERENCES \`promo_codes\`(\`id\`) ON DELETE SET NULL`,
    );

    // Backfill subtotal_amount and total_amount from existing amount column
    await queryRunner.query(
      `UPDATE \`orders\` 
       SET \`subtotal_amount\` = CAST(\`amount\` AS DECIMAL(12,2)), 
           \`total_amount\` = CAST(\`amount\` AS DECIMAL(12,2)) 
       WHERE \`subtotal_amount\` IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key
    await queryRunner.query(
      `ALTER TABLE \`orders\` DROP FOREIGN KEY \`FK_orders_promo_code_id\``,
    );

    // Drop columns
    await queryRunner.dropColumn('orders', 'total_amount');
    await queryRunner.dropColumn('orders', 'discount_amount');
    await queryRunner.dropColumn('orders', 'discount_percent');
    await queryRunner.dropColumn('orders', 'promo_code_code');
    await queryRunner.dropColumn('orders', 'promo_code_id');
    await queryRunner.dropColumn('orders', 'subtotal_amount');
  }
}
