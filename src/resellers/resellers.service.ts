import {
  BadGatewayException,
  BadRequestException,

  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { Reseller } from './entities/reseller.entity';
import { ResellerRetailOverride } from './entities/reseller-retail-override.entity';
import {
  BalanceTransaction,
  BalanceTransactionType,
} from './entities/balance-transaction.entity';
import { PackageTemplate } from '../package-template/entities/package-template.entity';
import { UsersEntity } from '../users/entitites/users.entity';
import { Role } from '../users/enums/role.enum';
import {
  isTelcoSuccess,
  telcoStatusFromResponse,
  TelcoProviderError,
  TelcoService,
} from '../telco/telco.service';
import { CreateResellerDto } from './dto/create-reseller.dto';
import { CreateResellerWithUserDto } from './dto/create-reseller-with-user.dto';
import { UpdateResellerDto } from './dto/update-reseller.dto';
import { AdminAdjustTelcoBalanceDto } from './dto/admin-adjust-telco-balance.dto';
import { InternalLedgerDto } from './dto/internal-ledger.dto';
import { UpsertRetailOverrideDto } from './dto/upsert-retail-override.dto';
import { Decimal4Util } from '../common/utils/decimal4.util';

function decToNumber(v: string | null | undefined): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeTelcoBalance(b: unknown): number | string {
  if (typeof b === 'number' && Number.isFinite(b)) return b;
  if (typeof b === 'string') {
    const normalized = b.replace(',', '.');
    const n = parseFloat(normalized);
    return Number.isFinite(n) ? n : b;
  }
  return String(b ?? '');
}

export type TelcoResellerSubset = {
  id: number;
  name: string;
  balance: number | string;
  parentId: number;
  contactInfo: unknown;
};

export type TelcoAccountRow = {
  id: number;
  name: string;
  balance: number;
  packageOnly?: boolean;
  steeringListId?: number;
};

export type ResellerAdminDto = {
  id: string;
  telcoResellerId: number;
  name: string;
  currency: string;
  contactEmail: string | null;
  creditLimit: number | null;
  balance: number;
  discountPct: number;
  allowDebt: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  telcoReseller?: TelcoResellerSubset;
  accounts?: TelcoAccountRow[];
};

export type ResellerRetailOverrideDto = {
  id: string;
  resellerId: string;
  packageTemplateId: string;
  mode: 'fixed_retail' | 'markup_percent';
  retailPrice: number | null;
  markupPercent: number | null;
  wholesaleReferencePrice: number | null;
  currency: string;
  updatedAt: string;
};

@Injectable()
export class ResellersService {
  private readonly logger = new Logger(ResellersService.name);

  constructor(
    @InjectRepository(Reseller)
    private readonly resellerRepo: Repository<Reseller>,
    @InjectRepository(ResellerRetailOverride)
    private readonly overrideRepo: Repository<ResellerRetailOverride>,
    @InjectRepository(PackageTemplate)
    private readonly packageRepo: Repository<PackageTemplate>,
    @InjectRepository(BalanceTransaction)
    private readonly txRepo: Repository<BalanceTransaction>,
    private readonly telco: TelcoService,
    private readonly dataSource: DataSource,
  ) {}

  private mapResellerBase(r: Reseller): ResellerAdminDto {
    return {
      id: r.id,
      telcoResellerId: r.telcoResellerId,
      name: r.name,
      currency: r.currency || 'EUR',
      contactEmail: r.contactEmail,
      creditLimit: decToNumber(r.creditLimit),
      balance: decToNumber(r.balance) ?? 0,
      discountPct: decToNumber(r.discountPct) ?? 0,
      allowDebt: r.allowDebt,
      isActive: r.isActive,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }

  private extractTelcoResellerSubset(raw: unknown): TelcoResellerSubset | null {
    const g = (raw as { getResellerInfo?: Record<string, unknown> })
      ?.getResellerInfo;
    if (!g || typeof g !== 'object') return null;
    const id = g.id as number;
    if (typeof id !== 'number') return null;
    return {
      id,
      name: String(g.name ?? ''),
      balance: normalizeTelcoBalance(g.balance),
      parentId: g.parentId as number,
      contactInfo: g.contactInfo ?? null,
    };
  }

  private extractAccountsForReseller(
    raw: unknown,
    telcoResellerId: number,
  ): TelcoAccountRow[] {
    const resellers = (
      raw as {
        listResellerAccount?: {
          reseller?: Array<{
            id: number;
            account?: Array<{
              id: number;
              name: string;
              balance: number;
              packageOnly?: boolean;
              steeringListId?: number;
            }>;
          }>;
        };
      }
    )?.listResellerAccount?.reseller;
    if (!Array.isArray(resellers)) return [];
    const block = resellers.find((x) => x.id === telcoResellerId);
    const accounts = block?.account ?? [];
    return accounts.map((a) => ({
      id: a.id,
      name: a.name,
      balance: a.balance,
      ...(a.packageOnly !== undefined ? { packageOnly: a.packageOnly } : {}),
      ...(a.steeringListId !== undefined
        ? { steeringListId: a.steeringListId }
        : {}),
    }));
  }

  private async enrichWithTelco(r: Reseller): Promise<ResellerAdminDto> {
    const base = this.mapResellerBase(r);
    if (!this.telco.isConfigured()) {
      return base;
    }
    try {
      const [infoRaw, listRaw] = await Promise.all([
        this.telco.getResellerInfo(r.telcoResellerId),
        this.telco.listResellerAccount(r.telcoResellerId),
      ]);
      const telcoReseller = this.extractTelcoResellerSubset(infoRaw);
      const accountsOk = isTelcoSuccess(listRaw);
      const infoOk = isTelcoSuccess(infoRaw);
      const accounts = accountsOk
        ? this.extractAccountsForReseller(listRaw, r.telcoResellerId)
        : [];
      return {
        ...base,
        ...(infoOk && telcoReseller ? { telcoReseller } : {}),
        ...(accountsOk ? { accounts } : {}),
      };
    } catch (e) {
      this.logger.warn(
        `Telco enrichment failed for reseller ${r.id}: ${e instanceof Error ? e.message : String(e)}`,
      );
      return base;
    }
  }

  async listAdmin(): Promise<{ data: ResellerAdminDto[] }> {
    const rows = await this.resellerRepo.find({ order: { createdAt: 'DESC' } });
    const data = await Promise.all(rows.map((r) => this.enrichWithTelco(r)));
    return { data };
  }

  async create(dto: CreateResellerDto): Promise<ResellerAdminDto> {
    const row = this.resellerRepo.create({
      name: dto.name,
      telcoResellerId: dto.telcoResellerId ?? 590,
      currency: (dto.currency ?? 'EUR').trim() || 'EUR',
      contactEmail: dto.contactEmail ?? null,
      creditLimit: dto.creditLimit != null ? String(dto.creditLimit) : null,
    });
    const saved = await this.resellerRepo.save(row);
    return this.enrichWithTelco(saved);
  }

  async update(id: string, dto: UpdateResellerDto): Promise<ResellerAdminDto> {
    const row = await this.resellerRepo.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException({ message: 'Reseller not found' });
    }
    if (dto.name !== undefined) row.name = dto.name;
    if (dto.currency !== undefined) {
      row.currency = dto.currency.trim() || 'EUR';
    }
    if (dto.contactEmail !== undefined) {
      row.contactEmail = dto.contactEmail;
    }
    if (dto.creditLimit !== undefined) {
      row.creditLimit =
        dto.creditLimit != null ? String(dto.creditLimit) : null;
    }
    if (dto.discountPct !== undefined) {
      row.discountPct = dto.discountPct.toFixed(2);
    }
    if (dto.allowDebt !== undefined) {
      row.allowDebt = dto.allowDebt;
    }
    if (dto.isActive !== undefined) {
      row.isActive = dto.isActive;
    }
    const saved = await this.resellerRepo.save(row);
    return this.enrichWithTelco(saved);
  }

  async adjustTelcoBalance(
    id: string,
    dto: AdminAdjustTelcoBalanceDto,
  ): Promise<{ ok: true; telcoResponse: unknown }> {
    if (!this.telco.isConfigured()) {
      throw new BadGatewayException({
        message: 'Telco API is not configured',
      });
    }
    const row = await this.resellerRepo.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException({ message: 'Reseller not found' });
    }
    const scope = dto.scope ?? 'reseller';

    try {
      if (scope === 'account') {
        if (dto.accountId == null) {
          throw new BadRequestException({
            message: 'accountId is required when scope is account',
          });
        }
        const data = await this.telco.modifyAccountBalance({
          accountId: dto.accountId,
          amount: dto.amount,
          setBalance: dto.setBalance === true,
          description: dto.description,
        });
        return { ok: true, telcoResponse: data };
      }

      const txType =
        dto.transactionType?.trim() ||
        this.telco.getDefaultResellerBalanceType() ||
        'Wire';
      const data = await this.telco.modifyResellerBalance({
        resellerId: row.telcoResellerId,
        type: txType,
        amount: dto.amount,
        setBalance: dto.setBalance === true,
        description: dto.description,
      });
      return { ok: true, telcoResponse: data };
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      if (e instanceof TelcoProviderError) {
        throw new BadGatewayException({ message: e.message });
      }
      throw new BadGatewayException({
        message: e instanceof Error ? e.message : 'Telco request failed',
      });
    }
  }

  async adjustInternalLedger(
    id: string,
    dto: InternalLedgerDto,
  ): Promise<{ ok: true; balance: number }> {
    const row = await this.resellerRepo.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException({ message: 'Reseller not found' });
    }
    const cur = decToNumber(row.balance) ?? 0;
    const next =
      dto.setBalance === true ? Number(dto.delta) : cur + Number(dto.delta);
    if (!Number.isFinite(next)) {
      throw new BadRequestException({ message: 'Invalid ledger result' });
    }
    const limitNum = decToNumber(row.creditLimit);
    if (limitNum != null) {
      const floor = -Math.abs(limitNum);
      if (next < floor) {
        throw new BadRequestException({
          message: `Internal ledger cannot go below ${floor} (credit limit)`,
        });
      }
    }
    row.balance = next.toFixed(4);
    await this.resellerRepo.save(row);
    return { ok: true, balance: next };
  }

  async listRetailOverrides(
    resellerId: string,
  ): Promise<{ data: ResellerRetailOverrideDto[] }> {
    await this.requireReseller(resellerId);
    const rows = await this.overrideRepo.find({
      where: { resellerId },
      order: { updatedAt: 'DESC' },
    });
    return {
      data: rows.map((o) => ({
        id: o.id,
        resellerId: o.resellerId,
        packageTemplateId: o.packageTemplateId,
        mode: o.mode,
        retailPrice: decToNumber(o.retailPrice),
        markupPercent: decToNumber(o.markupPercent),
        wholesaleReferencePrice: decToNumber(o.wholesaleReferencePrice),
        currency: o.currency,
        updatedAt: o.updatedAt.toISOString(),
      })),
    };
  }

  async upsertRetailOverride(
    resellerId: string,
    dto: UpsertRetailOverrideDto,
  ): Promise<ResellerRetailOverrideDto> {
    const reseller = await this.requireReseller(resellerId);
    const pt = await this.packageRepo.findOne({
      where: { id: dto.packageTemplateId },
    });
    if (!pt) {
      throw new NotFoundException({ message: 'Package template not found' });
    }
    if (dto.mode === 'fixed_retail' && dto.retailPrice == null) {
      throw new BadRequestException({
        message: 'retailPrice is required when mode is fixed_retail',
      });
    }
    if (dto.mode === 'markup_percent' && dto.markupPercent == null) {
      throw new BadRequestException({
        message: 'markupPercent is required when mode is markup_percent',
      });
    }

    let row = await this.overrideRepo.findOne({
      where: {
        resellerId,
        packageTemplateId: dto.packageTemplateId,
      },
    });
    if (!row) {
      row = this.overrideRepo.create({
        resellerId,
        packageTemplateId: dto.packageTemplateId,
        mode: dto.mode,
        currency: (dto.currency ?? reseller.currency ?? 'EUR').trim() || 'EUR',
        retailPrice: null,
        markupPercent: null,
        wholesaleReferencePrice: null,
      });
    }
    row.mode = dto.mode;
    if (dto.currency != null) {
      row.currency = dto.currency.trim() || 'EUR';
    }
    if (dto.mode === 'fixed_retail') {
      row.retailPrice = String(dto.retailPrice);
      row.markupPercent = null;
    } else {
      row.markupPercent = String(dto.markupPercent);
      row.retailPrice = null;
    }
    row.wholesaleReferencePrice =
      dto.wholesaleReferencePrice != null
        ? String(dto.wholesaleReferencePrice)
        : null;

    const saved = await this.overrideRepo.save(row);
    return {
      id: saved.id,
      resellerId: saved.resellerId,
      packageTemplateId: saved.packageTemplateId,
      mode: saved.mode,
      retailPrice: decToNumber(saved.retailPrice),
      markupPercent: decToNumber(saved.markupPercent),
      wholesaleReferencePrice: decToNumber(saved.wholesaleReferencePrice),
      currency: saved.currency,
      updatedAt: saved.updatedAt.toISOString(),
    };
  }

  async deleteRetailOverride(
    resellerId: string,
    overrideId: string,
  ): Promise<void> {
    await this.requireReseller(resellerId);
    const res = await this.overrideRepo.delete({
      id: overrideId,
      resellerId,
    });
    if (!res.affected) {
      throw new NotFoundException({ message: 'Retail override not found' });
    }
  }

  async getCustomerTariffForReseller(id: string): Promise<unknown> {
    if (!this.telco.isConfigured()) {
      throw new BadGatewayException({
        message: 'Telco API is not configured',
      });
    }
    const row = await this.resellerRepo.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException({ message: 'Reseller not found' });
    }
    try {
      const data = await this.telco.getCustomerTariff(row.telcoResellerId);
      if (!isTelcoSuccess(data)) {
        const st = telcoStatusFromResponse(data);
        throw new BadGatewayException({
          message: st?.msg || 'Telco getCustomerTariff failed',
        });
      }
      return data;
    } catch (e) {
      if (e instanceof BadGatewayException) throw e;
      throw new BadGatewayException({
        message: e instanceof Error ? e.message : 'Telco request failed',
      });
    }
  }

  // ── Reseller Platform Methods ──

  async createResellerWithUser(
    dto: CreateResellerWithUserDto,
    performedByUserId: string,
  ): Promise<{
    reseller: ResellerAdminDto;
    user: { id: string; email: string };
  }> {
    return this.dataSource.transaction(async (manager) => {
      // Create reseller
      const reseller = manager.create(Reseller, {
        name: dto.name,
        telcoResellerId: dto.telcoResellerId ?? 590,
        currency: (dto.currency ?? 'EUR').trim() || 'EUR',
        contactEmail: dto.contactEmail ?? dto.email,
        creditLimit: dto.creditLimit != null ? String(dto.creditLimit) : null,
        discountPct: dto.discountPct.toFixed(2),
        allowDebt: dto.allowDebt ?? false,
        isActive: true,
        balance: '0.0000',
      });
      const savedReseller = await manager.save(reseller);

      // Create user account for the reseller
      const passwordHash = await bcrypt.hash(dto.password, 12);
      const user = manager.create(UsersEntity, {
        email: dto.email,
        password: passwordHash,
        first_name: dto.name,
        last_name: '',
        role: Role.RESELLER,
        reseller_id: savedReseller.id,
        is_verified: true,
      });
      const savedUser = await manager.save(user);

      // Optional initial balance top-up
      if (dto.initialBalance && dto.initialBalance > 0) {
        const balanceStr = Decimal4Util.toString(dto.initialBalance);
        savedReseller.balance = balanceStr;
        await manager.save(savedReseller);

        await manager.save(
          manager.create(BalanceTransaction, {
            resellerId: savedReseller.id,
            type: BalanceTransactionType.TOPUP,
            amount: balanceStr,
            balanceAfter: balanceStr,
            description: 'Initial balance',
            performedBy: performedByUserId,
          }),
        );
      }

      return {
        reseller: this.mapResellerBase(savedReseller),
        user: { id: savedUser.id, email: savedUser.email },
      };
    });
  }

  async topupBalance(
    resellerId: string,
    amount: number,
    description: string | undefined,
    performedByUserId: string,
  ): Promise<{ balance: number }> {
    if (amount <= 0) {
      throw new BadRequestException({ message: 'Amount must be positive' });
    }

    return this.dataSource.transaction(async (manager) => {
      const reseller = await manager
        .createQueryBuilder(Reseller, 'r')
        .setLock('pessimistic_write')
        .where('r.id = :id', { id: resellerId })
        .getOne();

      if (!reseller)
        throw new NotFoundException({ message: 'Reseller not found' });

      const amountStr = Decimal4Util.toString(amount);
      const newBalance = Decimal4Util.add(reseller.balance, amountStr);
      reseller.balance = newBalance;
      await manager.save(reseller);

      await manager.save(
        manager.create(BalanceTransaction, {
          resellerId,
          type: BalanceTransactionType.TOPUP,
          amount: amountStr,
          balanceAfter: newBalance,
          description: description ?? null,
          performedBy: performedByUserId,
        }),
      );

      return { balance: parseFloat(newBalance) };
    });
  }

  async adjustBalance(
    resellerId: string,
    amount: number,
    description: string,
    performedByUserId: string,
  ): Promise<{ balance: number }> {
    return this.dataSource.transaction(async (manager) => {
      const reseller = await manager
        .createQueryBuilder(Reseller, 'r')
        .setLock('pessimistic_write')
        .where('r.id = :id', { id: resellerId })
        .getOne();

      if (!reseller)
        throw new NotFoundException({ message: 'Reseller not found' });

      const amountStr = Decimal4Util.toString(amount);
      const newBalance = Decimal4Util.add(reseller.balance, amountStr);
      reseller.balance = newBalance;
      await manager.save(reseller);

      await manager.save(
        manager.create(BalanceTransaction, {
          resellerId,
          type: BalanceTransactionType.ADJUSTMENT,
          amount: amountStr,
          balanceAfter: newBalance,
          description,
          performedBy: performedByUserId,
        }),
      );

      return { balance: parseFloat(newBalance) };
    });
  }

  async getTransactions(
    resellerId: string,
    page = 1,
    limit = 20,
  ): Promise<{ data: BalanceTransaction[]; total: number }> {
    const [data, total] = await this.txRepo.findAndCount({
      where: { resellerId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total };
  }

  async getResellerById(id: string): Promise<Reseller | null> {
    return this.resellerRepo.findOne({ where: { id } });
  }

  private async requireReseller(id: string): Promise<Reseller> {
    const row = await this.resellerRepo.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException({ message: 'Reseller not found' });
    }
    return row;
  }
}
