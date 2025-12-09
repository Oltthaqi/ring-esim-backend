import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class SimpleValidatePromoCodeDto {
  @ApiProperty({
    description: 'Promo code to validate',
    example: 'SUMMER25',
  })
  @IsString()
  @IsNotEmpty()
  code: string;
}

export class SimpleValidatePromoCodeResponseDto {
  @ApiProperty({
    description: 'Whether the code is valid',
    example: true,
  })
  valid: boolean;

  @ApiProperty({
    description: 'The validated promo code details',
    required: false,
  })
  code?: {
    id: string;
    code: string;
    name: string;
    percent_off: number;
  };

  @ApiProperty({
    description: 'Reason why the code is invalid',
    required: false,
    enum: [
      'CODE_NOT_FOUND',
      'CODE_INACTIVE',
      'CODE_NOT_YET_VALID',
      'CODE_EXPIRED',
    ],
  })
  reason?: string;

  @ApiProperty({
    description: 'Human-readable error message',
    required: false,
    example: 'This promo code has expired',
  })
  message?: string;
}
