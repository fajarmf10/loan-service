// we keep money as integer rupiah to avoid floating point issue
// rupiah is the smallest unit we care about, so no need to handle cents

export function toRupiah(value: number): number {
    if (!Number.isFinite(value)) {
        throw new Error('amount is not a finite number');
    }
    return Math.round(value);
}

export function isPositive(amount: number): boolean {
    return Number.isInteger(amount) && amount > 0;
}

export function sum(values: number[]): number {
    let total = 0;
    for (const v of values) {
        total += v;
    }
    return total;
}
