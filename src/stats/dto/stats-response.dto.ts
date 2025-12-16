import { ApiProperty } from '@nestjs/swagger';

export class DashboardStatsDto {
  @ApiProperty({ description: 'Total number of users', example: 1250 })
  totalUsers: number;

  @ApiProperty({ description: 'Number of active eSIMs', example: 342 })
  activeEsims: number;

  @ApiProperty({ description: 'Total revenue', example: 45678.90 })
  revenue: number;

  @ApiProperty({ description: 'Total number of orders', example: 892 })
  orders: number;
}

export class MoneyFlowDataPointDto {
  @ApiProperty({ description: 'Period label', example: 'Week 1' })
  period: string;

  @ApiProperty({ description: 'Revenue for this period', example: 8500.50 })
  revenue: number;
}

export class MoneyFlowResponseDto {
  @ApiProperty({ description: 'Money flow data points', type: [MoneyFlowDataPointDto] })
  data: MoneyFlowDataPointDto[];

  @ApiProperty({ description: 'Total revenue for the period', example: 50000.00 })
  total: number;
}

export class CountryUsageDto {
  @ApiProperty({ description: 'Country name', example: 'USA' })
  country: string;

  @ApiProperty({ description: 'Number of orders/purchases', example: 245 })
  count: number;

  @ApiProperty({ description: 'Percentage of total', example: 35.5 })
  percentage: number;
}

export class UsedCountriesResponseDto {
  @ApiProperty({ description: 'Country usage data', type: [CountryUsageDto] })
  data: CountryUsageDto[];

  @ApiProperty({ description: 'Total orders for the period', example: 690 })
  total: number;
}

export class TopEsimDto {
  @ApiProperty({ description: 'Rank position', example: 1 })
  rank: number;

  @ApiProperty({ description: 'Package template name', example: 'Europe 5GB' })
  product: string;

  @ApiProperty({ description: 'Country/Zone name', example: 'Germany' })
  country: string;

  @ApiProperty({ description: 'Number of purchases', example: 245 })
  purchases: number;

  @ApiProperty({ description: 'Total revenue', example: 6357.55 })
  revenue: number;
}

export class TopEsimsResponseDto {
  @ApiProperty({ description: 'Top 5 eSIMs', type: [TopEsimDto] })
  data: TopEsimDto[];
}

