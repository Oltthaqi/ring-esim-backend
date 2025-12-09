import {
  Injectable,
  BadRequestException,
  Logger,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull, Not } from 'typeorm';
import { UserCreditsBalance } from './entities/user-credits-balance.entity';
import {
  UserCreditsLedger,
  CreditLedgerType,
} from './entities/user-credits-ledger.entity';
import {
  UserCreditsReservation,
  ReservationStatus,
} from './entities/user-credits-reservation.entity';

@Injectable()
export class CreditsService {
  private readonly logger = new Logger(CreditsService.name);

  constructor(
    @InjectRepository(UserCreditsBalance)
    private balanceRepository: Repository<UserCreditsBalance>,
    @InjectRepository(UserCreditsLedger)
    private ledgerRepository: Repository<UserCreditsLedger>,
    @InjectRepository(UserCreditsReservation)
    private reservationRepository: Repository<UserCreditsReservation>,
    private dataSource: DataSource,
  ) {}

  /**
   * Ensure user has a balance row (create if missing)
   * Uses UPSERT to handle race conditions safely
   * CRITICAL: Does NOT overwrite existing balance/lifetime_earned
   */
  private async ensureBalanceExists(
    userId: string,
    queryRunner?: any,
  ): Promise<UserCreditsBalance> {
    const manager = queryRunner?.manager || this.balanceRepository.manager;

    // CRITICAL FIX: Use UPSERT that ONLY creates new rows, never overwrites existing balances
    // ON DUPLICATE KEY UPDATE only touches updated_at (keeps balance intact)
    await manager.query(
      `INSERT INTO user_credits_balances (user_id, balance, lifetime_earned, currency, updated_at)
       VALUES (?, 0.00, 0.00, 'EUR', NOW())
       ON DUPLICATE KEY UPDATE 
         currency = VALUES(currency),
         updated_at = NOW()`,
      [userId],
    );

    this.logger.log(
      `[RESERVE] Ensured balance row exists for user ${userId} (no balance overwrite)`,
    );

    // Now fetch the row (guaranteed to exist)
    const balance = await manager.findOne(UserCreditsBalance, {
      where: { user_id: userId },
    });

    if (!balance) {
      throw new Error(
        `Failed to ensure balance exists for user ${userId} - UPSERT succeeded but row not found`,
      );
    }

    return balance;
  }

  /**
   * Get user's available credit balance (with lifetime earned)
   */
  async getBalance(userId: string): Promise<{
    balance: number;
    lifetime_earned: number;
    currency: string;
  }> {
    const balanceRecord = await this.ensureBalanceExists(userId);
    return {
      balance: Number(balanceRecord.balance || 0),
      lifetime_earned: Number(balanceRecord.lifetime_earned || 0),
      currency: balanceRecord.currency || 'EUR',
    };
  }

  /**
   * Get user's available credit balance (legacy - just the number)
   */
  async getAvailableBalance(userId: string): Promise<number> {
    const balance = await this.getBalance(userId);
    return balance.balance;
  }

  /**
   * Reserve credits for an order (locks the amount)
   * @param stripePaymentIntentId - Optional Stripe PI ID for idempotency
   */
  async reserveCredits(
    userId: string,
    orderId: string,
    amount: number,
    stripePaymentIntentId?: string,
  ): Promise<UserCreditsReservation> {
    if (amount <= 0) {
      throw new BadRequestException('Reservation amount must be positive');
    }

    this.logger.log(
      `[RESERVE] Starting credit reservation: user=${userId}, order=${orderId}, credits_to_use=${amount}, PI=${stripePaymentIntentId || 'none'}`,
    );

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Ensure balance exists (does NOT overwrite existing balance)
      await this.ensureBalanceExists(userId, queryRunner);

      // Get current available balance
      const balanceRecord = await queryRunner.manager.findOne(
        UserCreditsBalance,
        {
          where: { user_id: userId },
        },
      );

      const available = Number(balanceRecord?.balance || 0);
      const lifetimeEarned = Number(balanceRecord?.lifetime_earned || 0);

      this.logger.log(
        `[RESERVE] Current balance for user ${userId}: €${available.toFixed(2)}, lifetime_earned: €${lifetimeEarned.toFixed(2)}`,
      );

      // Guard: Users cannot use credits before reaching lifetime_earned > 7.00
      if (lifetimeEarned <= 7.0) {
        throw new BadRequestException(
          `Credits cannot be used until you have earned more than €7.00 in lifetime credits. Current lifetime earned: €${lifetimeEarned.toFixed(2)}`,
        );
      }

      if (available < amount) {
        throw new BadRequestException(
          `Insufficient credits. Available: €${available.toFixed(2)}, Requested: €${amount.toFixed(2)}`,
        );
      }

      // Check for existing active reservation with same PI ID (idempotency)
      if (stripePaymentIntentId) {
        const existing = await queryRunner.manager.findOne(
          UserCreditsReservation,
          {
            where: {
              stripe_payment_intent_id: stripePaymentIntentId,
              status: ReservationStatus.ACTIVE,
            },
          },
        );
        if (existing) {
          this.logger.log(
            `Reservation already exists for PI ${stripePaymentIntentId}, returning existing`,
          );
          await queryRunner.commitTransaction();
          return existing;
        }
      }

      // Create reservation record
      const reservation = queryRunner.manager.create(UserCreditsReservation, {
        user_id: userId,
        order_id: orderId,
        amount,
        status: ReservationStatus.ACTIVE,
        stripe_payment_intent_id: stripePaymentIntentId || null,
      });
      await queryRunner.manager.save(reservation);

      this.logger.log(
        `Created reservation ${reservation.id} for user ${userId}: €${amount} (order: ${orderId}, PI: ${stripePaymentIntentId || 'none'})`,
      );

      // Create ledger entry
      const ledgerEntry = queryRunner.manager.create(UserCreditsLedger, {
        user_id: userId,
        type: CreditLedgerType.RESERVATION,
        amount,
        currency: 'EUR',
        order_id: orderId,
        stripe_payment_intent_id: stripePaymentIntentId || null,
        note: `Reserved €${amount.toFixed(2)} for order ${orderId}`,
      });
      await queryRunner.manager.save(ledgerEntry);

      // Deduct from balance (soft lock) - use raw SQL for DECIMAL precision
      await queryRunner.manager.query(
        `UPDATE user_credits_balances 
         SET balance = balance - CAST(? AS DECIMAL(12,2))
         WHERE user_id = ?`,
        [amount, userId],
      );

      this.logger.log(
        `Deducted €${amount} from user ${userId} balance (reservation)`,
      );

      await queryRunner.commitTransaction();
      return reservation;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Failed to reserve credits for user ${userId}: ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Release a reservation (cancel/expire order - restore credits)
   */
  async releaseReservation(
    reservationId: string,
    reason?: string,
  ): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const reservation = await queryRunner.manager.findOne(
        UserCreditsReservation,
        {
          where: { id: reservationId, status: ReservationStatus.ACTIVE },
        },
      );

      if (!reservation) {
        // Already released or converted - idempotent
        this.logger.log(
          `Reservation ${reservationId} already released/converted (idempotent)`,
        );
        await queryRunner.commitTransaction();
        return;
      }

      // Update reservation status
      reservation.status = ReservationStatus.RELEASED;
      await queryRunner.manager.save(reservation);

      this.logger.log(
        `Released reservation ${reservationId} for user ${reservation.user_id}: €${reservation.amount}`,
      );

      // Create ledger entry for release
      const ledgerEntry = queryRunner.manager.create(UserCreditsLedger, {
        user_id: reservation.user_id,
        type: CreditLedgerType.RELEASE,
        amount: reservation.amount,
        currency: 'EUR',
        order_id: reservation.order_id,
        stripe_payment_intent_id: reservation.stripe_payment_intent_id,
        note:
          reason ||
          `Released reservation ${reservationId} (€${typeof reservation.amount === 'number' ? reservation.amount.toFixed(2) : parseFloat(String(reservation.amount)).toFixed(2)})`,
      });
      await queryRunner.manager.save(ledgerEntry);

      // Restore balance - use raw SQL for DECIMAL precision
      await queryRunner.manager.query(
        `UPDATE user_credits_balances 
         SET balance = balance + CAST(? AS DECIMAL(12,2))
         WHERE user_id = ?`,
        [reservation.amount, reservation.user_id],
      );

      this.logger.log(
        `Restored €${reservation.amount} to user ${reservation.user_id} balance`,
      );

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Failed to release reservation ${reservationId}: ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Convert reservation to debit (payment successful - make deduction permanent)
   * Idempotent: safe to call multiple times
   */
  async convertReservationToDebit(
    reservationId: string,
    stripePaymentIntentId?: string,
  ): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const reservation = await queryRunner.manager.findOne(
        UserCreditsReservation,
        {
          where: { id: reservationId, status: ReservationStatus.ACTIVE },
        },
      );

      if (!reservation) {
        // Already converted or released - idempotent
        this.logger.log(
          `Reservation ${reservationId} already converted/released (idempotent)`,
        );
        await queryRunner.commitTransaction();
        return;
      }

      // Check idempotency: if DEBIT already exists for this PI + type
      if (stripePaymentIntentId) {
        const existingDebit = await queryRunner.manager.findOne(
          UserCreditsLedger,
          {
            where: {
              stripe_payment_intent_id: stripePaymentIntentId,
              type: CreditLedgerType.DEBIT,
            },
          },
        );
        if (existingDebit) {
          this.logger.log(
            `DEBIT already exists for PI ${stripePaymentIntentId} (idempotent)`,
          );
          // Still mark reservation as converted if not already
          if (reservation.status === ReservationStatus.ACTIVE) {
            reservation.status = ReservationStatus.CONVERTED;
            await queryRunner.manager.save(reservation);
          }
          await queryRunner.commitTransaction();
          return;
        }
      }

      // Update reservation status
      reservation.status = ReservationStatus.CONVERTED;
      if (stripePaymentIntentId && !reservation.stripe_payment_intent_id) {
        reservation.stripe_payment_intent_id = stripePaymentIntentId;
      }
      await queryRunner.manager.save(reservation);

      this.logger.log(
        `Converted reservation ${reservationId} to DEBIT for user ${reservation.user_id}: €${reservation.amount} (PI: ${stripePaymentIntentId || 'none'})`,
      );

      // Create ledger entry for debit
      const ledgerEntry = queryRunner.manager.create(UserCreditsLedger, {
        user_id: reservation.user_id,
        type: CreditLedgerType.DEBIT,
        amount: reservation.amount,
        currency: 'EUR',
        order_id: reservation.order_id,
        stripe_payment_intent_id:
          stripePaymentIntentId || reservation.stripe_payment_intent_id,
        note: `Debited €${typeof reservation.amount === 'number' ? reservation.amount.toFixed(2) : parseFloat(String(reservation.amount)).toFixed(2)} for order ${reservation.order_id} (converted from reservation)`,
      });
      await queryRunner.manager.save(ledgerEntry);

      // Balance already reduced during reservation - no change needed

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Failed to convert reservation ${reservationId} to debit: ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Add credits to user balance (cashback, admin adjustment, etc.)
   * @param stripePaymentIntentId - For idempotency (prevents double cashback)
   */
  async addCredits(
    userId: string,
    amount: number,
    type: CreditLedgerType = CreditLedgerType.CREDIT,
    orderId?: string,
    note?: string,
    stripePaymentIntentId?: string,
  ): Promise<void> {
    if (amount <= 0) {
      throw new BadRequestException('Credit amount must be positive');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Ensure balance row exists
      await this.ensureBalanceExists(userId, queryRunner);

      // Check idempotency: if CREDIT already exists for this PI + type
      if (stripePaymentIntentId) {
        const existingCredit = await queryRunner.manager.findOne(
          UserCreditsLedger,
          {
            where: {
              stripe_payment_intent_id: stripePaymentIntentId,
              type: CreditLedgerType.CREDIT,
            },
          },
        );
        if (existingCredit) {
          this.logger.log(
            `[CASHBACK] duplicate (stripe_pi_id=${stripePaymentIntentId}, type=CREDIT) - idempotent skip`,
          );
          await queryRunner.commitTransaction();
          return;
        }
      }

      // Create ledger entry
      const ledgerEntry = queryRunner.manager.create(UserCreditsLedger, {
        user_id: userId,
        type,
        amount,
        currency: 'EUR',
        order_id: orderId || null,
        stripe_payment_intent_id: stripePaymentIntentId || null,
        note: note || `Added €${amount.toFixed(2)} credits`,
      });
      await queryRunner.manager.save(ledgerEntry);

      this.logger.log(
        `Added €${amount} credits to user ${userId} (type: ${type}, order: ${orderId || 'none'}, PI: ${stripePaymentIntentId || 'none'})`,
      );

      // ENHANCED DIAGNOSTICS: Comprehensive parameter validation
      this.logger.log(`[CASHBACK DIAGNOSTIC] Input validation:`);
      this.logger.log(`  - userId: ${userId} (type: ${typeof userId})`);
      this.logger.log(`  - orderId: ${orderId} (type: ${typeof orderId})`);
      this.logger.log(
        `  - amount: ${amount} (type: ${typeof amount}, constructor: ${amount.constructor.name})`,
      );
      this.logger.log(`  - currency: EUR`);
      this.logger.log(`  - ledger type: ${type}`);
      this.logger.log(`  - stripe_payment_intent_id: ${stripePaymentIntentId}`);

      // Verify balance row exists before update
      const balanceBeforeUpdate = await queryRunner.manager.findOne(
        UserCreditsBalance,
        {
          where: { user_id: userId },
        },
      );

      if (!balanceBeforeUpdate) {
        this.logger.error(
          `[CASHBACK ERROR] Balance row does NOT exist for user ${userId} - ensureBalanceExists failed!`,
        );
        throw new Error(`Balance row missing for user ${userId}`);
      }

      this.logger.log(`[CASHBACK DIAGNOSTIC] Balance BEFORE update:`);
      this.logger.log(
        `  - balance: ${balanceBeforeUpdate.balance} (type: ${typeof balanceBeforeUpdate.balance})`,
      );
      this.logger.log(
        `  - lifetime_earned: ${balanceBeforeUpdate.lifetime_earned} (type: ${typeof balanceBeforeUpdate.lifetime_earned})`,
      );
      this.logger.log(`  - currency: ${balanceBeforeUpdate.currency}`);

      // CRITICAL: Ensure amount is a JavaScript number (not string)
      const decimalAmount = Number(amount);
      if (isNaN(decimalAmount)) {
        throw new Error(
          `Invalid amount: ${amount} cannot be converted to number`,
        );
      }

      this.logger.log(
        `[CASHBACK] table=user_credits_balances amount=${decimalAmount} typeof=${typeof decimalAmount}`,
      );

      // Update balance using raw SQL with explicit DECIMAL cast
      const updateBalanceResult = await queryRunner.manager.query(
        `UPDATE user_credits_balances 
         SET balance = balance + CAST(? AS DECIMAL(12,2))
         WHERE user_id = ?`,
        [decimalAmount, userId],
      );

      // Robust affectedRows detection (varies by MySQL driver version)
      this.logger.log(
        `[CASHBACK] Raw UPDATE result: ${JSON.stringify(updateBalanceResult)}`,
      );

      const balanceAffectedRows =
        updateBalanceResult?.affectedRows ??
        updateBalanceResult?.[0]?.affectedRows ??
        (Array.isArray(updateBalanceResult) && updateBalanceResult.length > 0
          ? updateBalanceResult[0]
          : 0) ??
        0;

      this.logger.log(`[CASHBACK] updateRows=${balanceAffectedRows}`);

      // CRITICAL: Throw if UPDATE didn't match any rows (silent failure prevention)
      if (balanceAffectedRows === 0) {
        this.logger.error(
          `[CASHBACK ERROR] Balance UPDATE matched 0 rows! userId: ${userId}, currency: EUR, table: user_credits_balances`,
        );
        throw new Error(
          `Failed to update balance for user ${userId}: UPDATE matched 0 rows (user_id or currency mismatch)`,
        );
      }

      // If this is earned (cashback, etc.), also increment lifetime_earned
      if (type === CreditLedgerType.CREDIT) {
        const updateLifetimeResult = await queryRunner.manager.query(
          `UPDATE user_credits_balances 
           SET lifetime_earned = lifetime_earned + CAST(? AS DECIMAL(12,2))
           WHERE user_id = ?`,
          [decimalAmount, userId],
        );

        this.logger.log(
          `[CASHBACK] Raw lifetime UPDATE result: ${JSON.stringify(updateLifetimeResult)}`,
        );

        const lifetimeAffectedRows =
          updateLifetimeResult?.affectedRows ??
          updateLifetimeResult?.[0]?.affectedRows ??
          0;

        this.logger.log(
          `[CASHBACK] lifetimeUpdateRows=${lifetimeAffectedRows}`,
        );

        // CRITICAL: Throw if UPDATE didn't match any rows
        if (lifetimeAffectedRows === 0) {
          this.logger.error(
            `[CASHBACK ERROR] Lifetime UPDATE matched 0 rows! userId: ${userId}`,
          );
          throw new Error(
            `Failed to update lifetime_earned for user ${userId}: UPDATE matched 0 rows`,
          );
        }
      }

      // Verify update succeeded (for debugging)
      const verifyBalance = await queryRunner.manager.findOne(
        UserCreditsBalance,
        {
          where: { user_id: userId },
        },
      );

      if (!verifyBalance) {
        this.logger.error(
          `[CASHBACK ERROR] Balance row disappeared after update!`,
        );
        throw new Error(`Balance row missing after update for user ${userId}`);
      }

      this.logger.log(
        `[CASHBACK] readback balance=${verifyBalance.balance} lifetime=${verifyBalance.lifetime_earned}`,
      );

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Failed to add credits to user ${userId}: ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Get user's ledger history
   */
  async getLedger(userId: string, limit = 50): Promise<UserCreditsLedger[]> {
    return this.ledgerRepository.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get user's active reservations
   */
  async getActiveReservations(
    userId: string,
  ): Promise<UserCreditsReservation[]> {
    return this.reservationRepository.find({
      where: { user_id: userId, status: ReservationStatus.ACTIVE },
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Find reservation by Stripe Payment Intent ID
   */
  async findReservationByPaymentIntent(
    stripePaymentIntentId: string,
  ): Promise<UserCreditsReservation | null> {
    return this.reservationRepository.findOne({
      where: {
        stripe_payment_intent_id: stripePaymentIntentId,
        status: ReservationStatus.ACTIVE,
      },
    });
  }

  /**
   * Update reservation with Stripe Payment Intent ID
   */
  async updateReservationPaymentIntent(
    reservationId: string,
    stripePaymentIntentId: string,
  ): Promise<void> {
    await this.reservationRepository.update(
      { id: reservationId },
      { stripe_payment_intent_id: stripePaymentIntentId },
    );
    this.logger.log(
      `Updated reservation ${reservationId} with PI ${stripePaymentIntentId}`,
    );
  }

  async getReservationById(
    reservationId: string,
  ): Promise<UserCreditsReservation | null> {
    return await this.reservationRepository.findOne({
      where: { id: reservationId },
    });
  }

  async createReservationWithIdempotency(
    userId: string,
    amountStr: string,
    currency: string,
    idempotencyKey: string,
    orderId?: string,
    note?: string,
    expiresInSeconds?: number,
  ): Promise<{
    reservationId: string;
    status: string;
    amount: string;
    currency: string;
    balanceAfterReservation: string;
  }> {
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      throw new BadRequestException('Invalid amount');
    }

    const existingReservation = await this.reservationRepository.findOne({
      where: {
        user_id: userId,
        stripe_payment_intent_id: idempotencyKey,
        status: ReservationStatus.ACTIVE,
      },
    });

    if (existingReservation) {
      const balance = await this.getBalance(userId);
      return {
        reservationId: existingReservation.id,
        status: 'PENDING',
        amount: existingReservation.amount.toString(),
        currency: currency || 'EUR',
        balanceAfterReservation: balance.balance.toString(),
      };
    }

    const reservation = await this.reserveCredits(
      userId,
      orderId || `temp-${Date.now()}`,
      amount,
      idempotencyKey,
    );

    const balance = await this.getBalance(userId);

    return {
      reservationId: reservation.id,
      status: 'PENDING',
      amount: amount.toString(),
      currency: currency || 'EUR',
      balanceAfterReservation: balance.balance.toString(),
    };
  }

  async confirmReservationWithIdempotency(
    reservationId: string,
    orderId: string,
    idempotencyKey: string,
  ): Promise<{
    reservationId: string;
    status: string;
    capturedAmount: string;
    currency: string;
    newBalance: string;
  }> {
    const reservation = await this.reservationRepository.findOne({
      where: { id: reservationId },
    });

    if (!reservation) {
      throw new BadRequestException('Reservation not found');
    }

    if (reservation.status === ReservationStatus.CONVERTED) {
      const balance = await this.getBalance(reservation.user_id);
      return {
        reservationId: reservation.id,
        status: 'CONFIRMED',
        capturedAmount: reservation.amount.toString(),
        currency: 'EUR',
        newBalance: balance.balance.toString(),
      };
    }

    if (reservation.status !== ReservationStatus.ACTIVE) {
      throw new BadRequestException(
        `Cannot confirm reservation with status ${reservation.status}`,
      );
    }

    await this.convertReservationToDebit(reservationId, idempotencyKey);

    const balance = await this.getBalance(reservation.user_id);

    return {
      reservationId: reservation.id,
      status: 'CONFIRMED',
      capturedAmount: reservation.amount.toString(),
      currency: 'EUR',
      newBalance: balance.balance.toString(),
    };
  }

  async cancelReservationWithIdempotency(
    reservationId: string,
    note?: string,
  ): Promise<{
    reservationId: string;
    status: string;
    amountReleased: string;
    currency: string;
    newBalance: string;
  }> {
    const reservation = await this.reservationRepository.findOne({
      where: { id: reservationId },
    });

    if (!reservation) {
      throw new BadRequestException('Reservation not found');
    }

    if (reservation.status === ReservationStatus.RELEASED) {
      const balance = await this.getBalance(reservation.user_id);
      return {
        reservationId: reservation.id,
        status: 'CANCELED',
        amountReleased: reservation.amount.toString(),
        currency: 'EUR',
        newBalance: balance.balance.toString(),
      };
    }

    if (reservation.status !== ReservationStatus.ACTIVE) {
      throw new BadRequestException(
        `Cannot cancel reservation with status ${reservation.status}`,
      );
    }

    await this.releaseReservation(reservationId, note);

    const balance = await this.getBalance(reservation.user_id);

    return {
      reservationId: reservation.id,
      status: 'CANCELED',
      amountReleased: reservation.amount.toString(),
      currency: 'EUR',
      newBalance: balance.balance.toString(),
    };
  }

  async refundCreditsWithIdempotency(
    userId: string,
    orderId: string,
    amountStr: string,
    idempotencyKey: string,
    note?: string,
  ): Promise<{
    refunded: string;
    currency: string;
    newBalance: string;
  }> {
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      throw new BadRequestException('Invalid refund amount');
    }

    const existingRefund = await this.ledgerRepository.findOne({
      where: {
        user_id: userId,
        order_id: orderId,
        type: CreditLedgerType.REFUND,
        stripe_payment_intent_id: idempotencyKey,
      },
    });

    if (existingRefund) {
      const balance = await this.getBalance(userId);
      return {
        refunded: existingRefund.amount.toString(),
        currency: 'EUR',
        newBalance: balance.balance.toString(),
      };
    }

    await this.addCredits(
      userId,
      amount,
      CreditLedgerType.REFUND,
      orderId,
      note || `Refund for order ${orderId}: €${amount.toFixed(2)}`,
      idempotencyKey,
    );

    const balance = await this.getBalance(userId);

    return {
      refunded: amount.toString(),
      currency: 'EUR',
      newBalance: balance.balance.toString(),
    };
  }
}
