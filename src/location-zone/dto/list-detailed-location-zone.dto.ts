import { IsNumber, IsOptional, IsString } from 'class-validator';

export class ListDetailedLocationZoneDto {
  @IsNumber()
  resellerId: number;
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
