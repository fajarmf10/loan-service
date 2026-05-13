import { describe, it, expect } from 'vitest';
import { InvalidStateTransitionError } from '../../../src/domain/error';
import { nextState, canTransition, assertTransition } from '../../../src/domain/state-machine';

describe('state machine', () => {
    it('returns the next state for each forward step', () => {
        expect(nextState('proposed')).toBe('approved');
        expect(nextState('approved')).toBe('invested');
        expect(nextState('invested')).toBe('disbursed');
        expect(nextState('disbursed')).toBeNull();
    });

    it('only allows the next forward transition', () => {
        expect(canTransition('proposed', 'approved')).toBe(true);
        expect(canTransition('approved', 'invested')).toBe(true);
        expect(canTransition('invested', 'disbursed')).toBe(true);
    });

    it('rejects skipping a state', () => {
        expect(canTransition('proposed', 'invested')).toBe(false);
        expect(canTransition('proposed', 'disbursed')).toBe(false);
        expect(canTransition('approved', 'disbursed')).toBe(false);
    });

    it('rejects going backward', () => {
        expect(canTransition('approved', 'proposed')).toBe(false);
        expect(canTransition('invested', 'approved')).toBe(false);
        expect(canTransition('disbursed', 'invested')).toBe(false);
    });

    it('rejects same state self loop', () => {
        expect(canTransition('proposed', 'proposed')).toBe(false);
        expect(canTransition('approved', 'approved')).toBe(false);
    });

    it('throws InvalidStateTransitionError when assertion fails', () => {
        expect(() => assertTransition('proposed', 'invested')).toThrow(
            InvalidStateTransitionError,
        );
    });

    it('does not throw on valid transition', () => {
        expect(() => assertTransition('approved', 'invested')).not.toThrow();
    });
});
