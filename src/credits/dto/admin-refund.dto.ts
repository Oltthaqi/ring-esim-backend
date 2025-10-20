import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, Matches } from 'class-validator';

export class AdminRefundDto {
  @ApiProperty({
    description: 'User ID to refund',
    example: 'user_123',
  })
  @IsString()
  userId: string;

  @ApiProperty({
    description: 'Order ID for the refund',
    example: 'ord_123',
  })
  @IsString()
  orderId: string;

  @ApiProperty({
    description: 'Amount to refund in EUR',
    example: '10.50',
    pattern: '^\\d+(\\.\\d{1,2})?$',
  })
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'Amount must be a valid decimal with up to 2 decimal places',
  })
  amount: string;

  @ApiProperty({
    description: 'Refund note',
    required: false,
  })
  @IsOptional()
  @IsString()
  note?: string;
}
