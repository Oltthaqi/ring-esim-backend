import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Query,
  Body,
} from '@nestjs/common';
import { LocationZoneService } from './location-zone.service';
import {
  ListDetailedLocationZoneDto,
  ListDetailedLocationZoneByIso2Dto,
  ListDetailedLocationZoneByPackageTemplateDto,
} from './dto/list-detailed-location-zone.dto';

@Controller('zones')
export class LocationZoneController {
  constructor(private readonly zones: LocationZoneService) {}

  @Post('sync')
  async sync(@Query('resellerId') resellerId?: string) {
    const id = Number(resellerId);
    if (!id) throw new BadRequestException('resellerId is required');
    return this.zones.syncFromOcs(id);
  }

  /**
   * Get detailed location zones for a reseller
   * POST /zones/detailed
   */
  @Post('detailed')
  async listDetailedLocationZone(@Body() dto: ListDetailedLocationZoneDto) {
    return this.zones.listDetailedLocationZone(dto);
  }

  /**
   * Get detailed location zones filtered by ISO2 country code
   * GET /zones/detailed/by-iso2?iso2=US
   */
  @Get('detailed/by-iso2')
  async listDetailedLocationZoneByIso2(
    @Query() dto: ListDetailedLocationZoneByIso2Dto,
  ) {
    return this.zones.listDetailedLocationZoneByIso2(dto.iso2);
  }

  /**
   * Get detailed location zones for a specific package template
   * GET /zones/detailed/by-package-template?packageTemplateId=123
   */
  @Get('detailed/by-package-template')
  async listDetailedLocationZoneByPackageTemplate(
    @Query() dto: ListDetailedLocationZoneByPackageTemplateDto,
  ) {
    return this.zones.listDetailedLocationZoneByPackageTemplate(
      dto.packageTemplateId,
    );
  }
}
