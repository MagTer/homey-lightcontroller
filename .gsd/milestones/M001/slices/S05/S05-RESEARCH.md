# S05: Twilight & Lux Logic — Research

**Date:** 2026-04-26

## Summary

This slice implements "Twilight & Lux Logic", which requires two new features: a "3-reading debounce" for lux sensors to prevent rapid phase flapping when clouds pass over, and "dimming curves" to provide smooth transitions (twilight logic).

We will build a `LuxAggregator` to handle multi-sensor averaging and the 3-reading debounce logic. For dimming curves, we will introduce a pure function `DimmingCurve.calculate(...)` that determines adaptive dimming values or provides transition easing, and potentially update the `DeviceAPI` to support transition durations if the Homey platform supports it. 

## Recommendation

**Lux Debounce:** Implement a `LuxAggregator` class that takes readings from multiple sensors (by ID), averages them per "tick", and keeps a rolling window of the last 3 averages. The `getSmoothedLux()` method will return the average of the last 3 readings, acting as a low-pass filter.

**Dimming Curves:** Introduce a pure function to calculate dimming curves. Since the Reconciler directly sets target states (`dim: number`), a dimming curve can either be an interpolation function (e.g. mapping lux values to dimming levels between 0-1) or a temporal curve (adjusting dimming smoothly over a twilight period). To maintain the state machine's simplicity, the pure function should evaluate current context (time/lux) and return the desired `dim` target.

## Implementation Landscape

### Key Files

- `src/lib/engine/LuxAggregator.ts` (New) — Responsible for recording sensor readings, computing network-wide averages, and maintaining the 3-reading debounce.
- `tests/engine/LuxAggregator.test.ts` (New) — Vitest coverage proving the debounce logic ignores transient spikes (e.g., a lightning flash) and correctly handles missing/failing sensors.
- `src/lib/engine/DimmingCurve.ts` (New) — Pure functions for calculating dim levels based on twilight progress or lux values.
- `tests/engine/DimmingCurve.test.ts` (New) — Vitest coverage for dimming curve interpolation.
- `src/lib/engine/EvaluationContext.ts` — Will be updated to use `LuxAggregator.getSmoothedLux()` for its `lux` value.

### Build Order

1. **Build `LuxAggregator`** — Implement the 3-reading rolling average and sensor tracking. This is independent and unblocks the debounce requirement.
2. **Build `DimmingCurve`** — Implement the twilight/dimming curve pure functions.
3. **Integrate into Context** — Provide the smoothed lux and/or calculated dim values to the `PhaseEngine` and `Reconciler`.

### Verification Approach

- **Lux Debounce:** Vitest test injecting a transient high lux value into a sequence of low lux values, verifying the smoothed result doesn't trigger a phase change.
- **Dimming Curves:** Vitest test verifying the output curve interpolates smoothly from 0 to 1 over a given range or twilight period.
- No direct Homey SDK dependencies are needed for this logic, meaning standard Vitest unit tests provide full confidence.

## Common Pitfalls

- **Sensor Dropouts:** If a sensor goes offline, it shouldn't hold the average at a stale value. `LuxAggregator` should probably require a timestamp with readings and ignore readings older than X minutes.
- **Reboot Cold Start:** On startup, we won't have 3 readings yet. The `LuxAggregator` should instantly adopt the first reading as the smoothed value, then build the 3-reading buffer from there, avoiding a scenario where lights don't turn on for 3 minutes after a reboot.