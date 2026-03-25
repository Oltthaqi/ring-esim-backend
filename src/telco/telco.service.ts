import { HttpService } from '@nestjs/axios';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';

export type TelcoStatus = { code?: number; msg?: string };

export function telcoStatusFromResponse(data: unknown): TelcoStatus | undefined {
  const d = data as { status?: TelcoStatus };
  return d?.status;
}

export function isTelcoSuccess(data: unknown): boolean {
  const code = telcoStatusFromResponse(data)?.code;
  return code === 0;
}

@Injectable()
export class TelcoService implements OnModuleInit {
  private readonly logger = new Logger(TelcoService.name);
  private url = '';
  private configured = false;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    const base = (
      this.config.get<string>('TELCO_BASE_URL') ||
      this.config.get<string>('OCS_BASE_URL') ||
      ''
    ).trim();
    const token = (
      this.config.get<string>('TELCO_TOKEN') ||
      this.config.get<string>('OCS_TOKEN') ||
      ''
    ).trim();

    if (!base) {
      this.logger.warn(
        'Telco API not configured (set TELCO_BASE_URL or OCS_BASE_URL). Reseller telco calls will fail until configured.',
      );
      this.configured = false;
      return;
    }

    try {
      const u = new URL(base);
      if (token) u.searchParams.set('token', token);
      this.url = u.toString();
      this.configured = true;
    } catch (e) {
      this.logger.error('Invalid TELCO_BASE_URL / OCS_BASE_URL', e);
      this.configured = false;
    }
  }

  isConfigured(): boolean {
    return this.configured && this.url.length > 0;
  }

  getDefaultResellerBalanceType(): string {
    return (
      this.config.get<string>('TELCO_MODIFY_RESELLER_BALANCE_TYPE') || 'Wire'
    ).trim() || 'Wire';
  }

  async post<T = unknown>(body: unknown): Promise<T> {
    if (!this.isConfigured()) {
      throw new Error('Telco API is not configured');
    }
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    const { data } = await firstValueFrom(
      this.http.post<T>(this.url, body, { headers }),
    );
    return data;
  }

  async postExpectSuccess<T = unknown>(body: unknown): Promise<T> {
    try {
      const data = await this.post<T>(body);
      if (!isTelcoSuccess(data)) {
        const st = telcoStatusFromResponse(data);
        throw new TelcoProviderError(
          st?.msg || 'Telco API returned an error',
          data,
          st?.code,
        );
      }
      return data;
    } catch (e) {
      if (e instanceof TelcoProviderError) throw e;
      const ax = e as AxiosError<{ status?: TelcoStatus }>;
      const msg =
        ax.response?.data &&
        typeof ax.response.data === 'object' &&
        'status' in ax.response.data
          ? (ax.response.data as { status?: { msg?: string } }).status?.msg
          : ax.message;
      throw new TelcoProviderError(
        msg || 'Telco request failed',
        ax.response?.data ?? null,
        ax.response?.status,
      );
    }
  }

  listResellerAccount(resellerId?: number) {
    const body =
      resellerId != null && Number.isFinite(resellerId)
        ? { listResellerAccount: { resellerId: Math.trunc(resellerId) } }
        : { listResellerAccount: {} };
    return this.post(body);
  }

  getResellerInfo(id: number) {
    return this.post({
      getResellerInfo: { id: Math.trunc(id) },
    });
  }

  modifyResellerBalance(params: {
    resellerId: number;
    type: string;
    amount: number;
    setBalance?: boolean;
    description?: string;
  }) {
    const payload: Record<string, unknown> = {
      resellerId: Math.trunc(params.resellerId),
      type: params.type,
      amount: params.amount,
    };
    if (params.description != null) payload.description = params.description;
    if (params.setBalance === true) payload.setBalance = true;
    return this.postExpectSuccess({
      modifyResellerBalance: payload,
    });
  }

  modifyAccountBalance(params: {
    accountId: number;
    amount: number;
    setBalance?: boolean;
    description?: string;
  }) {
    const payload: Record<string, unknown> = {
      accountId: Math.trunc(params.accountId),
      amount: params.amount,
    };
    if (params.description != null) payload.description = params.description;
    if (params.setBalance === true) payload.setBalance = true;
    return this.postExpectSuccess({
      modifyAccountBalance: payload,
    });
  }

  getCustomerTariff(resellerId: number) {
    return this.post({
      getCustomerTariff: Math.trunc(resellerId),
    });
  }
}

export class TelcoProviderError extends Error {
  constructor(
    message: string,
    readonly telcoBody: unknown,
    readonly telcoCode?: number,
  ) {
    super(message);
    this.name = 'TelcoProviderError';
  }
}
