# S05: S05: Twilight & Lux Logic — UAT

**Milestone:** M001
**Written:** 2026-04-26T09:35:02.566Z

# S05: Twilight & Lux Logic — UAT

**Milestone:** M001
**Written:** 2026-04-26

## UAT Type

- UAT mode: artifact-driven
- Why this mode is sufficient: This slice implements pure logic and interpolation helpers which are best verified via automated test suites covering edge cases and mathematical boundaries.

## Preconditions

- Vitest and TypeScript environments are configured.

## Smoke Test

`npx vitest run tests/engine/LuxDebounceIntegration.test.ts` - Confirms that the end-to-end integration of lux smoothing into the phase engine works.

## Test Cases

### 1. Transient Lux Spike Suppression

1. Record 2 readings of 10 lux.
2. Record 1 reading of 500 lux (transient spike).
3. Evaluate phase with a transition threshold of 200 lux.
4. **Expected:** Phase remains unchanged (smoothed lux ~173).

### 2. Sustained Lux Transition

1. Record 3 readings of 500 lux.
2. Evaluate phase with a transition threshold of 100 lux.
3. **Expected:** Phase transitions to MORNING with reason 'lux'.

### 3. Sensor Dropout / Staleness

1. Record a reading for Sensor A.
2. Advance time by 6 minutes (default stale limit is 5 mins).
3. Evaluate smoothed lux.
4. **Expected:** Returns `null` and diagnostic reports sensor as stale.

## Edge Cases

### Zero-Span Dimming

1. Configure a `luxToDim` curve with `brightLux: 500` and `darkLux: 500`.
2. Input lux 500.
3. **Expected:** Returns `0.5` (midpoint).

### NaN/Infinity Handling

1. Input `NaN` or `Infinity` to `luxToDim`.
2. **Expected:** Returns `0` (safe default).

## Failure Signals

- `npx vitest` failures in the `engine/` directory.
- `getSmoothedLux()` returning `null` despite fresh sensor data being present in `recordReading`.

## Not Proven By This UAT

- Real-world sensor noise patterns (simulated via tests).
- Homey SDK runtime behavior (out of scope for this pure logic slice).
