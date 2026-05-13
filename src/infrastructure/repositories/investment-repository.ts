import type { Db } from '../db';
import type { Investment } from '../domain/loan';

interface InvestmentRow {
    id: string;
    loan_id: string;
    investor_id: string;
    amount: number;
    invested_at: string;
}

function rowToInvestment(row: InvestmentRow): Investment {
    return {
        id: row.id,
        loanId: row.loan_id,
        investorId: row.investor_id,
        amount: row.amount,
        investedAt: row.invested_at,
    };
}

export class InvestmentRepository {
    constructor(private readonly db: Db) { }

    insert(investment: Investment): void {
        this.db
            .prepare(
                `INSERT INTO investments (id, loan_id, investor_id, amount, invested_at)
         VALUES (?, ?, ?, ?, ?)`,
            )
            .run(
                investment.id,
                investment.loanId,
                investment.investorId,
                investment.amount,
                investment.investedAt,
            );
    }

    listByLoan(loanId: string): Investment[] {
        const rows = this.db
            .prepare(
                'SELECT * FROM investments WHERE loan_id = ? ORDER BY invested_at ASC',
            )
            .all(loanId) as InvestmentRow[];
        return rows.map(rowToInvestment);
    }

    totalForLoan(loanId: string): number {
        const row = this.db
            .prepare('SELECT COALESCE(SUM(amount), 0) AS total FROM investments WHERE loan_id = ?')
            .get(loanId) as { total: number };
        return row.total;
    }
}
