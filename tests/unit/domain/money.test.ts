import { describe, it, expect } from 'vitest';
import { toRupiah, isPositive, sum } from '../../../src/domain/money';

describe('money helpers', () => {
    it('rounds to integer rupiah', () => {
        expect(toRupiah(100.4)).toBe(100);
        expect(toRupiah(100.5)).toBe(101);
        expect(toRupiah(-1.6)).toBe(-2);
    });

    it('throws on non finite value', () => {
        expect(() => toRupiah(Number.NaN)).toThrow();
        expect(() => toRupiah(Number.POSITIVE_INFINITY)).toThrow();
    });

    it('isPositive only accepts positive integer', () => {
        expect(isPositive(1)).toBe(true);
        expect(isPositive(1000000)).toBe(true);
        expect(isPositive(0)).toBe(false);
        expect(isPositive(-1)).toBe(false);
        expect(isPositive(1.5)).toBe(false);
    });

    it('sum returns total', () => {
        expect(sum([])).toBe(0);
        expect(sum([1])).toBe(1);
        expect(sum([10, 20, 30])).toBe(60);
    });
});
