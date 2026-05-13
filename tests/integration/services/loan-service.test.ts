import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestEnv, buildTestEnv } from '../../helpers/build-service';

describe('LoanService integration', () => {
    let env: TestEnv;

    beforeEach(() => {
        env = buildTestEnv();
    });

    afterEach(() => {
        env.cleanup();
    });

    it('serialises concurrent invests so total never exceeds principal', async () => {
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

        const results = await Promise.allSettled(
            Array.from({ length: 12 }).map((_, i) =>
                env.service.invest(loan.id, {
                    investorId: `i-${i}`,
                    amount: 100_000,
                }),
            ),
        );

        const successCount = results.filter((r) => r.status === 'fulfilled').length;
        const failureCount = results.filter((r) => r.status === 'rejected').length;

        expect(successCount).toBe(10);
        expect(failureCount).toBe(2);
        expect(env.investmentRepo.totalForLoan(loan.id)).toBe(1_000_000);
        expect(env.service.getLoan(loan.id).state).toBe('invested');
    });
});
