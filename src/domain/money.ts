// we keep money as integer rupiah to avoid floating point issue
// rupiah is the smallest unit we care about, so no need to handle cents

import { ValidationError } from './error';

export type Money = number & { readonly __brand: 'Money' };

export function toRupiah(value: number): Money {
    if (!Number.isFinite(value)) {
        throw new Error('amount is not a finite number');
    }
    return Math.round(value) as Money;
}

export function isPositive(amount: number): boolean {
    return Number.isInteger(amount) && amount > 0;
}

export function assertMoney(amount: unknown, field: string): Money {
    if (typeof amount !== 'number' || !Number.isFinite(amount)) {
        throw new ValidationError(`${field} must be a finite number`);
    }
    if (!Number.isInteger(amount)) {
        throw new ValidationError(`${field} must be an integer rupiah amount`);
    }
    if (amount <= 0) {
        throw new ValidationError(`${field} must be a positive integer rupiah amount`);
    }
    if (amount > Number.MAX_SAFE_INTEGER) {
        throw new ValidationError(`${field} exceeds the safe integer range`);
    }
    return amount as Money;
}

export function sum(values: number[]): number {
    let total = 0;
    for (const v of values) {
        total += v;
    }
    return total;
}
