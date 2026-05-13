import { LoanService } from '../../src/services/loan-service';
import { LoanRepository } from '../../src/repositories/loan-repository';
import { InvestmentRepository } from '../../src/repositories/investment-repository';
import type {
    AgreementLetterService,
} from '../../src/services/agreement-letter-service';
import {
    InMemoryNotificationService,
    type InvestorNotificationPayload,
} from '../../src/services/notification-service';
import type { Investment, Loan } from '../../src/domain/loan';

export interface UnitEnv {
    service: LoanService;
    loanRepo: FakeLoanRepository;
    investmentRepo: FakeInvestmentRepository;
    agreementCalls: Array<{ loanId: string; investmentCount: number }>;
    notification: InMemoryNotificationService;
    drainNotifications: () => InvestorNotificationPayload[];
}

class FakeLoanRepository {
    private map = new Map<string, Loan>();

    insert(loan: Loan): void {
        this.map.set(loan.id, { ...loan });
    }

    findById(id: string): Loan | null {
        const loan = this.map.get(id);
        return loan ? { ...loan } : null;
    }

    list(limit = 50, offset = 0): Loan[] {
        return Array.from(this.map.values())
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .slice(offset, offset + limit)
            .map((l) => ({ ...l }));
    }

    approve(
        id: string,
        pictureProofUrl: string,
        validatorEmployeeId: string,
        approvedAt: string,
        updatedAt: string,
    ): void {
        const loan = this.map.get(id);
        if (!loan || loan.state !== 'proposed') return;
        loan.state = 'approved';
        loan.approval = { pictureProofUrl, validatorEmployeeId, approvedAt };
        loan.updatedAt = updatedAt;
    }

    markInvested(id: string, agreementLetterUrl: string, updatedAt: string): void {
        const loan = this.map.get(id);
        if (!loan || loan.state !== 'approved') return;
        loan.state = 'invested';
        loan.agreementLetterUrl = agreementLetterUrl;
        loan.updatedAt = updatedAt;
    }

    disburse(
        id: string,
        signedAgreementUrl: string,
        fieldOfficerEmployeeId: string,
        disbursedAt: string,
        updatedAt: string,
    ): void {
        const loan = this.map.get(id);
        if (!loan || loan.state !== 'invested') return;
        loan.state = 'disbursed';
        loan.disbursement = {
            signedAgreementUrl,
            fieldOfficerEmployeeId,
            disbursedAt,
        };
        loan.updatedAt = updatedAt;
    }
}

class FakeInvestmentRepository {
    private list: Investment[] = [];

    insert(investment: Investment): void {
        this.list.push({ ...investment });
    }

    listByLoan(loanId: string): Investment[] {
        return this.list
            .filter((i) => i.loanId === loanId)
            .sort((a, b) => a.investedAt.localeCompare(b.investedAt))
            .map((i) => ({ ...i }));
    }

    totalForLoan(loanId: string): number {
        return this.list
            .filter((i) => i.loanId === loanId)
            .reduce((sum, i) => sum + i.amount, 0);
    }
}

export function buildUnitEnv(): UnitEnv {
    const loanRepo = new FakeLoanRepository();
    const investmentRepo = new FakeInvestmentRepository();

    const agreementCalls: Array<{ loanId: string; investmentCount: number }> = [];
    const agreementService: AgreementLetterService = {
        async generate(loan, investments) {
            agreementCalls.push({
                loanId: loan.id,
                investmentCount: investments.length,
            });
            return `http://unit/agreement-${loan.id}.txt`;
        },
    };

    const notification = new InMemoryNotificationService({ info: () => { } });

    const db = {
        transaction: (fn: () => void) => () => fn(),
    };

    let ids = 0;
    const service = new LoanService({
        db: db as never,
        loanRepository: loanRepo as unknown as LoanRepository,
        investmentRepository: investmentRepo as unknown as InvestmentRepository,
        agreementLetterService: agreementService,
        notificationService: notification,
        newId: () => {
            ids += 1;
            return `unit-id-${ids}`;
        },
        now: () => new Date('2026-05-13T00:00:00.000Z'),
    });

    return {
        service,
        loanRepo,
        investmentRepo,
        agreementCalls,
        notification,
        drainNotifications: () => notification.drain(),
    };
}

export type { FakeLoanRepository, FakeInvestmentRepository };
