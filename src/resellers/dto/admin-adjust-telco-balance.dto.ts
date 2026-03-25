import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';

export class AdminAdjustTelcoBalanceDto {
  @IsNumber()
  amount: number;

  @IsOptional()
  @IsBoolean()
  setBalance?: boolean;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(['reseller', 'account'])
  scope?: 'reseller' | 'account';

  @ValidateIf((o: AdminAdjustTelcoBalanceDto) => o.scope === 'account')
  @IsInt()
  @Min(1)
  accountId?: number;

  /** Provider transaction type for modifyResellerBalance (default: Wire or TELCO_MODIFY_RESELLER_BALANCE_TYPE). */
  @IsOptional()
  @IsString()
  transactionType?: string;
}
