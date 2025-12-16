import { ApiProperty } from '@nestjs/swagger';

export class DashboardStatsDto {
  @ApiProperty({ description: 'Total number of users', example: 1250 })
  totalUsers: number;

  @ApiProperty({ description: 'Number of active eSIMs', example: 342 })
  activeEsims: number;

  @ApiProperty({ description: 'Total revenue', example: 45678.9 })
  revenue: number;

  @ApiProperty({ description: 'Total number of orders', example: 892 })
  orders: number;
}

export class MoneyFlowDataPointDto {
  @ApiProperty({ description: 'Period label', example: 'Week 1' })
  period: string;

  @ApiProperty({ description: 'Revenue for this period', example: 8500.5 })
  revenue: number;
}

export class MoneyFlowResponseDto {
  @ApiProperty({
    description: 'Money flow data points',
    type: [MoneyFlowDataPointDto],
  })
  data: MoneyFlowDataPointDto[];

  @ApiProperty({
    description: 'Total revenue for the period',
    example: 50000.0,
  })
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

export class CouponStatsDto {
  @ApiProperty({ description: 'Total number of coupons', example: 50 })
  totalCoupons: number;

  @ApiProperty({ description: 'Number of active coupons', example: 30 })
  activeCoupons: number;

  @ApiProperty({ description: 'Number of expired coupons', example: 20 })
  expiredCoupons: number;

  @ApiProperty({
    description: 'Most used coupon code',
    example: '10ESIM',
    nullable: true,
  })
  mostUsedCoupon: string | null;
}

export class EsimStatsDto {
  @ApiProperty({ description: 'Total number of locations/zones', example: 45 })
  totalLocations: number;

  @ApiProperty({ description: 'Total number of packages', example: 120 })
  totalPackages: number;

  @ApiProperty({
    description: 'Number of active eSIMs (from usage)',
    example: 342,
  })
  activeEsims: number;

  @ApiProperty({
    description: 'Number of eSIMs expiring soon (packageEndDate <= today)',
    example: 15,
  })
  esimsExpiringSoon: number;
}

export class OrderStatsDto {
  @ApiProperty({ description: 'Total number of orders', example: 892 })
  totalOrders: number;

  @ApiProperty({
    description: 'Number of successful (completed) orders',
    example: 750,
  })
  successfulOrders: number;

  @ApiProperty({
    description: 'Number of pending orders (pending or processing)',
    example: 120,
  })
  pendingOrders: number;

  @ApiProperty({
    description: 'Number of failed orders (failed or cancelled)',
    example: 22,
  })
  failedOrders: number;
}

export class UserStatsDto {
  @ApiProperty({
    description: 'Total number of users (excluding deleted)',
    example: 1250,
  })
  totalUsers: number;

  @ApiProperty({
    description: 'Number of new users (created within last 7 days)',
    example: 45,
  })
  newUsers: number;

  @ApiProperty({ description: 'Number of active users', example: 1100 })
  activeUsers: number;

  @ApiProperty({ description: 'Number of inactive users', example: 150 })
  inactiveUsers: number;
}
