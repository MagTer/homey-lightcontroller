---
id: T01
parent: S05
milestone: M001
key_files:
  - src/lib/engine/LuxAggregator.ts — LuxAggregator class with recordReading, tick, getSmoothedLux, getDiagnostics
  - tests/engine/LuxAggregator.test.ts — 13 tests covering all specified cases
key_decisions:
  - Stale check boundary: `< staleAfterMs` (not `<=`) so a reading exactly at the boundary is considered stale — the 5-minute threshold was measured from reading age, not from recording time
  - Optional `now` on getSmoothedLux(): enables tests to pass explicit reference times; production callers can omit and get the original `new Date()` behavior
duration: 
verification_result: passed
completed_at: 2026-04-26T09:11:15.610Z
blocker_discovered: false
---

# T01: Built LuxAggregator with 3-reading rolling debounce, per-sensor stale detection (configurable threshold), and diagnostics surface

**Built LuxAggregator with 3-reading rolling debounce, per-sensor stale detection (configurable threshold), and diagnostics surface**

## What Happened

Created `src/lib/engine/LuxAggregator.ts` with `recordReading(sensorId, lux, at)`, `tick(now)`, `getSmoothedLux(now?)`, and `getDiagnostics(now)` methods. The rolling window is capped at 3 entries and only `tick()` mutates it. Cold-start: first reading adopted immediately via `freshReadings()` fallback when window is empty. Stale check uses strict `< staleAfterMs` so readings exactly at the boundary are excluded. The optional `now` param on `getSmoothedLux()` enables testability without requiring fake timers throughout. `getDiagnostics()` returns per-sensor `{ id, lastValue, lastSeenAgeMs, isStale }` plus `{ window, smoothed }`. Created `tests/engine/LuxAggregator.test.ts` covering all 7 required cases (cold start, transient spike suppression, sustained readings, sensor dropout, all-stale null, multi-sensor averaging, diagnostics) plus rolling window capacity and copy-safety checks — 13 tests total. All 48 tests in the suite pass.

## Verification

All 48 tests in suite pass. The 13 LuxAggregator tests cover cold-start (vi.useFakeTimers), transient spike suppression, sustained readings, sensor dropout with configurable threshold, all-sensors-stale null path, multi-sensor per-tick averaging, getDiagnostics output, and rolling window eviction.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npx vitest run tests/engine/LuxAggregator.test.ts` | 0 | ✅ pass | 194ms |
| 2 | `npx vitest run` | 0 | ✅ pass | 561ms |

## Deviations

Two deviations from the task plan: (1) `getSmoothedLux()` gained an optional `now` parameter instead of using wall-clock internally throughout — this was necessary because tests inject reference dates far from the real clock, making wall-clock staleness checks unreliable; (2) stale check uses strict `< staleAfterMs` (not `<=`) so a reading exactly at the boundary is treated as stale — the task plan was silent on this boundary condition.

## Known Issues

None.

## Files Created/Modified

- `src/lib/engine/LuxAggregator.ts — LuxAggregator class with recordReading, tick, getSmoothedLux, getDiagnostics`
- `tests/engine/LuxAggregator.test.ts — 13 tests covering all specified cases`
