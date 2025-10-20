import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class ConfirmReservationDto {
  @ApiProperty({
    description: 'Order ID to associate with the confirmed reservation',
    example: 'ord_123',
  })
  @IsString()
  orderId: string;

  @ApiProperty({
    description: 'Additional note for confirmation',
    required: false,
  })
  @IsOptional()
  @IsString()
  note?: string;
}
