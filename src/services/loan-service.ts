import { randomUUID } from 'node:crypto';
import type { Db } from '../db';
import type {
    AddInvestmentInput,
    ApproveLoanInput,
    CreateLoanInput,
    DisburseLoanInput,
    Investment,
    Loan,
} from '../domain/loan';

import { isPositive } from '../domain/money';
import { LoanRepository } from '../infrastructure/repositories/loan-repository';
import { InvestmentRepository } from '../infrastructure/repositories/investment-repository';
import type { AgreementLetterService } from './agreement-letter-service';
import type { NotificationService } from './notification-service';
import { LoanNotFoundError, InvalidStateTransitionError, InvestmentExceedsPrincipalError, ValidationError } from '../domain/error';

export interface LoanServiceDeps {
    db: Db;
    loanRepository: LoanRepository;
    investmentRepository: InvestmentRepository;
    agreementLetterService: AgreementLetterService;
    notificationService: NotificationService;
    now?: () => Date;
    newId?: () => string;
}

export interface InvestResult {
    loan: Loan;
    investment: Investment;
    fullyFunded: boolean;
}

export class LoanService {
    private readonly now: () => Date;
    private readonly newId: () => string;

    constructor(private readonly deps: LoanServiceDeps) {
        this.now = deps.now ?? (() => new Date());
        this.newId = deps.newId ?? (() => randomUUID());
    }

    async createLoan(input: CreateLoanInput): Promise<Loan> {
        validateCreateLoanInput(input);
        const ts = this.now().toISOString();
        const loan: Loan = {
            id: this.newId(),
            borrowerId: input.borrowerId,
            principal: input.principal,
            rate: input.rate,
            roi: input.roi,
            state: 'proposed',
            agreementLetterUrl: null,
            approval: null,
            disbursement: null,
            createdAt: ts,
            updatedAt: ts,
        };
        this.deps.loanRepository.insert(loan);
        return loan;
    }

    getLoan(id: string): Loan {
        const loan = this.deps.loanRepository.findById(id);
        if (!loan) throw new LoanNotFoundError(id);
        return loan;
    }

    listLoans(limit = 50, offset = 0): Loan[] {
        return this.deps.loanRepository.list(limit, offset);
    }

    listInvestments(loanId: string): Investment[] {
        const loan = this.deps.loanRepository.findById(loanId);
        if (!loan) throw new LoanNotFoundError(loanId);
        return this.deps.investmentRepository.listByLoan(loanId);
    }

    async approveLoan(loanId: string, input: ApproveLoanInput): Promise<Loan> {
        validateApproveInput(input);
        const loan = this.deps.loanRepository.findById(loanId);
        if (!loan) throw new LoanNotFoundError(loanId);
        if (loan.state !== 'proposed') {
            throw new InvalidStateTransitionError(loan.state, 'approved');
        }
        const ts = this.now().toISOString();
        this.deps.loanRepository.approve(
            loanId,
            input.pictureProofUrl,
            input.validatorEmployeeId,
            input.approvedAt,
            ts,
        );
        return this.getLoan(loanId);
    }

    async invest(loanId: string, input: AddInvestmentInput): Promise<InvestResult> {
        validateInvestInput(input);

        // one txn for insert + state change so the row rolls back if the cap is
        // exceeded. better-sqlite3 already serialises writes so this is not about
        // concurrency, only atomicity
        let didFund = false;
        let createdInvestment: Investment | null = null;

        const txn = this.deps.db.transaction(() => {
            const loan = this.deps.loanRepository.findById(loanId);
            if (!loan) throw new LoanNotFoundError(loanId);
            if (loan.state !== 'approved') {
                throw new InvalidStateTransitionError(loan.state, 'invested');
            }

            const currentTotal = this.deps.investmentRepository.totalForLoan(loanId);
            const remaining = loan.principal - currentTotal;
            if (input.amount > remaining) {
                throw new InvestmentExceedsPrincipalError(remaining);
            }

            const investment: Investment = {
                id: this.newId(),
                loanId,
                investorId: input.investorId,
                amount: input.amount,
                investedAt: this.now().toISOString(),
            };
            this.deps.investmentRepository.insert(investment);
            createdInvestment = investment;

            const newTotal = currentTotal + input.amount;
            if (newTotal === loan.principal) {
                didFund = true;
            }
        });

        txn();

        // run notification outside the txn so a slow webhook does not hold the
        // sqlite write lock. if it throws the investment is already saved and
        // the notification is lost. proper fix is an outbox table
        if (didFund) {
            await this.handleFullyFunded(loanId);
        }

        const loan = this.getLoan(loanId);
        if (!createdInvestment) {
            throw new Error('investment was not created, this should not happen');
        }
        return { loan, investment: createdInvestment, fullyFunded: didFund };
    }

    async disburseLoan(loanId: string, input: DisburseLoanInput): Promise<Loan> {
        validateDisburseInput(input);
        const loan = this.deps.loanRepository.findById(loanId);
        if (!loan) throw new LoanNotFoundError(loanId);
        if (loan.state !== 'invested') {
            throw new InvalidStateTransitionError(loan.state, 'disbursed');
        }
        const ts = this.now().toISOString();
        this.deps.loanRepository.disburse(
            loanId,
            input.signedAgreementUrl,
            input.fieldOfficerEmployeeId,
            input.disbursedAt,
            ts,
        );
        return this.getLoan(loanId);
    }

    private async handleFullyFunded(loanId: string): Promise<void> {
        const loan = this.getLoan(loanId);
        const investments = this.deps.investmentRepository.listByLoan(loanId);

        const url = await this.deps.agreementLetterService.generate(loan, investments);
        const ts = this.now().toISOString();
        this.deps.loanRepository.markInvested(loanId, url, ts);

        const updated = this.getLoan(loanId);
        await this.deps.notificationService.notifyInvestorsLoanFunded(updated, investments);
    }
}

function validateCreateLoanInput(input: CreateLoanInput): void {
    if (!input.borrowerId || typeof input.borrowerId !== 'string') {
        throw new ValidationError('borrowerId is required');
    }
    if (!isPositive(input.principal)) {
        throw new ValidationError('principal must be a positive integer');
    }
    if (typeof input.rate !== 'number' || input.rate < 0) {
        throw new ValidationError('rate must be a non negative number');
    }
    if (typeof input.roi !== 'number' || input.roi < 0) {
        throw new ValidationError('roi must be a non negative number');
    }
}

function validateApproveInput(input: ApproveLoanInput): void {
    if (!input.pictureProofUrl) {
        throw new ValidationError('pictureProofUrl is required');
    }
    if (!input.validatorEmployeeId) {
        throw new ValidationError('validatorEmployeeId is required');
    }
    if (!input.approvedAt || Number.isNaN(Date.parse(input.approvedAt))) {
        throw new ValidationError('approvedAt must be a valid date');
    }
}

function validateInvestInput(input: AddInvestmentInput): void {
    if (!input.investorId) {
        throw new ValidationError('investorId is required');
    }
    if (!isPositive(input.amount)) {
        throw new ValidationError('amount must be a positive integer');
    }
}

function validateDisburseInput(input: DisburseLoanInput): void {
    if (!input.signedAgreementUrl) {
        throw new ValidationError('signedAgreementUrl is required');
    }
    if (!input.fieldOfficerEmployeeId) {
        throw new ValidationError('fieldOfficerEmployeeId is required');
    }
    if (!input.disbursedAt || Number.isNaN(Date.parse(input.disbursedAt))) {
        throw new ValidationError('disbursedAt must be a valid date');
    }
}
