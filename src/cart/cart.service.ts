import { Injectable } from '@nestjs/common';
import { PromoCodesService } from '../promo-codes/promo-codes.service';
import { CreditsService } from '../credits/credits.service';
import {
  PricePreviewDto,
  PricePreviewResponseDto,
  RewardType,
} from './dto/price-preview.dto';

@Injectable()
export class CartService {
  constructor(
    private readonly promoCodesService: PromoCodesService,
    private readonly creditsService: CreditsService,
  ) {}

  /**
   * Calculate pricing preview without creating an order
   * Follows the exact calculation order specified:
   * 1. Promo discount
   * 2. Reward (cashback or discount)
   * 3. Credits applied
   */
  async calculatePricePreview(
    dto: PricePreviewDto,
    userId: string,
  ): Promise<PricePreviewResponseDto> {
    const subtotal = dto.subtotal;
    const currency = dto.currency || 'EUR';
    const rewardType = dto.rewardType || RewardType.NONE;

    let promoPercent = 0;
    let promoCode: string | undefined;

    // Step 1: Validate promo code if provided
    if (dto.promoCode) {
      const promoValidation =
        await this.promoCodesService.simpleValidatePromoCode(dto.promoCode);

      if (promoValidation.valid && promoValidation.code) {
        promoPercent = promoValidation.code.percent_off;
        promoCode = promoValidation.code.code;
      }
    }

    // Step 2: Calculate promo discount
    const discount_from_promo = this.round(subtotal * (promoPercent / 100));
    const after_promo = subtotal - discount_from_promo;

    // Step 3: Calculate reward discount or cashback
    let discount_from_reward = 0;
    let cashback_to_accrue = 0;

    if (rewardType === RewardType.DISCOUNT_3) {
      // 3% instant discount on after_promo amount
      discount_from_reward = this.round(after_promo * 0.03);
    } else if (rewardType === RewardType.CASHBACK_10) {
      // 10% cashback to be added after payment (not a discount)
      cashback_to_accrue = this.round(after_promo * 0.1);
    }

    const after_reward = after_promo - discount_from_reward;

    // Step 4: Calculate credits applied
    const available_credits =
      await this.creditsService.getAvailableBalance(userId);
    let credits_applied = 0;

    if (dto.creditsToUse && dto.creditsToUse > 0) {
      // User wants to use credits - clamp to available and after_reward
      credits_applied = Math.min(
        dto.creditsToUse,
        available_credits,
        after_reward,
      );
    }

    const amount_due = Math.max(0, this.round(after_reward - credits_applied));

    // Step 5: Calculate totals
    const total_discount = discount_from_promo + discount_from_reward;
    const total_amount = this.round(subtotal - total_discount);

    return {
      subtotal,
      currency,
      discount_from_promo,
      after_promo,
      reward_type: rewardType,
      discount_from_reward,
      cashback_to_accrue,
      after_reward,
      credits_applied,
      amount_due,
      total_discount,
      total_amount,
      promo: promoCode
        ? {
            code: promoCode,
            percent_off: promoPercent,
          }
        : undefined,
      available_credits,
    };
  }

  /**
   * Banker's rounding to 2 decimal places
   */
  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
