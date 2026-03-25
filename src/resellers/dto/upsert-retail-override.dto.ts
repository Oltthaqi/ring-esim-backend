import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import type { RetailOverrideMode } from '../entities/reseller-retail-override.entity';

export class UpsertRetailOverrideDto {
  @IsUUID()
  packageTemplateId: string;

  @IsEnum(['fixed_retail', 'markup_percent'])
  mode: RetailOverrideMode;

  @ValidateIf((o: UpsertRetailOverrideDto) => o.mode === 'fixed_retail')
  @IsNumber()
  retailPrice?: number;

  @ValidateIf((o: UpsertRetailOverrideDto) => o.mode === 'markup_percent')
  @IsNumber()
  markupPercent?: number;

  @IsOptional()
  @IsNumber()
  wholesaleReferencePrice?: number;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;
}
