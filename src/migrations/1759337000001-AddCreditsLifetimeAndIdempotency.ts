import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableIndex,
} from 'typeorm';

export class AddCreditsLifetimeAndIdempotency1759337000001
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add lifetime_earned to user_credits_balances
    const balanceTable = await queryRunner.getTable('user_credits_balances');
    if (balanceTable && !balanceTable.findColumnByName('lifetime_earned')) {
      await queryRunner.addColumn(
        'user_credits_balances',
        new TableColumn({
          name: 'lifetime_earned',
          type: 'decimal',
          precision: 12,
          scale: 2,
          default: 0.0,
        }),
      );
    }

    // Add stripe_payment_intent_id to user_credits_ledger for idempotency
    const ledgerTable = await queryRunner.getTable('user_credits_ledger');
    if (
      ledgerTable &&
      !ledgerTable.findColumnByName('stripe_payment_intent_id')
    ) {
      await queryRunner.addColumn(
        'user_credits_ledger',
        new TableColumn({
          name: 'stripe_payment_intent_id',
          type: 'varchar',
          length: '255',
          isNullable: true,
        }),
      );

      // Create unique index for idempotency: one CREDIT/DEBIT per PI per type
      await queryRunner.createIndex(
        'user_credits_ledger',
        new TableIndex({
          name: 'IDX_user_credits_ledger_pi_type_idempotency',
          columnNames: ['stripe_payment_intent_id', 'type'],
          isUnique: true,
          where: '`stripe_payment_intent_id` IS NOT NULL',
        }),
      );
    }

    // Add stripe_payment_intent_id to user_credits_reservations
    const reservationTable = await queryRunner.getTable(
      'user_credits_reservations',
    );
    if (
      reservationTable &&
      !reservationTable.findColumnByName('stripe_payment_intent_id')
    ) {
      await queryRunner.addColumn(
        'user_credits_reservations',
        new TableColumn({
          name: 'stripe_payment_intent_id',
          type: 'varchar',
          length: '255',
          isNullable: true,
        }),
      );

      // One active reservation per PI
      await queryRunner.createIndex(
        'user_credits_reservations',
        new TableIndex({
          name: 'IDX_user_credits_reservations_pi_active',
          columnNames: ['stripe_payment_intent_id', 'status'],
          isUnique: true,
          where:
            "`stripe_payment_intent_id` IS NOT NULL AND `status` = 'ACTIVE'",
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes first
    const ledgerTable = await queryRunner.getTable('user_credits_ledger');
    if (ledgerTable) {
      const ledgerIndex = ledgerTable.indices.find(
        (idx) => idx.name === 'IDX_user_credits_ledger_pi_type_idempotency',
      );
      if (ledgerIndex) {
        await queryRunner.dropIndex('user_credits_ledger', ledgerIndex);
      }
    }

    const reservationTable = await queryRunner.getTable(
      'user_credits_reservations',
    );
    if (reservationTable) {
      const resIndex = reservationTable.indices.find(
        (idx) => idx.name === 'IDX_user_credits_reservations_pi_active',
      );
      if (resIndex) {
        await queryRunner.dropIndex('user_credits_reservations', resIndex);
      }
    }

    // Drop columns
    const balanceTable = await queryRunner.getTable('user_credits_balances');
    if (balanceTable && balanceTable.findColumnByName('lifetime_earned')) {
      await queryRunner.dropColumn('user_credits_balances', 'lifetime_earned');
    }

    if (
      ledgerTable &&
      ledgerTable.findColumnByName('stripe_payment_intent_id')
    ) {
      await queryRunner.dropColumn(
        'user_credits_ledger',
        'stripe_payment_intent_id',
      );
    }

    if (
      reservationTable &&
      reservationTable.findColumnByName('stripe_payment_intent_id')
    ) {
      await queryRunner.dropColumn(
        'user_credits_reservations',
        'stripe_payment_intent_id',
      );
    }
  }
}
