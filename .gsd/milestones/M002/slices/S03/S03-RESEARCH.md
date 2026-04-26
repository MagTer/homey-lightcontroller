# S03: Eager config validation in onInit — Research

**Date:** 2026-04-26

## Summary

S03 adds eager config validation inside `onInit()` in `app.ts`. Currently `onInit()` (lines 70–81) only logs an initialisation message and registers flow cards — it never touches the settings store or validates any config. The requirement (R010) mandates that on every app start the stored config is read, parsed through the Zod schema, and if it is absent or invalid the app logs a critical error via `this.error(...)` and returns early, skipping the rest of initialisation.

The config parsing infrastructure is already fully in place. `parseConfig` (ConfigParser.ts line 13) throws `ConfigValidationError` on any Zod failure; `safeParseConfig` (line 24) wraps that into a `{ ok, config | error }` discriminated union that avoids try/catch boilerplate at the call site. `getConfigFromStore` in saveConfig.ts (line 9) retrieves the raw stored value as `AppConfig | null` without re-parsing — that is the correct first call in `onInit()`.

The public `getConfig()` method (app.ts lines 46–48) must not change. Its return type stays `AppConfig | null` and it continues to return the raw stored value without parsing. S03 is exclusively about what happens in `onInit()`, not about changing the getter.

## Recommendation

Use `safeParseConfig` inside `onInit()` rather than a bare `parseConfig` call wrapped in try/catch. The `safeParseConfig` path is already tested, produces a clean discriminated-union result, and avoids an awkward try/catch in a void async function. The updated `onInit()` should:

1. Call `getConfigFromStore(this.homey.settings as unknown as SettingsStore)` to retrieve the raw stored value.
2. If the result is `null`, call `this.error('onInit: no config found, skipping engine init')` and `return`.
3. Otherwise call `safeParseConfig(raw)`. If `result.ok === false`, call `this.error('onInit: invalid config', { issues: result.error.issues })` and `return`.
4. Only after a successful parse proceed with flow-card registration (the existing lines 73–80).

This sequencing makes the guard fail-fast: flow cards are registered only when a valid config exists. It matches the existing pattern established by `saveConfig()` (lines 54–68) where `this.error(...)` is called with a structured context object.

## Implementation Landscape

### Key Files

- `app.ts` — Current `onInit()` is lines 70–81. It logs one message then registers two flow cards. No config access occurs. Change needed: insert a guard block after line 71 (the `this.log('MyApp has been initialized')` call) that reads, parses, and validates the config before the flow-card registration block on lines 73–80. Imports of `safeParseConfig` and `SettingsStore` are already present (lines 2–8), so no new imports are required — `safeParseConfig` only needs to be added to the existing import on line 2 from `'./src/lib/config/ConfigParser.js'`.

- `src/lib/config/ConfigParser.ts` — Two relevant exports:
  - `parseConfig(raw: unknown): AppConfig` — throws `ConfigValidationError` on failure (line 13)
  - `safeParseConfig(raw: unknown): { ok: true; config: AppConfig } | { ok: false; error: ConfigValidationError }` — non-throwing wrapper (line 24); preferred for `onInit()` to avoid async try/catch noise

- `src/lib/config/saveConfig.ts` — `getConfigFromStore(store: SettingsStore): AppConfig | null` (line 9) returns the raw stored value as-is; already used by `getConfig()`. Call this first in `onInit()` to determine if a config exists at all before attempting parse.

### Build Order

1. Update the import on app.ts line 2 to also import `safeParseConfig` from `ConfigParser.js`.
2. Insert the guard block in `onInit()` between the initial `this.log(...)` call and the `this.homey.flow` block.
3. Add tests in a new file `tests/api/AppInit.test.ts` (following the Homey-SDK-free `TestableApp` pattern from `FlowCards.test.ts`) covering the four scenarios below.
4. Run `npm test` to confirm all 98 existing tests still pass plus the new ones.

### Verification Approach

Tests should use the same SDK-free `TestableApp` class pattern established in `tests/api/FlowCards.test.ts` — replicate the `onInit` logic directly in a test class with a stub `SettingsStore` and a captured `errors: string[]` array in place of `this.error(...)`.

Required test cases:

- **No config stored (cold start):** store returns `null` → `onInit` calls `this.error(...)` once and returns without registering flow cards.
- **Corrupted/invalid config in store:** store returns a malformed object → `safeParseConfig` returns `ok: false` → `this.error(...)` called with `issues` array, no flow-card registration.
- **Valid config in store:** store returns a well-formed config → `safeParseConfig` returns `ok: true` → no error logged, flow-card registration proceeds.
- **Error message content:** the error string logged on invalid config contains enough information (e.g., includes at least one Zod issue path/message) to be actionable in a Homey diagnostic log.

Use the `validConfig` fixture already defined in `tests/config/ConfigParser.test.ts` and `tests/api/AppSettings.test.ts` as the baseline for the "valid config" case.

## Common Pitfalls

- **Calling `parseConfig` instead of `safeParseConfig` in `onInit()`** — `onInit()` is `async` and a thrown exception from `parseConfig` would surface as an unhandled promise rejection at Homey's app-runner level, not a clean early-return. Always use `safeParseConfig` so the error path is an explicit `return`, not a throw.

- **Moving flow-card registration before the guard** — Flow cards must only be registered after the config guard passes. The current code registers them unconditionally; ensure the guard `return` statements sit above the `this.homey.flow` block.

- **Changing `getConfig()` return type or behaviour** — `getConfig()` must remain `AppConfig | null` and must continue to return raw stored value without parsing. S03 does not touch this method at all.

- **Adding a new import for `safeParseConfig` as a separate import line** — `ConfigParser.js` is already imported on line 2 (`parseConfig`) and line 3 (`ConfigValidationError`). Just add `safeParseConfig` to the existing named import on line 2 to keep imports tidy.

- **Testing with the real Homey SDK** — Homey SDK cannot be instantiated in unit tests. Always mirror the target logic in a local `TestableApp` class as done in `FlowCards.test.ts`, replacing `this.error(...)` / `this.log(...)` with captured arrays and stub stores.

## Constraints

- `getConfig()` public API must remain `AppConfig | null` — do NOT change it.
- `onInit()` must not throw; all error paths must be explicit `return` statements.
- Engine instantiation in `onInit` is explicitly out of scope for M002; S03 only adds the read + parse + log + early-return guard.
- The existing 98 passing tests must remain green after the change.
- Use `this.error(...)` (not `this.log(...)`) for all config-failure paths in `onInit()` — matches the pattern in `saveConfig()` (lines 62–64).
