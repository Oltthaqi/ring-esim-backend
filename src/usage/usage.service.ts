import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Inject,
  forwardRef,
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
    @Inject(forwardRef(() => OrdersService))
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
   * Get usage records by ICCID
   */
  async getUsageByIccids(iccids: string[]): Promise<Usage[]> {
    if (iccids.length === 0) {
      return [];
    }

    return this.usageRepository.find({
      where: iccids.map((iccid) => ({ iccid })),
      relations: ['order', 'order.packageTemplate'],
    });
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
   * Get consolidated usage by subscriber (aggregates all packages for same subscriber)
   */
  async getConsolidatedUsageBySubscriber(userId: string): Promise<{
    data: any[];
    total: number;
  }> {
    // Get all usage records for user, grouped by subscriber
    const usageRecords = await this.usageRepository.find({
      where: { order: { userId } },
      relations: ['order', 'order.packageTemplate'],
      order: { createdAt: 'ASC' },
    });

    // Group by subscriberId
    const subscriberGroups = new Map<number, any[]>();

    for (const usage of usageRecords) {
      const subscriberId = usage.subscriberId;
      if (!subscriberGroups.has(subscriberId)) {
        subscriberGroups.set(subscriberId, []);
      }
      subscriberGroups.get(subscriberId)!.push(usage);
    }

    const consolidatedData: any[] = [];

    // For each subscriber, consolidate all their packages
    for (const [subscriberId, usageList] of subscriberGroups) {
      // Sort by creation date to get original order first
      usageList.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );

      const originalUsage = usageList[0]; // First order (original eSIM)

      // Calculate total allowance from all packages
      const totalDataAllowed = usageList.reduce(
        (sum, usage) => sum + Number(usage.totalDataAllowed),
        0,
      );

      // Use the most recent sync data (they should all be the same from OCS)
      const latestUsage =
        usageList.find((u) => u.lastSyncedAt) || originalUsage;

      // Calculate remaining based on total allowance
      const totalDataUsed = Number(latestUsage.totalDataUsed);
      const totalDataRemaining = Math.max(0, totalDataAllowed - totalDataUsed);
      const usagePercentage =
        totalDataAllowed > 0 ? (totalDataUsed / totalDataAllowed) * 100 : 0;

      consolidatedData.push({
        subscriberId,
        iccid: originalUsage.iccid,
        imsi: originalUsage.imsi,
        msisdn: originalUsage.msisdn,

        // Consolidated data usage
        totalDataUsed, // OCS returns total across all packages
        totalDataAllowed, // Sum of all package allowances
        totalDataRemaining,
        usagePercentage,

        // Other usage stats
        totalCallDuration: latestUsage.totalCallDuration,
        totalSmsCount: latestUsage.totalSmsCount,
        totalResellerCost: latestUsage.totalResellerCost,
        totalSubscriberCost: latestUsage.totalSubscriberCost,

        // Status
        isActive: latestUsage.isActive,
        status: totalDataRemaining <= 0 ? 'in active' : 'active',

        // Dates
        firstUsageDate: latestUsage.firstUsageDate,
        lastUsageDate: latestUsage.lastUsageDate,
        packageStartDate: originalUsage.packageStartDate,
        packageEndDate: latestUsage.packageEndDate,
        lastSyncedAt: latestUsage.lastSyncedAt,

        // Location info
        lastUsageCountry: latestUsage.lastUsageCountry,
        lastUsageOperator: latestUsage.lastUsageOperator,

        // Package breakdown
        packages: usageList.map((usage) => ({
          orderId: usage.orderId,
          orderNumber: usage.order?.orderNumber,
          orderType: usage.order?.orderType,
          packageName: usage.order?.packageTemplate?.packageTemplateName,
          volume: usage.order?.packageTemplate?.volume,
          allowanceBytes: Number(usage.totalDataAllowed),
          addedAt: usage.createdAt,
        })),

        totalPackages: usageList.length,
        originalOrderId: originalUsage.orderId,
        createdAt: originalUsage.createdAt,
        updatedAt: latestUsage.updatedAt,
      });
    }

    return {
      data: consolidatedData,
      total: consolidatedData.length,
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
      const usageData = await this.getUsageFromOcs(usage.subscriberId);

      this.logger.log(
        `OCS Response for subscriber ${usage.subscriberId}:`,
        JSON.stringify(usageData, null, 2),
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
  private async getUsageFromOcs(subscriberId: number): Promise<any> {
    // Get both package data and usage data
    const [packagesResponse, usageResponse] = await Promise.all([
      this.ocsService.post({
        listSubscriberPrepaidPackages: {
          subscriberId,
        },
      }),
      this.ocsService
        .post({
          subscriberUsageOverPeriod: {
            subscriber: {
              subscriberId,
            },
            period: {
              start: new Date().toISOString().split('T')[0],
              end: new Date().toISOString().split('T')[0],
            },
          },
        })
        .catch(() => null), // Don't fail if usage API fails
    ]);

    return {
      packages: packagesResponse,
      usage: usageResponse,
    };
  }

  /**
   * Update usage record with data from OCS API
   */
  private async updateUsageFromOcsData(
    usage: Usage,
    ocsData: any,
  ): Promise<void> {
    const packagesData = ocsData?.packages?.listSubscriberPrepaidPackages;
    const usageData = ocsData?.usage?.subscriberUsageOverPeriod;

    if (
      !packagesData ||
      !packagesData.packages ||
      packagesData.packages.length === 0
    ) {
      this.logger.warn(
        `No packages found for subscriber ${usage.subscriberId}`,
      );
      await this.usageRepository.update(usage.id, {
        lastSyncedAt: new Date(),
        lastOcsResponse: ocsData,
      });
      return;
    }

    // Find the specific package that matches our order
    // We need to match by package template ID or subsPackageId
    const order = await this.ordersService.getOrderForUsageTracking(
      usage.orderId,
    );

    this.logger.log(
      `Looking for package match for order ${usage.orderId}: subsPackageId=${order.subsPackageId} (type: ${typeof order.subsPackageId}), packageTemplateId=${order.packageTemplate?.packageTemplateId}`,
    );
    this.logger.log(
      `Available packages: ${JSON.stringify(
        packagesData.packages.map((pkg: any) => ({
          id: pkg.subscriberprepaidpackageid,
          templateId: pkg.packageTemplate?.prepaidpackagetemplateid,
          usedData: pkg.useddatabyte,
          limit: pkg.pckdatabyte,
          active: pkg.active,
          tsassigned: pkg.tsassigned,
        })),
        null,
        2,
      )}`,
    );

    const targetPackage = packagesData.packages.find((pkg: any) => {
      // Prioritize subsPackageId match (most accurate)
      if (
        order.subsPackageId &&
        pkg.subscriberprepaidpackageid ===
          parseInt(order.subsPackageId.toString(), 10)
      ) {
        this.logger.log(
          `Found exact match by subsPackageId: ${pkg.subscriberprepaidpackageid} (order: ${order.subsPackageId})`,
        );
        return true;
      }

      // If no subsPackageId, try to match by package template AND order creation date
      if (
        !order.subsPackageId &&
        pkg.packageTemplate?.prepaidpackagetemplateid ===
          parseInt(order.packageTemplate?.packageTemplateId || '0', 10)
      ) {
        // Check if the package was assigned around the same time as the order
        const packageAssignedDate = new Date(pkg.tsassigned);
        const orderCreatedDate = new Date(order.createdAt);
        const timeDiff = Math.abs(
          packageAssignedDate.getTime() - orderCreatedDate.getTime(),
        );
        const hoursDiff = timeDiff / (1000 * 60 * 60);

        this.logger.log(
          `Checking package template match: ${pkg.packageTemplate?.prepaidpackagetemplateid}, packageAssigned=${pkg.tsassigned}, orderCreated=${order.createdAt}, hoursDiff=${hoursDiff.toFixed(2)}`,
        );

        // If the package was assigned within 2 hours of order creation, it's likely the right one
        if (hoursDiff <= 2) {
          this.logger.log(
            `Found match by package template and timing: ${pkg.subscriberprepaidpackageid}`,
          );
          return true;
        }
      }

      return false;
    });

    if (!targetPackage) {
      this.logger.warn(
        `No matching package found for order ${usage.orderId} in subscriber ${usage.subscriberId} packages`,
      );
      await this.usageRepository.update(usage.id, {
        lastSyncedAt: new Date(),
        lastOcsResponse: ocsData,
      });
      return;
    }

    this.logger.log(
      `Selected package ${targetPackage.subscriberprepaidpackageid}: usedData=${targetPackage.useddatabyte}, limit=${targetPackage.pckdatabyte}, active=${targetPackage.active}, tsassigned=${targetPackage.tsassigned}`,
    );

    // Extract usage data from the specific package
    const packageUsage = {
      useddatabyte: targetPackage.useddatabyte || 0,
      usedmocsecond: targetPackage.usedmocsecond || 0,
      usedmtcsecond: targetPackage.usedmtcsecond || 0,
      usedmosmsnumber: targetPackage.usedmosmsnumber || 0,
      usedmtsmsnumber: targetPackage.usedmtsmsnumber || 0,
      pckdatabyte: targetPackage.pckdatabyte || 0,
      tsactivationutc: targetPackage.tsactivationutc,
      tsexpirationutc: targetPackage.tsexpirationutc,
    };

    // Calculate data usage from package-specific data
    const dataUsageBytes = packageUsage.useddatabyte;
    const totalCallDuration =
      packageUsage.usedmocsecond + packageUsage.usedmtcsecond;
    const totalSmsCount =
      packageUsage.usedmosmsnumber + packageUsage.usedmtsmsnumber;

    // Get package activation and expiration dates
    let firstUsageDate = usage.firstUsageDate;
    let lastUsageDate = usage.lastUsageDate;
    let packageStartDate = usage.packageStartDate;
    let packageEndDate = usage.packageEndDate;

    if (packageUsage.tsactivationutc) {
      packageStartDate = new Date(packageUsage.tsactivationutc);
      if (!firstUsageDate) {
        firstUsageDate = packageStartDate;
      }
    }

    if (packageUsage.tsexpirationutc) {
      packageEndDate = new Date(packageUsage.tsexpirationutc);
    }

    // For now, we don't have country/operator info from packages API
    let lastUsageCountry: string | null = null;
    let lastUsageMcc: number | null = null;
    let lastUsageMnc: number | null = null;
    let lastUsageOperator: string | null = null;

    // Calculate remaining data using package-specific limit
    const packageDataLimit = packageUsage.pckdatabyte;
    const totalDataRemaining = Math.max(0, packageDataLimit - dataUsageBytes);

    // Extract cost data from usage API if available
    let totalResellerCost = 0;
    let totalSubscriberCost = 0;
    if (usageData?.total) {
      totalResellerCost = usageData.total.resellerCost || 0;
      totalSubscriberCost = usageData.total.subscriberCost || 0;
    }

    // Update usage record
    await this.usageRepository.update(usage.id, {
      totalDataUsed: dataUsageBytes,
      totalDataAllowed: packageDataLimit, // Update with package-specific limit
      totalDataRemaining,
      totalCallDuration,
      totalSmsCount,
      totalResellerCost,
      totalSubscriberCost,
      firstUsageDate,
      lastUsageDate,
      packageStartDate,
      packageEndDate,
      lastUsageCountry,
      lastUsageMcc,
      lastUsageMnc,
      lastUsageOperator,
      lastSyncedAt: new Date(),
      lastOcsResponse: ocsData,
      // Update status based on remaining data
      status: totalDataRemaining <= 0 ? 'in-active' : 'active',
      isActive: totalDataRemaining > 0,
    });

    this.logger.log(
      `Updated usage for subscriber ${usage.subscriberId}: ${this.formatBytes(dataUsageBytes)}/${this.formatBytes(packageDataLimit)} used`,
    );
  }

  /**
   * Cron job to sync usage for all active subscriptions every hour
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
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
