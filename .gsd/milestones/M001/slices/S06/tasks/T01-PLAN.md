---
estimated_steps: 20
estimated_files: 6
skills_used: []
---

# T01: Wire backend api.ts, App settings methods, and homey:manager:api permission

Build the backend layer that the settings page will call. Three connected pieces, all in one task because they form one tested boundary.

1. Create `src/api.ts` exporting a default object with three handlers:
   - `async getConfig({ homey })` → returns `homey.app.getConfig()` (which may be `null`).
   - `async saveConfig({ homey, body })` → calls `homey.app.saveConfig(body)`; on success returns `{ ok: true, version: <savedVersion> }`; on validation error throws an Error whose message contains the Zod issues so Homey's API engine surfaces it as a 400-style response.
   - `async getDevices({ homey })` → returns `{ token: await homey.api.getOwnerApiToken(), localUrl: await homey.api.getLocalUrl() }`. Do NOT log the token.

   Type the handlers loosely (`{ homey: any; body?: unknown }`) — Homey's API engine doesn't ship strict types and over-typing fights the framework. This is the canonical pattern for SDK v3 ESM apps.

2. Replace the root `api.js` (currently `export default {};`) with `export { default } from "./.homeybuild/api.js";`. Note the `.homeybuild` path — `tsconfig.json` sets `outDir: "./.homeybuild"`, NOT `./build`. The test-app/api.js using `./build/api.js` is from a different tsconfig.

3. Extend `app.ts` with two methods on the App class:
   - `getConfig(): AppConfig | null` — returns `this.homey.settings.get('config')` (which is `null` on first run) without parsing. UI consumers handle the `null` case to render an empty form.
   - `saveConfig(raw: unknown): { version: string }` — runs `parseConfig(raw)` from `src/lib/config/ConfigParser.ts`. On success calls `this.homey.settings.set('config', parsed)` and `this.log('config saved', { version: parsed.version })`, then returns `{ version: parsed.version }`. On `ConfigValidationError` calls `this.error('config save rejected', { issues: e.issues })` and re-throws so the api.ts handler propagates a useful error message to the UI.

4. Edit `.homeycompose/app.json` to add `"permissions": ["homey:manager:api"]`. The compiled `app.json` at the repo root is generated from this file by the Homey CLI — do not edit the root `app.json` directly. Run `npx homey app build` (or `npx homey app validate`, which builds as a side effect) to regenerate.

5. Add a Vitest unit test at `tests/api/AppSettings.test.ts` that constructs a stub object exposing the same surface as the App's methods would consume (`{ settings: { get, set }, log, error }`) and exercises `saveConfig`/`getConfig` round-trip. Two strategies are acceptable, pick whichever produces less mocking noise:
   - (a) Extract the save/get logic into a small pure helper (e.g. `src/lib/config/saveConfig.ts` taking a `SettingsStore` interface) and unit-test the helper; have `app.ts` call into it. This is cleaner — recommended.
   - (b) Test the App class directly with a hand-rolled `homey` fake.

   Test cases the file MUST cover:
   - Round-trip: a valid `AppConfig` saved via `saveConfig` is returned identically by `getConfig`.
   - Validation: an invalid object (e.g. missing `phases.EVENING`) throws `ConfigValidationError` and the underlying settings store is NEVER written to.
   - Cold start: `getConfig` returns `null` when settings has no value (does not throw, does not return a default).

6. Verify the full chain: `npm test` green, `npx tsc --noEmit` clean, `npx homey app validate --level publish` passes (image issues are pre-existing — confirm validate does not regress on api.js / app.json structural errors).

Pitfall to avoid: do NOT run `parseConfig` inside `getConfig`. The reconciler (and tests) call `getConfig` and run `parseConfig` themselves at the boundary they care about; double-parsing would mask the case where a previously-stored-then-schema-changed config would crash on read instead of being recoverable.

## Inputs

- `src/lib/config/Config.ts`
- `src/lib/config/ConfigParser.ts`
- `app.ts`
- `api.js`
- `.homeycompose/app.json`
- `tsconfig.json`
- `.gsd/milestones/M001/slices/S06/S06-RESEARCH.md`

## Expected Output

- `src/api.ts`
- `api.js`
- `app.ts`
- `.homeycompose/app.json`
- `src/lib/config/saveConfig.ts`
- `tests/api/AppSettings.test.ts`

## Verification

npm test && npx tsc --noEmit && npx homey app validate --level publish

## Observability Impact

Adds two structured log statements: `this.log('config saved', { version })` on successful saves and `this.error('config save rejected', { issues })` on validation failures. The Zod issues array names the exact path of any rejected field, which is what a future debugging agent (or the user reading Homey's developer tools console) needs to localize a bad save without re-running the failing payload. Critical: the api.ts `getDevices` handler MUST NOT log the owner API token returned by `getOwnerApiToken()`. Logging only the localUrl is acceptable.
