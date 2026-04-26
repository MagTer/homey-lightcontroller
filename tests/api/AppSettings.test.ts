import { describe, it, expect, beforeEach } from 'vitest';
import { ConfigValidationError } from '../../src/lib/config/ConfigParser.js';
import {
  getConfigFromStore,
  saveConfigToStore,
  saveConfigToStoreResult,
  type SettingsStore,
} from '../../src/lib/config/saveConfig.js';

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

function makeStore(): {
  store: SettingsStore;
  written: Map<string, unknown>;
} {
  const written = new Map<string, unknown>();
  return {
    store: {
      get(_key: string) {
        return written.get(_key) ?? null;
      },
      set(key: string, value: unknown) {
        written.set(key, value);
      },
    },
    written,
  };
}

describe('AppSettings helpers (saveConfig / getConfig)', () => {
  describe('getConfigFromStore', () => {
    it('returns null when settings has no value (cold start)', () => {
      const { store } = makeStore();
      const result = getConfigFromStore(store);
      expect(result).toBeNull();
    });

    it('returns the stored value as-is without parsing', () => {
      const { store, written } = makeStore();
      written.set('config', clone(validConfig));
      const result = getConfigFromStore(store);
      expect(result).toEqual(validConfig);
    });
  });

  describe('saveConfigToStore', () => {
    it('round-trips a valid AppConfig identically', () => {
      const { store, written } = makeStore();
      saveConfigToStore(store, clone(validConfig));
      const stored = written.get('config');
      expect(stored).toEqual(validConfig);
    });

    it('throws ConfigValidationError for invalid input (missing EVENING phase)', () => {
      const { store, written } = makeStore();
      const broken = clone(validConfig);
      // @ts-expect-error - intentionally deleting for test
      delete broken.phases.EVENING;
      expect(() => saveConfigToStore(store, broken)).toThrow(ConfigValidationError);
      // Store must NOT be written to on failure
      expect(written.has('config')).toBe(false);
    });

    it('throws ConfigValidationError for invalid time strings', () => {
      const { store, written } = makeStore();
      const broken = clone(validConfig);
      // @ts-expect-error - intentionally setting invalid time
      broken.phases.MORNING.weekday.conditions[0] = { type: 'time', at: '25:99' };
      expect(() => saveConfigToStore(store, broken)).toThrow(ConfigValidationError);
      expect(written.has('config')).toBe(false);
    });

    it('throws ConfigValidationError for unknown solar event', () => {
      const { store, written } = makeStore();
      const broken = clone(validConfig);
      // @ts-expect-error - intentionally setting invalid solar event
      broken.phases.MORNING.weekend.conditions[0] = { type: 'solar', event: 'midnight', offsetMinutes: 0 };
      expect(() => saveConfigToStore(store, broken)).toThrow(ConfigValidationError);
      expect(written.has('config')).toBe(false);
    });

    it('returns { version } on success', () => {
      const { store } = makeStore();
      const result = saveConfigToStore(store, clone(validConfig));
      expect(result).toEqual({ version: '1.0.0' });
    });
  });

  describe('saveConfigToStoreResult (non-throwing variant)', () => {
    it('returns ok:true with version on valid input', () => {
      const { store } = makeStore();
      const result = saveConfigToStoreResult(store, clone(validConfig));
      expect(result).toEqual({ ok: true, version: '1.0.0' });
    });

    it('returns ok:false with ConfigValidationError on invalid input', () => {
      const { store, written } = makeStore();
      const result = saveConfigToStoreResult(store, { totally: 'wrong' });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(ConfigValidationError);
        // Store must NOT be written to on failure
        expect(written.has('config')).toBe(false);
      }
    });
  });
});
