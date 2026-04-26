# S07: S07: Flow Cards & REST API — UAT

**Milestone:** M001
**Written:** 2026-04-26T10:17:44.941Z

# S07: Flow Cards & REST API — UAT

**Milestone:** M001
**Written:** 2026-04-26

## UAT Type

- UAT mode: artifact-driven
- Why this mode is sufficient: The integration logic is fully covered by unit tests using mocked Homey SDK components, and the structural surface (JSON declarations) is verified by the Homey CLI validator.

## Preconditions

- App code is compiled to `.homeybuild/`.
- Vitest is available in the environment.

## Smoke Test

- Run `npx vitest tests/api/RestApi.test.ts` to confirm the REST endpoint delegates to the app and handles validation.

## Test Cases

### 1. REST API PUT /phase (Valid)

1. Call `putPhase` with `{ homey, body: { phase: 'EVENING' } }`.
2. **Expected:** Returns `{ ok: true, phase: 'EVENING' }` and `app.forcePhase` is called with `'EVENING'`.

### 2. Flow Action Card listener

1. Invoke the `registerRunListener` callback with `args.phase = 'DAY'`.
2. **Expected:** `app.getForcedPhase()` returns `'DAY'`.

### 3. REST API PUT /phase (Invalid)

1. Call `putPhase` with `{ homey, body: { phase: 'SUMMER' } }`.
2. **Expected:** Throws a `ZodError` as `'SUMMER'` is not a valid phase enum value.

## Edge Cases

### Undefined Body

1. Call `putPhase` with `{ homey, body: undefined }`.
2. **Expected:** Throws a `ZodError` (as `undefined` is passed to the validator), preventing state corruption.

## Failure Signals

- `npx vitest` failures in `tests/api/` indicate broken wiring or validation.
- `homey app validate` errors regarding `set_phase` or `phase_changed` indicate JSON schema violations in `.homeycompose/`.

## Not Proven By This UAT

- Actual execution on a Homey Pro hub (verified via SDK-level mocks instead).
- Reconciler-loop consumption of the forced phase (deferred to S08).

## Notes for Tester

- The publish-level validation error regarding missing images can be ignored as it is out of scope for this logic-focused slice.

