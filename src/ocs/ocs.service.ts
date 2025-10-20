import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class OcsService {
  private base = (process.env.OCS_BASE_URL || '').trim();
  private token = (process.env.OCS_TOKEN || '').trim();
  private url = ''; // final URL with token

  constructor(private http: HttpService) {}

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
