import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

export enum TimePeriod {
  WEEK = 'week',
  MONTH = 'month',
  YEAR = 'year',
}

export class MoneyFlowQueryDto {
  @ApiProperty({
    description: 'Time period filter',
    enum: TimePeriod,
    default: TimePeriod.MONTH,
    required: false,
  })
  @IsOptional()
  @IsEnum(TimePeriod)
  period?: TimePeriod = TimePeriod.MONTH;
}

export class UsedCountriesQueryDto {
  @ApiProperty({
    description: 'Time period filter',
    enum: TimePeriod,
    default: TimePeriod.MONTH,
    required: false,
  })
  @IsOptional()
  @IsEnum(TimePeriod)
  period?: TimePeriod = TimePeriod.MONTH;
}

