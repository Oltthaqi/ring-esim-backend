import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, Min, Matches } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateReservationDto {
  @ApiProperty({
    description: 'Amount to reserve in EUR',
    example: '10.50',
    pattern: '^\\d+(\\.\\d{1,2})?$',
  })
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'Amount must be a valid decimal with up to 2 decimal places',
  })
  amount: string;

  @ApiProperty({
    description: 'Currency code',
    example: 'EUR',
    default: 'EUR',
    required: false,
  })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({
    description: 'Reason for reservation',
    example: 'Order checkout',
    required: false,
  })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiProperty({
    description: 'Associated order ID',
    example: 'ord_123',
    required: false,
  })
  @IsOptional()
  @IsString()
  orderId?: string;

  @ApiProperty({
    description: 'Additional note',
    required: false,
  })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiProperty({
    description: 'Reservation expiry time in seconds',
    example: 900,
    default: 1800,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(60)
  @Type(() => Number)
  expiresInSeconds?: number;
}
