---
estimated_steps: 24
estimated_files: 1
skills_used: []
---

# T02: Build settings/index.html with role-based device picker calling /getConfig, /saveConfig, /getDevices

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

## Inputs

- `settings/index.html`
- `src/api.ts`
- `src/lib/config/Config.ts`
- `.gsd/milestones/M001/slices/S06/S06-RESEARCH.md`

## Expected Output

- `settings/index.html`

## Verification

test -s settings/index.html && grep -q onHomeyReady settings/index.html && grep -q /getConfig settings/index.html && grep -q /saveConfig settings/index.html && grep -q /getDevices settings/index.html && ! grep -q '<body>Hello</body>' settings/index.html

## Observability Impact

Frontend errors surface to the user via `Homey.alert(err.message)`. Backend save failures log structured Zod issues (added in T01), so a debugging agent can correlate a failed user save to a specific schema violation by reading the Homey app log. No new backend logging in this task.
