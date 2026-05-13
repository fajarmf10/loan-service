import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildTestApp, TestApp } from '../helpers/build-app';

describe('invest concurrency over http', () => {
    let env: TestApp;

    beforeEach(async () => {
        env = await buildTestApp();
    });

    afterEach(async () => {
        await env.close();
    });

    it('never lets parallel invests exceed principal', async () => {
        // setup an approved loan with 500_000 principal
        const create = await env.app.inject({
            method: 'POST',
            url: '/loans',
            payload: { borrowerId: 'b-1', principal: 500_000, rate: 10, roi: 8 },
        });
        const { id } = create.json();
        await env.app.inject({
            method: 'POST',
            url: `/loans/${id}/approve`,
            payload: {
                pictureProofUrl: 'http://t/p.jpg',
                validatorEmployeeId: 'emp-1',
                approvedAt: '2026-05-10T10:00:00.000Z',
            },
        });

        // fire 8 parallel invests of 100_000 each, only 5 should succeed
        const requests = Array.from({ length: 8 }).map((_, i) =>
            env.app.inject({
                method: 'POST',
                url: `/loans/${id}/investments`,
                payload: { investorId: `inv-${i}`, amount: 100_000 },
            }),
        );
        const responses = await Promise.all(requests);

        const success = responses.filter((r) => r.statusCode === 201);
        const failure = responses.filter((r) => r.statusCode === 409);

        expect(success).toHaveLength(5);
        expect(failure).toHaveLength(3);
        for (const f of failure) {
            expect(f.json().error.code).toBe('INVESTMENT_EXCEEDS_PRINCIPAL');
        }

        // final state should be invested at exactly principal
        const final = await env.app.inject({
            method: 'GET',
            url: `/loans/${id}`,
        });
        expect(final.json().state).toBe('invested');
    });
});
