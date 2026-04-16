import {
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateResellerWithUserDto {
  @ApiProperty({ description: 'Reseller company name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    description: 'Telco reseller ID from OCS provider (defaults to 590)',
    default: 590,
  })
  @IsOptional()
  @IsNumber()
  telcoResellerId?: number;

  @ApiProperty({ description: 'Reseller admin email' })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Reseller admin password (min 10 chars, 1 number)',
  })
  @IsString()
  @MinLength(10)
  @Matches(/\d/, { message: 'Password must contain at least 1 number' })
  password: string;

  @ApiProperty({ description: 'Discount percentage (0-100)', example: 15 })
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPct: number;

  @ApiPropertyOptional({ description: 'Allow orders when balance is negative' })
  @IsOptional()
  allowDebt?: boolean;

  @ApiPropertyOptional({
    description: 'Maximum negative balance allowed (null = unlimited)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  creditLimit?: number;

  @ApiPropertyOptional({
    description: 'Initial balance to top up (creates TOPUP transaction)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  initialBalance?: number;

  @ApiPropertyOptional({
    description: 'Contact email for the reseller (defaults to admin email)',
  })
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiPropertyOptional({ description: 'Currency code', default: 'EUR' })
  @IsOptional()
  @IsString()
  currency?: string;
}
