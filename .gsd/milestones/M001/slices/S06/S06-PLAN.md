# S06: Settings UI

**Goal:** Wire the existing Config schema to a Homey settings UI so the user can pick devices for roles, save a validated config, and reload it.
**Demo:** Manual test: User can select devices and save a valid config.

## Must-Haves

- A user opening Homey app settings sees a working page (no stub `Hello` placeholder) that loads existing config and renders a role/device assignment form.
- `getConfig` returns the current persisted `AppConfig` (or `null` when unset) via `homey.app`.
- `saveConfig` rejects malformed input via `parseConfig` BEFORE writing to `this.homey.settings`, so persistent state never holds invalid config.
- `getDevices` returns `{ token, localUrl }` so the frontend can call the Homey Web API directly with the owner API token.
- `npx homey app validate` passes; `npx tsc --noEmit` is clean; `npm test` is green including a new `tests/api/AppSettings.test.ts`.
- ## Threat Surface
- **Abuse**: `saveConfig` accepts arbitrary JSON from the settings page. A malformed payload that bypasses validation would corrupt persistent state and crash the app on next reload. Mitigation: `parseConfig` runs server-side in `App.saveConfig` before `this.homey.settings.set('config', value)`. The frontend may also pre-validate but the backend is authoritative.
- **Data exposure**: `getDevices` returns the owner API token. This is by design — the settings page needs it to call the Homey Web API — but the token must never be written to `this.log`, telemetry, or error messages. `console.log(token)` is forbidden.
- **Input trust**: User-supplied role IDs, names, and device assignments flow through `saveConfig` into Zod's `AppConfigSchema`. All validation responsibility sits in `parseConfig`; no handler may write raw user input to settings.
- ## Requirement Impact
- **Requirements touched**: R002 (validated, owned by S05). Saving a config doesn't change the reconciliation loop, but it must continue to find a valid config — the new save path's validation gate preserves R002's invariant that a saved config parses cleanly.
- **Re-verify**: After this slice ships, manually load a previously-saved config on app restart and confirm the maintenance loop still ticks. No automated re-run of S05 tests required since the engine code is untouched.
- **Decisions revisited**: None. MEM002 (api.js as plain JS shim) continues to apply — we re-export from `.homeybuild/api.js`.
- ## Proof Level
- This slice proves: integration (real Homey runtime renders the settings page; api.ts handlers run inside Homey's API engine).
- Real runtime required: yes (settings page must load on a live Homey to verify).
- Human/UAT required: yes (frontend is only testable via the Homey app's settings tab).
- ## Observability / Diagnostics
- Runtime signals: `app.saveConfig` logs structured success/failure (`this.log('config saved', { version })` / `this.error('config save rejected', { issues })`). `app.getConfig` logs once on cold start when no config is present.
- Inspection surfaces: `homey app run --remote` console will show save/reject events; `this.homey.settings.get('config')` is the canonical persisted state.
- Failure visibility: validation errors include the Zod `issues` array so the user (and a future debugging agent) can see exactly which path was rejected.
- Redaction constraints: NEVER log the result of `getOwnerApiToken()` or include it in error messages. Logs of `getDevices` should record only the local URL, not the token.
- ## Integration Closure
- Upstream surfaces consumed: `src/lib/config/Config.ts`, `src/lib/config/ConfigParser.ts` (validation), `homey.settings` (persistence), `homey.api.getOwnerApiToken` / `getLocalUrl` (device fetch).
- New wiring introduced: `src/api.ts` handlers; `app.ts` `getConfig`/`saveConfig` methods; `api.js` re-export shim; `settings/index.html` real UI; `homey:manager:api` permission.
- What remains before the milestone is truly usable end-to-end: S07 (Flow cards + REST API) layers on top — phase change triggers and HTTP PUT for config updates.

## Proof Level

- This slice proves: integration

## Integration Closure

After this slice, the settings page is the single user-facing path to persist an `AppConfig`. The reconciler (S04) and lux/dimming logic (S05) already read config via `homey.settings`; this slice closes the loop on how that config gets written. Open: S07 will add Flow card triggers and a REST PUT for programmatic config updates; S08 covers store-readiness polish (icons, descriptions).

## Verification

- Adds structured logs in `App.saveConfig` (success with version, failure with Zod issues) and `App.getConfig` (one cold-start log when null). The owner API token returned by `getDevices` is sensitive and must never be logged or echoed in errors — a future agent debugging the settings page must inspect `this.homey.settings.get('config')` directly via `homey app run`, not by re-running the API handler with verbose logging.

## Tasks

- [x] **T01: Wire backend api.ts, App settings methods, and homey:manager:api permission** `est:2h`
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
  - Files: `src/api.ts`, `api.js`, `app.ts`, `.homeycompose/app.json`, `src/lib/config/saveConfig.ts`, `tests/api/AppSettings.test.ts`
  - Verify: npm test && npx tsc --noEmit && npx homey app validate --level publish

- [x] **T02: Build settings/index.html with role-based device picker calling /getConfig, /saveConfig, /getDevices** `est:2h`
  Replace `settings/index.html` (currently `<html><body>Hello</body></html>`) with a working settings page. The page is plain HTML/JS — no bundler — and runs inside the Homey settings iframe.

Depends on T01: requires `/getConfig`, `/saveConfig`, `/getDevices` endpoints to exist.

1. Top-level structure: a single `<html>` with a `<style>` block (vanilla CSS, no framework — Homey provides minimal default styling), a form region, and a `<script>` block containing the `onHomeyReady(Homey)` callback. The Homey global is injected by the settings host, NOT bundled, so do not import or require it.

2. Inside `onHomeyReady(Homey)`:
   - Call `Homey.ready()` to dismiss the loading spinner.
   - In parallel, fetch existing config via `Homey.api('GET', '/getConfig')` and the device-list credentials via `Homey.api('GET', '/getDevices')`.
   - Use the `{ token, localUrl }` from `getDevices` to call `fetch(${localUrl}/api/v2/devices, { headers: { Authorization: 'Bearer ' + token } })`. Filter the returned device list to those whose capabilities include `onoff` (devices without onoff cannot be controlled by this app and must not appear in the picker).
   - If `getConfig` returns `null`, render an empty form populated with default empty roles (`[]`) and an empty device map. Otherwise pre-fill from the loaded config's `roles` and `phases.NIGHT.states` (use NIGHT as the source-of-truth role list since every phase shares the same role IDs in V1).

3. Render UI:
   - A list of roles. Each row: text input for `name`, hidden field for `id` (slug-from-name on first creation, immutable thereafter), a multi-select of devices (checkboxes against the filtered onoff device list), and a Remove button.
   - An `Add role` button that appends a blank row.
   - A `Save` button that assembles an `AppConfig` from form state and calls `Homey.api('POST', '/saveConfig', config)`.

4. Save behavior:
   - V1 scope: the page edits roles and their device assignments only. Phase schedules and per-phase states are out of scope for the picker UI — pre-fill them from the loaded config if present, otherwise use a sensible default block (NIGHT/MORNING/DAY/EVENING with placeholder time conditions and `onoff:false` states for each role) so that `parseConfig` will accept the saved blob. Document this default in a `<!-- comment -->` near the assembly code.
   - On `Homey.api` success, call `Homey.alert('Saved!')`.
   - On error (the api.ts handler throws on Zod validation failure, which surfaces as a rejected promise with `err.message` containing the issues), call `Homey.alert('Save failed: ' + err.message)`.

5. Accessibility/polish: form inputs have visible labels; the device list is scrollable if long; Save button is disabled while a request is in flight.

6. Manual verification (this is the slice's UAT step — no automated browser test possible because the Homey global is server-injected):
   - Run `npx homey app run` to launch on a paired Homey.
   - Open the app's Settings tab in Homey's web UI.
   - Confirm: the device list loads (not empty if the Homey has any onoff devices), an existing saved config (if any) pre-populates roles, adding a role + assigning devices + Save shows `Saved!`, reloading the page shows the just-saved state.
   - Confirm error path: temporarily edit the script to send an invalid config (e.g. empty version string), click Save, confirm `Save failed: ...` alert.

7. Do NOT add a build step or bundler. The settings page is shipped as-is; Homey serves it from the `settings/` directory unchanged.

Pitfall: `Homey.api` paths in the Homey SDK v3 are matched against the keys in api.ts default export — `'GET', '/getConfig'` calls the `getConfig` handler. Do not prefix with `/api/` — that's reserved for the Homey Web API endpoint we hit separately for device listing.
  - Files: `settings/index.html`
  - Verify: test -s settings/index.html && grep -q onHomeyReady settings/index.html && grep -q /getConfig settings/index.html && grep -q /saveConfig settings/index.html && grep -q /getDevices settings/index.html && ! grep -q '<body>Hello</body>' settings/index.html

## Files Likely Touched

- src/api.ts
- api.js
- app.ts
- .homeycompose/app.json
- src/lib/config/saveConfig.ts
- tests/api/AppSettings.test.ts
- settings/index.html
