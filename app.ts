import Homey from 'homey';
import { parseConfig, type AppConfig } from './src/lib/config/ConfigParser.js';
import { ConfigValidationError } from './src/lib/config/ConfigParser.js';
import {
  getConfigFromStore,
  saveConfigToStore,
  type SettingsStore,
} from './src/lib/config/saveConfig.js';
import { Phase, PhaseSchema } from './src/lib/config/Config.js';

export default class MyApp extends Homey.App {
  private _forcedPhase: Phase | null = null;
  private _phaseChangedTrigger!: Homey.FlowCardTrigger;

  /**
   * Force the active phase to a specific value, bypassing automatic evaluation.
   * Validates the input against PhaseSchema and logs all attempts.
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

  async onInit() {
    this.log('MyApp has been initialized');

    this.homey.flow
      .getActionCard('set_phase')
      .registerRunListener(async (args: { phase: Phase }) => {
        this.forcePhase(args.phase);
        return true;
      });
    this._phaseChangedTrigger = this.homey.flow.getTriggerCard('phase_changed');
    this.log('Flow cards registered');
  }
}
