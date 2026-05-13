export class DomainError extends Error {
    public readonly code: string;
    public readonly statusCode: number;

    constructor(code: string, message: string, statusCode = 400) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        this.name = 'DomainError';
    }
}

export class LoanNotFoundError extends DomainError {
    constructor(loanId: string) {
        super('LOAN_NOT_FOUND', `loan with id ${loanId} is not found`, 404);
    }
}

export class InvalidStateTransitionError extends DomainError {
    constructor(from: string, to: string) {
        super(
            'INVALID_STATE_TRANSITION',
            `loan cannot move from ${from} to ${to}`,
            409,
        );
    }
}

export class InvestmentExceedsPrincipalError extends DomainError {
    constructor(remaining: number) {
        super(
            'INVESTMENT_EXCEEDS_PRINCIPAL',
            `investment amount is too big, remaining capacity is ${remaining}`,
            409,
        );
    }
}

export class ValidationError extends DomainError {
    public readonly details: unknown;

    constructor(message: string, details?: unknown) {
        super('VALIDATION_ERROR', message, 400);
        this.details = details;
    }
}
