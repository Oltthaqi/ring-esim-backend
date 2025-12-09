import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddPaymentFieldsToOrders1754850000000
  implements MigrationInterface
{
  name = 'AddPaymentFieldsToOrders1754850000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add payment fields to orders table
    await queryRunner.addColumn(
      'orders',
      new TableColumn({
        name: 'paymentIntentId',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'orders',
      new TableColumn({
        name: 'paymentStatus',
        type: 'enum',
        enum: ['pending', 'processing', 'succeeded', 'failed', 'canceled'],
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove payment fields from orders table
    await queryRunner.dropColumn('orders', 'paymentStatus');
    await queryRunner.dropColumn('orders', 'paymentIntentId');
  }
}

