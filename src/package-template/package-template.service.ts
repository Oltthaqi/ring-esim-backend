/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PackageTemplate } from './entities/package-template.entity';
import { LocationZoneService } from '../location-zone/location-zone.service';
import { OcsService } from 'src/ocs/ocs.service';
import { LocationZone } from '../location-zone/entities/location-zone.entity';
import {
  PackageTemplateDetailsDto,
  PackageTemplateDetailsResponseDto,
  CountryOperatorDto,
} from './dto/package-template-details.dto';
import {
  ListDetailedLocationZoneResponseDto,
  DetailedLocationZoneDto,
} from '../location-zone/dto/list-detailed-location-zone.dto';

type Raw = Record<string, any>;
interface Normalized {
  packageTemplateId: string;
  packageTemplateName: string;
  zoneId: string;
  zoneName?: string | null;
  periodDays?: number | null;
  volume?: string | null;
  price?: number | null;
  currency?: string | null;
}

@Injectable()
export class PackageTemplatesService {
  private readonly logger = new Logger(PackageTemplatesService.name);

  constructor(
    @InjectRepository(PackageTemplate)
    private readonly pkgRepo: Repository<PackageTemplate>,
    @InjectRepository(LocationZone)
    private readonly zoneRepo: Repository<LocationZone>,
    private readonly ocs: OcsService,
    private readonly zones: LocationZoneService,
  ) {}

  private bytesToHuman(b?: number | null): string | null {
    if (b == null) return null;
    if (b >= 1024 * 1024 * 1024) return `${(b / 1024 ** 3).toFixed(0)}GB`;
    if (b >= 1024 * 1024) return `${(b / 1024 ** 2).toFixed(0)}MB`;
    if (b >= 1024) return `${(b / 1024).toFixed(0)}KB`;
    return `${b}B`;
  }

  private normalize(t: Raw): Normalized | null {
    const id = t.prepaidpackagetemplateid ?? t.packageTemplateId ?? t.id;
    const name =
      t.prepaidpackagetemplatename ?? t.packageTemplateName ?? t.name;
    const zone =
      t.locationzoneid ??
      t.locationZoneId ??
      t.rdbLocationZones?.locationzoneid;

    if (id == null || name == null || zone == null) return null;

    const zoneName =
      t.rdbLocationZones?.locationzonename ?? t.locationZoneName ?? null;

    const price = t.cost ?? t.price ?? null;
    const currency = t.currency ?? null;
    const periodDays = t.perioddays ?? t.periodDays ?? null;
    const volume = this.bytesToHuman(t.databyte ?? null) ?? t.volume ?? null;

    return {
      packageTemplateId: String(id),
      packageTemplateName: String(name),
      zoneId: String(zone),
      zoneName,
      periodDays,
      volume,
      price,
      currency,
    };
  }

  async findOne(id: string): Promise<PackageTemplate | null> {
    return await this.pkgRepo.findOne({
      where: { id },
    });
  }

  async findByTemplateId(
    packageTemplateId: string,
  ): Promise<PackageTemplate | null> {
    return await this.pkgRepo.findOne({
      where: { packageTemplateId },
    });
  }

  async findAll(): Promise<PackageTemplate[]> {
    return await this.pkgRepo.find({
      relations: ['zone'],
      order: { packageTemplateName: 'ASC' },
    });
  }

  async syncFromOcs(resellerId: number) {
    const payload = { listPrepaidPackageTemplate: { resellerId } };
    const res = await this.ocs.post<{
      listPrepaidPackageTemplate?: { template?: any[] };
    }>(payload);

    const raw = res?.listPrepaidPackageTemplate?.template ?? [];
    const normalized = raw
      .map((r) => this.normalize(r))
      .filter((x): x is Normalized => x !== null);
    const skipped = raw.length - normalized.length;

    // Get all zone IDs from templates
    const zoneIds = Array.from(new Set(normalized.map((v) => v.zoneId)));

    // Fetch zones that already exist
    const existingZones = await this.zones.findManyByIds(zoneIds);
    const existingZoneIds = new Set(existingZones.map((z) => String(z.zoneId)));

    // Find missing zones and insert them
    const missingZones = normalized
      .filter((v) => !existingZoneIds.has(v.zoneId))
      .map((v) => ({
        zoneId: v.zoneId,
        zoneName: v.zoneName ?? '',
        countriesIso2: null,
        countryNames: null,
      }));

    if (missingZones.length) {
      await this.zoneRepo.upsert(missingZones, { conflictPaths: ['zoneId'] });
      this.logger.log(
        `Inserted ${missingZones.length} missing zones before inserting packages`,
      );
    }

    // Re-fetch zones after insert
    const zoneRows = await this.zones.findManyByIds(zoneIds);
    const zoneById = new Map(zoneRows.map((z) => [String(z.zoneId), z]));

    // Prepare packages
    const rows = normalized.map((v) => {
      const z = zoneById.get(v.zoneId);
      return {
        packageTemplateId: v.packageTemplateId,
        packageTemplateName: v.packageTemplateName,
        zoneId: v.zoneId,
        zoneName: v.zoneName ?? z?.zoneName ?? '',
        countriesIso2: z?.countriesIso2 ?? null,
        periodDays: v.periodDays ?? null,
        volume: v.volume ?? null,
        price: v.price ?? null,
        currency: v.currency ?? null,
      };
    });

    if (rows.length) {
      await this.pkgRepo.upsert(rows, { conflictPaths: ['packageTemplateId'] });
    }

    return { saved: rows.length, skipped };
  }

  /**
   * Get detailed package template information including countries and operators
   */
  async getPackageTemplateDetails(
    dto: PackageTemplateDetailsDto,
  ): Promise<PackageTemplateDetailsResponseDto> {
    // Find the package template
    const packageTemplate = await this.findOne(dto.packageTemplateId);
    if (!packageTemplate) {
      throw new NotFoundException(
        `Package template with ID ${dto.packageTemplateId} not found`,
      );
    }

    // Get detailed location zone information from OCS
    const detailedZonesResponse =
      await this.ocs.post<ListDetailedLocationZoneResponseDto>({
        listDetailedLocationZone: 567, // Default reseller ID
      });

    if (!detailedZonesResponse.listDetailedLocationZone) {
      throw new NotFoundException('No detailed location zones found');
    }

    // Find the specific zone for this package template
    const packageZone = detailedZonesResponse.listDetailedLocationZone.find(
      (zone) => zone.zoneId === Number(packageTemplate.zoneId),
    );

    if (!packageZone) {
      throw new NotFoundException(
        `Location zone ${packageTemplate.zoneId} not found in detailed zones`,
      );
    }

    // Group operators by country
    const countryOperatorsMap = new Map<string, CountryOperatorDto>();

    packageZone.operators.forEach((operator) => {
      const countryIso2 = operator.countryIso2.toLowerCase();
      const countryName = operator.countryName;

      if (!countryOperatorsMap.has(countryIso2)) {
        countryOperatorsMap.set(countryIso2, {
          countryIso2: operator.countryIso2,
          countryName: countryName,
          operatorNames: [],
        });
      }

      // Add operator name if not already present
      const countryData = countryOperatorsMap.get(countryIso2)!;
      if (!countryData.operatorNames.includes(operator.operatorName)) {
        countryData.operatorNames.push(operator.operatorName);
      }
    });

    // Convert map to array
    const countries: CountryOperatorDto[] = Array.from(
      countryOperatorsMap.values(),
    );

    return {
      packageTemplateId: packageTemplate.packageTemplateId,
      packageName: packageTemplate.packageTemplateName,
      price: packageTemplate.price,
      currency: packageTemplate.currency,
      usageAllowed: packageTemplate.volume,
      validityDays: packageTemplate.periodDays,
      numberOfCountries: countries.length,
      countries: countries,
    };
  }
}
