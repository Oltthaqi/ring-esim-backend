import { IsString, IsOptional, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSimpleOrderDto {
  @ApiProperty({
    description: 'Package Template ID to purchase',
    example: '594193',
  })
  @IsString()
  packageTemplateId: string;

  @ApiProperty({
    description: 'Order amount',
    example: 1.99,
    type: 'number',
  })
  @IsNumber()
  amount: number;

  @ApiPropertyOptional({
    description: 'Currency code (defaults to USD)',
    example: 'EUR',
    default: 'USD',
  })
  @IsString()
  @IsOptional()
  currency?: string;
}
