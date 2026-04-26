---
estimated_steps: 4
estimated_files: 3
skills_used: []
---

# T01: Declare flow card JSON files and add forcePhase state to App

Create the two `.homeycompose/flow/` JSON declarations (action `set_phase`, trigger `phase_changed`) and extend the App class with `_forcedPhase: Phase | null`, a typed `forcePhase(raw: unknown): Phase` setter, and a `getForcedPhase(): Phase | null` getter. The setter validates the raw input against `PhaseSchema.parse()` from `src/lib/config/Config.ts` so both REST and Flow paths share one validation point.

The action card needs id `set_phase`, a single argument named `phase` of type `dropdown` with the four hardcoded values (NIGHT, MORNING, DAY, EVENING) plus localized titles. The trigger card needs id `phase_changed` and one `string` token named `phase`. Use `dropdown` (not `autocomplete`) since the value set is fixed and small — `autocomplete` would require a registerArgumentAutocompleteListener and adds runtime complexity for no UX benefit.

Do NOT touch the root `app.json` — it is auto-generated from `.homeycompose/`. Do NOT register the cards in `onInit()` yet (that is T02's job). This task only adds the data files and pure App state so T02's wiring has something to call.

Log `forcePhase` calls via `this.log('forcePhase', { phase })` and log validation rejections via `this.error('forcePhase rejected', { raw })` — never echo full bodies.

## Inputs

- ``src/lib/config/Config.ts``
- ``app.ts``
- ``.homeycompose/app.json``

## Expected Output

- ``.homeycompose/flow/actions/set_phase.json``
- ``.homeycompose/flow/triggers/phase_changed.json``
- ``app.ts``

## Verification

npx tsc --noEmit && npx vitest run && npx homey app validate --level publish 2>&1 | grep -E 'set_phase|phase_changed|valid' || true

## Observability Impact

Adds two App.log entries (`forcePhase` accept, `forcePhase rejected`) and exposes `getForcedPhase()` as a synchronous inspection surface. No secret/PII risk — phase values are a 4-element enum.
