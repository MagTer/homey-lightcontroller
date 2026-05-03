import Homey from 'homey';
import { parseConfig, safeParseConfig, type AppConfig } from './src/lib/config/ConfigParser.js';
import { ConfigValidationError } from './src/lib/config/ConfigParser.js';
import {
  getConfigFromStore,
  saveConfigToStore,
  type SettingsStore,
} from './src/lib/config/saveConfig.js';
import { Phase, PhaseSchema } from './src/lib/config/Config.js';
import { Reconciler } from './src/lib/engine/Reconciler.js';
import { HomeyDeviceAPI } from './src/lib/engine/HomeyDeviceAPI.js';
import { evaluatePhase, PHASE_ORDER } from './src/lib/engine/PhaseEngine.js';
import { buildEvaluationContext } from './src/lib/engine/EvaluationContext.js';
import { LuxAggregator } from './src/lib/engine/LuxAggregator.js';
import type { RoleDeviceMapping } from './src/lib/engine/DeviceAPI.js';

const TICK_INTERVAL_MS = 60_000;

export default class MyApp extends Homey.App {
  private _forcedPhase: Phase | null = null;
  private _phaseChangedTrigger!: Homey.FlowCardTrigger;
  private _reconciler!: Reconciler;
  private _tickInterval: ReturnType<typeof setInterval> | null = null;
  private _luxAggregator = new LuxAggregator();
  private _lastTransition: { from: Phase | null; to: Phase; at: string } | null = null;

  /**
   * Force the active phase to a specific value, bypassing automatic evaluation.
   * Validates the input against PhaseSchema, applies it to devices, and logs all attempts.
   */
  forcePhase(raw: unknown): Phase {
    let parsed: Phase;

    try {
      parsed = PhaseSchema.parse(raw);
    } catch (err) {
      this.error('forcePhase rejected', { raw });
      throw err;
    }

    this._forcedPhase = parsed;
    this.log('forcePhase', { phase: parsed });

    const config = this.getConfig();
    if (config) {
      this._applyPhase(parsed, config).catch(this.error);
    }

    return parsed;
  }

  /**
   * Get the current forced phase, if any.
   * Returns null when automatic phase evaluation is active.
   */
  getForcedPhase(): Phase | null {
    return this._forcedPhase;
  }

  /**
   * Get current runtime status for the settings page status panel.
   */
  getStatus(): {
    currentPhase: Phase | null;
    lux: Record<string, number | null>;
    lastTransition: { from: Phase | null; to: Phase; at: string } | null;
  } {
    const store = this.homey.settings as unknown as SettingsStore;
    const currentPhase = store.get('currentPhase') as Phase | null;
    const config = this.getConfig();
    const sensors = config?.sensors;
    const lux: Record<string, number | null> = {};

    if (sensors) {
      const now = new Date();
      const diagnostics = this._luxAggregator.getDiagnostics(now);
      for (const key of Object.keys(sensors)) {
        const sensor = diagnostics.sensors.find((s) => s.id === sensors[key as keyof typeof sensors]);
        lux[key] = sensor && !sensor.isStale ? sensor.lastValue : null;
      }
    }

    return {
      currentPhase,
      lux,
      lastTransition: this._lastTransition,
    };
  }

  /**
   * Returns the raw stored config, or null if never saved.
   * Does NOT parse — callers run parseConfig at their own boundary.
   */
  getConfig(): AppConfig | null {
    return getConfigFromStore(this.homey.settings as unknown as SettingsStore);
  }

  /**
   * Validates raw input via Zod, persists on success, logs outcome.
   * @throws ConfigValidationError if input is invalid.
   */
  saveConfig(raw: unknown): { version: string } {
    try {
      // parseConfig will throw ConfigValidationError on failure
      const store = this.homey.settings as unknown as SettingsStore;
      const result = saveConfigToStore(store, raw);
      this.log('config saved', { version: result.version });
      return result;
    } catch (e) {
      if (e instanceof ConfigValidationError) {
        this.error('config save rejected', { issues: e.issues });
        throw e;
      }
      throw e;
    }
  }

  /**
   * Build a RoleDeviceMapping from config.roles[].devices.
   */
  private _buildRoleDeviceMapping(config: AppConfig): RoleDeviceMapping {
    const mapping: RoleDeviceMapping = {};
    for (const role of config.roles) {
      if (role.devices && role.devices.length > 0) {
        mapping[role.id] = role.devices;
      }
    }
    return mapping;
  }

  /**
   * Apply a phase: fire the Flow trigger and reconcile devices to the target state.
   */
  private async _applyPhase(
    phase: Phase,
    config: AppConfig,
    previousPhase: Phase | null = null
  ): Promise<void> {
    await this._phaseChangedTrigger.trigger({ phase, previous_phase: previousPhase });
    const mapping = this._buildRoleDeviceMapping(config);
    await this._reconciler.reconcile(phase, config, mapping);
  }

  /**
   * Single evaluation tick: checks phase transitions and applies them.
   * Respects forced-phase override when set.
   */
  private async _readLuxSensors(config: AppConfig, now: Date): Promise<void> {
    const sensors = config.sensors;
    if (!sensors) return;

    for (const [sensorKey, deviceId] of Object.entries(sensors)) {
      if (!deviceId) continue;
      try {
        const device = await (this.homey.api as any).devices.getDevice({ id: deviceId });
        const lux = device.capabilitiesObj?.measure_luminance?.value;
        if (typeof lux === 'number' && Number.isFinite(lux)) {
          this._luxAggregator.recordReading(deviceId, lux, now);
        } else {
          this.log('lux sensor non-numeric reading', { sensor: sensorKey, deviceId, lux });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.error('lux sensor read failed', { sensor: sensorKey, deviceId, message });
      }
    }
  }

  private async _tick(): Promise<void> {
    const config = this.getConfig();
    if (!config) return;

    const now = new Date();
    const store = this.homey.settings as unknown as SettingsStore;
    let currentPhase: Phase | null = store.get('currentPhase') as Phase | null;
    const lastEvalTimeStr = store.get('lastEvalTime') as string | null;

    if (!currentPhase || !PHASE_ORDER.includes(currentPhase)) {
      currentPhase = 'NIGHT';
    }
    const lastEvalTime = lastEvalTimeStr ? new Date(lastEvalTimeStr) : new Date(0);

    // Read lux sensors before evaluation
    await this._readLuxSensors(config, now);

    // If a phase is forced, apply it immediately and skip automatic evaluation
    if (this._forcedPhase !== null) {
      if (this._forcedPhase !== currentPhase) {
        this.log('forced phase override', { from: currentPhase, to: this._forcedPhase });
        await this._applyPhase(this._forcedPhase, config, currentPhase);
        store.set('currentPhase', this._forcedPhase);
        store.set('lastEvalTime', now.toISOString());
      }
      return;
    }

    const geo = this.homey.geolocation;
    const ctx = buildEvaluationContext({
      aggregator: this._luxAggregator,
      now,
      latitude: geo.getLatitude(),
      longitude: geo.getLongitude(),
      countryCode: '',
    });

    const result = evaluatePhase(currentPhase, lastEvalTime, config, ctx);

    if (result.transitions.length > 0) {
      this.log('phase transition', {
        from: currentPhase,
        to: result.phase,
        transitions: result.transitions.map((t) => `${t.from}→${t.to}`),
      });
      this._lastTransition = {
        from: currentPhase,
        to: result.phase,
        at: now.toISOString(),
      };
      await this._applyPhase(result.phase, config, currentPhase);
    }

    store.set('currentPhase', result.phase);
    store.set('lastEvalTime', result.lastEvalTime.toISOString());
  }

  async onInit() {
    this.log('MyApp has been initialized');

    // Create device API and reconciler
    const deviceApi = new HomeyDeviceAPI(this.homey);
    this._reconciler = new Reconciler(deviceApi, {
      luxProvider: () => this._luxAggregator.getSmoothedLux(),
    });

    // Register Flow action card
    this.homey.flow
      .getActionCard('set_phase')
      .registerRunListener(async (args: { phase: Phase }) => {
        this.forcePhase(args.phase);
        return true;
      });

    // Register Flow condition card
    this.homey.flow
      .getConditionCard('is_phase')
      .registerRunListener(async (args: { phase: Phase }) => {
        const store = this.homey.settings as unknown as SettingsStore;
        const currentPhase = store.get('currentPhase') as Phase | null;
        return currentPhase === args.phase;
      });

    // Register Flow trigger card
    this._phaseChangedTrigger = this.homey.flow.getTriggerCard('phase_changed');

    const store = this.homey.settings as unknown as SettingsStore;

    const raw = getConfigFromStore(store);
    if (raw === null) {
      this.error('onInit: config missing from store; skip engine start');
      return;
    }

    const result = safeParseConfig(raw);
    if (!result.ok) {
      this.error('onInit: invalid config', { issues: result.error.issues });
      return;
    }

    // Start the evaluation engine
    this._tickInterval = this.homey.setInterval(() => {
      this._tick().catch(this.error);
    }, TICK_INTERVAL_MS);

    // Run an immediate tick so the app is responsive right after start
    this._tick().catch(this.error);

    this.log('Flow cards registered, engine started');
  }

  async onUninit() {
    if (this._tickInterval !== null) {
      this.homey.clearInterval(this._tickInterval);
      this._tickInterval = null;
    }
  }
}
