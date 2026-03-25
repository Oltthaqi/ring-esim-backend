import {
  IsEmail,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateResellerDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsInt()
  @Min(1)
  telcoResellerId: number;

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
