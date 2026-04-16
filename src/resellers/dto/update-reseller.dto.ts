import {
  IsBoolean,
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateResellerDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  contactEmail?: string | null;

  @IsOptional()
  @IsNumber()
  creditLimit?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPct?: number;

  @IsOptional()
  @IsBoolean()
  allowDebt?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
