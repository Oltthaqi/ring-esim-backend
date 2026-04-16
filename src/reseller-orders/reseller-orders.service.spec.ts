import { Decimal4Util } from '../common/utils/decimal4.util';

describe('Decimal4Util', () => {
  describe('discount calculation', () => {
    const cases: [number, number, string][] = [
      // [cost, discountPct, expectedResellerPrice]
      [10, 15, '8.5000'],
      [10, 0, '10.0000'],
      [10, 100, '0.0000'],
      [66, 15.75, '55.6050'],
      [100, 50, '50.0000'],
      [0.01, 10, '0.0090'],
      [999.9999, 1, '989.9999'],
    ];

    it.each(cases)(
      'cost=%f, discount=%f%% → resellerPrice=%s',
      (cost, discountPct, expected) => {
        const ourSellPrice = Decimal4Util.toString(cost);
        const multiplier = Decimal4Util.toString(1 - discountPct / 100);
        const result = Decimal4Util.multiply(ourSellPrice, multiplier);
        expect(result).toBe(expected);
      },
    );
  });

  describe('balance check logic', () => {
    it('allows order when balance >= price', () => {
      expect(Decimal4Util.greaterThanOrEqual('100.0000', '85.0000')).toBe(true);
    });

    it('rejects order when balance < price and no debt', () => {
      expect(Decimal4Util.greaterThanOrEqual('5.0000', '85.0000')).toBe(false);
    });

    it('allows debt when balance goes negative', () => {
      const afterDebit = Decimal4Util.subtract('5.0000', '85.0000');
      expect(afterDebit).toBe('-80.0000');
    });

    it('checks credit limit correctly', () => {
      const balance = '5.0000';
      const price = '85.0000';
      const creditLimit = '100.0000';
      const afterDebit = Decimal4Util.subtract(balance, price);
      const floor = Decimal4Util.negate(creditLimit);
      // -80 > -100, so within limit
      expect(Decimal4Util.lessThan(afterDebit, floor)).toBe(false);
    });

    it('rejects when exceeding credit limit', () => {
      const balance = '5.0000';
      const price = '200.0000';
      const creditLimit = '100.0000';
      const afterDebit = Decimal4Util.subtract(balance, price);
      const floor = Decimal4Util.negate(creditLimit);
      // -195 < -100, exceeds limit
      expect(Decimal4Util.lessThan(afterDebit, floor)).toBe(true);
    });

    it('handles exact boundary (balance === price)', () => {
      expect(Decimal4Util.greaterThanOrEqual('85.0000', '85.0000')).toBe(true);
    });

    it('handles exact credit limit boundary', () => {
      const balance = '0.0000';
      const price = '100.0000';
      const creditLimit = '100.0000';
      const afterDebit = Decimal4Util.subtract(balance, price);
      const floor = Decimal4Util.negate(creditLimit);
      // -100 === -100, exactly at limit, should NOT reject
      expect(Decimal4Util.lessThan(afterDebit, floor)).toBe(false);
    });
  });

  describe('basic operations', () => {
    it('add', () => {
      expect(Decimal4Util.add('100.5000', '50.2500')).toBe('150.7500');
    });

    it('subtract', () => {
      expect(Decimal4Util.subtract('100.5000', '50.2500')).toBe('50.2500');
    });

    it('negate', () => {
      expect(Decimal4Util.negate('100.0000')).toBe('-100.0000');
      expect(Decimal4Util.negate('-50.0000')).toBe('50.0000');
    });

    it('toString handles various inputs', () => {
      expect(Decimal4Util.toString(10)).toBe('10.0000');
      expect(Decimal4Util.toString('10.5')).toBe('10.5000');
      expect(Decimal4Util.toString(null)).toBe('0.0000');
      expect(Decimal4Util.toString(undefined)).toBe('0.0000');
    });
  });
});
