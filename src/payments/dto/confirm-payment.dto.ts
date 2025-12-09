import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ConfirmPaymentDto {
  @ApiProperty({
    description: 'Payment Intent ID from Stripe',
    example: 'pi_1234567890abcdef',
  })
  @IsString()
  paymentIntentId: string;
}

