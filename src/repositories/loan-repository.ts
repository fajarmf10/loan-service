import type { Db } from '../db';
import type { Loan, LoanState, Approval, Disbursement } from '../domain/loan';

interface LoanRow {
    id: string;
    borrower_id: string;
    principal: number;
    rate: number;
    roi: number;
    state: LoanState;
    agreement_letter_url: string | null;
    picture_proof_url: string | null;
    validator_employee_id: string | null;
    approved_at: string | null;
    signed_agreement_url: string | null;
    field_officer_employee_id: string | null;
    disbursed_at: string | null;
    created_at: string;
    updated_at: string;
}

function rowToLoan(row: LoanRow): Loan {
    const approval: Approval | null =
        row.picture_proof_url && row.validator_employee_id && row.approved_at
            ? {
                pictureProofUrl: row.picture_proof_url,
                validatorEmployeeId: row.validator_employee_id,
                approvedAt: row.approved_at,
            }
            : null;

    const disbursement: Disbursement | null =
        row.signed_agreement_url && row.field_officer_employee_id && row.disbursed_at
            ? {
                signedAgreementUrl: row.signed_agreement_url,
                fieldOfficerEmployeeId: row.field_officer_employee_id,
                disbursedAt: row.disbursed_at,
            }
            : null;

    return {
        id: row.id,
        borrowerId: row.borrower_id,
        principal: row.principal,
        rate: row.rate,
        roi: row.roi,
        state: row.state,
        agreementLetterUrl: row.agreement_letter_url,
        approval,
        disbursement,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

export class LoanRepository {
    constructor(private readonly db: Db) { }

    insert(loan: Loan): void {
        const stmt = this.db.prepare(`
      INSERT INTO loans (id, borrower_id, principal, rate, roi, state, created_at, updated_at)
      VALUES (@id, @borrowerId, @principal, @rate, @roi, @state, @createdAt, @updatedAt)
    `);
        stmt.run({
            id: loan.id,
            borrowerId: loan.borrowerId,
            principal: loan.principal,
            rate: loan.rate,
            roi: loan.roi,
            state: loan.state,
            createdAt: loan.createdAt,
            updatedAt: loan.updatedAt,
        });
    }

    findById(id: string): Loan | null {
        const row = this.db
            .prepare('SELECT * FROM loans WHERE id = ?')
            .get(id) as LoanRow | undefined;
        return row ? rowToLoan(row) : null;
    }

    list(limit = 50, offset = 0): Loan[] {
        const rows = this.db
            .prepare('SELECT * FROM loans ORDER BY created_at DESC LIMIT ? OFFSET ?')
            .all(limit, offset) as LoanRow[];
        return rows.map(rowToLoan);
    }

    approve(
        id: string,
        pictureProofUrl: string,
        validatorEmployeeId: string,
        approvedAt: string,
        updatedAt: string,
    ): void {
        this.db
            .prepare(
                `UPDATE loans
         SET state = 'approved',
             picture_proof_url = ?,
             validator_employee_id = ?,
             approved_at = ?,
             updated_at = ?
         WHERE id = ? AND state = 'proposed'`,
            )
            .run(pictureProofUrl, validatorEmployeeId, approvedAt, updatedAt, id);
    }

    markInvested(id: string, agreementLetterUrl: string, updatedAt: string): void {
        this.db
            .prepare(
                `UPDATE loans
         SET state = 'invested',
             agreement_letter_url = ?,
             updated_at = ?
         WHERE id = ? AND state = 'approved'`,
            )
            .run(agreementLetterUrl, updatedAt, id);
    }

    disburse(
        id: string,
        signedAgreementUrl: string,
        fieldOfficerEmployeeId: string,
        disbursedAt: string,
        updatedAt: string,
    ): void {
        this.db
            .prepare(
                `UPDATE loans
         SET state = 'disbursed',
             signed_agreement_url = ?,
             field_officer_employee_id = ?,
             disbursed_at = ?,
             updated_at = ?
         WHERE id = ? AND state = 'invested'`,
            )
            .run(
                signedAgreementUrl,
                fieldOfficerEmployeeId,
                disbursedAt,
                updatedAt,
                id,
            );
    }
}
