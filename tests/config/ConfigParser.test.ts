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
};

describe('ConfigParser', () => {
  it('parses a fully valid config into a typed AppConfig', () => {
    const result = parseConfig(clone(validConfig));
    expect(result).toEqual(validConfig);
  });

  it('throws ConfigValidationError when a phase key is missing', () => {
    const broken = clone(validConfig);
    delete (broken as any).phases.EVENING;
    expect(() => parseConfig(broken)).toThrow(ConfigValidationError);
  });

  it('rejects invalid time strings like 25:99', () => {
    const broken = clone(validConfig);
    (broken as any).phases.MORNING.weekday.conditions[0] = { type: 'time', at: '25:99' };
    expect(() => parseConfig(broken)).toThrow(ConfigValidationError);
  });

  it('rejects malformed conditions (unknown solar event)', () => {
    const broken = clone(validConfig);
    (broken as any).phases.MORNING.weekend.conditions[0] = { type: 'solar', event: 'midnight', offsetMinutes: 0 };
    expect(() => parseConfig(broken)).toThrow(ConfigValidationError);
  });

  it('safeParseConfig returns ok:false on invalid input instead of throwing', () => {
    const result = safeParseConfig({ totally: 'wrong' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ConfigValidationError);
    }
  });

  it('accepts sensors field', () => {
    const withSensors = {
      ...clone(validConfig),
      sensors: {
        outdoor: 'sensor-outdoor-id',
        indoor_downstairs: 'sensor-down-id',
        indoor_upstairs: 'sensor-up-id',
      }
    };
    const result = parseConfig(withSensors);
    expect(result.sensors).toEqual(withSensors.sensors);
  });

  it('accepts optional sensors and partial sensors', () => {
    const partial = {
      ...clone(validConfig),
      sensors: { outdoor: 'only-outdoor' }
    };
    const result = parseConfig(partial);
    expect(result.sensors).toEqual({ outdoor: 'only-outdoor' });
  });

  it('accepts dimming config in role', () => {
    const withDimming = clone(validConfig);
    (withDimming as any).roles[0].dimming = {
      activeInPhases: ['MORNING', 'DAY', 'EVENING'],
      source: 'indoor_downstairs',
      brightLux: 100,
      darkLux: 20,
      brightDim: 0,
      darkDim: 0.4,
    };
    const result = parseConfig(withDimming);
    expect(result.roles[0].dimming).toEqual({
      activeInPhases: ['MORNING', 'DAY', 'EVENING'],
      source: 'indoor_downstairs',
      brightLux: 100,
      darkLux: 20,
      brightDim: 0,
      darkDim: 0.4,
    });
  });

  it('rejects invalid dimming source', () => {
    const bad = clone(validConfig);
    (bad as any).roles[0].dimming = {
      activeInPhases: ['MORNING'],
      source: 'outdoor',
      brightLux: 100,
      darkLux: 20,
      brightDim: 0,
      darkDim: 0.4,
    };
    expect(() => parseConfig(bad)).toThrow(ConfigValidationError);
  });
});
