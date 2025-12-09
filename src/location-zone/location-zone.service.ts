// zones.service.ts
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm'; // <- add In
import { Cron, CronExpression } from '@nestjs/schedule';
import { LocationZone } from './entities/location-zone.entity';
import { OcsService } from 'src/ocs/ocs.service';
import {
  ListDetailedLocationZoneDto,
  ListDetailedLocationZoneResponseDto,
  DetailedLocationZoneDto,
} from './dto/list-detailed-location-zone.dto';

interface OcsZoneOperator {
  countryIso2: string;
  countryName: string;
}
interface OcsLocationZone {
  zoneId: number;
  zoneName: string;
  operators?: OcsZoneOperator[];
}

@Injectable()
export class LocationZoneService {
  private readonly logger = new Logger(LocationZoneService.name);

  constructor(
    @InjectRepository(LocationZone)
    private readonly zoneRepo: Repository<LocationZone>,
    private readonly ocs: OcsService,
  ) {}

  // NEW: used by PackageTemplatesService
  async findManyByIds(zoneIds: string[]) {
    if (!zoneIds.length) return [];
    return this.zoneRepo.find({
      where: { zoneId: In(zoneIds) }, // import In from 'typeorm'
    });
  }

  async syncFromOcs(resellerId: number): Promise<{ saved: number }> {
    if (!resellerId) throw new BadRequestException('resellerId is required');

    const payload = { listDetailedLocationZone: resellerId };
    const res = await this.ocs.post<{
      listDetailedLocationZone: OcsLocationZone[] | null;
    }>(payload);

    const zones: OcsLocationZone[] = res.listDetailedLocationZone ?? [];
    if (!zones.length) return { saved: 0 };

    const rows: Partial<LocationZone>[] = zones.map((z) => ({
      zoneId: String(z.zoneId),
      zoneName: z.zoneName,
      countriesIso2: (z.operators ?? []).map((o) => o.countryIso2),
      countryNames: (z.operators ?? []).map((o) => o.countryName),
    }));

    await this.zoneRepo.upsert(rows, { conflictPaths: ['zoneId'] });
    return { saved: rows.length };
  }

  /**
   * Get detailed location zones for a reseller
   */
  async listDetailedLocationZone(
    dto: ListDetailedLocationZoneDto,
  ): Promise<ListDetailedLocationZoneResponseDto> {
    const payload = { listDetailedLocationZone: dto.resellerId };
    return this.ocs.post<ListDetailedLocationZoneResponseDto>(payload);
  }

  /**
   * Get detailed location zones filtered by ISO2 country code
   */
  async listDetailedLocationZoneByIso2(
    iso2: string,
  ): Promise<DetailedLocationZoneDto[]> {
    // First get all zones for all resellers, then filter by ISO2
    // Note: This is a simplified approach. In a real scenario, you might want to
    // get resellerId from context or pass it as parameter
    const payload = { listDetailedLocationZone: 1 }; // Default reseller ID
    const response =
      await this.ocs.post<ListDetailedLocationZoneResponseDto>(payload);

    if (!response.listDetailedLocationZone) {
      return [];
    }

    // Filter zones that contain the specified ISO2 country
    return response.listDetailedLocationZone.filter((zone) =>
      zone.operators.some(
        (operator) => operator.countryIso2.toLowerCase() === iso2.toLowerCase(),
      ),
    );
  }

  /**
   * Get detailed location zones for a specific package template
   * This would require getting the location zone ID from the package template first
   */
  async listDetailedLocationZoneByPackageTemplate(
    packageTemplateId: number,
  ): Promise<DetailedLocationZoneDto[]> {
    // This is a placeholder implementation
    // In a real scenario, you would:
    // 1. Get the package template to find its locationZoneId
    // 2. Get all detailed location zones
    // 3. Filter by the specific zone ID

    // For now, return all zones (you can implement the actual logic based on your package template structure)
    const payload = { listDetailedLocationZone: 1 }; // Default reseller ID
    const response =
      await this.ocs.post<ListDetailedLocationZoneResponseDto>(payload);

    return response.listDetailedLocationZone || [];
  }

  /**
   * Cron job to sync zones from OCS every 24 hours at 12 AM
   */
  @Cron('0 0 * * *') // Every day at 12:00 AM
  async syncZonesFromOcsScheduled(): Promise<void> {
    this.logger.log('Starting scheduled zones sync from OCS');

    try {
      // Use a default reseller ID for scheduled sync
      // You might want to make this configurable via environment variables
      const defaultResellerId = 1;
      const result = await this.syncFromOcs(defaultResellerId);

      this.logger.log(
        `Completed scheduled zones sync: ${result.saved} zones saved`,
      );
    } catch (error) {
      this.logger.error('Failed to sync zones from OCS:', error);
    }
  }
}
