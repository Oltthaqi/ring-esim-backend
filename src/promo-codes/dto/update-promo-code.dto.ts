import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  Min,
  Max,
  IsEnum,
  IsOptional,
  IsDateString,
  Length,
} from 'class-validator';
import { PromoCodeStatus } from '../entities/promo-code.entity';

export class UpdatePromoCodeDto {
  @ApiPropertyOptional({
    description: 'Admin-friendly name for the promo code',
    example: 'Winter 2025 Promotion',
  })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  name?: string;

  @ApiPropertyOptional({
    description: 'Percentage discount (0.01 to 100.00)',
    example: 30.0,
    minimum: 0.01,
    maximum: 100.0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100.0)
  percent_off?: number;

  @ApiPropertyOptional({
    description: 'Promo code status',
    enum: PromoCodeStatus,
  })
  @IsOptional()
  @IsEnum(PromoCodeStatus)
  status?: PromoCodeStatus;

  @ApiPropertyOptional({
    description: 'Start date (ISO 8601)',
    example: '2025-06-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  start_at?: string;

  @ApiPropertyOptional({
    description: 'End date (ISO 8601)',
    example: '2025-08-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  end_at?: string;
}
