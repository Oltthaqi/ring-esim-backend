/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PackageTemplate } from '../package-template/entities/package-template.entity';
import { LocationZone } from '../location-zone/entities/location-zone.entity';

@Injectable()
export class DestinationsService {
  constructor(
    @InjectRepository(PackageTemplate)
    private packageTemplateRepo: Repository<PackageTemplate>,
    @InjectRepository(LocationZone)
    private locationZoneRepo: Repository<LocationZone>,
  ) {}

  // LIST all destinations (typed as local/regional/global) using ZoneName + countriesIso2
  async getDestinations() {
    const zones = await this.locationZoneRepo.find({
      // IMPORTANT: use ZoneId (numeric) — this matches PackageTemplate.zoneId
      select: ['zoneId', 'zoneName', 'countriesIso2', 'countryNames'],
    });

    return (
      zones
        // Skip zones with empty or null countriesIso2
        .filter(
          (zone) =>
            Array.isArray(zone.countriesIso2) && zone.countriesIso2.length > 0,
        )
        .map((zone) => {
          // De-dupe ISO2 codes; normalize to lowercase
          const uniqueIso2 = [
            ...new Set(zone.countriesIso2?.map((c) => String(c).toLowerCase())),
          ];
          // De-dupe display names from DB
          const uniqueNames = Array.isArray(zone.countryNames)
            ? [...new Set(zone.countryNames)]
            : [];

          // Determine type
          const nameLc = (zone.zoneName ?? '').toLowerCase();
          let type: 'local' | 'regional' | 'global';
          if (nameLc.includes('kuda') || nameLc.includes('kudo')) {
            type = 'global';
          } else if (uniqueIso2.length === 1) {
            type = 'local';
          } else {
            type = 'regional';
          }

          return {
            key: Number(zone.zoneId), // use ZoneId as the key exposed to the client
            title: zone.zoneName,
            countries: uniqueNames, // names straight from DB
            iso2: uniqueIso2,
            type,
          };
        })
    );
  }

  // PACKAGES for a clicked country (e.g., /api/esim/destinations/country/us/packages)
  async getPackagesByCountry(iso2: string) {
    const allZones = await this.locationZoneRepo.find({
      select: ['zoneId', 'zoneName', 'countriesIso2', 'countryNames'],
    });

    const zones = allZones
      .filter(
        (z) => Array.isArray(z.countriesIso2) && z.countriesIso2.length > 0,
      )
      .map((z) => {
        const isoList = [
          ...new Set(z.countriesIso2?.map((c) => String(c).toLowerCase())),
        ];
        const names = Array.isArray(z.countryNames)
          ? [...new Set(z.countryNames)]
          : [];
        return {
          ZoneId: Number(z.zoneId),
          zoneName: z.zoneName ?? '',
          countriesIso2: isoList,
          countryNames: names,
        };
      })
      // ✅ only single-country zones for the requested ISO
      .filter(
        (z) =>
          z.countriesIso2.includes(iso2) &&
          z.countriesIso2.length === 1 &&
          !z.zoneName.toLowerCase().includes('kudo') && // optional: exclude global “KUDO”
          !z.zoneName.toLowerCase().includes('kuda'),
      );

    if (zones.length === 0) {
      return {
        country: { iso2, name: iso2.toUpperCase() },
        items: [],
        total: 0,
      };
    }

    const zoneIds = Array.from(new Set(zones.map((z) => z.ZoneId)));

    const rawPkgs = await this.packageTemplateRepo
      .createQueryBuilder('p')
      .select([
        'p.id AS id',
        'p.packageTemplateId AS packageTemplateId',
        'p.packageTemplateName AS name',
        'p.price AS price',
        'p.currency AS currency',
        'p.periodDays AS periodDays',
        'p.volume AS volume',
        'p.zoneId AS zoneId',
      ])
      .where('p.zoneId IN (:...ids)', { ids: zoneIds })
      .getRawMany();

    const zoneById = new Map(zones.map((z) => [z.ZoneId, z]));
    const items = rawPkgs
      .map((r) => {
        const z = zoneById.get(Number(r.zoneId));
        if (!z) return null;
        return {
          id: String(r.id),
          packageTemplateId: String(r.packageTemplateId),
          title: r.name,
          price: r.price != null ? Number(r.price) : null,
          currency: r.currency ?? 'EUR',
          periodDays: r.periodDays ?? null,
          data: r.volume ?? null,
          countriesCount: z.countriesIso2.length, // will be 1
          zoneId: z.ZoneId,
          zoneName: z.zoneName,
        };
      })
      .filter(Boolean) as any[];

    items.sort((a, b) => {
      const pa = a.price ?? Number.POSITIVE_INFINITY;
      const pb = b.price ?? Number.POSITIVE_INFINITY;
      if (pa !== pb) return pa - pb;
      return a.title.localeCompare(b.title);
    });

    const countryName =
      zones
        .map((z) => {
          const idx = z.countriesIso2.findIndex((c) => c === iso2);
          return (
            (idx >= 0 ? z.countryNames?.[idx] : z.countryNames?.[0]) ?? null
          );
        })
        .find(Boolean) || iso2.toUpperCase();

    return {
      country: { iso2, name: countryName },
      items,
      total: items.length,
    };
  }

  async getPackagesByRegion(zoneId: number) {
    if (!Number.isFinite(zoneId)) {
      return { region: null, items: [], total: 0 };
    }

    // Load the zone
    const z = await this.locationZoneRepo.findOne({
      where: { zoneId: zoneId as any }, // cast if your entity typing is strict
      select: ['zoneId', 'zoneName', 'countriesIso2', 'countryNames'],
    });

    // Validate + normalize
    if (!z || !Array.isArray(z.countriesIso2) || z.countriesIso2.length === 0) {
      return { region: null, items: [], total: 0 };
    }
    const iso2List = [
      ...new Set(z.countriesIso2.map((c) => String(c).toLowerCase())),
    ];
    const nameLc = (z.zoneName ?? '').toLowerCase();

    // Must be regional: more than one unique country, and NOT kudo/kuda
    const isKudo = nameLc.includes('kudo') || nameLc.includes('kuda');
    if (iso2List.length <= 1 || isKudo) {
      return {
        region: { zoneId: Number(z.zoneId), title: z.zoneName ?? '' },
        items: [],
        total: 0,
      };
    }

    const countryNames = Array.isArray(z.countryNames)
      ? [...new Set(z.countryNames)]
      : [];

    // Fetch packages for this zone only
    const rawPkgs = await this.packageTemplateRepo
      .createQueryBuilder('p')
      .select([
        'p.id AS id',
        'p.packageTemplateId AS packageTemplateId',
        'p.packageTemplateName AS name',
        'p.price AS price',
        'p.currency AS currency',
        'p.periodDays AS periodDays',
        'p.volume AS volume',
        'p.zoneId AS zoneId',
      ])
      .where('p.zoneId = :id', { id: Number(z.zoneId) })
      .getRawMany();

    const items = rawPkgs.map((r) => ({
      id: String(r.id),
      packageTemplateId: String(r.packageTemplateId),
      title: r.name,
      price: r.price != null ? Number(r.price) : null,
      currency: r.currency ?? 'EUR',
      periodDays: r.periodDays ?? null,
      data: r.volume ?? null,
      countriesCount: iso2List.length, // multi-country badge
      zoneId: Number(r.zoneId),
      zoneName: z.zoneName ?? '',
    }));

    // Sort like the other list: cheapest first, nulls last
    items.sort((a, b) => {
      const pa = a.price ?? Number.POSITIVE_INFINITY;
      const pb = b.price ?? Number.POSITIVE_INFINITY;
      if (pa !== pb) return pa - pb;
      return a.title.localeCompare(b.title);
    });

    return {
      region: {
        zoneId: Number(z.zoneId),
        title: z.zoneName ?? '',
        iso2: iso2List,
        countries: countryNames,
      },
      items,
      total: items.length,
    };
  }
}
