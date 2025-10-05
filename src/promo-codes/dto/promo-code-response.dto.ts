import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PromoCodeStatus } from '../entities/promo-code.entity';

export class PromoCodeResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  code: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  percent_off: number;

  @ApiProperty({ enum: PromoCodeStatus })
  status: PromoCodeStatus;

  @ApiPropertyOptional()
  start_at: Date | null;

  @ApiPropertyOptional()
  end_at: Date | null;

  @ApiProperty()
  created_at: Date;

  @ApiProperty()
  updated_at: Date;
}

export class ValidatePromoCodeResponseDto {
  @ApiProperty()
  valid: boolean;

  @ApiPropertyOptional({
    type: 'object',
    properties: {
      id: { type: 'string' },
      code: { type: 'string' },
      name: { type: 'string' },
      percent_off: { type: 'number' },
    },
  })
  code?: {
    id: string;
    code: string;
    name: string;
    percent_off: number;
  };

  @ApiPropertyOptional({
    enum: [
      'CODE_NOT_FOUND',
      'CODE_INACTIVE',
      'CODE_NOT_YET_VALID',
      'CODE_EXPIRED',
      'ORDER_LOCKED',
    ],
  })
  reason?: string;
}

export class OrderPricingResponseDto {
  @ApiProperty()
  orderId: string;

  @ApiProperty()
  currency: string;

  @ApiProperty()
  subtotal_amount: number;

  @ApiPropertyOptional({
    type: 'object',
    properties: {
      code: { type: 'string' },
      name: { type: 'string' },
      percent: { type: 'number' },
    },
  })
  promo: {
    code: string;
    name: string;
    percent: number;
  } | null;

  @ApiProperty()
  discount_amount: number;

  @ApiProperty()
  total_amount: number;
}
