import { IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class ListDetailedLocationZoneDto {
  @ApiPropertyOptional({
    description: 'Reseller ID (preferred).',
    example: 590,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  resellerId?: number;

  /** Same value as OCS request field `listDetailedLocationZone` (vendor API shape). */
  @ApiPropertyOptional({
    description:
      'Alternative to resellerId — same as OCS JSON field listDetailedLocationZone.',
    example: 590,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  listDetailedLocationZone?: number;
}

export class ListDetailedLocationZoneByIso2Dto {
  @IsString()
  iso2: string;
}

export class ListDetailedLocationZoneByPackageTemplateDto {
  @IsNumber()
  packageTemplateId: number;
}

export class DetailedLocationZoneOperatorDto {
  networkId: number;
  continent: string;
  countryCode: number;
  countryName: string;
  countryIso2: string;
  utcOffset: string;
  operatorName: string;
  mccMncs: Array<{
    mcc: string;
    mnc: string;
  }>;
  tadigs: string[];
}

export class DetailedLocationZoneDto {
  zoneId: number;
  zoneName: string;
  reseller: {
    id: number;
    name: string;
  };
  operators: DetailedLocationZoneOperatorDto[];
}

export class ListDetailedLocationZoneResponseDto {
  status: {
    code: number;
    msg: string;
  };
  listDetailedLocationZone: DetailedLocationZoneDto[] | null;
}
