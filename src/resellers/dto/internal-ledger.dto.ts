import { IsBoolean, IsNumber, IsOptional } from 'class-validator';

export class InternalLedgerDto {
  @IsNumber()
  delta: number;

  @IsOptional()
  @IsBoolean()
  setBalance?: boolean;
}
