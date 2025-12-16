import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersEntity } from '../users/entitites/users.entity';
import { Usage } from '../usage/entities/usage.entity';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { PackageTemplate } from '../package-template/entities/package-template.entity';
import {
  DashboardStatsDto,
  MoneyFlowResponseDto,
  MoneyFlowDataPointDto,
  UsedCountriesResponseDto,
  CountryUsageDto,
  TopEsimsResponseDto,
  TopEsimDto,
} from './dto/stats-response.dto';
import { TimePeriod } from './dto/stats-query.dto';

@Injectable()
export class StatsService {
  constructor(
    @InjectRepository(UsersEntity)
    private usersRepository: Repository<UsersEntity>,
    @InjectRepository(Usage)
    private usageRepository: Repository<Usage>,
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(PackageTemplate)
    private packageTemplateRepository: Repository<PackageTemplate>,
  ) {}

  async getDashboardStats(): Promise<DashboardStatsDto> {
    // Total users (excluding deleted)
    const totalUsers = await this.usersRepository.count({
      where: { is_deleted: false },
    });

    // Active eSIMs (from usage table where status is 'active' or isActive is true/1)
    const activeEsims = await this.usageRepository.count({
      where: [{ status: 'active' }, { isActive: true }],
    });

    // Total revenue from completed orders (using amount_due_after_credits)
    const revenueResult = await this.orderRepository
      .createQueryBuilder('orders')
      .select('COALESCE(SUM(orders.amount_due_after_credits), 0)', 'total')
      .where('orders.status = :status', { status: OrderStatus.COMPLETED })
      .getRawOne();

    const revenue = parseFloat(revenueResult?.total || '0');

    // Total orders count (only completed orders)
    const orders = await this.orderRepository.count({
      where: { status: OrderStatus.COMPLETED },
    });

    return {
      totalUsers,
      activeEsims,
      revenue,
      orders,
    };
  }

  async getMoneyFlow(
    period: TimePeriod = TimePeriod.MONTH,
  ): Promise<MoneyFlowResponseDto> {
    const now = new Date();
    let startDate: Date;
    let groupByFormat: string;
    let periodLabels: string[];
    let periodKeys: string[] = [];

    switch (period) {
      case TimePeriod.WEEK:
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        groupByFormat = '%Y-%m-%d';
        periodLabels = [];
        for (let i = 6; i >= 0; i--) {
          const date = new Date(now);
          date.setDate(date.getDate() - i);
          const dateStr = date.toISOString().split('T')[0];
          periodKeys.push(dateStr);
          periodLabels.push(`Day ${7 - i}`);
        }
        break;
      case TimePeriod.MONTH:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        groupByFormat = '%Y-%u'; // Week number (ISO week)
        periodLabels = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
        // Calculate week numbers for current month
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        for (let i = 0; i < 4; i++) {
          const weekDate = new Date(firstDay);
          weekDate.setDate(firstDay.getDate() + i * 7);
          const year = weekDate.getFullYear();
          // Get ISO week number
          const weekNum = this.getISOWeek(weekDate);
          periodKeys.push(`${year}-${String(weekNum).padStart(2, '0')}`);
        }
        break;
      case TimePeriod.YEAR:
        startDate = new Date(now.getFullYear(), 0, 1);
        groupByFormat = '%Y-%m';
        periodLabels = [
          'Jan',
          'Feb',
          'Mar',
          'Apr',
          'May',
          'Jun',
          'Jul',
          'Aug',
          'Sep',
          'Oct',
          'Nov',
          'Dec',
        ];
        const year = now.getFullYear();
        for (let i = 1; i <= 12; i++) {
          periodKeys.push(`${year}-${String(i).padStart(2, '0')}`);
        }
        break;
    }

    const results = await this.orderRepository
      .createQueryBuilder('order')
      .select(`DATE_FORMAT(order.created_at, '${groupByFormat}')`, 'period')
      .addSelect('COALESCE(SUM(order.amount_due_after_credits), 0)', 'revenue')
      .where('order.status = :status', { status: OrderStatus.COMPLETED })
      .andWhere('order.created_at >= :startDate', { startDate })
      .groupBy('period')
      .orderBy('period', 'ASC')
      .getRawMany();

    // Create a map of period -> revenue
    const revenueMap = new Map<string, number>();
    results.forEach((row) => {
      revenueMap.set(row.period, parseFloat(row.revenue || '0'));
    });

    // Fill in all periods with data (defaulting to 0 if no data)
    const data: MoneyFlowDataPointDto[] = periodLabels.map((label, index) => {
      const periodKey = periodKeys[index];
      return {
        period: label,
        revenue: revenueMap.get(periodKey) || 0,
      };
    });

    const total = data.reduce((sum, point) => sum + point.revenue, 0);

    return {
      data,
      total,
    };
  }

  private getISOWeek(date: Date): number {
    const d = new Date(
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
    );
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  }

  async getUsedCountries(
    period: TimePeriod = TimePeriod.MONTH,
  ): Promise<UsedCountriesResponseDto> {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case TimePeriod.WEEK:
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        break;
      case TimePeriod.MONTH:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case TimePeriod.YEAR:
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
    }

    // Get orders with package templates and location zones
    const orders = await this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.packageTemplate', 'package')
      .leftJoinAndSelect('package.zone', 'zone')
      .where('order.status = :status', { status: OrderStatus.COMPLETED })
      .andWhere('order.created_at >= :startDate', { startDate })
      .getMany();

    // Count by country from package zones
    const countryCountMap = new Map<string, number>();

    orders.forEach((order) => {
      if (order.packageTemplate?.zone) {
        const zone = order.packageTemplate.zone;
        const countryNames = zone.countryNames || [];

        if (countryNames.length > 0) {
          // Use the first country name as the primary country for this order
          // This prevents double-counting when a zone covers multiple countries
          const primaryCountry = countryNames[0];
          const currentCount = countryCountMap.get(primaryCountry) || 0;
          countryCountMap.set(primaryCountry, currentCount + 1);
        } else if (zone.zoneName) {
          // Fallback to zone name if no country names
          const currentCount = countryCountMap.get(zone.zoneName) || 0;
          countryCountMap.set(zone.zoneName, currentCount + 1);
        }
      } else if (order.packageTemplate?.zoneName) {
        // Fallback to package zone name
        const currentCount =
          countryCountMap.get(order.packageTemplate.zoneName) || 0;
        countryCountMap.set(order.packageTemplate.zoneName, currentCount + 1);
      }
    });

    const total = orders.length;

    // Convert to array and calculate percentages
    const data: CountryUsageDto[] = Array.from(countryCountMap.entries())
      .map(([country, count]) => ({
        country,
        count,
        percentage:
          total > 0 ? parseFloat(((count / total) * 100).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    return {
      data,
      total,
    };
  }

  async getTopEsims(): Promise<TopEsimsResponseDto> {
    // Get top 5 eSIMs by purchase count (all time)
    // First, get the aggregated data
    const results = await this.orderRepository
      .createQueryBuilder('order')
      .leftJoin('order.packageTemplate', 'package')
      .leftJoin('package.zone', 'zone')
      .select('package.id', 'packageId')
      .addSelect('package.packageTemplateName', 'product')
      .addSelect('COUNT(order.id)', 'purchases')
      .addSelect('COALESCE(SUM(order.amount_due_after_credits), 0)', 'revenue')
      .where('order.status = :status', { status: OrderStatus.COMPLETED })
      .groupBy('package.id')
      .addGroupBy('package.packageTemplateName')
      .orderBy('purchases', 'DESC')
      .limit(5)
      .getRawMany();

    // If no results, return empty array
    if (results.length === 0) {
      return { data: [] };
    }

    // Now get the full package details to extract country names
    const packageIds = results
      .map((r) => r.packageId)
      .filter((id) => id != null);

    // If no valid package IDs, return data without country details
    if (packageIds.length === 0) {
      const data: TopEsimDto[] = results.map((row, index) => ({
        rank: index + 1,
        product: row.product || 'Unknown',
        country: 'Unknown',
        purchases: parseInt(row.purchases || '0', 10),
        revenue: parseFloat(row.revenue || '0'),
      }));
      return { data };
    }

    const packages = await this.packageTemplateRepository
      .createQueryBuilder('package')
      .leftJoinAndSelect('package.zone', 'zone')
      .where('package.id IN (:...ids)', { ids: packageIds })
      .getMany();

    const packageMap = new Map(packages.map((p) => [p.id, p]));

    const data: TopEsimDto[] = results.map((row, index) => {
      const packageTemplate = packageMap.get(row.packageId);
      let country = 'Unknown';

      if (
        packageTemplate?.zone?.countryNames &&
        packageTemplate.zone.countryNames.length > 0
      ) {
        country = packageTemplate.zone.countryNames[0];
      } else if (packageTemplate?.zone?.zoneName) {
        country = packageTemplate.zone.zoneName;
      } else if (packageTemplate?.zoneName) {
        country = packageTemplate.zoneName;
      }

      return {
        rank: index + 1,
        product: row.product || 'Unknown',
        country,
        purchases: parseInt(row.purchases || '0', 10),
        revenue: parseFloat(row.revenue || '0'),
      };
    });

    return { data };
  }
}
