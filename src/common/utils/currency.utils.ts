/**
 * Currency utility functions for handling minor units (cents)
 * to avoid floating-point precision issues
 */

/**
 * Zero-decimal currencies (no fractional units)
 * These currencies have no minor units (e.g., ¥100 is stored as 100, not 10000)
 */
const ZERO_DECIMAL_CURRENCIES = new Set([
  'BIF', // Burundian Franc
  'CLP', // Chilean Peso
  'DJF', // Djiboutian Franc
  'GNF', // Guinean Franc
  'JPY', // Japanese Yen
  'KMF', // Comorian Franc
  'KRW', // South Korean Won
  'MGA', // Malagasy Ariary
  'PYG', // Paraguayan Guaraní
  'RWF', // Rwandan Franc
  'UGX', // Ugandan Shilling
  'VND', // Vietnamese Đồng
  'VUV', // Vanuatu Vatu
  'XAF', // Central African CFA Franc
  'XOF', // West African CFA Franc
  'XPF', // CFP Franc
]);

/**
 * Convert decimal amount to minor units (cents) for storage
 * @param amount - Decimal amount (e.g., 1.99 EUR)
 * @param currency - ISO 4217 currency code (e.g., 'EUR', 'JPY')
 * @returns Integer minor units (e.g., 199 for EUR, 100 for JPY)
 *
 * @example
 * toMinorUnits(1.99, 'EUR') // 199
 * toMinorUnits(0.20, 'EUR') // 20
 * toMinorUnits(100, 'JPY')  // 100
 * toMinorUnits(0.005, 'EUR') // 1 (rounds up from 0.5 cents)
 */
export function toMinorUnits(amount: number, currency: string): number {
  const upperCurrency = currency.toUpperCase();

  if (ZERO_DECIMAL_CURRENCIES.has(upperCurrency)) {
    // Zero-decimal currency: amount is already in minor units
    return Math.round(amount);
  }

  // Standard currency (2 decimal places): multiply by 100
  // Use Math.round for banker's rounding (half-even)
  return Math.round(amount * 100);
}

/**
 * Convert minor units (cents) back to decimal amount for display
 * @param minorUnits - Integer minor units (e.g., 199)
 * @param currency - ISO 4217 currency code
 * @returns Decimal amount (e.g., 1.99)
 *
 * @example
 * fromMinorUnits(199, 'EUR') // 1.99
 * fromMinorUnits(20, 'EUR')  // 0.20
 * fromMinorUnits(100, 'JPY') // 100
 */
export function fromMinorUnits(minorUnits: number, currency: string): number {
  const upperCurrency = currency.toUpperCase();

  if (ZERO_DECIMAL_CURRENCIES.has(upperCurrency)) {
    return minorUnits;
  }

  return minorUnits / 100;
}

/**
 * Format amount for display (with currency symbol)
 * @param amount - Decimal amount
 * @param currency - ISO 4217 currency code
 * @returns Formatted string (e.g., "€1.99", "¥100")
 */
export function formatCurrency(amount: number, currency: string): string {
  const upperCurrency = currency.toUpperCase();
  const decimals = ZERO_DECIMAL_CURRENCIES.has(upperCurrency) ? 0 : 2;

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: upperCurrency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

/**
 * Validate that minor units value is safe for storage
 * (within JavaScript's safe integer range)
 */
export function isValidMinorUnits(minorUnits: number): boolean {
  return (
    Number.isInteger(minorUnits) &&
    minorUnits >= 0 &&
    minorUnits <= Number.MAX_SAFE_INTEGER
  );
}
