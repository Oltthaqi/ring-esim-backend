import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TopupBalanceDto {
  @ApiProperty({
    description: 'Amount to add (must be positive)',
    example: 100,
  })
  @IsNumber()
  @Min(0.0001)
  amount: number;

  @ApiPropertyOptional({ description: 'Description for the top-up' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  description?: string;
}
