import {
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TopupOrderDto {
  @ApiProperty({
    description: 'Package Template ID to add as top-up',
    example: '234593',
  })
  @IsString()
  packageTemplateId: string;

  @ApiProperty({
    description: 'Subscriber ID to top-up',
    example: 28345617,
    type: 'number',
  })
  @IsNumber()
  subscriberId: number;

  @ApiProperty({
    description: 'Top-up amount',
    example: 5.99,
    type: 'number',
  })
  @IsNumber()
  amount: number;

  @ApiPropertyOptional({
    description: 'Currency code (defaults to USD)',
    example: 'USD',
    default: 'USD',
  })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({
    description: 'Carry over remaining data from previous packages',
    example: true,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  reportUnitsPreviousPackage?: boolean;

  @ApiPropertyOptional({
    description: 'Validity period in days (optional - uses package default)',
    example: 30,
    minimum: 1,
    maximum: 365,
  })
  @IsNumber()
  @IsOptional()
  validityPeriod?: number;

  @ApiPropertyOptional({
    description: 'Start date and time for package activation (optional)',
    example: '2024-01-15T10:00:00Z',
    format: 'date-time',
  })
  @IsDateString()
  @IsOptional()
  activePeriodStart?: string;

  @ApiPropertyOptional({
    description: 'End date and time for package expiration (optional)',
    example: '2024-02-15T10:00:00Z',
    format: 'date-time',
  })
  @IsDateString()
  @IsOptional()
  activePeriodEnd?: string;
}
