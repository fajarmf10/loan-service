import { describe, it, expect, beforeEach } from 'vitest';
import { ValidationError, LoanNotFoundError, InvalidStateTransitionError, InvestmentExceedsPrincipalError } from '../../../src/domain/error';
import { UnitEnv, buildUnitEnv } from '../../helpers/build-unit-env';


describe('LoanService unit', () => {
    let env: UnitEnv;

    beforeEach(() => {
        env = buildUnitEnv();
    });

    describe('createLoan', () => {
        it('creates a loan in proposed state', async () => {
            const loan = await env.service.createLoan({
                borrowerId: 'b-1',
                principal: 1_000_000,
                rate: 12,
                roi: 10,
            });
            expect(loan.state).toBe('proposed');
            expect(loan.principal).toBe(1_000_000);
            expect(loan.agreementLetterUrl).toBeNull();
        });

        it('rejects non positive principal', async () => {
            await expect(
                env.service.createLoan({
                    borrowerId: 'b-1',
                    principal: 0,
                    rate: 1,
                    roi: 1,
                }),
            ).rejects.toBeInstanceOf(ValidationError);
        });

        it('rejects negative rate', async () => {
            await expect(
                env.service.createLoan({
                    borrowerId: 'b-1',
                    principal: 100,
                    rate: -1,
                    roi: 1,
                }),
            ).rejects.toBeInstanceOf(ValidationError);
        });
    });

    describe('getLoan', () => {
        it('throws LoanNotFoundError for unknown id', () => {
            expect(() => env.service.getLoan('nope')).toThrow(LoanNotFoundError);
        });
    });

    describe('approve', () => {
        it('moves loan from proposed to approved', async () => {
            const loan = await env.service.createLoan({
                borrowerId: 'b-1',
                principal: 1_000_000,
                rate: 12,
                roi: 10,
            });
            const updated = await env.service.approveLoan(loan.id, {
                pictureProofUrl: 'http://x/proof.jpg',
                validatorEmployeeId: 'emp-001',
                approvedAt: '2026-05-10T10:00:00.000Z',
            });
            expect(updated.state).toBe('approved');
            expect(updated.approval?.validatorEmployeeId).toBe('emp-001');
        });

        it('rejects approve twice', async () => {
            const loan = await env.service.createLoan({
                borrowerId: 'b-1',
                principal: 1_000_000,
                rate: 12,
                roi: 10,
            });
            await env.service.approveLoan(loan.id, {
                pictureProofUrl: 'http://x/proof.jpg',
                validatorEmployeeId: 'emp-001',
                approvedAt: '2026-05-10T10:00:00.000Z',
            });
            await expect(
                env.service.approveLoan(loan.id, {
                    pictureProofUrl: 'http://x/proof.jpg',
                    validatorEmployeeId: 'emp-001',
                    approvedAt: '2026-05-10T10:00:00.000Z',
                }),
            ).rejects.toBeInstanceOf(InvalidStateTransitionError);
        });

        it('rejects invalid approvedAt date', async () => {
            const loan = await env.service.createLoan({
                borrowerId: 'b-1',
                principal: 1_000_000,
                rate: 12,
                roi: 10,
            });
            await expect(
                env.service.approveLoan(loan.id, {
                    pictureProofUrl: 'http://x/proof.jpg',
                    validatorEmployeeId: 'emp-001',
                    approvedAt: 'not-a-date',
                }),
            ).rejects.toBeInstanceOf(ValidationError);
        });
    });

    describe('invest', () => {
        async function setupApprovedLoan(principal: number) {
            const loan = await env.service.createLoan({
                borrowerId: 'b-1',
                principal,
                rate: 12,
                roi: 10,
            });
            await env.service.approveLoan(loan.id, {
                pictureProofUrl: 'http://x/proof.jpg',
                validatorEmployeeId: 'emp-001',
                approvedAt: '2026-05-10T10:00:00.000Z',
            });
            return loan;
        }

        it('rejects investing on proposed loan', async () => {
            const loan = await env.service.createLoan({
                borrowerId: 'b-1',
                principal: 1_000_000,
                rate: 12,
                roi: 10,
            });
            await expect(
                env.service.invest(loan.id, { investorId: 'inv-1', amount: 1000 }),
            ).rejects.toBeInstanceOf(InvalidStateTransitionError);
        });

        it('rejects investment that exceeds principal', async () => {
            const loan = await setupApprovedLoan(1_000_000);
            await expect(
                env.service.invest(loan.id, { investorId: 'inv-1', amount: 1_000_001 }),
            ).rejects.toBeInstanceOf(InvestmentExceedsPrincipalError);
        });

        it('keeps loan in approved when partially funded', async () => {
            const loan = await setupApprovedLoan(1_000_000);
            const r = await env.service.invest(loan.id, {
                investorId: 'inv-1',
                amount: 400_000,
            });
            expect(r.fullyFunded).toBe(false);
            expect(r.loan.state).toBe('approved');
        });

        it('moves to invested when total reaches principal', async () => {
            const loan = await setupApprovedLoan(1_000_000);
            await env.service.invest(loan.id, { investorId: 'inv-1', amount: 600_000 });
            const r = await env.service.invest(loan.id, {
                investorId: 'inv-2',
                amount: 400_000,
            });
            expect(r.fullyFunded).toBe(true);
            expect(r.loan.state).toBe('invested');
            expect(r.loan.agreementLetterUrl).toMatch(/agreement-/);
            expect(env.agreementCalls).toHaveLength(1);
            expect(env.agreementCalls[0].investmentCount).toBe(2);
        });

        it('notifies all investors when fully funded', async () => {
            const loan = await setupApprovedLoan(500_000);
            await env.service.invest(loan.id, { investorId: 'inv-1', amount: 200_000 });
            await env.service.invest(loan.id, { investorId: 'inv-2', amount: 300_000 });
            const sent = env.drainNotifications();
            expect(sent).toHaveLength(2);
            expect(sent.map((s) => s.investorId).sort()).toEqual(['inv-1', 'inv-2']);
        });

        it('rejects further investment after invested state', async () => {
            const loan = await setupApprovedLoan(500_000);
            await env.service.invest(loan.id, { investorId: 'inv-1', amount: 500_000 });
            await expect(
                env.service.invest(loan.id, { investorId: 'inv-2', amount: 1 }),
            ).rejects.toBeInstanceOf(InvalidStateTransitionError);
        });
    });

    describe('disburse', () => {
        async function setupInvestedLoan() {
            const loan = await env.service.createLoan({
                borrowerId: 'b-1',
                principal: 500_000,
                rate: 12,
                roi: 10,
            });
            await env.service.approveLoan(loan.id, {
                pictureProofUrl: 'http://x/proof.jpg',
                validatorEmployeeId: 'emp-001',
                approvedAt: '2026-05-10T10:00:00.000Z',
            });
            await env.service.invest(loan.id, {
                investorId: 'inv-1',
                amount: 500_000,
            });
            return loan.id;
        }

        it('moves loan from invested to disbursed', async () => {
            const id = await setupInvestedLoan();
            const updated = await env.service.disburseLoan(id, {
                signedAgreementUrl: 'http://x/agreement.pdf',
                fieldOfficerEmployeeId: 'emp-fo-01',
                disbursedAt: '2026-05-12T08:00:00.000Z',
            });
            expect(updated.state).toBe('disbursed');
            expect(updated.disbursement?.fieldOfficerEmployeeId).toBe('emp-fo-01');
        });

        it('rejects disburse on approved loan', async () => {
            const loan = await env.service.createLoan({
                borrowerId: 'b-1',
                principal: 500_000,
                rate: 12,
                roi: 10,
            });
            await env.service.approveLoan(loan.id, {
                pictureProofUrl: 'http://x/proof.jpg',
                validatorEmployeeId: 'emp-001',
                approvedAt: '2026-05-10T10:00:00.000Z',
            });
            await expect(
                env.service.disburseLoan(loan.id, {
                    signedAgreementUrl: 'http://x/agreement.pdf',
                    fieldOfficerEmployeeId: 'emp-fo-01',
                    disbursedAt: '2026-05-12T08:00:00.000Z',
                }),
            ).rejects.toBeInstanceOf(InvalidStateTransitionError);
        });
    });
});
