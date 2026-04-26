---
id: T02
parent: S06
milestone: M001
key_files:
  - settings/index.html
key_decisions:
  - Chose inline style block rather than importing a CSS file — Homey's settings iframe provides minimal default styling so no framework is needed
  - Stable role ids: once assigned, id is immutable; only the name field updates on edit. New roles get a timestamp-suffixed temp id that is reassigned to a slugified name on first name edit
  - Owner API token from getDevices is used only to call the Homey API for device listing — never logged or echoed in error messages
duration: 
verification_result: mixed
completed_at: 2026-04-26T10:01:40.951Z
blocker_discovered: false
---

# T02: Built settings/index.html with role-based device picker calling /getConfig, /saveConfig, /getDevices

**Built settings/index.html with role-based device picker calling /getConfig, /saveConfig, /getDevices**

## What Happened

Replaced the placeholder settings/index.html with a full working settings page. Built a plain HTML/JS page that calls Homey.api('GET', '/getConfig') and Homey.api('GET', '/getDevices') in parallel on load, then fetches the device list via the Homey API v2 using the owner token to filter devices with the onoff capability. The page renders each role as a card with a name input, hidden id field (slugified on first creation, immutable after), a scrollable checkbox list of onoff devices, and a Remove button. An Add Role button appends a new blank card. The Save button assembles a full AppConfig blob — including default phases (NIGHT/MORNING/DAY/EVENING with placeholder time conditions and onoff:false states for each role) — and POSTs to /saveConfig. On success it shows Homey.alert('Saved!'); on Zod validation failure (surfaced as a rejected promise) it shows Homey.alert('Save failed: ' + err.message). The Save button is disabled during in-flight requests. Form inputs have visible labels; the device list scrolls when long. No build step or bundler — the file ships as-is from the settings/ directory.

## Verification

Task verification passed: file exists with content, contains onHomeyReady, /getConfig, /saveConfig, /getDevices calls, and the Hello placeholder is removed. Homey app validate passes TypeScript compilation and structural checks; the only remaining publish-level failure is the pre-existing missing images property which predates this task.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `test -s settings/index.html && grep -q onHomeyReady settings/index.html && grep -q /getConfig settings/index.html && grep -q /saveConfig settings/index.html && grep -q /getDevices settings/index.html && ! grep -q '<body>Hello</body>' settings/index.html` | 0 | ✅ pass | 0ms |
| 2 | `npx homey app validate --level publish` | 1 | ⚠️  pre-existing images issue only | 0ms |

## Deviations

None — implemented exactly as specified. Used the NIGHT phase's states object as the source-of-truth role list for pre-fill (matching the task plan's guidance on V1 scope).

## Known Issues

None.

## Files Created/Modified

- `settings/index.html`
