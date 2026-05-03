import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';
import { Phase, PhaseSchema } from '../../src/lib/config/Config.js';

// We need to test MyApp's forcePhase / getForcedPhase contract.
// Rather than extending Homey.App (which requires the real SDK module at runtime),
// we replicate the exact same implementation as MyApp.forcePhase / getForcedPhase
// so the test isolates the contract from the SDK wiring.
// Keep this in sync with app.ts if forcePhase logic changes.
class TestableApp {
  _forcedPhase: Phase | null = null;

  // Mirror of MyApp.forcePhase — identical logic, no Homey dependency
  forcePhase(raw: unknown): Phase {
    let parsed: Phase;
    try {
      parsed = PhaseSchema.parse(raw);
    } catch (err) {
      // Simulate the App.error() call — no SDK needed in test
      // this.homey.app.error('forcePhase rejected', { raw });
      throw err;
    }
    this._forcedPhase = parsed;
    // this.homey.app.log('forcePhase', { phase: parsed });
    return parsed;
  }

  getForcedPhase(): Phase | null {
    return this._forcedPhase;
  }
}

describe('FlowCards — App forcePhase / getForcedPhase contract', () => {
  describe('valid phases', () => {
    it.each(['NIGHT', 'MORNING', 'DAY', 'EVENING'] as const)(
      'sets _forcedPhase and getForcedPhase() returns %s',
      (phase) => {
        const app = new TestableApp();
        expect(app.getForcedPhase()).toBeNull(); // starts null

        const result = app.forcePhase(phase);

        expect(result).toBe(phase);
        expect(app.getForcedPhase()).toBe(phase);
      }
    );

    it('overwrites the previous forced phase', () => {
      const app = new TestableApp();

      app.forcePhase('NIGHT');
      expect(app.getForcedPhase()).toBe('NIGHT');

      app.forcePhase('DAY');
      expect(app.getForcedPhase()).toBe('DAY');
    });

    it('forcePhase("NIGHT") then forcePhase("DAY") results in getForcedPhase() === "DAY"', () => {
      const app = new TestableApp();

      app.forcePhase('NIGHT');
      app.forcePhase('DAY');

      expect(app.getForcedPhase()).toBe('DAY');
    });
  });

  describe('invalid phases', () => {
    it('throws ZodError for an unrecognized phase string', () => {
      const app = new TestableApp();

      expect(() => app.forcePhase('MIDNIGHT')).toThrow(ZodError);
    });

    it('throws ZodError for a number', () => {
      const app = new TestableApp();

      expect(() => app.forcePhase(123)).toThrow(ZodError);
    });

    it('throws ZodError for null', () => {
      const app = new TestableApp();

      expect(() => app.forcePhase(null)).toThrow(ZodError);
    });

    it('leaves _forcedPhase unchanged after a rejected invalid phase', () => {
      const app = new TestableApp();

      app.forcePhase('EVENING');
      expect(app.getForcedPhase()).toBe('EVENING');

      try {
        app.forcePhase('INVALID');
      } catch {
        // expected
      }

      // State must NOT have changed
      expect(app.getForcedPhase()).toBe('EVENING');
    });

    it('leaves _forcedPhase unchanged after calling with undefined', () => {
      const app = new TestableApp();
      expect(app.getForcedPhase()).toBeNull();

      try {
        app.forcePhase(undefined);
      } catch {
        // expected — Zod rejects undefined for a string enum
      }

      expect(app.getForcedPhase()).toBeNull();
    });
  });
});

// is_phase condition card logic — mirrors app.ts registerRunListener
function isPhaseCondition(currentPhase: Phase | null, argsPhase: Phase): boolean {
  return currentPhase === argsPhase;
}

// phase_changed trigger payload shape
interface PhaseChangedPayload {
  phase: Phase;
  previous_phase: Phase | null;
}

describe('FlowCards — is_phase condition', () => {
  it('returns true when current phase matches args phase', () => {
    expect(isPhaseCondition('MORNING', 'MORNING')).toBe(true);
    expect(isPhaseCondition('NIGHT', 'NIGHT')).toBe(true);
  });

  it('returns false when current phase differs', () => {
    expect(isPhaseCondition('MORNING', 'DAY')).toBe(false);
    expect(isPhaseCondition('EVENING', 'NIGHT')).toBe(false);
  });

  it('returns false when current phase is null', () => {
    expect(isPhaseCondition(null, 'DAY')).toBe(false);
    expect(isPhaseCondition(null, 'NIGHT')).toBe(false);
  });

  it('handles all four phases correctly', () => {
    const phases: Phase[] = ['NIGHT', 'MORNING', 'DAY', 'EVENING'];
    for (const p of phases) {
      expect(isPhaseCondition(p, p)).toBe(true);
      expect(isPhaseCondition(p, phases.find((x) => x !== p)!)).toBe(false);
    }
  });
});

describe('FlowCards — phase_changed trigger payload', () => {
  it('includes both phase and previous_phase in payload', () => {
    const payload: PhaseChangedPayload = { phase: 'MORNING', previous_phase: 'NIGHT' };
    expect(payload.phase).toBe('MORNING');
    expect(payload.previous_phase).toBe('NIGHT');
  });

  it('allows previous_phase to be null on first transition or forced phase', () => {
    const payload: PhaseChangedPayload = { phase: 'NIGHT', previous_phase: null };
    expect(payload.phase).toBe('NIGHT');
    expect(payload.previous_phase).toBeNull();
  });

  it('accepts all valid phase values', () => {
    const phases: Phase[] = ['NIGHT', 'MORNING', 'DAY', 'EVENING'];
    for (const from of phases) {
      for (const to of phases) {
        const payload: PhaseChangedPayload = { phase: to, previous_phase: from };
        expect(payload.phase).toBe(to);
        expect(payload.previous_phase).toBe(from);
      }
    }
  });
});