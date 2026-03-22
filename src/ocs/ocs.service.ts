import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class OcsService {
  private static readonly DEFAULT_RESELLER_ID = 590;
  private static readonly DEFAULT_ACCOUNT_ID = 2582;

  private base = (process.env.OCS_BASE_URL || '').trim();
  private token = (process.env.OCS_TOKEN || '').trim();
  private url = ''; // final URL with token

  constructor(private http: HttpService) {}

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

  async listSubscribers(accountId: number) {
    const body = { listSubscriber: { accountId } };
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { data } = await firstValueFrom(
      this.http.post(this.url, body, { headers }),
    );
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
    return data?.listSubscriber?.subscriberList ?? [];
  }

  async post<T>(body: unknown): Promise<T> {
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    const { data } = await firstValueFrom(
      this.http.post<T>(this.url, body, { headers }),
    );
    return data;
  }
}
