---
estimated_steps: 3
estimated_files: 2
skills_used: []
---

# T02: Wire putPhase REST handler and register set_phase flow action listener

Add a `putPhase({ homey, body })` handler to `src/api.ts` following the exact loose-typing pattern established in S06 (`{ homey: any, body?: any }` per MEM022). The handler reads `body?.phase`, calls `homey.app.forcePhase(body?.phase)` (which validates internally — do NOT re-validate here), and returns `{ ok: true, phase }` on success. Let validation errors propagate; the Homey API engine will surface them as 400s.

In `app.ts` `onInit()`, register the action card: `this.homey.flow.getActionCard('set_phase').registerRunListener(async (args) => { this.forcePhase(args.phase); return true; })`. Also obtain a reference to the trigger card and store it as `private _phaseChangedTrigger` so future slices (S08+) can fire `phase_changed` tokens — but DO NOT fire it from S07 since there is no reconciler loop yet.

Flow card IDs in `getActionCard(...)` and `getTriggerCard(...)` must match the JSON `id` fields exactly (per S07-RESEARCH constraint). The root `api.js` shim already re-exports from `.homeybuild/api.js` per MEM020 — do not modify it.

## Inputs

- ``src/api.ts``
- ``app.ts``
- ``.homeycompose/flow/actions/set_phase.json``
- ``.homeycompose/flow/triggers/phase_changed.json``
- ``src/lib/config/Config.ts``

## Expected Output

- ``src/api.ts``
- ``app.ts``

## Verification

npx tsc --noEmit && npx vitest run && npx homey app validate --level publish

## Observability Impact

REST handler delegates to `forcePhase` so the existing log surface from T01 covers HTTP-path acceptances and rejections. Adds one onInit log line confirming flow card registration succeeded; failure to find the card throws synchronously and surfaces in Homey's app startup log.
