import type { Investment, Loan } from '../domain/loan';

export interface InvestorNotificationPayload {
    loanId: string;
    investorId: string;
    amount: number;
    agreementLetterUrl: string;
}

export interface NotificationService {
    notifyInvestorsLoanFunded(loan: Loan, investments: Investment[]): Promise<void>;
    drain(): InvestorNotificationPayload[];
}

// in real system we would push to a queue (bullmq, rabbitmq, kafka, etc) and a worker
// would send the email. for simplicity, we collect notifications in
// memory and log them. the drain method is useful for tests.
export class InMemoryNotificationService implements NotificationService {
    private sent: InvestorNotificationPayload[] = [];

    constructor(private readonly logger: { info: (obj: unknown, msg?: string) => void }) { }

    async notifyInvestorsLoanFunded(
        loan: Loan,
        investments: Investment[],
    ): Promise<void> {
        if (!loan.agreementLetterUrl) {
            throw new Error('agreement letter url is missing, cannot notify investors');
        }
        for (const investment of investments) {
            const payload: InvestorNotificationPayload = {
                loanId: loan.id,
                investorId: investment.investorId,
                amount: investment.amount,
                agreementLetterUrl: loan.agreementLetterUrl,
            };
            this.sent.push(payload);
            this.logger.info({ event: 'investor_notified', payload }, 'investor notified');
        }
    }

    drain(): InvestorNotificationPayload[] {
        const out = this.sent.slice();
        this.sent = [];
        return out;
    }
}
