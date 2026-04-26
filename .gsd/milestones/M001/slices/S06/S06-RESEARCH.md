# S06: Settings UI — Research

**Date:** 2026-04-26
**Slice:** Manual test: User can select devices and save a valid config.

## Summary

S06 wires the existing `Config.ts`/`ConfigParser.ts` types to a browser-side settings page and a backend API layer. The app has no drivers — it controls other apps' devices via the Homey Web API. Device listing therefore requires fetching an owner API token (`this.homey.api.getOwnerApiToken()`) from within an `api.js` endpoint, then calling the Homey local REST API from the settings page frontend. Config persistence uses `this.homey.settings.set('config', value)` / `get('config')`.

The three moving parts are: (1) `src/api.ts` — TypeScript backend handlers for `getConfig`, `saveConfig`, and `getDevices`; (2) `settings/index.html` — vanilla HTML/JS settings page using the `onHomeyReady(Homey)` callback; (3) minor additions to `.homeycompose/app.json` (permissions) and `api.js` (re-export). The App class (`app.ts`) does not need significant changes — its role is to expose `getConfig`/`saveConfig` methods that delegate to `this.homey.settings`.

This is a well-understood pattern within the Homey SDK v3 ESM app. No new libraries or risky integrations.

## Recommendation

Build in three tasks in order:
1. `src/api.ts` + update `api.js` shim → enables backend endpoints
2. Extend `app.ts` with `getConfig`/`saveConfig` methods + add permission to `app.json`
3. `settings/index.html` → the frontend, testable only on a live Homey

## Implementation Landscape

### Key Files

- `src/lib/config/Config.ts` — Defines `AppConfigSchema` (Zod). The `AppConfig` type is what gets saved/loaded from settings. `RoleSchema` (id + name) is what the device picker populates.
- `src/lib/config/ConfigParser.ts` — `parseConfig(raw)` / `safeParseConfig(raw)`. The `saveConfig` endpoint should run this before persisting.
- `app.ts` — Extends `Homey.App`. Must gain `getConfig(): AppConfig | null` and `saveConfig(raw: unknown): void` methods; the api.ts handlers delegate to these via `homey.app`.
- `api.js` (root) — Currently `export default {};`. Must become `export { default } from "./.homeybuild/api.js";` to re-export the compiled TypeScript.
- `src/api.ts` (new) — TypeScript backend handlers. The `api.js` shim re-exports this file's compiled output.
- `.homeycompose/app.json` — Needs `"permissions": ["homey:manager:api"]` added so `getOwnerApiToken()` is available.
- `settings/index.html` — Currently a stub (`<html><body>Hello</body></html>`). Must be replaced with the real device picker + config form.

### api.ts Handler Shape

```typescript
// src/api.ts — compiled to .homeybuild/api.js, re-exported by root api.js
export default {
  async getConfig({ homey }: { homey: any }) {
    return homey.app.getConfig();
  },
  async saveConfig({ homey, body }: { homey: any; body: unknown }) {
    homey.app.saveConfig(body);
    return { ok: true };
  },
  async getDevices({ homey }: { homey: any }) {
    // Returns owner token so the frontend can call Homey Web API directly
    const token = await homey.api.getOwnerApiToken();
    const localUrl = await homey.api.getLocalUrl();
    return { token, localUrl };
  },
};
```

The settings page then does `fetch(`${localUrl}/api/v2/devices`, { headers: { Authorization: \`Bearer ${token}\` } })` to get all devices and their capabilities, filtering for ones with `onoff` capability.

### settings/index.html Pattern

```html
<script>
function onHomeyReady(Homey) {
  Homey.ready();
  // Load existing config
  Homey.api('GET', '/getConfig', {}).then(config => { /* populate form */ });
  // Load device list via API token
  Homey.api('GET', '/getDevices', {}).then(({ token, localUrl }) => {
    fetch(`${localUrl}/api/v2/devices`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.json()).then(devices => { /* populate device pickers */ });
  });
  // Save
  document.getElementById('save').addEventListener('click', () => {
    Homey.api('POST', '/saveConfig', configObj)
      .then(() => Homey.alert('Saved!'))
      .catch(err => Homey.alert('Error: ' + err.message));
  });
}
</script>
```

### Config Shape (What the UI Must Produce)

From `Config.ts`, a valid `AppConfig` requires:
- `version: string`
- `roles: Array<{ id: string; name: string }>` — each role maps a name to a set of devices
- `phases.NIGHT/MORNING/DAY/EVENING` — each with `weekday`, `weekend` (conditions), and `states` (record of roleId → `{ onoff, dim? }`)

For V1 the UI only needs to: (a) let the user name roles and assign devices to them, and (b) persist as JSON. Phase schedule editing is complex and out of scope for S06 — users can manually edit a JSON blob, or we provide pre-filled defaults and only expose the device-assignment piece.

### Build Order

1. **`src/api.ts` + fix `api.js`** — proves the backend wiring works (can validate with `npx homey app validate`).
2. **Extend `app.ts`** with `getConfig`/`saveConfig` + add `"permissions"` to `.homeycompose/app.json` + rebuild.
3. **`settings/index.html`** — device picker that calls `/getDevices`, renders role assignment, calls `/saveConfig`. Manual test on a live Homey (no unit test possible).

### Verification Approach

- `npx homey app validate` must pass (currently fails on images only — Settings tab itself is fine once `settings/index.html` is non-stub and `api.js` re-exports properly).
- `npx tsc --noEmit` must be clean after adding `src/api.ts` and extending `app.ts`.
- Manual test: Open Homey app settings, see device list, assign devices to roles, click Save, reload — confirm config persisted via `this.homey.settings.get('config')`.

## Constraints

- `api.js` (root) **must stay plain JavaScript** — it is a re-export shim only. All logic goes in `src/api.ts`.
- No Homey driver in this app — device enumeration goes through the Homey Web API REST endpoint, not `this.homey.drivers.getDrivers()`.
- `settings/index.html` must use the `onHomeyReady(Homey)` callback pattern — the `Homey` global is injected by the Homey web server, not bundled.
- `getOwnerApiToken()` requires the `homey:manager:api` permission in `app.json` — without it the call throws.
- ESM app (`"esm": true` in app.json): `api.js` must use ES module `export`, not `module.exports`.

## Common Pitfalls

- **`api.js` shim path** — The compiled output lands in `.homeybuild/`, not `./build/`. Use `export { default } from "./.homeybuild/api.js"`. (test-app uses `./build/api.js` — different project; ours sets `"outDir": "./.homeybuild"` in tsconfig.)
- **`getOwnerApiToken` without permission** — Silent failure at validate time but runtime crash. Must add `"homey:manager:api"` to `.homeycompose/app.json` permissions array before testing.
- **Config defaults** — `parseConfig` will reject a config with no roles or phases. The `saveConfig` handler must validate before writing; a save of partial UI state must be prevented or the app will crash on load.
- **`this.homey.settings.get('config')` returns `null` on first run** — `getConfig` in App must handle `null` gracefully and return a sensible empty state to the UI.

## Open Risks

- Device listing via Homey Web API requires the Homey hub to be on the same LAN as the browser; testing in Homey Cloud emulation won't exercise real device fetch.
- If the user has many devices (100+) the fetch-all-devices approach may be slow; V1 scope accepts this.
