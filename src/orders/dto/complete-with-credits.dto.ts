import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CompleteWithCreditsDto {
  @ApiProperty({
    description: 'Reservation ID to capture',
    required: false,
    example: 'res-uuid-here',
  })
  @IsOptional()
  @IsString()
  reservationId?: string;
}
