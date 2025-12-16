import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { StatsService } from './stats.service';
import {
  DashboardStatsDto,
  MoneyFlowResponseDto,
  UsedCountriesResponseDto,
  TopEsimsResponseDto,
  CouponStatsDto,
  EsimStatsDto,
  OrderStatsDto,
  UserStatsDto,
} from './dto/stats-response.dto';
import {
  MoneyFlowQueryDto,
  UsedCountriesQueryDto,
  TimePeriod,
} from './dto/stats-query.dto';

@ApiTags('Stats')
@Controller('api/stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get dashboard statistics' })
  @ApiResponse({
    status: 200,
    description: 'Dashboard statistics retrieved successfully',
    type: DashboardStatsDto,
  })
  async getDashboardStats(): Promise<DashboardStatsDto> {
    return this.statsService.getDashboardStats();
  }

  @Get('money-flow')
  @ApiOperation({ summary: 'Get money flow chart data' })
  @ApiQuery({
    name: 'period',
    enum: TimePeriod,
    required: false,
    description: 'Time period filter (week, month, year)',
  })
  @ApiResponse({
    status: 200,
    description: 'Money flow data retrieved successfully',
    type: MoneyFlowResponseDto,
  })
  async getMoneyFlow(
    @Query() query: MoneyFlowQueryDto,
  ): Promise<MoneyFlowResponseDto> {
    return this.statsService.getMoneyFlow(query.period);
  }

  @Get('used-countries')
  @ApiOperation({ summary: 'Get used countries chart data' })
  @ApiQuery({
    name: 'period',
    enum: TimePeriod,
    required: false,
    description: 'Time period filter (week, month, year)',
  })
  @ApiResponse({
    status: 200,
    description: 'Used countries data retrieved successfully',
    type: UsedCountriesResponseDto,
  })
  async getUsedCountries(
    @Query() query: UsedCountriesQueryDto,
  ): Promise<UsedCountriesResponseDto> {
    return this.statsService.getUsedCountries(query.period);
  }

  @Get('top-esims')
  @ApiOperation({ summary: 'Get top 5 eSIMs bought (all time)' })
  @ApiResponse({
    status: 200,
    description: 'Top eSIMs data retrieved successfully',
    type: TopEsimsResponseDto,
  })
  async getTopEsims(): Promise<TopEsimsResponseDto> {
    return this.statsService.getTopEsims();
  }

  @Get('coupons')
  @ApiOperation({ summary: 'Get coupon statistics' })
  @ApiResponse({
    status: 200,
    description: 'Coupon statistics retrieved successfully',
    type: CouponStatsDto,
  })
  async getCouponStats(): Promise<CouponStatsDto> {
    return this.statsService.getCouponStats();
  }

  @Get('esims')
  @ApiOperation({ summary: 'Get eSIM statistics' })
  @ApiResponse({
    status: 200,
    description: 'eSIM statistics retrieved successfully',
    type: EsimStatsDto,
  })
  async getEsimStats(): Promise<EsimStatsDto> {
    return this.statsService.getEsimStats();
  }

  @Get('orders')
  @ApiOperation({ summary: 'Get order statistics' })
  @ApiResponse({
    status: 200,
    description: 'Order statistics retrieved successfully',
    type: OrderStatsDto,
  })
  async getOrderStats(): Promise<OrderStatsDto> {
    return this.statsService.getOrderStats();
  }

  @Get('users')
  @ApiOperation({ summary: 'Get user statistics' })
  @ApiResponse({
    status: 200,
    description: 'User statistics retrieved successfully',
    type: UserStatsDto,
  })
  async getUserStats(): Promise<UserStatsDto> {
    return this.statsService.getUserStats();
  }
}
