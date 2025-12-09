import { Controller, Get, Param } from '@nestjs/common';
import { DestinationsService } from './destinations.service';

@Controller('esim/destinations')
export class DestinationsController {
  constructor(private readonly svc: DestinationsService) {}

  // Lokale: list countries from single-country zones
  // GET /api/esim/destinations/lokale?resellerId=567
  @Get()
  lokale() {
    return this.svc.getDestinations();
  }

  @Get('country/:iso2/packages')
  byCountry(@Param('iso2') iso2: string) {
    return this.svc.getPackagesByCountry(iso2.toLowerCase());
  }
  @Get('region/:zoneId/packages')
  byRegion(@Param('zoneId') zoneId: string) {
    return this.svc.getPackagesByRegion(Number(zoneId));
  }
}
