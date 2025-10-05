import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUUID } from 'class-validator';

export class ValidatePromoCodeDto {
  @ApiProperty({
    description: 'Promo code to validate',
    example: 'SUMMER25',
  })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({
    description: 'Order ID to validate against',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsNotEmpty()
  orderId: string;
}

export class ApplyPromoCodeDto {
  @ApiProperty({
    description: 'Promo code to apply',
    example: 'SUMMER25',
  })
  @IsString()
  @IsNotEmpty()
  code: string;
}
