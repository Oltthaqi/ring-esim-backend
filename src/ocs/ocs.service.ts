import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import {
  UpstreamTemplate,
  AffectPackageResult,
  AffectPackageToSubscriberParams,
} from './types/upstream.types';
import { UpstreamApiError } from './errors/upstream-api.error';
import { UpstreamApiLog } from './entities/upstream-api-log.entity';

@Injectable()
export class OcsService {
  private readonly logger = new Logger(OcsService.name);
  private static readonly DEFAULT_RESELLER_ID = 590;
  private static readonly DEFAULT_ACCOUNT_ID = 2582;

  private base = (process.env.OCS_BASE_URL || '').trim();
  private token = (process.env.OCS_TOKEN || '').trim();
  private url = ''; // final URL with token

  constructor(
    private http: HttpService,
    @InjectRepository(UpstreamApiLog)
    private readonly logRepo: Repository<UpstreamApiLog>,
  ) {}

  /** Default reseller for OCS calls when not passed explicitly (sync, zone lists, package details). */
  getDefaultResellerId(): number {
    const n = Number(process.env.OCS_DEFAULT_RESELLER_ID);
    return Number.isFinite(n) && n > 0
      ? Math.trunc(n)
      : OcsService.DEFAULT_RESELLER_ID;
  }

  /** Default OCS account for subscriber listing when not passed explicitly. */
  getDefaultAccountId(): number {
    const n = Number(process.env.OCS_ACCOUNT_ID);
    return Number.isFinite(n) && n > 0
      ? Math.trunc(n)
      : OcsService.DEFAULT_ACCOUNT_ID;
  }

  /** Shared account ID for reseller eSIM pool (accountForSubs param). */
  getSharedAccountId(): number {
    const n = Number(process.env.UPSTREAM_SHARED_ACCOUNT_ID);
    return Number.isFinite(n) && n > 0
      ? Math.trunc(n)
      : this.getDefaultAccountId();
  }

  onModuleInit() {
    // Build URL using URL API to avoid bad concatenation
    try {
      const u = new URL(this.base); // will throw if base is invalid/empty
      if (this.token) u.searchParams.set('token', this.token);
      this.url = u.toString();
    } catch (e) {
      console.error('[OCS] Invalid base URL or token:', {
        base: this.base,
        tokenSet: !!this.token,
      });
      throw e;
    }
  }

  private readonly headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  async listSubscribers(accountId: number) {
    const body = { listSubscriber: { accountId } };
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { data } = await firstValueFrom(
      this.http.post(this.url, body, { headers: this.headers }),
    );
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
    return data?.listSubscriber?.subscriberList ?? [];
  }

  async post<T>(body: unknown): Promise<T> {
    const { data } = await firstValueFrom(
      this.http.post<T>(this.url, body, { headers: this.headers }),
    );
    return data;
  }

  // ── Typed upstream methods for the reseller platform ──

  async listPrepaidPackageTemplates(
    resellerId?: number,
  ): Promise<UpstreamTemplate[]> {
    const methodName = 'listPrepaidPackageTemplate';
    const params: Record<string, unknown> = {};
    if (resellerId != null) params.resellerId = resellerId;
    const body = { [methodName]: params };

    const start = Date.now();
    let responseData: Record<string, unknown> | undefined;
    let statusCode: number | undefined;

    try {
      const { data } = await firstValueFrom(
        this.http.post<Record<string, unknown>>(this.url, body, {
          headers: this.headers,
          timeout: 30_000,
        }),
      );
      responseData = data;
      const status = data?.status as { code: number; msg: string } | undefined;
      statusCode = status?.code;

      if (status && status.code !== 0) {
        throw new UpstreamApiError(status.code, status.msg, methodName);
      }

      const result = data?.[methodName] as
        | {
            template?: UpstreamTemplate[];
          }
        | undefined;
      return result?.template ?? [];
    } finally {
      await this.saveLog(
        methodName,
        body,
        responseData,
        statusCode,
        Date.now() - start,
      );
    }
  }

  async affectPackageToSubscriberByAccount(
    params: AffectPackageToSubscriberParams,
    resellerOrderId?: string,
  ): Promise<AffectPackageResult> {
    const methodName = 'affectPackageToSubscriber';
    const body: Record<string, unknown> = {
      [methodName]: {
        packageTemplateId: params.packageTemplateId,
        accountForSubs: params.accountForSubs,
        ...(params.validityPeriod != null
          ? { validityPeriod: params.validityPeriod }
          : {}),
      },
    };

    const start = Date.now();
    let responseData: Record<string, unknown> | undefined;
    let statusCode: number | undefined;

    try {
      const { data } = await firstValueFrom(
        this.http.post<Record<string, unknown>>(this.url, body, {
          headers: this.headers,
          timeout: 30_000,
        }),
      );
      responseData = data;
      const status = data?.status as { code: number; msg: string } | undefined;
      statusCode = status?.code;

      if (!status || status.code !== 0) {
        throw new UpstreamApiError(
          status?.code ?? -1,
          status?.msg ?? 'No status in response',
          methodName,
        );
      }

      const result = data?.[methodName] as AffectPackageResult | undefined;
      if (!result?.iccid) {
        throw new UpstreamApiError(-1, 'Missing ICCID in response', methodName);
      }

      return result;
    } finally {
      await this.saveLog(
        methodName,
        body,
        responseData,
        statusCode,
        Date.now() - start,
        resellerOrderId,
      );
    }
  }

  async getSingleSubscriber(
    subscriberId: number,
  ): Promise<Record<string, unknown>> {
    const methodName = 'getSingleSubscriber';
    const body = { [methodName]: { subscriberId } };

    const start = Date.now();
    let responseData: Record<string, unknown> | undefined;
    let statusCode: number | undefined;

    try {
      const { data } = await firstValueFrom(
        this.http.post<Record<string, unknown>>(this.url, body, {
          headers: this.headers,
          timeout: 30_000,
        }),
      );
      responseData = data;
      const status = data?.status as { code: number; msg: string } | undefined;
      statusCode = status?.code;

      if (status && status.code !== 0) {
        throw new UpstreamApiError(status.code, status.msg, methodName);
      }

      return (data?.[methodName] as Record<string, unknown>) ?? {};
    } finally {
      await this.saveLog(
        methodName,
        body,
        responseData,
        statusCode,
        Date.now() - start,
      );
    }
  }

  private async saveLog(
    methodName: string,
    requestBody: unknown,
    responseBody: unknown,
    statusCode: number | undefined,
    durationMs: number,
    resellerOrderId?: string,
  ): Promise<void> {
    try {
      await this.logRepo.save(
        this.logRepo.create({
          methodName,
          requestBody: requestBody as Record<string, unknown>,
          responseBody: responseBody as Record<string, unknown>,
          statusCode: statusCode ?? null,
          durationMs,
          resellerOrderId: resellerOrderId ?? null,
        }),
      );
    } catch (e) {
      this.logger.warn(
        `Failed to save upstream API log: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
}
