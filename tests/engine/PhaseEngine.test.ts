import { describe, it, expect } from 'vitest';
import { evaluatePhase, PHASE_ORDER, type TransitionRecord, type EngineResult } from '../../src/lib/engine/PhaseEngine.js';
import type { AppConfig, Phase } from '../../src/lib/config/Config.js';
import type { EvaluationContext } from '../../src/lib/engine/EvaluationContext.js';

// Helper to create a context with specific date
function makeCtx(overrides: Partial<EvaluationContext> = {}): EvaluationContext {
  return {
    now: new Date('2026-01-15T12:00:00Z'), // Thursday
    lux: null,
    latitude: 52.37, // Amsterdam
    longitude: 4.90,
    countryCode: '',
    ...overrides
  };
}

// Helper to create a basic config
function makeConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    version: '1.0.0',
    roles: [{ id: 'living', name: 'Living Room' }],
    phases: {
      NIGHT: {
        weekday: { conditions: [{ type: 'time', at: '00:00' }] },
        weekend: { conditions: [{ type: 'time', at: '00:00' }] },
        states: { living: { onoff: false } }
      },
      MORNING: {
        weekday: { conditions: [{ type: 'time', at: '07:00' }] },
        weekend: { conditions: [{ type: 'time', at: '08:00' }] },
        states: { living: { onoff: true, dim: 0.5 } }
      },
      DAY: {
        weekday: { conditions: [{ type: 'time', at: '12:00' }] },
        weekend: { conditions: [{ type: 'time', at: '12:00' }] },
        states: { living: { onoff: false } }
      },
      EVENING: {
        weekday: { conditions: [{ type: 'time', at: '20:00' }] },
        weekend: { conditions: [{ type: 'time', at: '20:00' }] },
        states: { living: { onoff: true, dim: 0.8 } }
      }
    },
    ...overrides
  } as AppConfig;
}

describe('PhaseEngine', () => {
  describe('standard progression', () => {
    it('transitions from NIGHT to MORNING when time passes 07:00 on weekday', () => {
      const config = makeConfig();
      const lastEvalTime = new Date('2026-01-15T06:59:00Z'); // Just before 07:00
      const now = new Date('2026-01-15T07:01:00Z'); // Just after 07:00
      const ctx = makeCtx({ now });

      const result = evaluatePhase('NIGHT', lastEvalTime, config, ctx);

      expect(result.phase).toBe('MORNING');
      expect(result.transitions).toHaveLength(1);
      expect(result.transitions[0]).toMatchObject({
        from: 'NIGHT',
        to: 'MORNING',
        reason: 'time'
      });
      expect(result.transitions[0].eventTime).toEqual(new Date('2026-01-15T07:00:00Z'));
    });

    it('transitions from MORNING to DAY when time passes 12:00', () => {
      const config = makeConfig();
      const lastEvalTime = new Date('2026-01-15T11:59:00Z');
      const now = new Date('2026-01-15T12:01:00Z');
      const ctx = makeCtx({ now });

      const result = evaluatePhase('MORNING', lastEvalTime, config, ctx);

      expect(result.phase).toBe('DAY');
      expect(result.transitions).toHaveLength(1);
      expect(result.transitions[0]).toMatchObject({
        from: 'MORNING',
        to: 'DAY',
        reason: 'time'
      });
    });
  });

  describe('no-trigger no-op', () => {
    it('stays in NIGHT when no transition time has passed', () => {
      const config = makeConfig();
      const lastEvalTime = new Date('2026-01-15T02:00:00Z');
      const now = new Date('2026-01-15T03:00:00Z'); // Still before 07:00
      const ctx = makeCtx({ now });

      const result = evaluatePhase('NIGHT', lastEvalTime, config, ctx);

      expect(result.phase).toBe('NIGHT');
      expect(result.transitions).toHaveLength(0);
      expect(result.cappedAt).toBeUndefined();
    });

    it('stays in DAY during midday', () => {
      const config = makeConfig();
      const lastEvalTime = new Date('2026-01-15T13:00:00Z');
      const now = new Date('2026-01-15T14:00:00Z'); // Between 12:00 and 20:00
      const ctx = makeCtx({ now });

      const result = evaluatePhase('DAY', lastEvalTime, config, ctx);

      expect(result.phase).toBe('DAY');
      expect(result.transitions).toHaveLength(0);
    });
  });

  describe('day-crossing time condition', () => {
    it('handles EVENING at 23:00 crossing to next day NIGHT', () => {
      const ctx = makeCtx();
      const config: AppConfig = {
        ...makeConfig(),
        phases: {
          ...makeConfig().phases,
          EVENING: {
            weekday: { conditions: [{ type: 'time', at: '23:00' }] },
            weekend: { conditions: [{ type: 'time', at: '23:00' }] },
            states: { living: { onoff: true, dim: 0.8 } }
          },
          NIGHT: {
            weekday: { conditions: [{ type: 'time', at: '00:00' }] },
            weekend: { conditions: [{ type: 'time', at: '00:00' }] },
            states: { living: { onoff: false } }
          }
        }
      };

      // lastEvalTime at 22:30 on Jan 15, now at 00:30 on Jan 16 (crosses midnight)
      const lastEvalTime = new Date('2026-01-15T22:30:00Z');
      const now = new Date('2026-01-16T00:30:00Z');

      const result = evaluatePhase('DAY', lastEvalTime, config, makeCtx({ now }));

      expect(result.transitions).toHaveLength(2);
      // First: DAY -> EVENING at 23:00 on Jan 15
      expect(result.transitions[0]).toMatchObject({
        from: 'DAY',
        to: 'EVENING',
        reason: 'time'
      });
      // eventTime should be 23:00 on Jan 15 (previous calendar day)
      expect(result.transitions[0].eventTime).toEqual(new Date('2026-01-15T23:00:00Z'));

      // Second: EVENING -> NIGHT at 00:00 on Jan 16
      expect(result.transitions[1]).toMatchObject({
        from: 'EVENING',
        to: 'NIGHT',
        reason: 'time'
      });
      expect(result.transitions[1].eventTime).toEqual(new Date('2026-01-16T00:00:00Z'));

      expect(result.phase).toBe('NIGHT');
    });
  });

  describe('holiday -> weekend schedule', () => {
    it('uses weekend schedule on Dutch public holiday (Christmas)', () => {
      // Dec 25, 2026 is a Friday (Christmas Day) - public holiday in NL
      const christmas2026 = new Date('2026-12-25T08:00:00Z'); // Friday
      expect(christmas2026.getDay()).toBe(5); // Verify it's Friday

      // Config where weekend MORNING fires at 08:00, weekday at 07:00
      const config: AppConfig = {
        version: '1.0.0',
        roles: [{ id: 'living', name: 'Living Room' }],
        phases: {
          NIGHT: {
            weekday: { conditions: [{ type: 'time', at: '00:00' }] },
            weekend: { conditions: [{ type: 'time', at: '00:00' }] },
            states: { living: { onoff: false } }
          },
          MORNING: {
            weekday: { conditions: [{ type: 'time', at: '07:00' }] },
            weekend: { conditions: [{ type: 'time', at: '09:00' }] }, // Later on weekend
            states: { living: { onoff: true, dim: 0.5 } }
          },
          DAY: {
            weekday: { conditions: [{ type: 'time', at: '12:00' }] },
            weekend: { conditions: [{ type: 'time', at: '12:00' }] },
            states: { living: { onoff: false } }
          },
          EVENING: {
            weekday: { conditions: [{ type: 'time', at: '20:00' }] },
            weekend: { conditions: [{ type: 'time', at: '20:00' }] },
            states: { living: { onoff: true, dim: 0.8 } }
          }
        }
      };

      const ctx = makeCtx({
        now: new Date('2026-12-25T09:30:00Z'), // After 09:00 (weekend time)
        countryCode: 'NL'
      });

      // lastEvalTime at 08:00 (after 07:00 but before 09:00)
      const lastEvalTime = new Date('2026-12-25T08:00:00Z');

      const result = evaluatePhase('NIGHT', lastEvalTime, config, ctx);

      // Should be MORNING because we're using weekend schedule (09:00 trigger)
      expect(result.phase).toBe('MORNING');
      expect(result.transitions).toHaveLength(1);
      expect(result.transitions[0].to).toBe('MORNING');
      expect(result.transitions[0].eventTime).toEqual(new Date('2026-12-25T09:00:00Z'));
    });
  });

  describe('24h reboot catchup', () => {
    it('cycles through all phases over clamped 24h window from old lastEvalTime', () => {
      const config = makeConfig();

      // Set lastEvalTime to 30 hours ago - should be clamped to 24h
      // Window becomes 24h ago to now: Jan 14 12:00 → Jan 15 12:00
      // At 12:00 on Jan 15, we'll have seen:
      // - MORNING at 07:00 (within window)
      // - DAY at 12:00 (within window)
      const now = new Date('2026-01-15T12:00:00Z');
      const lastEvalTime = new Date(now.getTime() - 30 * 60 * 60 * 1000); // 30h ago

      const ctx = makeCtx({ now });

      const result = evaluatePhase('NIGHT', lastEvalTime, config, ctx);

      // Window is 24h: 2026-01-14T12:00:00Z to 2026-01-15T12:00:00Z
      // Starting at NIGHT, we see MORNING at 07:00 and DAY at 12:00
      expect(result.phase).toBe('DAY');
      expect(result.transitions).toHaveLength(2);

      // Verify the sequence
      expect(result.transitions[0]).toMatchObject({ from: 'NIGHT', to: 'MORNING' });
      expect(result.transitions[1]).toMatchObject({ from: 'MORNING', to: 'DAY' });
    });
  });

  describe('iteration cap', () => {
    // This test uses all lux conditions with values that will continuously trigger
    // Each phase has a condition that evaluates to true at "now"
    it('caps at MAX_ITERATIONS with cappedAt flag on degenerate config', () => {
      // Using lux conditions with values that will always trigger at "now"
      // All conditions reference "now" as eventTime, so evalTime never advances
      const degenerateConfig: AppConfig = {
        version: '1.0.0',
        roles: [{ id: 'test', name: 'Test' }],
        phases: {
          NIGHT: {
            weekday: { conditions: [{ type: 'lux', operator: 'gt', value: 0 }] },
            weekend: { conditions: [{ type: 'lux', operator: 'gt', value: 0 }] },
            states: { test: { onoff: false } }
          },
          MORNING: {
            weekday: { conditions: [{ type: 'lux', operator: 'gt', value: 0 }] },
            weekend: { conditions: [{ type: 'lux', operator: 'gt', value: 0 }] },
            states: { test: { onoff: true } }
          },
          DAY: {
            weekday: { conditions: [{ type: 'lux', operator: 'gt', value: 0 }] },
            weekend: { conditions: [{ type: 'lux', operator: 'gt', value: 0 }] },
            states: { test: { onoff: false } }
          },
          EVENING: {
            weekday: { conditions: [{ type: 'lux', operator: 'gt', value: 0 }] },
            weekend: { conditions: [{ type: 'lux', operator: 'gt', value: 0 }] },
            states: { test: { onoff: true } }
          }
        }
      };

      // Any time window works since lux > 0 is always true at ctx.now
      const now = new Date('2026-01-15T12:00:00Z');
      const lastEvalTime = new Date('2026-01-15T11:00:00Z');

      const ctx = makeCtx({ now, lux: 100 }); // lux > 0 triggers

      const result = evaluatePhase('NIGHT', lastEvalTime, degenerateConfig, ctx);

      // Should cap at 4 iterations
      expect(result.cappedAt).toBe(4);
      expect(result.transitions).toHaveLength(4);
    });
  });

  describe('lux trigger', () => {
    it('triggers transition with reason "lux" when lux condition is met', () => {
      const config: AppConfig = {
        version: '1.0.0',
        roles: [{ id: 'living', name: 'Living Room' }],
        phases: {
          NIGHT: {
            weekday: { conditions: [{ type: 'time', at: '00:00' }] },
            weekend: { conditions: [{ type: 'time', at: '00:00' }] },
            states: { living: { onoff: false } }
          },
          MORNING: {
            weekday: { conditions: [{ type: 'time', at: '07:00' }] },
            weekend: { conditions: [{ type: 'time', at: '08:00' }] },
            states: { living: { onoff: true, dim: 0.5 } }
          },
          DAY: {
            weekday: { conditions: [{ type: 'lux', operator: 'gt', value: 100 }] },
            weekend: { conditions: [{ type: 'lux', operator: 'gt', value: 100 }] },
            states: { living: { onoff: false } }
          },
          EVENING: {
            weekday: { conditions: [{ type: 'time', at: '20:00' }] },
            weekend: { conditions: [{ type: 'time', at: '20:00' }] },
            states: { living: { onoff: true, dim: 0.8 } }
          }
        }
      };

      const now = new Date('2026-01-15T12:00:00Z');
      const lastEvalTime = new Date('2026-01-15T11:00:00Z'); // After 07:00, before lux check

      const ctx = makeCtx({ now, lux: 250 }); // Lux > 100, triggers DAY

      const result = evaluatePhase('MORNING', lastEvalTime, config, ctx);

      expect(result.phase).toBe('DAY');
      expect(result.transitions).toHaveLength(1);
      expect(result.transitions[0]).toMatchObject({
        from: 'MORNING',
        to: 'DAY',
        reason: 'lux'
      });
      // Lux events happen at 'now'
      expect(result.transitions[0].eventTime).toEqual(now);
    });

    it('does not trigger when lux is below threshold', () => {
      const config: AppConfig = {
        version: '1.0.0',
        roles: [{ id: 'living', name: 'Living Room' }],
        phases: {
          NIGHT: {
            weekday: { conditions: [{ type: 'time', at: '00:00' }] },
            weekend: { conditions: [{ type: 'time', at: '00:00' }] },
            states: { living: { onoff: false } }
          },
          MORNING: {
            weekday: { conditions: [{ type: 'time', at: '07:00' }] },
            weekend: { conditions: [{ type: 'time', at: '08:00' }] },
            states: { living: { onoff: true, dim: 0.5 } }
          },
          DAY: {
            weekday: { conditions: [{ type: 'lux', operator: 'gt', value: 100 }] },
            weekend: { conditions: [{ type: 'lux', operator: 'gt', value: 100 }] },
            states: { living: { onoff: false } }
          },
          EVENING: {
            weekday: { conditions: [{ type: 'time', at: '20:00' }] },
            weekend: { conditions: [{ type: 'time', at: '20:00' }] },
            states: { living: { onoff: true, dim: 0.8 } }
          }
        }
      };

      const now = new Date('2026-01-15T12:00:00Z');
      const lastEvalTime = new Date('2026-01-15T11:00:00Z');

      const ctx = makeCtx({ now, lux: 50 }); // Lux < 100, should NOT trigger

      const result = evaluatePhase('MORNING', lastEvalTime, config, ctx);

      // Stays in MORNING, no transition to DAY
      expect(result.phase).toBe('MORNING');
      expect(result.transitions).toHaveLength(0);
    });
  });

  describe('solar trigger', () => {
    it('triggers transition at sunset for DAY with solar condition', () => {
      // Dec 15, 2026 in Amsterdam: sunset ~16:28 CET (15:28 UTC)
      // Using fixed date and location to get deterministic solar times
      const testDate = new Date('2026-12-15T16:00:00Z'); // 4:00 PM UTC = ~5:00 PM CET
      const lastEvalTime = new Date('2026-12-15T14:00:00Z'); // Before sunset

      // Config where DAY starts at sunset
      const config: AppConfig = {
        version: '1.0.0',
        roles: [{ id: 'living', name: 'Living Room' }],
        phases: {
          NIGHT: {
            weekday: { conditions: [{ type: 'time', at: '00:00' }] },
            weekend: { conditions: [{ type: 'time', at: '00:00' }] },
            states: { living: { onoff: false } }
          },
          MORNING: {
            weekday: { conditions: [{ type: 'time', at: '07:00' }] },
            weekend: { conditions: [{ type: 'time', at: '08:00' }] },
            states: { living: { onoff: true, dim: 0.5 } }
          },
          DAY: {
            weekday: { conditions: [{ type: 'solar', event: 'sunset', offsetMinutes: 0 }] },
            weekend: { conditions: [{ type: 'solar', event: 'sunset', offsetMinutes: 0 }] },
            states: { living: { onoff: false } }
          },
          EVENING: {
            weekday: { conditions: [{ type: 'time', at: '22:00' }] },
            weekend: { conditions: [{ type: 'time', at: '22:00' }] },
            states: { living: { onoff: true, dim: 0.8 } }
          }
        }
      };

      // Run evaluation 1 minute "after" sunset (16:30 UTC for safety)
      const now = new Date('2026-12-15T16:30:00Z');
      const ctx = makeCtx({
        now,
        latitude: 52.37,
        longitude: 4.90
      });

      const result = evaluatePhase('MORNING', lastEvalTime, config, ctx);

      // Should transition to DAY via solar trigger
      expect(result.phase).toBe('DAY');
      expect(result.transitions).toHaveLength(1);
      expect(result.transitions[0]).toMatchObject({
        from: 'MORNING',
        to: 'DAY',
        reason: 'solar'
      });
      // Event time should be around sunset time
      const eventTime = result.transitions[0].eventTime;
      expect(eventTime).toBeDefined();
      // Sunset should be between 15:00 and 17:00 UTC on this date
      const eventHour = eventTime!.getUTCHours();
      expect(eventHour).toBeGreaterThanOrEqual(15);
      expect(eventHour).toBeLessThanOrEqual(17);
    });
  });

  describe('invalid country fallback', () => {
    it('uses weekday schedule on Tuesday with empty countryCode', () => {
      const config: AppConfig = {
        version: '1.0.0',
        roles: [{ id: 'test', name: 'Test' }],
        phases: {
          NIGHT: {
            weekday: { conditions: [{ type: 'time', at: '00:00' }] },
            weekend: { conditions: [{ type: 'time', at: '00:00' }] },
            states: { test: { onoff: false } }
          },
          MORNING: {
            weekday: { conditions: [{ type: 'time', at: '07:00' }] },
            weekend: { conditions: [{ type: 'time', at: '09:00' }] },
            states: { test: { onoff: true } }
          },
          DAY: {
            weekday: { conditions: [{ type: 'time', at: '12:00' }] },
            weekend: { conditions: [{ type: 'time', at: '12:00' }] },
            states: { test: { onoff: false } }
          },
          EVENING: {
            weekday: { conditions: [{ type: 'time', at: '20:00' }] },
            weekend: { conditions: [{ type: 'time', at: '20:00' }] },
            states: { test: { onoff: true } }
          }
        }
      };

      // Tuesday Jan 13, 2026 with empty countryCode
      const now = new Date('2026-01-13T08:00:00Z'); // Tuesday
      expect(now.getDay()).toBe(2); // Verify Tuesday

      const lastEvalTime = new Date('2026-01-13T06:00:00Z');
      const ctx = makeCtx({ now, countryCode: '' });

      const result = evaluatePhase('NIGHT', lastEvalTime, config, ctx);

      // Should use weekday schedule (07:00 trigger), not weekend (09:00)
      expect(result.phase).toBe('MORNING');
      expect(result.transitions).toHaveLength(1);
      expect(result.transitions[0].eventTime).toEqual(new Date('2026-01-13T07:00:00Z'));
    });

    it('uses weekend schedule on Saturday with empty countryCode', () => {
      const config: AppConfig = {
        version: '1.0.0',
        roles: [{ id: 'test', name: 'Test' }],
        phases: {
          NIGHT: {
            weekday: { conditions: [{ type: 'time', at: '00:00' }] },
            weekend: { conditions: [{ type: 'time', at: '00:00' }] },
            states: { test: { onoff: false } }
          },
          MORNING: {
            weekday: { conditions: [{ type: 'time', at: '07:00' }] },
            weekend: { conditions: [{ type: 'time', at: '09:00' }] },
            states: { test: { onoff: true } }
          },
          DAY: {
            weekday: { conditions: [{ type: 'time', at: '12:00' }] },
            weekend: { conditions: [{ type: 'time', at: '12:00' }] },
            states: { test: { onoff: false } }
          },
          EVENING: {
            weekday: { conditions: [{ type: 'time', at: '20:00' }] },
            weekend: { conditions: [{ type: 'time', at: '20:00' }] },
            states: { test: { onoff: true } }
          }
        }
      };

      // Saturday Jan 17, 2026 with empty countryCode
      const now = new Date('2026-01-17T10:00:00Z'); // Saturday
      expect(now.getDay()).toBe(6); // Verify Saturday

      const lastEvalTime = new Date('2026-01-17T06:00:00Z');
      const ctx = makeCtx({ now, countryCode: '' });

      const result = evaluatePhase('NIGHT', lastEvalTime, config, ctx);

      // Should use weekend schedule (09:00 trigger), not weekday (07:00)
      expect(result.phase).toBe('MORNING');
      expect(result.transitions).toHaveLength(1);
      expect(result.transitions[0].eventTime).toEqual(new Date('2026-01-17T09:00:00Z'));
    });

    it('handles invalid country code gracefully with fallback to weekday/weekend', () => {
      // Note: date-holidays doesn't actually throw for invalid country codes;
      // it silently treats them as unknown countries. The logger warning only triggers
      // on actual initialization failures (rare). This test documents that behavior.

      // Use a different date to avoid cache from earlier tests
      const now = new Date('2026-06-15T12:00:00Z'); // Monday
      // Need a window that crosses a time trigger (12:00 for DAY)
      const lastEvalTime = new Date('2026-06-15T11:30:00Z'); // Before 12:00

      const ctx = makeCtx({
        now,
        countryCode: 'ZZZ' // Invalid but won't throw - lib treats it as unknown
      });

      const config = makeConfig();

      // Should still work correctly without crashing
      const result = evaluatePhase('MORNING', lastEvalTime, config, ctx);

      // Uses weekday schedule (12:00 trigger) since it's Monday
      expect(result.phase).toBe('DAY');
      expect(result.transitions).toHaveLength(1);
      expect(result.transitions[0].to).toBe('DAY');
    });
  });

  describe('PHASE_ORDER constant', () => {
    it('exports correct phase order', () => {
      expect(PHASE_ORDER).toEqual(['NIGHT', 'MORNING', 'DAY', 'EVENING']);
    });
  });

  describe('EngineResult structure', () => {
    it('returns structured result with all documented fields', () => {
      const config = makeConfig();
      const lastEvalTime = new Date('2026-01-15T06:59:00Z');
      const now = new Date('2026-01-15T07:01:00Z');
      const ctx = makeCtx({ now });

      const result = evaluatePhase('NIGHT', lastEvalTime, config, ctx);

      // Verify all fields exist
      expect(result).toHaveProperty('phase');
      expect(result).toHaveProperty('lastEvalTime');
      expect(result).toHaveProperty('transitions');
      // cappedAt is optional, not present in this case

      // Verify types
      expect(typeof result.phase).toBe('string');
      expect(result.lastEvalTime instanceof Date).toBe(true);
      expect(Array.isArray(result.transitions)).toBe(true);

      // Verify transition record structure
      if (result.transitions.length > 0) {
        const transition = result.transitions[0];
        expect(transition).toHaveProperty('from');
        expect(transition).toHaveProperty('to');
        expect(transition).toHaveProperty('reason');
        expect(transition).toHaveProperty('eventTime');
        expect(transition.eventTime instanceof Date).toBe(true);
      }
    });

    it('returns lastEvalTime === ctx.now for the next tick', () => {
      const config = makeConfig();
      const now = new Date('2026-01-15T12:00:00Z');
      const ctx = makeCtx({ now });

      const result = evaluatePhase('NIGHT', new Date('2026-01-15T00:00:00Z'), config, ctx);

      // lastEvalTime should be set to ctx.now for the next evaluation
      expect(result.lastEvalTime).toEqual(now);
    });
  });
});