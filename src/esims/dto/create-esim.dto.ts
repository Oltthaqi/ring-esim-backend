import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateEsimDto {
  @IsInt()
  subscriberId: number;

  @IsOptional()
  @IsString()
  imsi?: string;

  @IsOptional()
  @IsString()
  iccid?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  smdpServer?: string;

  @IsOptional()
  @IsString()
  activationCode?: string;

  @IsOptional()
  @IsString()
  batchId?: string;

  @IsInt()
  accountId: number;

  @IsInt()
  resellerId: number;

  @IsBoolean()
  prepaid: boolean;

  @IsNumber()
  balance: number;

  @IsOptional()
  @IsString()
  simStatus?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsDateString()
  activationDate?: Date;
}
