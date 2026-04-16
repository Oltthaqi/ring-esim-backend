const ERROR_CODE_MESSAGES: Record<number, string> = {
  0: 'OK',
  1: 'Unknown request',
  2: 'Invalid request',
  3: 'Unexpected error',
  4: 'Duplicate entry',
  5: 'Data inconsistency',
  6: 'Not found',
  7: 'Database error',
  8: 'No API account for reseller',
  9: 'Source IP not authorised',
  10: 'Invalid reseller',
  11: 'Resource not visible',
  12: 'Resource read-only',
  13: 'SMS API error',
  14: 'Operation impossible',
  15: 'HLR API error',
  16: 'Steering API error',
  17: 'Subscriber end of life',
  18: 'Timeout',
  100: 'Traffic control limit exceeded',
};

export class UpstreamApiError extends Error {
  public readonly code: number;
  public readonly endpoint: string;
  public readonly upstreamMessage: string;

  constructor(code: number, upstreamMessage: string, endpoint: string) {
    const humanReadable =
      ERROR_CODE_MESSAGES[code] ?? `Unknown error code ${code}`;
    super(
      `Upstream ${endpoint} failed: [${code}] ${humanReadable} — ${upstreamMessage}`,
    );
    this.name = 'UpstreamApiError';
    this.code = code;
    this.endpoint = endpoint;
    this.upstreamMessage = upstreamMessage;
  }
}
