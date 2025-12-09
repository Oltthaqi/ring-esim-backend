// src/package-templates/dto/create-package-template.dto.ts
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsArray,
} from 'class-validator';

export class CreatePackageTemplateDto {
  @IsString()
  packageTemplateId: string;

  @IsString()
  packageTemplateName: string;

  @IsString()
  zoneId: string;

  @IsString()
  zoneName: string;

  @IsOptional()
  @IsArray()
  countriesIso2?: string[];

  @IsOptional()
  @IsInt()
  periodDays?: number;

  @IsOptional()
  @IsString()
  volume?: string;

  @IsOptional()
  @IsNumber()
  price?: number;
}
