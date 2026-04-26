import { describe, it, expect } from 'vitest';
import { parseConfig, safeParseConfig, ConfigValidationError } from '../../src/lib/config/ConfigParser.js';

const clone = <T>(o: T): T => JSON.parse(JSON.stringify(o));

const validConfig = {
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
      weekend: { conditions: [{ type: 'solar', event: 'sunrise', offsetMinutes: -30 }] },
      states: { living: { onoff: true, dim: 0.5 } }
    },
    DAY: {
      weekday: { conditions: [{ type: 'solar', event: 'sunset', offsetMinutes: 0 }] },
      weekend: { conditions: [{ type: 'lux', operator: 'gt', value: 100 }] },
      states: { living: { onoff: false } }
    },
    EVENING: {
      weekday: { conditions: [{ type: 'time', at: '20:00' }] },
      weekend: { conditions: [{ type: 'time', at: '21:00' }] },
      states: { living: { onoff: true, dim: 0.8 } }
    }
  }
} as const;

describe('ConfigParser', () => {
  it('parses a fully valid config into a typed AppConfig', () => {
    const result = parseConfig(clone(validConfig));
    expect(result).toEqual(validConfig);
  });

  it('throws ConfigValidationError when a phase key is missing', () => {
    const broken = clone(validConfig);
    // @ts-expect-error - intentionally deleting for test
    delete broken.phases.EVENING;
    expect(() => parseConfig(broken)).toThrow(ConfigValidationError);
  });

  it('rejects invalid time strings like 25:99', () => {
    const broken = clone(validConfig);
    // @ts-expect-error - intentionally setting invalid time
    broken.phases.MORNING.weekday.conditions[0] = { type: 'time', at: '25:99' };
    expect(() => parseConfig(broken)).toThrow(ConfigValidationError);
  });

  it('rejects malformed conditions (unknown solar event)', () => {
    const broken = clone(validConfig);
    // @ts-expect-error - intentionally setting invalid solar event
    broken.phases.MORNING.weekend.conditions[0] = { type: 'solar', event: 'midnight', offsetMinutes: 0 };
    expect(() => parseConfig(broken)).toThrow(ConfigValidationError);
  });

  it('safeParseConfig returns ok:false on invalid input instead of throwing', () => {
    const result = safeParseConfig({ totally: 'wrong' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ConfigValidationError);
    }
  });
});
