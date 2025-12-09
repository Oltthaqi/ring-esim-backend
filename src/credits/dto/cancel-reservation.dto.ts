import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CancelReservationDto {
  @ApiProperty({
    description: 'Reason for cancellation',
    required: false,
  })
  @IsOptional()
  @IsString()
  note?: string;
}
