/**
 * 4-decimal-place arithmetic for balance operations.
 * Same pattern as DecimalUtil but with PRECISION=4, SCALE=10000.
 * Used for reseller balance and upstream cost calculations.
 */
export class Decimal4Util {
  private static readonly PRECISION = 4;
  private static readonly SCALE = 10000;

  static toMinorUnits(value: string | number): number {
    const parsed = typeof value === 'number' ? value : parseFloat(value);
    if (isNaN(parsed)) {
      throw new Error(`Invalid decimal value: ${value}`);
    }
    return Math.round(parsed * this.SCALE);
  }

  static fromMinorUnits(value: number): string {
    return (value / this.SCALE).toFixed(this.PRECISION);
  }

  static add(a: string, b: string): string {
    return this.fromMinorUnits(this.toMinorUnits(a) + this.toMinorUnits(b));
  }

  static subtract(a: string, b: string): string {
    return this.fromMinorUnits(this.toMinorUnits(a) - this.toMinorUnits(b));
  }

  static multiply(a: string, b: string): string {
    const aMinor = this.toMinorUnits(a);
    const bMinor = this.toMinorUnits(b);
    return this.fromMinorUnits(Math.round((aMinor * bMinor) / this.SCALE));
  }

  static compare(a: string, b: string): number {
    return this.toMinorUnits(a) - this.toMinorUnits(b);
  }

  static greaterThanOrEqual(a: string, b: string): boolean {
    return this.compare(a, b) >= 0;
  }

  static lessThan(a: string, b: string): boolean {
    return this.compare(a, b) < 0;
  }

  static toString(value: number | string | null | undefined): string {
    if (value === null || value === undefined) return '0.0000';
    const parsed = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(parsed)) return '0.0000';
    return parsed.toFixed(this.PRECISION);
  }

  static negate(a: string): string {
    return this.fromMinorUnits(-this.toMinorUnits(a));
  }
}
