import { LoanState } from './loan';
import { InvalidStateTransitionError } from './error';

const ALLOWED_TRANSITIONS: Record<LoanState, LoanState | null> = {
    proposed: 'approved',
    approved: 'invested',
    invested: 'disbursed',
    disbursed: null,
};

export function nextState(current: LoanState): LoanState | null {
    return ALLOWED_TRANSITIONS[current];
}

export function canTransition(from: LoanState, to: LoanState): boolean {
    return ALLOWED_TRANSITIONS[from] === to;
}

export function assertTransition(from: LoanState, to: LoanState): void {
    if (!canTransition(from, to)) {
        throw new InvalidStateTransitionError(from, to);
    }
}
