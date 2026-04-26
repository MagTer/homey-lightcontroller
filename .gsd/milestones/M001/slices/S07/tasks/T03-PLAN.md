---
estimated_steps: 4
estimated_files: 2
skills_used: []
---

# T03: Add Vitest coverage for REST putPhase and flow action handler

Create two test files using the existing fake-Homey pattern from `tests/api/AppSettings.test.ts`.

`tests/api/RestApi.test.ts`: import the default export from `src/api.ts`, build a minimal `homey` mock with `app: { forcePhase: vi.fn() }`, and verify (a) valid phase string delegates to `app.forcePhase` with the same string and returns `{ ok: true, phase }`, (b) when `app.forcePhase` throws (simulating Zod rejection of an invalid phase) the error propagates, (c) missing `body` and missing `body.phase` both cause `app.forcePhase` to be called with `undefined` (the App is the single validation point — do NOT validate in the handler).

`tests/api/FlowCards.test.ts`: this slice extracts no pure helper for the flow listener — the listener is a 3-line closure inside `onInit()`. So instead of testing the closure indirectly, test the App's `forcePhase`/`getForcedPhase` contract end-to-end: valid phases set `_forcedPhase` and are observable via `getForcedPhase()`; invalid phases throw a `ZodError` and leave `_forcedPhase` unchanged from its prior value; calling `forcePhase('NIGHT')` then `forcePhase('DAY')` results in `getForcedPhase() === 'DAY'`. Use the same `Homey.App` instantiation pattern S06 used (or a thin App subclass that exposes the protected `homey` for injection if needed).

All new tests must pass alongside the existing 82 from S06.

## Inputs

- ``src/api.ts``
- ``app.ts``
- ``tests/api/AppSettings.test.ts``
- ``src/lib/config/Config.ts``

## Expected Output

- ``tests/api/RestApi.test.ts``
- ``tests/api/FlowCards.test.ts``

## Verification

npx vitest run tests/api/RestApi.test.ts tests/api/FlowCards.test.ts && npx vitest run

## Observability Impact

Negative-path tests assert that rejection logs do NOT contain raw user input beyond the offending phase value, protecting the redaction contract from T01.
