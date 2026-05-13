import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openDatabase } from '../../src/db';
import type { Db } from '../../src/db';
import { LoanRepository } from '../../src/repositories/loan-repository';
import type { Loan } from '../../src/domain/loan';

describe('LoanRepository integration', () => {
    let db: Db;
    let loanRepo: LoanRepository;

    beforeEach(() => {
        db = openDatabase(':memory:');
        loanRepo = new LoanRepository(db);
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

    it('inserts and reads a loan', () => {
        loanRepo.insert(makeLoan('loan-1'));
        const found = loanRepo.findById('loan-1');
        expect(found?.id).toBe('loan-1');
        expect(found?.state).toBe('proposed');
    });

    it('returns null when loan is missing', () => {
        expect(loanRepo.findById('nope')).toBeNull();
    });

    it('updates to approved only when state is proposed', () => {
        loanRepo.insert(makeLoan('loan-1'));
        loanRepo.approve('loan-1', 'http://x/p.jpg', 'emp-1', '2026-05-10T10:00:00Z', '2026-05-10T10:00:00Z');
        const first = loanRepo.findById('loan-1');
        expect(first?.state).toBe('approved');

        // second call should not flip state since it is no longer proposed
        loanRepo.approve('loan-1', 'http://x/p2.jpg', 'emp-2', '2026-05-11T10:00:00Z', '2026-05-11T10:00:00Z');
        const second = loanRepo.findById('loan-1');
        expect(second?.state).toBe('approved');
        expect(second?.approval?.validatorEmployeeId).toBe('emp-1');
    });
});
