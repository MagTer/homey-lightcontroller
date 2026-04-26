# S07: Flow Cards & REST API

**Goal:** Expose the four-phase state machine via two external surfaces — a Homey Flow Action card ("Set Phase") and a REST endpoint (`PUT /phase`) — both routed into a single App-level `forcePhase()` setter, so users and Flows can override the active phase.
**Demo:** User can trigger phase changes via Flow or HTTP PUT.

## Must-Haves

- After this slice, an end user can pick "Set Phase → EVENING" from the Homey Flow editor and the App's `_forcedPhase` becomes `'EVENING'`; a `PUT /phase` request with `{ "phase": "NIGHT" }` to the app's API surface results in `_forcedPhase === 'NIGHT'`; invalid phase strings (REST or Flow argument) are rejected with a typed error before reaching App state. Validated via two new Vitest files (`tests/api/RestApi.test.ts`, `tests/api/FlowCards.test.ts`) plus `npx homey app validate --level publish`.

## Proof Level

- This slice proves: integration — proves both external surfaces (Flow and HTTP) wire correctly into App state via real handler functions; full Reconciler-loop consumption of `_forcedPhase` is deferred (not in S07 demo).

## Integration Closure

Upstream consumed: `PhaseSchema`/`Phase` from `src/lib/config/Config.ts`, existing `src/api.ts` handler pattern, root `api.js` shim. New wiring: `.homeycompose/flow/actions/set_phase.json`, `.homeycompose/flow/triggers/phase_changed.json`, action-card registration in `app.ts` `onInit()`, `putPhase` handler in `src/api.ts`. Remaining for milestone: S08 wires the trigger card to the actual reconciler loop and pre-publish polish.

## Verification

- App logs every `forcePhase()` call with the resolved phase; invalid phase attempts via REST/Flow log a structured rejection with the offending value (no PII risk — phase values are an enum). Inspection: `homey.app.getForcedPhase()` exposes current state; `app.json` (built) lists the registered flow cards as a structural surface.

## Tasks

- [x] **T01: Declare flow card JSON files and add forcePhase state to App** `est:45m`
  Create the two `.homeycompose/flow/` JSON declarations (action `set_phase`, trigger `phase_changed`) and extend the App class with `_forcedPhase: Phase | null`, a typed `forcePhase(raw: unknown): Phase` setter, and a `getForcedPhase(): Phase | null` getter. The setter validates the raw input against `PhaseSchema.parse()` from `src/lib/config/Config.ts` so both REST and Flow paths share one validation point.

The action card needs id `set_phase`, a single argument named `phase` of type `dropdown` with the four hardcoded values (NIGHT, MORNING, DAY, EVENING) plus localized titles. The trigger card needs id `phase_changed` and one `string` token named `phase`. Use `dropdown` (not `autocomplete`) since the value set is fixed and small — `autocomplete` would require a registerArgumentAutocompleteListener and adds runtime complexity for no UX benefit.

Do NOT touch the root `app.json` — it is auto-generated from `.homeycompose/`. Do NOT register the cards in `onInit()` yet (that is T02's job). This task only adds the data files and pure App state so T02's wiring has something to call.

Log `forcePhase` calls via `this.log('forcePhase', { phase })` and log validation rejections via `this.error('forcePhase rejected', { raw })` — never echo full bodies.
  - Files: `.homeycompose/flow/actions/set_phase.json`, `.homeycompose/flow/triggers/phase_changed.json`, `app.ts`
  - Verify: npx tsc --noEmit && npx vitest run && npx homey app validate --level publish 2>&1 | grep -E 'set_phase|phase_changed|valid' || true

- [x] **T02: Wire putPhase REST handler and register set_phase flow action listener** `est:30m`
  Add a `putPhase({ homey, body })` handler to `src/api.ts` following the exact loose-typing pattern established in S06 (`{ homey: any, body?: any }` per MEM022). The handler reads `body?.phase`, calls `homey.app.forcePhase(body?.phase)` (which validates internally — do NOT re-validate here), and returns `{ ok: true, phase }` on success. Let validation errors propagate; the Homey API engine will surface them as 400s.

In `app.ts` `onInit()`, register the action card: `this.homey.flow.getActionCard('set_phase').registerRunListener(async (args) => { this.forcePhase(args.phase); return true; })`. Also obtain a reference to the trigger card and store it as `private _phaseChangedTrigger` so future slices (S08+) can fire `phase_changed` tokens — but DO NOT fire it from S07 since there is no reconciler loop yet.

Flow card IDs in `getActionCard(...)` and `getTriggerCard(...)` must match the JSON `id` fields exactly (per S07-RESEARCH constraint). The root `api.js` shim already re-exports from `.homeybuild/api.js` per MEM020 — do not modify it.
  - Files: `src/api.ts`, `app.ts`
  - Verify: npx tsc --noEmit && npx vitest run && npx homey app validate --level publish

- [x] **T03: Add Vitest coverage for REST putPhase and flow action handler** `est:45m`
  Create two test files using the existing fake-Homey pattern from `tests/api/AppSettings.test.ts`.

`tests/api/RestApi.test.ts`: import the default export from `src/api.ts`, build a minimal `homey` mock with `app: { forcePhase: vi.fn() }`, and verify (a) valid phase string delegates to `app.forcePhase` with the same string and returns `{ ok: true, phase }`, (b) when `app.forcePhase` throws (simulating Zod rejection of an invalid phase) the error propagates, (c) missing `body` and missing `body.phase` both cause `app.forcePhase` to be called with `undefined` (the App is the single validation point — do NOT validate in the handler).

`tests/api/FlowCards.test.ts`: this slice extracts no pure helper for the flow listener — the listener is a 3-line closure inside `onInit()`. So instead of testing the closure indirectly, test the App's `forcePhase`/`getForcedPhase` contract end-to-end: valid phases set `_forcedPhase` and are observable via `getForcedPhase()`; invalid phases throw a `ZodError` and leave `_forcedPhase` unchanged from its prior value; calling `forcePhase('NIGHT')` then `forcePhase('DAY')` results in `getForcedPhase() === 'DAY'`. Use the same `Homey.App` instantiation pattern S06 used (or a thin App subclass that exposes the protected `homey` for injection if needed).

All new tests must pass alongside the existing 82 from S06.
  - Files: `tests/api/RestApi.test.ts`, `tests/api/FlowCards.test.ts`
  - Verify: npx vitest run tests/api/RestApi.test.ts tests/api/FlowCards.test.ts && npx vitest run

## Files Likely Touched

- .homeycompose/flow/actions/set_phase.json
- .homeycompose/flow/triggers/phase_changed.json
- app.ts
- src/api.ts
- tests/api/RestApi.test.ts
- tests/api/FlowCards.test.ts
