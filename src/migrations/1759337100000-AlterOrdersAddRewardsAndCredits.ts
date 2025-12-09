import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableForeignKey,
} from 'typeorm';

export class AlterOrdersAddRewardsAndCredits1759337100000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add status if not exists (check first)
    const table = await queryRunner.getTable('orders');
    const hasStatus = table?.columns.find((col) => col.name === 'status');

    if (!hasStatus) {
      await queryRunner.addColumn(
        'orders',
        new TableColumn({
          name: 'status',
          type: 'enum',
          enum: ['DRAFT', 'OPEN', 'PAID', 'CANCELED', 'EXPIRED'],
          default: "'OPEN'",
        }),
      );
    }

    // Add currency if not exists
    const hasCurrency = table?.columns.find((col) => col.name === 'currency');
    if (!hasCurrency) {
      await queryRunner.addColumn(
        'orders',
        new TableColumn({
          name: 'currency',
          type: 'char',
          length: '3',
          default: "'EUR'",
        }),
      );
    }

    // Add reward fields (check if they exist first)
    const hasRewardType = table?.columns.find(
      (col) => col.name === 'reward_type',
    );
    if (!hasRewardType) {
      await queryRunner.addColumn(
        'orders',
        new TableColumn({
          name: 'reward_type',
          type: 'enum',
          enum: ['NONE', 'CASHBACK_10', 'DISCOUNT_3'],
          default: "'NONE'",
        }),
      );
    }

    const hasDiscountFromReward = table?.columns.find(
      (col) => col.name === 'discount_from_reward_amount',
    );
    if (!hasDiscountFromReward) {
      await queryRunner.addColumn(
        'orders',
        new TableColumn({
          name: 'discount_from_reward_amount',
          type: 'decimal',
          precision: 12,
          scale: 2,
          default: 0.0,
        }),
      );
    }

    const hasCashbackToAccrue = table?.columns.find(
      (col) => col.name === 'cashback_to_accrue_amount',
    );
    if (!hasCashbackToAccrue) {
      await queryRunner.addColumn(
        'orders',
        new TableColumn({
          name: 'cashback_to_accrue_amount',
          type: 'decimal',
          precision: 12,
          scale: 2,
          default: 0.0,
        }),
      );
    }

    // Add credits fields (check if they exist first)
    const hasCreditsApplied = table?.columns.find(
      (col) => col.name === 'credits_applied_amount',
    );
    if (!hasCreditsApplied) {
      await queryRunner.addColumn(
        'orders',
        new TableColumn({
          name: 'credits_applied_amount',
          type: 'decimal',
          precision: 12,
          scale: 2,
          default: 0.0,
        }),
      );
    }

    const hasCreditsReservation = table?.columns.find(
      (col) => col.name === 'credits_reservation_id',
    );
    if (!hasCreditsReservation) {
      await queryRunner.addColumn(
        'orders',
        new TableColumn({
          name: 'credits_reservation_id',
          type: 'char',
          length: '36',
          isNullable: true,
        }),
      );
    }

    // Add total fields (if not exist from promo migration)
    const hasTotalDiscountAmount = table?.columns.find(
      (col) => col.name === 'total_discount_amount',
    );
    if (!hasTotalDiscountAmount) {
      await queryRunner.addColumn(
        'orders',
        new TableColumn({
          name: 'total_discount_amount',
          type: 'decimal',
          precision: 12,
          scale: 2,
          default: 0.0,
        }),
      );
    }

    const hasAmountDue = table?.columns.find(
      (col) => col.name === 'amount_due_after_credits',
    );
    if (!hasAmountDue) {
      await queryRunner.addColumn(
        'orders',
        new TableColumn({
          name: 'amount_due_after_credits',
          type: 'decimal',
          precision: 12,
          scale: 2,
          isNullable: true,
        }),
      );
    }

    // Add promo percent snapshot if not exists
    const hasPromoPercent = table?.columns.find(
      (col) => col.name === 'promo_percent',
    );
    if (!hasPromoPercent) {
      await queryRunner.addColumn(
        'orders',
        new TableColumn({
          name: 'promo_percent',
          type: 'decimal',
          precision: 5,
          scale: 2,
          isNullable: true,
        }),
      );
    }

    // Rename discount_amount to discount_from_promo_amount if needed
    const hasDiscountFromPromo = table?.columns.find(
      (col) => col.name === 'discount_from_promo_amount',
    );
    if (!hasDiscountFromPromo) {
      const hasDiscountAmount = table?.columns.find(
        (col) => col.name === 'discount_amount',
      );
      if (hasDiscountAmount) {
        await queryRunner.renameColumn(
          'orders',
          'discount_amount',
          'discount_from_promo_amount',
        );
      } else {
        await queryRunner.addColumn(
          'orders',
          new TableColumn({
            name: 'discount_from_promo_amount',
            type: 'decimal',
            precision: 12,
            scale: 2,
            default: 0.0,
          }),
        );
      }
    }

    // Add foreign key for credits_reservation_id (check if exists first)
    // Note: This will only work if user_credits_reservations table exists (from previous migration)
    const reservationsTableExists = await queryRunner.hasTable(
      'user_credits_reservations',
    );

    if (reservationsTableExists && hasCreditsReservation) {
      const orderTableCheck = await queryRunner.getTable('orders');
      const hasForeignKey = orderTableCheck?.foreignKeys.find(
        (fk) => fk.name === 'FK_orders_credits_reservation_id',
      );

      if (!hasForeignKey) {
        try {
          await queryRunner.createForeignKey(
            'orders',
            new TableForeignKey({
              columnNames: ['credits_reservation_id'],
              referencedColumnNames: ['id'],
              referencedTableName: 'user_credits_reservations',
              onDelete: 'SET NULL',
              name: 'FK_orders_credits_reservation_id',
            }),
          );
        } catch (error) {
          console.warn(
            'Could not create FK_orders_credits_reservation_id:',
            error.message,
          );
          // Continue - FK can be added manually later if needed
        }
      }
    }

    // Backfill amount_due_after_credits from total_amount
    await queryRunner.query(
      `UPDATE \`orders\` SET \`amount_due_after_credits\` = \`total_amount\` WHERE \`amount_due_after_credits\` IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey(
      'orders',
      'FK_orders_credits_reservation_id',
    );
    await queryRunner.dropColumn('orders', 'amount_due_after_credits');
    await queryRunner.dropColumn('orders', 'credits_reservation_id');
    await queryRunner.dropColumn('orders', 'credits_applied_amount');
    await queryRunner.dropColumn('orders', 'cashback_to_accrue_amount');
    await queryRunner.dropColumn('orders', 'discount_from_reward_amount');
    await queryRunner.dropColumn('orders', 'reward_type');
  }
}
