import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, IsEnum } from 'class-validator';

export enum RewardType {
  NONE = 'NONE',
  CASHBACK_10 = 'CASHBACK_10',
  DISCOUNT_3 = 'DISCOUNT_3',
}

export class PricePreviewDto {
  @ApiProperty({
    example: 41.99,
    description: 'Order subtotal before any discounts',
  })
  @IsNumber()
  subtotal: number;

  @ApiProperty({ example: 'EUR', default: 'EUR' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiProperty({ example: 'SUMMER10', required: false })
  @IsString()
  @IsOptional()
  promoCode?: string;

  @ApiProperty({ enum: RewardType, default: RewardType.NONE, required: false })
  @IsEnum(RewardType)
  @IsOptional()
  rewardType?: RewardType;

  @ApiProperty({
    example: 10.0,
    description: 'Credits to use (or max available)',
    required: false,
  })
  @IsNumber()
  @IsOptional()
  creditsToUse?: number;
}

export class PricePreviewResponseDto {
  @ApiProperty({ example: 41.99 })
  subtotal: number;

  @ApiProperty({ example: 'EUR' })
  currency: string;

  @ApiProperty({ example: 4.2, description: 'Discount from promo code' })
  discount_from_promo: number;

  @ApiProperty({ example: 37.79, description: 'Amount after promo' })
  after_promo: number;

  @ApiProperty({ example: 'CASHBACK_10' })
  reward_type: RewardType;

  @ApiProperty({
    example: 0,
    description: 'Discount from reward (3% discount only)',
  })
  discount_from_reward: number;

  @ApiProperty({
    example: 3.78,
    description: 'Cashback to earn after payment (cashback only)',
  })
  cashback_to_accrue: number;

  @ApiProperty({ example: 37.79, description: 'Amount after reward' })
  after_reward: number;

  @ApiProperty({ example: 10.0, description: 'Credits applied' })
  credits_applied: number;

  @ApiProperty({ example: 27.79, description: 'Final amount due' })
  amount_due: number;

  @ApiProperty({ example: 4.2, description: 'Total discount (promo + reward)' })
  total_discount: number;

  @ApiProperty({
    example: 37.79,
    description: 'Total amount (subtotal - total_discount)',
  })
  total_amount: number;

  @ApiProperty()
  promo?: {
    code: string;
    percent_off: number;
  };

  @ApiProperty({ example: 25.0, description: 'User available balance' })
  available_credits: number;
}
