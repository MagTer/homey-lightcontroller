# S05: Twilight & Lux Logic

**Goal:** Implement a 3-reading lux debounce (LuxAggregator) and pure dimming-curve interpolation (DimmingCurve), then wire smoothed lux into EvaluationContext so transient lux spikes (clouds, lightning) cannot trigger phase changes.
**Demo:** Vitest verifies the 3-reading debounce and dimming curves.

## Must-Haves

- `LuxAggregator` records timestamped per-sensor readings, computes per-tick averages across active sensors, maintains a 3-reading rolling window, and exposes `getSmoothedLux(): number | null`.
- On cold start (first reading), `getSmoothedLux()` returns that first reading immediately (no 3-tick warm-up dead zone).
- Stale readings (older than a configurable TTL) are excluded from the per-tick average; if all sensors are stale or missing, `getSmoothedLux()` returns `null`.
- `DimmingCurve` exports pure interpolation helpers: a linear lux→dim curve over a configurable lux range, and a temporal twilight curve that ramps a `dim` value across a start/end timestamp window. Outputs are clamped to [0, 1].
- A new helper `buildEvaluationContext` constructs an `EvaluationContext` whose `lux` field is the aggregator's smoothed value (preserving the existing `lux: number | null` contract — `evaluateLux` and `evaluatePhase` are unchanged).
- All existing 35 tests still pass; new tests for `LuxAggregator`, `DimmingCurve`, and the integration scenario pass; `tsc` compiles cleanly.

## Proof Level

- This slice proves: Contract — pure-function unit tests with full Vitest coverage. No real Homey runtime required (the slice deliberately keeps lux smoothing and dimming curves SDK-free per the research doc). Human/UAT not required.

## Integration Closure

- Upstream surfaces consumed: `src/lib/engine/EvaluationContext.ts` (the `lux: number | null` field), `src/lib/config/Config.ts` (no schema changes needed for this slice).
- New wiring introduced in this slice: a `buildEvaluationContext(aggregator, now, latitude, longitude, countryCode, logger?)` helper in `src/lib/engine/EvaluationContext.ts` that bridges the aggregator into the existing context shape.
- What remains before the milestone is truly usable end-to-end: S06 wires this into the Homey app's settings/runtime, S07 exposes Flow cards and REST. This slice does not yet hook the aggregator into a live `app.ts` tick loop — that integration belongs to S06/S07.

## Verification

- Runtime signals: `LuxAggregator` exposes `getDiagnostics()` returning per-sensor reading age, sensor count, and current rolling-window contents — sufficient for a future agent to see why smoothed lux is null or stale.
- Inspection surfaces: structured object returned by `getDiagnostics()`; future settings UI / REST surface (S07) can render it.
- Failure visibility: when all sensors are stale, `getSmoothedLux()` returns `null` (matching the existing contract); diagnostics surface the per-sensor ages so the cause is unambiguous.
- Redaction constraints: none — lux readings and timestamps are not sensitive.

## Tasks

- [x] **T01: Build LuxAggregator with 3-reading debounce and stale-sensor handling** `est:1h`
  Create a pure `LuxAggregator` class that records per-sensor lux readings with timestamps, computes a per-tick network average across non-stale sensors, maintains a 3-reading rolling window, and exposes `getSmoothedLux()` plus `getDiagnostics()`. Cold-start behavior: the first reading is adopted immediately as the smoothed value (no 3-tick warm-up). Sensor-dropout behavior: readings older than the configurable `staleAfterMs` (default 5 minutes) are excluded; if no fresh sensors remain, `getSmoothedLux()` returns `null`. Provide a `tick(now: Date)` method that snapshots the current per-sensor average into the rolling window — this is the only surface that mutates the window, so the engine can call it once per evaluation. Write the test file alongside it with cases covering: (a) cold start adopts first reading, (b) transient single-tick lightning spike does not move the smoothed value past a threshold, (c) sustained high readings eventually shift the smoothed value, (d) a sensor going stale stops contributing, (e) all sensors stale returns `null`, (f) multi-sensor averaging works per tick, (g) `getDiagnostics()` reports per-sensor ages and current window. Use `vi.useFakeTimers()` only if needed — most tests can pass `Date` instances directly to `recordReading(sensorId, lux, at)` and `tick(now)`. Do not modify any existing files in this task.
  - Files: `src/lib/engine/LuxAggregator.ts`, `tests/engine/LuxAggregator.test.ts`
  - Verify: npx vitest run tests/engine/LuxAggregator.test.ts

- [x] **T02: Implement DimmingCurve pure interpolation helpers** `est:45m`
  Create `src/lib/engine/DimmingCurve.ts` exporting two pure functions: `luxToDim({ lux, brightLux, darkLux, brightDim, darkDim })` returning a clamped [0,1] dim value linearly interpolated so `lux >= brightLux` maps to `brightDim` (typically 0) and `lux <= darkLux` maps to `darkDim` (typically 1). And `twilightCurve({ now, startAt, endAt, startDim, endDim })` returning a clamped [0,1] dim value linearly interpolated across the temporal window so `now <= startAt` returns `startDim`, `now >= endAt` returns `endDim`, and values in between are linearly mixed. Both functions must: handle inverted ranges (e.g. `darkLux > brightLux`) consistently, clamp output to [0,1], and reject NaN/Infinity inputs by returning the closer-clamped boundary. Edge cases: when `startAt === endAt`, return `endDim` if `now >= startAt` else `startDim` (no division-by-zero). Write the test file with cases covering: (a) `luxToDim` boundary values, (b) `luxToDim` midpoint interpolation, (c) `luxToDim` clamping outside range, (d) `twilightCurve` before/after window, (e) `twilightCurve` midpoint interpolation, (f) `twilightCurve` zero-length window, (g) `luxToDim` with inverted range. These are pure functions — no timers, no IO, no dependencies beyond the input objects. Do not modify any existing files in this task.
  - Files: `src/lib/engine/DimmingCurve.ts`, `tests/engine/DimmingCurve.test.ts`
  - Verify: npx vitest run tests/engine/DimmingCurve.test.ts

- [x] **T03: Wire LuxAggregator into EvaluationContext and prove debounce blocks transient phase changes** `est:45m`
  Add a `buildEvaluationContext` factory to `src/lib/engine/EvaluationContext.ts` with signature `buildEvaluationContext(args: { aggregator: LuxAggregator; now: Date; latitude: number; longitude: number; countryCode: string; logger?: Logger }): EvaluationContext`. The factory calls `aggregator.tick(args.now)` and then returns an `EvaluationContext` whose `lux` field is `aggregator.getSmoothedLux()`. Do NOT modify the `EvaluationContext` interface itself — `lux: number | null` already accommodates the smoothed value. Do NOT modify `evaluateLux` or `evaluatePhase` — they continue to consume `ctx.lux` exactly as before. Then write `tests/engine/LuxDebounceIntegration.test.ts` that builds a minimal `AppConfig` with a single lux-triggered phase transition (e.g. NIGHT→MORNING when `lux > 100`), and proves: (a) a single transient spike (one tick at lux 500 surrounded by ticks at lux 10) does NOT trigger a phase change because the smoothed value stays low, (b) sustained bright readings (3+ ticks at lux 500) DO trigger the transition once the smoothed value crosses the threshold. Use the real `evaluatePhase` and a real `LuxAggregator` — this is the integration proof that the smoothing actually filters transients in the engine pipeline. Run the full test suite at the end to verify no regressions.
  - Files: `src/lib/engine/EvaluationContext.ts`, `tests/engine/LuxDebounceIntegration.test.ts`
  - Verify: npx vitest run && npx tsc --noEmit

## Files Likely Touched

- src/lib/engine/LuxAggregator.ts
- tests/engine/LuxAggregator.test.ts
- src/lib/engine/DimmingCurve.ts
- tests/engine/DimmingCurve.test.ts
- src/lib/engine/EvaluationContext.ts
- tests/engine/LuxDebounceIntegration.test.ts
