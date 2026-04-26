---
estimated_steps: 1
estimated_files: 2
skills_used: []
---

# T01: Build LuxAggregator with 3-reading debounce and stale-sensor handling

Create a pure `LuxAggregator` class that records per-sensor lux readings with timestamps, computes a per-tick network average across non-stale sensors, maintains a 3-reading rolling window, and exposes `getSmoothedLux()` plus `getDiagnostics()`. Cold-start behavior: the first reading is adopted immediately as the smoothed value (no 3-tick warm-up). Sensor-dropout behavior: readings older than the configurable `staleAfterMs` (default 5 minutes) are excluded; if no fresh sensors remain, `getSmoothedLux()` returns `null`. Provide a `tick(now: Date)` method that snapshots the current per-sensor average into the rolling window — this is the only surface that mutates the window, so the engine can call it once per evaluation. Write the test file alongside it with cases covering: (a) cold start adopts first reading, (b) transient single-tick lightning spike does not move the smoothed value past a threshold, (c) sustained high readings eventually shift the smoothed value, (d) a sensor going stale stops contributing, (e) all sensors stale returns `null`, (f) multi-sensor averaging works per tick, (g) `getDiagnostics()` reports per-sensor ages and current window. Use `vi.useFakeTimers()` only if needed — most tests can pass `Date` instances directly to `recordReading(sensorId, lux, at)` and `tick(now)`. Do not modify any existing files in this task.

## Inputs

- ``src/lib/engine/EvaluationContext.ts``
- ``src/lib/engine/conditionEvaluators.ts``
- ``.gsd/milestones/M001/slices/S05/S05-RESEARCH.md``

## Expected Output

- ``src/lib/engine/LuxAggregator.ts``
- ``tests/engine/LuxAggregator.test.ts``

## Verification

npx vitest run tests/engine/LuxAggregator.test.ts

## Observability Impact

Adds `getDiagnostics()` returning `{ sensors: Array<{ id, lastValue, lastSeenAgeMs, isStale }>, window: number[], smoothed: number | null }`. A future agent debugging 'why didn't the lights respond to dusk?' can call this and immediately see whether sensors are reporting, whether readings are stale, and what the rolling window currently contains.
