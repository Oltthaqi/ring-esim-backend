import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsDateString,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderType } from '../entities/order.entity';

export class CreateOrderDto {
  @ApiProperty({
    description: 'Package Template ID to purchase',
    example: '594193',
  })
  @IsString()
  packageTemplateId: string;

  @ApiPropertyOptional({
    description: 'Type of order - defaults to one-time',
    enum: OrderType,
    example: OrderType.ONE_TIME,
    default: OrderType.ONE_TIME,
  })
  @IsEnum(OrderType)
  @IsOptional()
  orderType?: OrderType;

  @ApiProperty({
    description: 'Order amount',
    example: 1.99,
    type: 'number',
  })
  @IsNumber()
  amount: number;

  @ApiPropertyOptional({
    description: 'Currency code (defaults to USD)',
    example: 'EUR',
    default: 'USD',
  })
  @IsString()
  @IsOptional()
  currency?: string;

  // Advanced fields (optional - for specific use cases only)
  // Note: Most users should use POST /orders/simple instead
  @ApiPropertyOptional({
    description: 'Subscriber ID for existing subscriber (advanced use only)',
    example: 28345617,
    type: 'number',
  })
  @IsNumber()
  @IsOptional()
  subscriberId?: number;

  @ApiPropertyOptional({
    description: 'IMSI for subscriber identification (advanced use only)',
    example: '123456789012345',
  })
  @IsString()
  @IsOptional()
  imsi?: string;

  @ApiPropertyOptional({
    description: 'ICCID for subscriber identification (advanced use only)',
    example: '8948010000054019245',
  })
  @IsString()
  @IsOptional()
  iccid?: string;

  @ApiPropertyOptional({
    description:
      'MSISDN (phone number) for subscriber identification (advanced use only)',
    example: '+1234567890',
  })
  @IsString()
  @IsOptional()
  msisdn?: string;

  @ApiPropertyOptional({
    description:
      'Activation code for subscriber identification (advanced use only)',
    example: 'K2-2KPOHA-9P0O2H',
  })
  @IsString()
  @IsOptional()
  activationCode?: string;

  // Package configuration (advanced options - optional)
  @ApiPropertyOptional({
    description:
      'Validity period in days (uses package default if not specified)',
    example: 7,
    minimum: 1,
    maximum: 365,
  })
  @IsNumber()
  @IsOptional()
  validityPeriod?: number;

  @ApiPropertyOptional({
    description: 'Start date and time for package activation',
    example: '2024-01-15T10:00:00Z',
    format: 'date-time',
  })
  @IsDateString()
  @IsOptional()
  activePeriodStart?: string;

  @ApiPropertyOptional({
    description: 'End date and time for package expiration',
    example: '2024-02-15T10:00:00Z',
    format: 'date-time',
  })
  @IsDateString()
  @IsOptional()
  activePeriodEnd?: string;

  @ApiPropertyOptional({
    description: 'Start time for recurring packages (UTC)',
    example: '2024-01-15T10:00:00Z',
    format: 'date-time',
  })
  @IsDateString()
  @IsOptional()
  startTimeUTC?: string;

  @ApiPropertyOptional({
    description: 'Whether to activate package on first use',
    example: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  activationAtFirstUse?: boolean;
}
