export class DecimalUtil {
  private static readonly PRECISION = 2;
  private static readonly SCALE = 100;

  static toMinorUnits(value: string): number {
    const parsed = parseFloat(value);
    if (isNaN(parsed)) {
      throw new Error(`Invalid decimal value: ${value}`);
    }
    return Math.round(parsed * this.SCALE);
  }

  static fromMinorUnits(value: number): string {
    return (value / this.SCALE).toFixed(this.PRECISION);
  }

  static add(a: string, b: string): string {
    const aMinor = this.toMinorUnits(a);
    const bMinor = this.toMinorUnits(b);
    return this.fromMinorUnits(aMinor + bMinor);
  }

  static subtract(a: string, b: string): string {
    const aMinor = this.toMinorUnits(a);
    const bMinor = this.toMinorUnits(b);
    return this.fromMinorUnits(aMinor - bMinor);
  }

  static multiply(a: string, b: string): string {
    const aMinor = this.toMinorUnits(a);
    const bMinor = this.toMinorUnits(b);
    return this.fromMinorUnits(Math.round((aMinor * bMinor) / this.SCALE));
  }

  static min(a: string, b: string): string {
    const aMinor = this.toMinorUnits(a);
    const bMinor = this.toMinorUnits(b);
    return this.fromMinorUnits(Math.min(aMinor, bMinor));
  }

  static max(a: string, b: string): string {
    const aMinor = this.toMinorUnits(a);
    const bMinor = this.toMinorUnits(b);
    return this.fromMinorUnits(Math.max(aMinor, bMinor));
  }

  static compare(a: string, b: string): number {
    const aMinor = this.toMinorUnits(a);
    const bMinor = this.toMinorUnits(b);
    return aMinor - bMinor;
  }

  static equals(a: string, b: string): boolean {
    return this.compare(a, b) === 0;
  }

  static greaterThan(a: string, b: string): boolean {
    return this.compare(a, b) > 0;
  }

  static greaterThanOrEqual(a: string, b: string): boolean {
    return this.compare(a, b) >= 0;
  }

  static lessThan(a: string, b: string): boolean {
    return this.compare(a, b) < 0;
  }

  static lessThanOrEqual(a: string, b: string): boolean {
    return this.compare(a, b) <= 0;
  }

  static isZero(value: string): boolean {
    return this.equals(value, '0.00');
  }

  static toString(value: number | string | null | undefined): string {
    if (value === null || value === undefined) {
      return '0.00';
    }
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      if (isNaN(parsed)) {
        return '0.00';
      }
      return parsed.toFixed(this.PRECISION);
    }
    return value.toFixed(this.PRECISION);
  }

  static validate(value: string): boolean {
    return /^\d+(\.\d{1,2})?$/.test(value);
  }
}
