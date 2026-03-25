import { IsEmail, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

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
}
