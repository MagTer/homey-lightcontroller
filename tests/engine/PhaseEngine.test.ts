import { describe, it, expect, vi } from 'vitest';
import { evaluatePhase, evaluatePhaseConditions, PHASE_ORDER, type TransitionRecord, type EngineResult } from '../../src/lib/engine/PhaseEngine.js';
import type { AppConfig, Phase, PhaseSchedule } from '../../src/lib/config/Config.js';
import type { EvaluationContext } from '../../src/lib/engine/EvaluationContext.js';

// Pin tests to a non-UTC timezone so local-time interpretation is explicit.
process.env.TZ = 'Europe/Amsterdam';

// Helper to create a context with specific date
function makeCtx(overrides: Partial<EvaluationContext> = {}): EvaluationContext {
  return {
    now: new Date('2026-01-15T12:00:00Z'), // Thursday, 13:00 local
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
      // 07:00 local CET = 06:00 UTC
      const lastEvalTime = new Date('2026-01-15T05:59:00Z'); // 06:59 local
      const now = new Date('2026-01-15T06:01:00Z'); // 07:01 local
      const ctx = makeCtx({ now });

      const result = evaluatePhase('NIGHT', lastEvalTime, config, ctx);

      expect(result.phase).toBe('MORNING');
      expect(result.transitions).toHaveLength(1);
      expect(result.transitions[0]).toMatchObject({
        from: 'NIGHT',
        to: 'MORNING',
        reason: 'time'
      });
      expect(result.transitions[0].eventTime).toEqual(new Date('2026-01-15T06:00:00Z'));
    });

    it('transitions from MORNING to DAY when time passes 12:00', () => {
      const config = makeConfig();
      // 12:00 local CET = 11:00 UTC
      const lastEvalTime = new Date('2026-01-15T10:59:00Z'); // 11:59 local
      const now = new Date('2026-01-15T11:01:00Z'); // 12:01 local
      const ctx = makeCtx({ now });

      const result = evaluatePhase('MORNING', lastEvalTime, config, ctx);

      expect(result.phase).toBe('DAY');
      expect(result.transitions).toHaveLength(1);
      expect(result.transitions[0]).toMatchObject({
        from: 'MORNING',
        to: 'DAY',
        reason: 'time'
      });
      expect(result.transitions[0].eventTime).toEqual(new Date('2026-01-15T11:00:00Z'));
    });
  });

  describe('local-time interpretation', () => {
    it('a time condition at 08:00 triggers at 08:00 local time, not UTC', () => {
      // In Europe/Amsterdam (CET, UTC+1 in January), 08:00 local = 07:00 UTC.
      const lastEvalTime = new Date('2026-01-15T06:59:00Z'); // 07:59 local
      const now = new Date('2026-01-15T07:01:00Z'); // 08:01 local
      const ctx = makeCtx({ now });

      const config = makeConfig({
        phases: {
          ...makeConfig().phases,
          MORNING: {
            weekday: { conditions: [{ type: 'time', at: '08:00' }] },
            weekend: { conditions: [{ type: 'time', at: '08:00' }] },
            states: { living: { onoff: true, dim: 0.5 } }
          }
        }
      });

      const result = evaluatePhase('NIGHT', lastEvalTime, config, ctx);

      expect(result.phase).toBe('MORNING');
      expect(result.transitions).toHaveLength(1);
      expect(result.transitions[0].eventTime).toEqual(new Date('2026-01-15T07:00:00Z'));
      expect(result.transitions[0].eventTime.getHours()).toBe(8);
      expect(result.transitions[0].eventTime.getMinutes()).toBe(0);
    });
  });

  describe('no-trigger no-op', () => {
    it('stays in NIGHT when no transition time has passed', () => {
      const config = makeConfig();
      const lastEvalTime = new Date('2026-01-15T02:00:00Z'); // 03:00 local
      const now = new Date('2026-01-15T03:00:00Z'); // 04:00 local, still before 07:00
      const ctx = makeCtx({ now });

      const result = evaluatePhase('NIGHT', lastEvalTime, config, ctx);

      expect(result.phase).toBe('NIGHT');
      expect(result.transitions).toHaveLength(0);
      expect(result.cappedAt).toBeUndefined();
    });

    it('stays in DAY during midday', () => {
      const config = makeConfig();
      const lastEvalTime = new Date('2026-01-15T13:00:00Z'); // 14:00 local
      const now = new Date('2026-01-15T14:00:00Z'); // 15:00 local, between 12:00 and 20:00
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

      // lastEvalTime at 22:30 local on Jan 15 (21:30 UTC), now at 00:30 local on Jan 16 (23:30 UTC)
      const lastEvalTime = new Date('2026-01-15T21:30:00Z');
      const now = new Date('2026-01-15T23:30:00Z');

      const result = evaluatePhase('DAY', lastEvalTime, config, makeCtx({ now }));

      expect(result.transitions).toHaveLength(2);
      // First: DAY -> EVENING at 23:00 local on Jan 15 = 22:00 UTC
      expect(result.transitions[0]).toMatchObject({
        from: 'DAY',
        to: 'EVENING',
        reason: 'time'
      });
      expect(result.transitions[0].eventTime).toEqual(new Date('2026-01-15T22:00:00Z'));

      // Second: EVENING -> NIGHT at 00:00 local on Jan 16 = 23:00 UTC Jan 15
      expect(result.transitions[1]).toMatchObject({
        from: 'EVENING',
        to: 'NIGHT',
        reason: 'time'
      });
      expect(result.transitions[1].eventTime).toEqual(new Date('2026-01-15T23:00:00Z'));

      expect(result.phase).toBe('NIGHT');
    });
  });

  describe('holiday -> weekend schedule', () => {
    it('uses weekend schedule on Dutch public holiday (Christmas)', () => {
      // Dec 25, 2026 is a Friday (Christmas Day) - public holiday in NL
      const christmas2026 = new Date('2026-12-25T08:00:00Z'); // Friday, 09:00 local
      expect(christmas2026.getDay()).toBe(5); // Verify it's Friday

      // Config where weekend MORNING fires at 09:00, weekday at 07:00
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
        now: new Date('2026-12-25T09:30:00Z'), // 10:30 local, after 09:00 weekend time
        countryCode: 'NL'
      });

      // lastEvalTime at 08:30 local (07:30 UTC): after weekday 07:00 local,
      // before weekend 09:00 local. Only a holiday/weekend should trigger.
      const lastEvalTime = new Date('2026-12-25T07:30:00Z');

      const result = evaluatePhase('NIGHT', lastEvalTime, config, ctx);

      // Should be MORNING because we're using weekend schedule (09:00 local trigger)
      expect(result.phase).toBe('MORNING');
      expect(result.transitions).toHaveLength(1);
      expect(result.transitions[0].to).toBe('MORNING');
      expect(result.transitions[0].eventTime).toEqual(new Date('2026-12-25T08:00:00Z'));
    });
  });

  describe('24h reboot catchup', () => {
    it('cycles through all phases over clamped 24h window from old lastEvalTime', () => {
      const config = makeConfig();

      // Set lastEvalTime to 30 hours ago - should be clamped to 24h.
      // With CET, MORNING at 07:00 local = 06:00 UTC and DAY at 12:00 local = 11:00 UTC.
      // Choose now late enough so the 24h window includes 06:00 UTC today.
      const now = new Date('2026-01-15T18:00:00Z'); // 19:00 local
      const lastEvalTime = new Date(now.getTime() - 30 * 60 * 60 * 1000); // 30h ago

      const ctx = makeCtx({ now });

      const result = evaluatePhase('NIGHT', lastEvalTime, config, ctx);

      expect(result.phase).toBe('DAY');
      expect(result.transitions).toHaveLength(2);

      // Verify the sequence
      expect(result.transitions[0]).toMatchObject({ from: 'NIGHT', to: 'MORNING' });
      expect(result.transitions[0].eventTime).toEqual(new Date('2026-01-15T06:00:00Z'));
      expect(result.transitions[1]).toMatchObject({ from: 'MORNING', to: 'DAY' });
      expect(result.transitions[1].eventTime).toEqual(new Date('2026-01-15T11:00:00Z'));
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
      const lastEvalTime = new Date('2026-01-15T11:00:00Z'); // After 07:00 local, before lux check

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
      const now = new Date('2026-01-13T08:00:00Z'); // Tuesday, 09:00 local
      expect(now.getDay()).toBe(2); // Verify it's Tuesday

      // 07:00 local = 06:00 UTC
      const lastEvalTime = new Date('2026-01-13T05:00:00Z'); // 06:00 local
      const ctx = makeCtx({ now, countryCode: '' });

      const result = evaluatePhase('NIGHT', lastEvalTime, config, ctx);

      // Should use weekday schedule (07:00 local trigger), not weekend (09:00 local)
      expect(result.phase).toBe('MORNING');
      expect(result.transitions).toHaveLength(1);
      expect(result.transitions[0].eventTime).toEqual(new Date('2026-01-13T06:00:00Z'));
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
      const now = new Date('2026-01-17T10:00:00Z'); // Saturday, 11:00 local
      expect(now.getDay()).toBe(6); // Verify it's Saturday

      // 09:00 local = 08:00 UTC
      const lastEvalTime = new Date('2026-01-17T06:00:00Z'); // 07:00 local
      const ctx = makeCtx({ now, countryCode: '' });

      const result = evaluatePhase('NIGHT', lastEvalTime, config, ctx);

      // Should use weekend schedule (09:00 local trigger), not weekday (07:00 local)
      expect(result.phase).toBe('MORNING');
      expect(result.transitions).toHaveLength(1);
      expect(result.transitions[0].eventTime).toEqual(new Date('2026-01-17T08:00:00Z'));
    });

    it('handles invalid country code gracefully with fallback to weekday/weekend', () => {
      // Note: date-holidays doesn't actually throw for invalid country codes;
      // it silently treats them as unknown countries. The logger warning only triggers
      // on actual initialization failures (rare). This test documents that behavior.

      // Use a different date to avoid cache from earlier tests
      const now = new Date('2026-06-15T12:00:00Z'); // Monday, 14:00 local (CEST)
      // Need a window that crosses a time trigger (12:00 local for DAY)
      // 12:00 local CEST = 10:00 UTC
      const lastEvalTime = new Date('2026-06-15T09:30:00Z'); // 11:30 local

      const ctx = makeCtx({
        now,
        countryCode: 'ZZZ' // Invalid but won't throw - lib treats it as unknown
      });

      const config = makeConfig();

      // Should still work correctly without crashing
      const result = evaluatePhase('MORNING', lastEvalTime, config, ctx);

      // Uses weekday schedule (12:00 local trigger) since it's Monday
      expect(result.phase).toBe('DAY');
      expect(result.transitions).toHaveLength(1);
      expect(result.transitions[0].to).toBe('DAY');
      expect(result.transitions[0].eventTime).toEqual(new Date('2026-06-15T10:00:00Z'));
    });
  });

  describe('PHASE_ORDER constant', () => {
    it('exports correct phase order', () => {
      expect(PHASE_ORDER).toEqual(['NIGHT', 'MORNING', 'DAY', 'EVENING']);
    });
  });

  describe('type-priority tiebreak', () => {
    it('(a) time vs solar at identical eventTimes → time wins', () => {
      // Align time '09:00' local (08:00 UTC) with solar sunrise + 20 min.
      // Jan 15 Amsterdam sunrise is ~07:40 UTC, so +20 min = 08:00 UTC.
      const now = new Date('2026-01-15T08:00:00Z'); // 09:00 local
      const evalTime = new Date('2026-01-15T07:59:00Z'); // 08:59 local

      // Schedule with solar first, then time (solar comes first to prove iteration order doesn't decide)
      const schedule: PhaseSchedule = {
        conditions: [
          { type: 'solar', event: 'sunrise', offsetMinutes: 20 },
          { type: 'time', at: '09:00' }
        ]
      };

      const ctx = makeCtx({ now, latitude: 52.37, longitude: 4.90 });

      const result = evaluatePhaseConditions(schedule, ctx, evalTime);

      expect(result.triggered).toBe(true);
      expect(result.reason).toBe('time');
      expect(result.eventTime?.getTime()).toBe(new Date('2026-01-15T08:00:00Z').getTime());
    });

    it('(b) time vs lux at identical eventTimes → time wins', () => {
      // 09:00 local = 08:00 UTC
      const now = new Date('2026-01-15T08:00:00Z');
      const evalTime = new Date('2026-01-15T07:59:00Z');

      // Schedule with lux first, then time
      const schedule: PhaseSchedule = {
        conditions: [
          { type: 'lux', operator: 'lt', value: 100 },
          { type: 'time', at: '09:00' }
        ]
      };

      // lux: 0 < 100 triggers at 'now' (08:00:00Z)
      // time: '09:00' local also resolves to 08:00:00Z
      const ctx = makeCtx({ now, lux: 0 });

      const result = evaluatePhaseConditions(schedule, ctx, evalTime);

      expect(result.triggered).toBe(true);
      expect(result.reason).toBe('time');
      expect(result.eventTime?.getTime()).toBe(now.getTime());
    });

    it('(c) solar vs lux at identical eventTimes → solar wins', () => {
      // Test solar vs lux tiebreak by using a solar offset to force exact alignment.
      // On Dec 15, 2026 in Amsterdam, sunset is at approximately 15:28:20.883 UTC.
      // We use a calculated offset to align solar with lux event time.
      const SunCalc = require('suncalc');
      const lat = 52.37, lon = 4.90;
      
      // Base time for solar calculation
      const baseTime = new Date('2026-12-15T16:00:00Z');
      const evalTime = new Date('2026-12-15T14:00:00Z');

      // Get the raw sunset time for this date
      const dec15Times = SunCalc.getTimes(baseTime, lat, lon);
      const sunsetTime = dec15Times.sunset;
      
      // Calculate offset needed to align sunset to our target
      // We want solar event at exactly [some time], so we offset from actual sunset
      const offsetMinutes = 32;  // 15:28:20.883 + 32min = 16:00:20.883

      // The solar event will be at sunset + offset = 16:00:20.883
      // Set lux to trigger at the exact same time
      const targetTime = new Date(sunsetTime.getTime() + offsetMinutes * 60000);

      // Schedule with lux first, then solar (lux first to prove iteration order doesn't decide)
      const schedule: PhaseSchedule = {
        conditions: [
          { type: 'lux', operator: 'gt', value: 0 },  // triggers at ctx.now
          { type: 'solar', event: 'sunset', offsetMinutes }
        ]
      };

      // Lux triggers at targetTime when lux > 0
      // Solar triggers at targetTime via calculated offset
      const ctx = makeCtx({
        now: targetTime,
        lux: 100,
        latitude: lat,
        longitude: lon
      });

      const result = evaluatePhaseConditions(schedule, ctx, evalTime);

      // Solar (priority 1) beats lux (priority 2) when eventTimes are equal
      expect(result.triggered).toBe(true);
      expect(result.reason).toBe('solar');
    });

    it('(d) distinct timestamps — earliest wins regardless of type', () => {
      const now = new Date('2026-01-15T12:00:00Z'); // 13:00 local
      const evalTime = new Date('2026-01-15T05:59:00Z'); // 06:59 local

      // Schedule with lux first (triggers at 12:00 UTC = 13:00 local), then time (triggers at 07:00 local = 06:00 UTC)
      const schedule: PhaseSchedule = {
        conditions: [
          { type: 'lux', operator: 'lt', value: 100 },
          { type: 'time', at: '07:00' }
        ]
      };

      // lux triggers at 'now' (12:00:00Z)
      // time triggers at 06:00:00Z (earlier)
      const ctx = makeCtx({ now, lux: 0 });

      const result = evaluatePhaseConditions(schedule, ctx, evalTime);

      // 06:00 UTC is earlier than 12:00 UTC, so time should win
      expect(result.triggered).toBe(true);
      expect(result.reason).toBe('time');
      expect(result.eventTime?.getTime()).toBe(new Date('2026-01-15T06:00:00Z').getTime());
    });
  });
});
