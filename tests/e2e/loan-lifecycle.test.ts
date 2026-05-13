import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestApp, buildTestApp } from '../helpers/build-app';


describe('loan lifecycle e2e', () => {
    let env: TestApp;

    beforeEach(async () => {
        env = await buildTestApp();
    });

    afterEach(async () => {
        await env.close();
    });

    it('walks loan through proposed approved invested disbursed', async () => {
        // 1. create a loan
        const createRes = await env.app.inject({
            method: 'POST',
            url: '/loans',
            payload: {
                borrowerId: 'borrower-123',
                principal: 1_000_000,
                rate: 12.5,
                roi: 10,
            },
        });
        expect(createRes.statusCode).toBe(201);
        const created = createRes.json();
        expect(created.state).toBe('proposed');
        const loanId = created.id;

        // 2. approve the loan
        const approveRes = await env.app.inject({
            method: 'POST',
            url: `/loans/${loanId}/approve`,
            payload: {
                pictureProofUrl: 'http://test/files/proof.jpg',
                validatorEmployeeId: 'emp-001',
                approvedAt: '2026-05-13T10:00:00.000Z',
            },
        });
        expect(approveRes.statusCode).toBe(200);
        expect(approveRes.json().state).toBe('approved');
        expect(approveRes.json().approval.validatorEmployeeId).toBe('emp-001');

        // 3. two investors fund the loan
        const invest1 = await env.app.inject({
            method: 'POST',
            url: `/loans/${loanId}/investments`,
            payload: { investorId: 'inv-1', amount: 400_000 },
        });
        expect(invest1.statusCode).toBe(201);
        expect(invest1.json().fullyFunded).toBe(false);
        expect(invest1.json().loan.state).toBe('approved');

        const invest2 = await env.app.inject({
            method: 'POST',
            url: `/loans/${loanId}/investments`,
            payload: { investorId: 'inv-2', amount: 600_000 },
        });
        expect(invest2.statusCode).toBe(201);
        expect(invest2.json().fullyFunded).toBe(true);
        expect(invest2.json().loan.state).toBe('invested');
        expect(invest2.json().loan.agreementLetterUrl).toMatch(/agreement-/);

        // investors got notified
        const sent = env.notificationService.drain();
        expect(sent).toHaveLength(2);

        // 4. disburse
        const disburseRes = await env.app.inject({
            method: 'POST',
            url: `/loans/${loanId}/disburse`,
            payload: {
                signedAgreementUrl: 'http://test/files/signed.pdf',
                fieldOfficerEmployeeId: 'fo-001',
                disbursedAt: '2026-05-14T08:00:00.000Z',
            },
        });
        expect(disburseRes.statusCode).toBe(200);
        expect(disburseRes.json().state).toBe('disbursed');
        expect(disburseRes.json().disbursement.fieldOfficerEmployeeId).toBe('fo-001');

        // 5. final read shows full loan state
        const getRes = await env.app.inject({
            method: 'GET',
            url: `/loans/${loanId}`,
        });
        expect(getRes.statusCode).toBe(200);
        const loan = getRes.json();
        expect(loan.state).toBe('disbursed');
        expect(loan.approval).not.toBeNull();
        expect(loan.disbursement).not.toBeNull();
        expect(loan.agreementLetterUrl).not.toBeNull();

        // 6. list investments shows both
        const invList = await env.app.inject({
            method: 'GET',
            url: `/loans/${loanId}/investments`,
        });
        expect(invList.statusCode).toBe(200);
        expect(invList.json()).toHaveLength(2);
    });

    it('lists all loans ordered by creation', async () => {
        for (let i = 0; i < 3; i += 1) {
            await env.app.inject({
                method: 'POST',
                url: '/loans',
                payload: {
                    borrowerId: `b-${i}`,
                    principal: 100_000,
                    rate: 10,
                    roi: 8,
                },
            });
        }
        const res = await env.app.inject({ method: 'GET', url: '/loans' });
        expect(res.statusCode).toBe(200);
        expect(res.json()).toHaveLength(3);
    });
});
