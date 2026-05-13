import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openDatabase } from '../../src/db';
import type { Db } from '../../src/db';
import { LoanRepository } from '../../src/repositories/loan-repository';
import { InvestmentRepository } from '../../src/repositories/investment-repository';
import type { Loan } from '../../src/domain/loan';

describe('InvestmentRepository integration', () => {
    let db: Db;
    let loanRepo: LoanRepository;
    let investmentRepo: InvestmentRepository;

    beforeEach(() => {
        db = openDatabase(':memory:');
        loanRepo = new LoanRepository(db);
        investmentRepo = new InvestmentRepository(db);
        loanRepo.insert(makeLoan('loan-1'));
    });

    afterEach(() => {
        db.close();
    });

    const makeLoan = (id: string, principal = 1_000_000): Loan => ({
        id,
        borrowerId: 'b-1',
        principal,
        rate: 12,
        roi: 10,
        state: 'proposed',
        agreementLetterUrl: null,
        approval: null,
        disbursement: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    });

    it('tracks total investment per loan', () => {
        investmentRepo.insert({
            id: 'inv-1',
            loanId: 'loan-1',
            investorId: 'i-1',
            amount: 200_000,
            investedAt: new Date().toISOString(),
        });
        investmentRepo.insert({
            id: 'inv-2',
            loanId: 'loan-1',
            investorId: 'i-2',
            amount: 300_000,
            investedAt: new Date().toISOString(),
        });
        expect(investmentRepo.totalForLoan('loan-1')).toBe(500_000);
    });

    it('returns 0 total when there is no investment', () => {
        expect(investmentRepo.totalForLoan('loan-1')).toBe(0);
    });

    it('lists investments ordered by time', () => {
        investmentRepo.insert({
            id: 'inv-1',
            loanId: 'loan-1',
            investorId: 'i-1',
            amount: 100,
            investedAt: '2026-05-10T10:00:00Z',
        });
        investmentRepo.insert({
            id: 'inv-2',
            loanId: 'loan-1',
            investorId: 'i-2',
            amount: 200,
            investedAt: '2026-05-10T11:00:00Z',
        });
        const list = investmentRepo.listByLoan('loan-1');
        expect(list.map((i) => i.id)).toEqual(['inv-1', 'inv-2']);
    });

    it('cascade deletes investments when loan is removed', () => {
        investmentRepo.insert({
            id: 'inv-1',
            loanId: 'loan-1',
            investorId: 'i-1',
            amount: 100,
            investedAt: '2026-05-10T10:00:00Z',
        });
        db.prepare('DELETE FROM loans WHERE id = ?').run('loan-1');
        expect(investmentRepo.listByLoan('loan-1')).toHaveLength(0);
    });
});
