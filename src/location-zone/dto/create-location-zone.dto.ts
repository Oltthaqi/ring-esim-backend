// src/zones/dto/create-location-zone.dto.ts
import { IsArray, IsOptional, IsString } from 'class-validator';

export class CreateLocationZoneDto {
  @IsString()
  zoneId: string;

  @IsString()
  zoneName: string;

  @IsOptional()
  @IsArray()
  countriesIso2?: string[];

  @IsOptional()
  @IsArray()
  countryNames?: string[];
}
