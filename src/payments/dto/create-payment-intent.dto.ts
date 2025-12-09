import { IsString, IsNumber, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePaymentIntentDto {
  @ApiProperty({
    description: 'Order ID for the eSIM purchase or top-up',
    example: '30ea3a42-9f35-465b-b407-d3de3571a943',
  })
  @IsString()
  orderId: string;

  @ApiProperty({
    description: 'Amount to charge (in dollars)',
    example: 25.99,
    minimum: 0.5,
  })
  @IsNumber()
  @Min(0.5)
  amount: number;

  @ApiPropertyOptional({
    description: 'Currency code',
    example: 'USD',
    default: 'USD',
  })
  @IsString()
  @IsOptional()
  currency?: string;
}
