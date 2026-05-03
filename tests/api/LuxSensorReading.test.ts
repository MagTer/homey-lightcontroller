import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LuxAggregator } from '../../src/lib/engine/LuxAggregator.js';
import type { AppConfig } from '../../src/lib/config/Config.js';

// Mirrors MyApp._readLuxSensors logic for testing without Homey SDK dependency
async function readLuxSensors(
  config: AppConfig,
  now: Date,
  getDevice: (id: string) => Promise<{ capabilitiesObj?: Record<string, { value?: unknown }> }>,
  aggregator: LuxAggregator,
  log: (msg: string, detail?: unknown) => void,
  error: (msg: string, detail?: unknown) => void
): Promise<void> {
  const sensors = config.sensors;
  if (!sensors) return;

  for (const [sensorKey, deviceId] of Object.entries(sensors)) {
    if (!deviceId) continue;
    try {
      const device = await getDevice(deviceId);
      const lux = device.capabilitiesObj?.measure_luminance?.value;
      if (typeof lux === 'number' && Number.isFinite(lux)) {
        aggregator.recordReading(deviceId, lux, now);
      } else {
        log('lux sensor non-numeric reading', { sensor: sensorKey, deviceId, lux });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      error('lux sensor read failed', { sensor: sensorKey, deviceId, message });
    }
  }
}

describe('Lux sensor reading flow', () => {
  let aggregator: LuxAggregator;
  let logs: Array<{ msg: string; detail?: unknown }>;
  let errors: Array<{ msg: string; detail?: unknown }>;

  beforeEach(() => {
    aggregator = new LuxAggregator();
    logs = [];
    errors = [];
  });

  function makeConfig(sensors?: AppConfig['sensors']): AppConfig {
    return {
      version: '1.0.0',
      roles: [],
      phases: {
        NIGHT: { weekday: { conditions: [{ type: 'time', at: '00:00' }] }, weekend: { conditions: [{ type: 'time', at: '00:00' }] }, states: {} },
        MORNING: { weekday: { conditions: [{ type: 'time', at: '06:30' }] }, weekend: { conditions: [{ type: 'time', at: '07:30' }] }, states: {} },
        DAY: { weekday: { conditions: [{ type: 'time', at: '09:00' }] }, weekend: { conditions: [{ type: 'time', at: '10:00' }] }, states: {} },
        EVENING: { weekday: { conditions: [{ type: 'time', at: '18:00' }] }, weekend: { conditions: [{ type: 'time', at: '17:00' }] }, states: {} },
      },
      sensors,
    };
  }

  it('records readings from all configured sensors', async () => {
    const config = makeConfig({
      outdoor: 'dev-outdoor',
      indoor_downstairs: 'dev-down',
      indoor_upstairs: 'dev-up',
    });

    const getDevice = vi.fn(async (id: string) => {
      const values: Record<string, number> = {
        'dev-outdoor': 500,
        'dev-down': 45,
        'dev-up': 30,
      };
      return { capabilitiesObj: { measure_luminance: { value: values[id] } } };
    });

    const now = new Date('2024-01-01T12:00:00Z');
    await readLuxSensors(config, now, getDevice, aggregator, (m, d) => logs.push({ msg: m, detail: d }), (m, d) => errors.push({ msg: m, detail: d }));

    aggregator.tick(now);
    expect(aggregator.getSmoothedLux(now)).toBeCloseTo((500 + 45 + 30) / 3, 1);
    expect(getDevice).toHaveBeenCalledTimes(3);
  });

  it('skips missing sensor configs', async () => {
    const config = makeConfig({ outdoor: 'dev-outdoor' });
    const getDevice = vi.fn(async () => ({ capabilitiesObj: { measure_luminance: { value: 100 } } }));

    await readLuxSensors(
      config, new Date(), getDevice, aggregator,
      (m, d) => logs.push({ msg: m, detail: d }),
      (m, d) => errors.push({ msg: m, detail: d })
    );

    expect(getDevice).toHaveBeenCalledTimes(1);
    expect(getDevice).toHaveBeenCalledWith('dev-outdoor');
  });

  it('handles device read errors gracefully', async () => {
    const config = makeConfig({ outdoor: 'dev-outdoor', indoor_downstairs: 'dev-down' });
    const getDevice = vi.fn(async (id: string) => {
      if (id === 'dev-outdoor') throw new Error('timeout');
      return { capabilitiesObj: { measure_luminance: { value: 50 } } };
    });

    await readLuxSensors(
      config, new Date(), getDevice, aggregator,
      (m, d) => logs.push({ msg: m, detail: d }),
      (m, d) => errors.push({ msg: m, detail: d })
    );

    expect(errors).toHaveLength(1);
    expect(errors[0].msg).toBe('lux sensor read failed');
    expect((errors[0].detail as Record<string, string>).sensor).toBe('outdoor');
  });

  it('logs non-numeric lux readings', async () => {
    const config = makeConfig({ outdoor: 'dev-outdoor' });
    const getDevice = vi.fn(async () => ({ capabilitiesObj: { measure_luminance: { value: null } } }));

    await readLuxSensors(
      config, new Date(), getDevice, aggregator,
      (m, d) => logs.push({ msg: m, detail: d }),
      (m, d) => errors.push({ msg: m, detail: d })
    );

    expect(logs).toHaveLength(1);
    expect(logs[0].msg).toBe('lux sensor non-numeric reading');
    expect(errors).toHaveLength(0);
  });

  it('does nothing when sensors config is absent', async () => {
    const config = makeConfig();
    const getDevice = vi.fn();

    await readLuxSensors(
      config, new Date(), getDevice, aggregator,
      (m, d) => logs.push({ msg: m, detail: d }),
      (m, d) => errors.push({ msg: m, detail: d })
    );

    expect(getDevice).not.toHaveBeenCalled();
  });
});
