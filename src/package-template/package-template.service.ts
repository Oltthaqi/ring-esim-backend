/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { PackageTemplate } from './entities/package-template.entity';
import { LocationZoneService } from '../location-zone/location-zone.service';
import { OcsService } from 'src/ocs/ocs.service';
import { LocationZone } from '../location-zone/entities/location-zone.entity';
import {
  PackageTemplateDetailsDto,
  PackageTemplateDetailsResponseDto,
  CountryOperatorDto,
} from './dto/package-template-details.dto';
import { ListDetailedLocationZoneResponseDto } from '../location-zone/dto/list-detailed-location-zone.dto';
import { UpdatePackageTemplateDto } from './dto/update-package-template.dto';

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

  private countriesFromStoredIso2(iso2s: string[] | null): CountryOperatorDto[] {
    if (!iso2s?.length) return [];
    return iso2s.map((countryIso2) => ({
      countryIso2,
      countryName: countryIso2,
      operatorNames: [] as string[],
    }));
  }

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

  async findOne(
    id: string,
    opts?: { includeDeleted?: boolean },
  ): Promise<PackageTemplate | null> {
    return await this.pkgRepo.findOne({
      where: {
        id,
        ...(opts?.includeDeleted ? {} : { isDeleted: false }),
      },
    });
  }

  async findByTemplateId(
    packageTemplateId: string,
    opts?: { includeDeleted?: boolean },
  ): Promise<PackageTemplate | null> {
    return await this.pkgRepo.findOne({
      where: {
        packageTemplateId,
        ...(opts?.includeDeleted ? {} : { isDeleted: false }),
      },
    });
  }

  async findAll(): Promise<PackageTemplate[]> {
    return await this.pkgRepo.find({
      where: { isDeleted: false },
      relations: ['zone'],
      order: { packageTemplateName: 'ASC' },
    });
  }

  private assertOcsStatus(data: Raw | null | undefined): void {
    const code = data?.status?.code;
    if (code !== 0) {
      const msg =
        typeof data?.status?.msg === 'string'
          ? data.status.msg
          : 'OCS request failed';
      throw new BadRequestException(msg);
    }
  }

  private buildModifyPPTCorePayload(t: Raw, newCost: number): Raw {
    const id = Number(t.prepaidpackagetemplateid);
    const resellerid = Number(t.resellerid);
    const locationzoneid = Number(t.locationzoneid);
    const perioddays = Number(t.perioddays);
    if (
      !Number.isFinite(id) ||
      !Number.isFinite(resellerid) ||
      !Number.isFinite(locationzoneid) ||
      !Number.isFinite(perioddays)
    ) {
      throw new BadRequestException(
        'OCS template is missing required fields for modifyPPTCore',
      );
    }
    const core: Raw = {
      prepaidpackagetemplateid: id,
      prepaidpackagetemplatename: String(t.prepaidpackagetemplatename ?? ''),
      resellerid,
      locationzoneid,
      perioddays,
      cost: newCost,
    };
    if (t.destinationzoneid != null && t.destinationzoneid !== '') {
      const dz = Number(t.destinationzoneid);
      if (Number.isFinite(dz)) core.destinationzoneid = dz;
    }
    if (t.databyte != null && t.databyte !== '') {
      const db = Number(t.databyte);
      if (Number.isFinite(db)) core.databyte = db;
    }
    for (const key of [
      'mocsecond',
      'mtcsecond',
      'mosmsnumber',
      'mtsmsnumber',
    ] as const) {
      if (t[key] != null && t[key] !== '') {
        const n = Number(t[key]);
        if (Number.isFinite(n)) core[key] = n;
      }
    }
    if (t.esimSponsor != null && t.esimSponsor !== '') {
      const sp = Number(t.esimSponsor);
      if (Number.isFinite(sp)) core.esimSponsor = sp;
    }
    return { modifyPPTCore: core };
  }

  /**
   * Update package sell price: listPrepaidPackageTemplate → modifyPPTCore (cost), then persist locally.
   */
  async updatePackage(id: string, dto: UpdatePackageTemplateDto) {
    if (dto.price === undefined || dto.price === null) {
      throw new BadRequestException('price is required');
    }
    const newCost = Number(dto.price);
    if (!Number.isFinite(newCost) || newCost <= 0) {
      throw new BadRequestException('price must be a positive number');
    }

    const row = await this.findOne(id);
    if (!row) {
      throw new NotFoundException(`Package template ${id} not found`);
    }

    const templateIdNum = Number(row.packageTemplateId);
    if (!Number.isFinite(templateIdNum)) {
      throw new BadRequestException('Invalid packageTemplateId on record');
    }

    const listRes = await this.ocs.post<Raw>({
      listPrepaidPackageTemplate: { templateId: templateIdNum },
    });
    this.assertOcsStatus(listRes);

    const templates = listRes?.listPrepaidPackageTemplate?.template;
    const t = Array.isArray(templates) ? templates[0] : null;
    if (!t) {
      throw new NotFoundException(
        `OCS has no prepaid package template for id ${templateIdNum}`,
      );
    }

    const modifyBody = this.buildModifyPPTCorePayload(t, newCost);
    const modRes = await this.ocs.post<Raw>(modifyBody);
    this.assertOcsStatus(modRes);

    row.price = newCost;
    await this.pkgRepo.save(row);

    return {
      id: row.id,
      packageTemplateId: row.packageTemplateId,
      title: row.packageTemplateName,
      price: Number(row.price),
      currency: row.currency ?? 'EUR',
      periodDays: row.periodDays ?? null,
      data: row.volume ?? null,
      zoneId: Number(row.zoneId),
      zoneName: row.zoneName,
    };
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
        isDeleted: false,
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
        isDeleted: false,
      };
    });

    if (rows.length) {
      await this.pkgRepo.upsert(rows, { conflictPaths: ['packageTemplateId'] });
    }

    // Do not tombstone the whole catalog when OCS returns an empty normalized list.
    let softDeletedTemplates = 0;
    if (normalized.length > 0) {
      const syncedTemplateIds = normalized.map((n) => n.packageTemplateId);
      const tombstone = await this.pkgRepo
        .createQueryBuilder()
        .update(PackageTemplate)
        .set({ isDeleted: true })
        .where('packageTemplateId NOT IN (:...ids)', { ids: syncedTemplateIds })
        .execute();
      softDeletedTemplates = tombstone.affected ?? 0;

      if (zoneIds.length) {
        await this.zoneRepo.update(
          { zoneId: In(zoneIds) },
          { isDeleted: false },
        );
      }
    }

    return { saved: rows.length, skipped, softDeletedTemplates };
  }

  /**
   * Get detailed package template information including countries and operators
   */
  async getPackageTemplateDetails(
    dto: PackageTemplateDetailsDto,
  ): Promise<PackageTemplateDetailsResponseDto> {
    // Find the package template - try by UUID first, then by packageTemplateId
    let packageTemplate = await this.findOne(dto.packageTemplateId);

    // If not found by UUID, try by packageTemplateId (business key)
    if (!packageTemplate) {
      packageTemplate = await this.findByTemplateId(dto.packageTemplateId);
    }

    if (!packageTemplate) {
      throw new NotFoundException(
        `Package template with ID ${dto.packageTemplateId} not found`,
      );
    }

    const resellerId =
      dto.resellerId != null && Number.isFinite(Number(dto.resellerId))
        ? Number(dto.resellerId)
        : this.ocs.getDefaultResellerId();

    const detailedZonesResponse =
      await this.ocs.post<ListDetailedLocationZoneResponseDto>({
        listDetailedLocationZone: resellerId,
      });

    const zones = detailedZonesResponse.listDetailedLocationZone ?? null;
    const zoneList = Array.isArray(zones) ? zones : [];

    const baseFields = {
      packageTemplateId: packageTemplate.packageTemplateId,
      packageName: packageTemplate.packageTemplateName,
      price: packageTemplate.price,
      currency: packageTemplate.currency,
      usageAllowed: packageTemplate.volume,
      validityDays: packageTemplate.periodDays,
    };

    const packageZone = zoneList.find(
      (zone) => zone.zoneId === Number(packageTemplate.zoneId),
    );

    if (!packageZone?.operators?.length) {
      const countries = this.countriesFromStoredIso2(
        packageTemplate.countriesIso2,
      );
      return {
        ...baseFields,
        numberOfCountries: countries.length,
        countries,
      };
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
      ...baseFields,
      numberOfCountries: countries.length,
      countries,
    };
  }

  /**
   * Cron job to sync packages from OCS every 24 hours at 12 AM
   */
  @Cron('0 0 * * *') // Every day at 12:00 AM
  async syncPackagesFromOcsScheduled(): Promise<void> {
    this.logger.log('Starting scheduled packages sync from OCS');

    try {
      // Use a default reseller ID for scheduled sync
      // You might want to make this configurable via environment variables
      const result = await this.syncFromOcs(this.ocs.getDefaultResellerId());

      this.logger.log(
        `Completed scheduled packages sync from OCS: saved=${result.saved}, softDeletedTemplates=${result.softDeletedTemplates}`,
      );
    } catch (error) {
      this.logger.error('Failed to sync packages from OCS:', error);
    }
  }
}
