import { IsNotEmpty, IsNumber, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AdjustBalanceDto {
  @ApiProperty({
    description: 'Adjustment amount (positive to add, negative to subtract)',
    example: -5.5,
  })
  @IsNumber()
  amount: number;

  @ApiProperty({ description: 'Reason for the adjustment (required)' })
  @IsString()
  @IsNotEmpty()
  description: string;
}
