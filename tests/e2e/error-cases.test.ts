import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildTestApp, TestApp } from '../helpers/build-app';

describe('loan api error cases', () => {
    let env: TestApp;

    beforeEach(async () => {
        env = await buildTestApp();
    });

    afterEach(async () => {
        await env.close();
    });

    async function createLoan(principal = 1_000_000) {
        const res = await env.app.inject({
            method: 'POST',
            url: '/loans',
            payload: { borrowerId: 'b-1', principal, rate: 10, roi: 8 },
        });
        return res.json();
    }

    async function approve(loanId: string) {
        return env.app.inject({
            method: 'POST',
            url: `/loans/${loanId}/approve`,
            payload: {
                pictureProofUrl: 'http://test/p.jpg',
                validatorEmployeeId: 'emp-1',
                approvedAt: '2026-05-10T10:00:00.000Z',
            },
        });
    }

    it('returns 404 when loan id is unknown', async () => {
        const res = await env.app.inject({
            method: 'GET',
            url: '/loans/unknown-id',
        });
        expect(res.statusCode).toBe(404);
        expect(res.json().error.code).toBe('LOAN_NOT_FOUND');
    });

    it('returns 400 when create payload is invalid', async () => {
        const res = await env.app.inject({
            method: 'POST',
            url: '/loans',
            payload: {
                borrowerId: '',
                principal: -1,
                rate: -1,
                roi: 'not-a-number',
            },
        });
        expect(res.statusCode).toBe(400);
        expect(res.json().error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 409 when approving twice', async () => {
        const loan = await createLoan();
        const first = await approve(loan.id);
        expect(first.statusCode).toBe(200);

        const second = await approve(loan.id);
        expect(second.statusCode).toBe(409);
        expect(second.json().error.code).toBe('INVALID_STATE_TRANSITION');
    });

    it('returns 409 when investing on proposed loan', async () => {
        const loan = await createLoan();
        const res = await env.app.inject({
            method: 'POST',
            url: `/loans/${loan.id}/investments`,
            payload: { investorId: 'inv-1', amount: 100 },
        });
        expect(res.statusCode).toBe(409);
        expect(res.json().error.code).toBe('INVALID_STATE_TRANSITION');
    });

    it('returns 409 when investment exceeds principal', async () => {
        const loan = await createLoan(500_000);
        await approve(loan.id);
        await env.app.inject({
            method: 'POST',
            url: `/loans/${loan.id}/investments`,
            payload: { investorId: 'inv-1', amount: 400_000 },
        });
        const res = await env.app.inject({
            method: 'POST',
            url: `/loans/${loan.id}/investments`,
            payload: { investorId: 'inv-2', amount: 200_000 },
        });
        expect(res.statusCode).toBe(409);
        expect(res.json().error.code).toBe('INVESTMENT_EXCEEDS_PRINCIPAL');
    });

    it('returns 409 when disbursing before invested', async () => {
        const loan = await createLoan();
        await approve(loan.id);
        const res = await env.app.inject({
            method: 'POST',
            url: `/loans/${loan.id}/disburse`,
            payload: {
                signedAgreementUrl: 'http://test/a.pdf',
                fieldOfficerEmployeeId: 'fo-1',
                disbursedAt: '2026-05-15T10:00:00.000Z',
            },
        });
        expect(res.statusCode).toBe(409);
        expect(res.json().error.code).toBe('INVALID_STATE_TRANSITION');
    });

    it('returns 400 when disburse payload misses fields', async () => {
        const loan = await createLoan(500_000);
        await approve(loan.id);
        await env.app.inject({
            method: 'POST',
            url: `/loans/${loan.id}/investments`,
            payload: { investorId: 'inv-1', amount: 500_000 },
        });
        const res = await env.app.inject({
            method: 'POST',
            url: `/loans/${loan.id}/disburse`,
            payload: { signedAgreementUrl: 'http://test/a.pdf' },
        });
        expect(res.statusCode).toBe(400);
        expect(res.json().error.code).toBe('VALIDATION_ERROR');
    });
});
