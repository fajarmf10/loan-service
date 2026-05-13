export type LoanState = 'proposed' | 'approved' | 'invested' | 'disbursed';

export const LOAN_STATES: LoanState[] = ['proposed', 'approved', 'invested', 'disbursed'];

export interface Loan {
    id: string;
    borrowerId: string;
    principal: number;
    rate: number;
    roi: number;
    state: LoanState;
    agreementLetterUrl: string | null;
    approval: Approval | null;
    disbursement: Disbursement | null;
    createdAt: string;
    updatedAt: string;
}

export interface Approval {
    pictureProofUrl: string;
    validatorEmployeeId: string;
    approvedAt: string;
}

export interface Disbursement {
    signedAgreementUrl: string;
    fieldOfficerEmployeeId: string;
    disbursedAt: string;
}

export interface Investment {
    id: string;
    loanId: string;
    investorId: string;
    amount: number;
    investedAt: string;
}

export interface CreateLoanInput {
    borrowerId: string;
    principal: number;
    rate: number;
    roi: number;
}

export interface ApproveLoanInput {
    pictureProofUrl: string;
    validatorEmployeeId: string;
    approvedAt: string;
}

export interface DisburseLoanInput {
    signedAgreementUrl: string;
    fieldOfficerEmployeeId: string;
    disbursedAt: string;
}

export interface AddInvestmentInput {
    investorId: string;
    amount: number;
}
