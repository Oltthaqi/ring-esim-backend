import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateResellerOrderDto {
  @ApiProperty({ description: 'Upstream OCS template ID', example: 553 })
  @IsInt()
  @Min(1)
  upstreamTemplateId: number;

  @ApiPropertyOptional({
    description: 'Custom validity period in days (overrides template default)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  validityPeriod?: number;

  @ApiPropertyOptional({ description: 'Optional notes (e.g. customer name)' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  notes?: string;
}
