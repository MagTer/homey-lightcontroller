# S06: Settings UI — UAT

**Milestone:** M001
**Written:** 2026-04-26T10:02:41.755Z

# S06: Settings UI — UAT

**Milestone:** M001
**Written:** 2026-04-26

## UAT Type

- UAT mode: mixed (automated tests for backend + manual script for UI)
- Why this mode is sufficient: Backend logic is fully verified by Vitest; UI integration requires a live Homey runtime to verify Web API token usage and iframe rendering.

## Preconditions

- Homey Pro is paired and reachable via `npx homey app run`.
- Homey Pro has at least one device with the `onoff` capability.

## Smoke Test

Run `npx homey app run`, open the app settings in the Homey Web UI, and confirm the "Add Role" button adds a card with a list of available on-off devices.

## Test Cases

### 1. Save and Reload Valid Config

1. Open App Settings.
2. Click "Add Role", enter name "Window Lights".
3. Select one or more devices from the list.
4. Click "Save".
5. **Expected:** Alert says "Saved!". Reloading the page shows "Window Lights" with the correct devices pre-selected.

### 2. Role Identity Persistence

1. Create a role named "Morning Lights" and save it.
2. Change the name to "Morning Window Lights" and save it.
3. Reload the page.
4. **Expected:** The role ID (not visible in UI but used in save blob) remains the same as the slug derived from the original name ("morning-lights"), ensuring associations in phases (out of scope for this UI but present in config) are not broken.

### 3. Validation Gate

1. Use browser dev tools to set a role's name to an empty string (bypassing HTML5 validation if any).
2. Click "Save".
3. **Expected:** Alert says "Save failed: ..." with a Zod error message describing the invalid name field. Settings store is not updated.

## Edge Cases

### No OnOff Devices

1. Open App Settings on a Homey with no lights/switches.
2. **Expected:** The device list for roles is empty, but the page does not crash.

## Failure Signals

- Empty device list when lights exist (Token/Web API issue).
- "Saved!" followed by empty state on reload (Persistence/api.js issue).
- Red Zod error strings on a valid-looking save (Validation logic too strict).

## Not Proven By This UAT

- Phase scheduling (out of scope for V1 settings UI, uses defaults).
- Mobile app rendering (only tested in Web UI).

## Notes for Tester

- The page uses a default set of phases (NIGHT, MORNING, DAY, EVENING) with placeholder times to satisfy the Zod schema. These are not yet editable in the UI.
- The owner token is used in the browser only and never sent to the app backend except for the initial retrieval.
