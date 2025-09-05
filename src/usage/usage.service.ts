import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Usage } from './entities/usage.entity';
import { UsageResponseDto } from './dto/usage-response.dto';
import { UsageQueryDto } from './dto/usage-query.dto';
import { OcsService } from '../ocs/ocs.service';
import { OrdersService } from '../orders/orders.service';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class UsageService {
  private readonly logger = new Logger(UsageService.name);

  constructor(
    @InjectRepository(Usage)
    private readonly usageRepository: Repository<Usage>,
    private readonly ocsService: OcsService,
    private readonly ordersService: OrdersService,
  ) {}

  /**
   * Create initial usage record when order is completed
   */
  async createUsageRecord(orderId: string): Promise<Usage> {
    // Get order details
    const order = await this.ordersService.getOrderForUsageTracking(orderId);
    if (!order.subscriberId) {
      throw new BadRequestException('Order does not have a subscriber ID');
    }

    // Check if usage record already exists
    const existingUsage = await this.usageRepository.findOne({
      where: { orderId },
    });
    if (existingUsage) {
      return existingUsage;
    }

    // Parse package volume to bytes
    const totalDataAllowed = this.parseVolumeToBytes(
      order.packageTemplate?.volume || '0',
    );

    // Create usage record
    const usage = this.usageRepository.create({
      orderId,
      subscriberId: order.subscriberId,
      imsi: order.imsi,
      iccid: order.iccid,
      msisdn: order.msisdn,
      totalDataAllowed,
      totalDataRemaining: totalDataAllowed,
      packageStartDate: order.activePeriodStart || new Date(),
      packageEndDate: order.activePeriodEnd,
      isActive: true,
      status: 'active',
    });

    const savedUsage = await this.usageRepository.save(usage);
    this.logger.log(`Created usage record for order ${orderId}`);

    // Immediately sync with OCS to get current usage
    await this.syncUsageWithOcs(savedUsage.id);

    return savedUsage;
  }

  /**
   * Get usage for a specific order
   */
  async getUsageByOrderId(orderId: string): Promise<UsageResponseDto> {
    const usage = await this.usageRepository.findOne({
      where: { orderId },
      relations: ['order'],
    });

    if (!usage) {
      throw new NotFoundException('Usage record not found for this order');
    }

    return this.toResponseDto(usage);
  }

  /**
   * Get usage for authenticated user
   */
  async getUserUsage(
    userId: string,
    query: UsageQueryDto,
  ): Promise<{
    data: UsageResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { startDate, endDate, page = 1, limit = 20 } = query;

    // Build where conditions
    const whereCondition: any = {
      order: { userId },
    };

    if (startDate && endDate) {
      whereCondition.createdAt = Between(
        new Date(startDate),
        new Date(endDate),
      );
    }

    // Get total count
    const total = await this.usageRepository.count({
      where: whereCondition,
      relations: ['order'],
    });

    // Get paginated results
    const usageRecords = await this.usageRepository.find({
      where: whereCondition,
      relations: ['order'],
      order: { updatedAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: usageRecords.map((usage) => this.toResponseDto(usage)),
      total,
      page,
      limit,
    };
  }

  /**
   * Manually sync usage with OCS API
   */
  async syncUsageWithOcs(usageId: string): Promise<UsageResponseDto> {
    const usage = await this.usageRepository.findOne({
      where: { id: usageId },
      relations: ['order'],
    });

    if (!usage) {
      throw new NotFoundException('Usage record not found');
    }

    try {
      this.logger.log(`Syncing usage for subscriber ${usage.subscriberId}`);

      // Get usage data from OCS API
      const currentDate = new Date();
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(currentDate.getDate() - 7);

      const usageData = await this.getUsageFromOcs(
        usage.subscriberId,
        sevenDaysAgo.toISOString().split('T')[0],
        currentDate.toISOString().split('T')[0],
      );

      // Update usage record with OCS data
      await this.updateUsageFromOcsData(usage, usageData);

      // Return updated usage
      const updatedUsage = await this.usageRepository.findOne({
        where: { id: usageId },
        relations: ['order'],
      });

      this.logger.log(
        `Successfully synced usage for subscriber ${usage.subscriberId}`,
      );
      return this.toResponseDto(updatedUsage!);
    } catch (error) {
      this.logger.error(
        `Failed to sync usage for subscriber ${usage.subscriberId}:`,
        error,
      );
      throw new BadRequestException(`Failed to sync usage: ${error.message}`);
    }
  }

  /**
   * Get real-time usage for a subscriber from OCS API
   */
  private async getUsageFromOcs(
    subscriberId: number,
    startDate: string,
    endDate: string,
  ): Promise<any> {
    const requestBody = {
      subscriberUsageOverPeriod: {
        subscriber: {
          subscriberId,
        },
        period: {
          start: startDate,
          end: endDate,
        },
      },
    };

    return await this.ocsService.post(requestBody);
  }

  /**
   * Update usage record with data from OCS API
   */
  private async updateUsageFromOcsData(
    usage: Usage,
    ocsData: any,
  ): Promise<void> {
    const usageData = ocsData?.subscriberUsageOverPeriod;
    if (!usageData || !usageData.usages || usageData.usages.length === 0) {
      this.logger.warn(
        `No usage data found for subscriber ${usage.subscriberId}`,
      );
      await this.usageRepository.update(usage.id, {
        lastSyncedAt: new Date(),
        lastOcsResponse: ocsData,
      });
      return;
    }

    const subscriberUsage = usageData.usages[0];
    const totalUsage = subscriberUsage.total;

    // Calculate data usage (type 33 = DATA)
    const dataUsageBytes = totalUsage?.quantityPerType?.['33'] || 0;
    const totalCallDuration = totalUsage?.quantityPerType?.['1'] || 0; // MOC calls
    const totalSmsCount =
      (totalUsage?.quantityPerType?.['21'] || 0) +
      (totalUsage?.quantityPerType?.['22'] || 0); // MO + MT SMS

    // Get country and operator info from latest usage
    let lastUsageCountry: string | null = null;
    let lastUsageMcc: number | null = null;
    let lastUsageMnc: number | null = null;
    let lastUsageOperator: string | null = null;
    let firstUsageDate = usage.firstUsageDate;
    let lastUsageDate = usage.lastUsageDate;

    if (
      totalUsage?.quantityPerCountry &&
      totalUsage.quantityPerCountry.length > 0
    ) {
      const countryData = totalUsage.quantityPerCountry[0];
      lastUsageCountry = countryData.alpha2;
      lastUsageMcc = countryData.mcc;

      if (
        countryData.quantityPerOperator &&
        countryData.quantityPerOperator.length > 0
      ) {
        const operatorData = countryData.quantityPerOperator[0];
        lastUsageMnc = operatorData.mnc;
        lastUsageOperator = operatorData.name;
      }
    }

    // Get first and last usage dates from detailed usage
    if (subscriberUsage.subsPeriodUsages) {
      for (const periodUsage of subscriberUsage.subsPeriodUsages) {
        if (periodUsage.subsDailyUsages) {
          for (const dailyUsage of periodUsage.subsDailyUsages) {
            const usageDate = new Date(dailyUsage.usageDateUtc);
            if (!firstUsageDate || usageDate < firstUsageDate) {
              firstUsageDate = usageDate;
            }
            if (!lastUsageDate || usageDate > lastUsageDate) {
              lastUsageDate = usageDate;
            }
          }
        }
      }
    }

    // Calculate remaining data
    const totalDataRemaining = Math.max(
      0,
      usage.totalDataAllowed - dataUsageBytes,
    );

    // Update usage record
    await this.usageRepository.update(usage.id, {
      totalDataUsed: dataUsageBytes,
      totalDataRemaining,
      totalCallDuration,
      totalSmsCount,
      totalResellerCost: totalUsage?.resellerCost || 0,
      totalSubscriberCost: totalUsage?.subscriberCost || 0,
      firstUsageDate,
      lastUsageDate,
      lastUsageCountry,
      lastUsageMcc,
      lastUsageMnc,
      lastUsageOperator,
      lastSyncedAt: new Date(),
      lastOcsResponse: ocsData,
      // Update status based on remaining data
      status: totalDataRemaining <= 0 ? 'exhausted' : 'active',
      isActive: totalDataRemaining > 0,
    });

    this.logger.log(
      `Updated usage for subscriber ${usage.subscriberId}: ${this.formatBytes(dataUsageBytes)}/${this.formatBytes(usage.totalDataAllowed)} used`,
    );
  }

  /**
   * Cron job to sync usage for all active subscriptions every hour
   */
  @Cron(CronExpression.EVERY_HOUR)
  async syncAllActiveUsage(): Promise<void> {
    this.logger.log(
      'Starting scheduled usage sync for all active subscriptions',
    );

    const activeUsageRecords = await this.usageRepository.find({
      where: { isActive: true },
      relations: ['order'],
    });

    this.logger.log(
      `Found ${activeUsageRecords.length} active usage records to sync`,
    );

    let successCount = 0;
    let errorCount = 0;

    for (const usage of activeUsageRecords) {
      try {
        await this.syncUsageWithOcs(usage.id);
        successCount++;
      } catch (error) {
        this.logger.error(`Failed to sync usage for ${usage.id}:`, error);
        errorCount++;
      }

      // Add small delay to avoid overwhelming the OCS API
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    this.logger.log(
      `Completed scheduled usage sync: ${successCount} successful, ${errorCount} errors`,
    );
  }

  /**
   * Convert volume string (e.g., "5GB", "500MB") to bytes
   */
  private parseVolumeToBytes(volume: string): number {
    if (!volume) return 0;

    const volumeStr = volume.toUpperCase();
    const numMatch = volumeStr.match(/(\d+(?:\.\d+)?)/);
    if (!numMatch) return 0;

    const num = parseFloat(numMatch[1]);

    if (volumeStr.includes('GB')) {
      return num * 1024 * 1024 * 1024;
    } else if (volumeStr.includes('MB')) {
      return num * 1024 * 1024;
    } else if (volumeStr.includes('KB')) {
      return num * 1024;
    } else {
      return num; // assume bytes
    }
  }

  /**
   * Format bytes to human readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Convert usage entity to response DTO
   */
  private toResponseDto(usage: Usage): UsageResponseDto {
    const usagePercentage =
      usage.totalDataAllowed > 0
        ? (usage.totalDataUsed / usage.totalDataAllowed) * 100
        : 0;

    return {
      id: usage.id,
      orderId: usage.orderId,
      subscriberId: usage.subscriberId,
      imsi: usage.imsi,
      iccid: usage.iccid,
      msisdn: usage.msisdn,
      totalDataUsed: usage.totalDataUsed,
      totalDataAllowed: usage.totalDataAllowed,
      totalDataRemaining: usage.totalDataRemaining,
      usagePercentage: Math.round(usagePercentage * 100) / 100,
      totalCallDuration: usage.totalCallDuration,
      totalSmsCount: usage.totalSmsCount,
      totalResellerCost: usage.totalResellerCost,
      totalSubscriberCost: usage.totalSubscriberCost,
      firstUsageDate: usage.firstUsageDate,
      lastUsageDate: usage.lastUsageDate,
      packageStartDate: usage.packageStartDate,
      packageEndDate: usage.packageEndDate,
      isActive: usage.isActive,
      status: usage.status,
      lastSyncedAt: usage.lastSyncedAt,
      lastUsageCountry: usage.lastUsageCountry,
      lastUsageOperator: usage.lastUsageOperator,
      createdAt: usage.createdAt,
      updatedAt: usage.updatedAt,
    };
  }
}
