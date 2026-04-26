import { describe, it, expect } from 'vitest';
import {
  safeParseConfig,
  ConfigValidationError,
  type AppConfig,
} from '../../src/lib/config/ConfigParser.js';
import { getConfigFromStore, type SettingsStore } from '../../src/lib/config/saveConfig.js';

const clone = <T>(o: T): T => JSON.parse(JSON.stringify(o));

// Fixture matching the existing test style from AppSettings.test.ts
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

// SDK-free TestableApp following the pattern from FlowCards.test.ts
// Replicates the onInit() guard logic for testing
class TestableApp {
  errors: Array<{ msg: string; detail?: unknown }> = [];
  logs: string[] = [];
  flowCardsRegistered: boolean = false;

  constructor(private store: SettingsStore) {}

  private log(msg: string) {
    this.logs.push(msg);
  }

  private error(msg: string, detail?: unknown) {
    this.errors.push({ msg, detail });
  }

  // Mirror of MyApp.onInit() guard logic
  onInit(): void {
    this.log('MyApp has been initialized');

    const raw = getConfigFromStore(this.store);
    if (raw === null) {
      this.error('onInit: config missing from store; skip engine start');
      return;
    }

    const result = safeParseConfig(raw);
    if (!result.ok) {
      this.error('onInit: invalid config', { issues: result.error.issues });
      return;
    }

    // Simulate flow card registration
    this.flowCardsRegistered = true;
    this.log('Flow cards registered');
  }
}

// Helper to create a stub SettingsStore
function makeStore(initialConfig: unknown | null = null): SettingsStore {
  const data = new Map<string, unknown>();
  if (initialConfig !== null) {
    data.set('config', initialConfig);
  }
  return {
    get(key: string) {
      return data.get(key) ?? null;
    },
    set() {
      // no-op for tests
    },
  };
}

describe('MyApp.onInit() — eager config validation guard', () => {
  it('cold start: null stored config → error logged, no flow-card registration', () => {
    const store = makeStore(null);
    const app = new TestableApp(store);

    app.onInit();

    // Should have logged exactly one error
    expect(app.errors).toHaveLength(1);
    expect(app.errors[0].msg).toMatch(/^onInit:/);
    expect(app.errors[0].msg).toMatch(/config missing/i);

    // Flow cards should NOT be registered
    expect(app.flowCardsRegistered).toBe(false);
  });

  it('invalid stored config: error with issues logged, no flow-card registration', () => {
    const broken = clone(validConfig);
    // @ts-expect-error - intentionally deleting for test
    delete broken.phases.EVENING;

    const store = makeStore(broken);
    const app = new TestableApp(store);

    app.onInit();

    // Should have logged exactly one error with issues detail
    expect(app.errors).toHaveLength(1);
    expect(app.errors[0].msg).toBe('onInit: invalid config');
    expect(app.errors[0].detail).toBeDefined();
    expect(Array.isArray((app.errors[0].detail as { issues: unknown[] }).issues)).toBe(true);

    const issues = (app.errors[0].detail as { issues: Array<{ path: unknown[]; message: string }> }).issues;
    expect(issues.length).toBeGreaterThan(0);

    // Flow cards should NOT be registered
    expect(app.flowCardsRegistered).toBe(false);
  });

  it('valid stored config: no errors, flow-card registration proceeds', () => {
    const store = makeStore(clone(validConfig));
    const app = new TestableApp(store);

    app.onInit();

    // Should have zero errors
    expect(app.errors).toHaveLength(0);

    // Flow cards should be registered
    expect(app.flowCardsRegistered).toBe(true);

    // Should have logged flow registration
    expect(app.logs).toContain('Flow cards registered');
  });

  it('error message actionability: Zod issues have path and message', () => {
    const broken = clone(validConfig);
    // @ts-expect-error - intentionally breaking for test
    delete broken.phases.EVENING;

    const store = makeStore(broken);
    const app = new TestableApp(store);

    app.onInit();

    const issues = (app.errors[0].detail as { issues: Array<{ path: unknown[]; message: string }> }).issues;

    // At least one issue should have a non-empty path
    const hasPath = issues.some(i => i.path && i.path.length > 0);
    expect(hasPath).toBe(true);

    // At least one issue should have a non-empty message
    const hasMessage = issues.some(i => i.message && i.message.length > 0);
    expect(hasMessage).toBe(true);
  });
});
