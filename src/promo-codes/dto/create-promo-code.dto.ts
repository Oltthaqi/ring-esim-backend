import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  Max,
  IsEnum,
  IsOptional,
  IsDateString,
  Length,
} from 'class-validator';
import { PromoCodeStatus } from '../entities/promo-code.entity';

export class CreatePromoCodeDto {
  @ApiProperty({
    description: 'Promo code (case-insensitive, will be stored as uppercase)',
    example: 'SUMMER25',
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  code: string;

  @ApiProperty({
    description: 'Admin-friendly name for the promo code',
    example: 'Summer 2025 Promotion',
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 255)
  name: string;

  @ApiProperty({
    description: 'Percentage discount (0.01 to 100.00)',
    example: 25.5,
    minimum: 0.01,
    maximum: 100.0,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100.0)
  percent_off: number;

  @ApiPropertyOptional({
    description: 'Promo code status',
    enum: PromoCodeStatus,
    default: PromoCodeStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(PromoCodeStatus)
  status?: PromoCodeStatus;

  @ApiPropertyOptional({
    description: 'Start date (ISO 8601). If null, effective immediately.',
    example: '2025-06-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  start_at?: string;

  @ApiPropertyOptional({
    description: 'End date (ISO 8601). If null, no expiry.',
    example: '2025-08-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  end_at?: string;
}
