import { parseConfig, type AppConfig } from './ConfigParser.js';
import { ConfigValidationError } from './ConfigParser.js';

export interface SettingsStore {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
}

export function getConfigFromStore(store: SettingsStore): AppConfig | null {
  return store.get('config') as AppConfig | null;
}

export function saveConfigToStore(store: SettingsStore, raw: unknown): { version: string } {
  const parsed = parseConfig(raw);
  store.set('config', parsed);
  return { version: parsed.version };
}

export function saveConfigToStoreResult(store: SettingsStore, raw: unknown):
  | { ok: true; version: string }
  | { ok: false; error: ConfigValidationError } {
  try {
    const { version } = saveConfigToStore(store, raw);
    return { ok: true, version };
  } catch (e) {
    if (e instanceof ConfigValidationError) {
      return { ok: false, error: e };
    }
    throw e;
  }
}
