# S02: S02 — UAT

**Milestone:** M002
**Written:** 2026-04-26T21:04:21.655Z

# S02: Reconciler single-retry on transient failure — UAT

**Milestone:** M002
**Written:** 2026-04-26

## UAT Type

- UAT mode: artifact-driven
- Why this mode is sufficient: The Reconciler logic is fully decoupled from the Homey runtime via the DeviceAPI abstraction. Unit tests with fake timers provide deterministic proof of timing and retry behavior that would be difficult to reproduce consistently in a live environment.

## Preconditions

- Node.js environment is set up.
- Dependencies are installed (`npm install`).

## Smoke Test

Run the Reconciler test suite: `npm test -- tests/engine/Reconciler.test.ts`. All 15 tests must pass.

## Test Cases

### 1. Transient Failure Recovery

1. Simulate a reconcile event where a device's `setCapability` fails on the first call but succeeds on the second.
2. Advance timers by `retryDelayMs` (200ms).
3. **Expected:** The device entry is found in the `applied[]` array of the `ReconcileResult`, and the `failed[]` array is empty. The `DeviceAPI` call count for that capability is 2.

### 2. Persistent Failure Reporting

1. Simulate a reconcile event where a device's `setCapability` fails on both the first and second calls.
2. Advance timers twice by `retryDelayMs`.
3. **Expected:** The device entry is found in the `failed[]` array with the error message from the second attempt.

### 3. Configurable Retry Delay

1. Instantiate `Reconciler` with `retryDelayMs: 500`.
2. Simulate a transient failure.
3. Advance timers by 499ms.
4. **Expected:** The second `setCapability` call has not yet been made.
5. Advance timers by another 2ms.
6. **Expected:** The second `setCapability` call is made and succeeds.

### 4. Mesh Pacing Integrity (R006)

1. Simulate a reconcile involving two devices, where the first device requires a retry.
2. **Expected:** The total time elapsed before the second device's first command is at least `retryDelayMs` + 50ms (mesh delay).

## Edge Cases

### Multiple Retries in One Reconcile

1. Run a reconcile with multiple devices failing transients.
2. **Expected:** Each device independently retries once and eventually succeeds, landing in `applied[]`.

## Failure Signals

- `ReconcileResult` contains entries in `failed[]` for failures that should have been recovered.
- Mesh saturation errors (if tested in live environment) due to missing 50ms delay.
- Tests fail to advance timers correctly, indicating a hang in the retry logic.

## Not Proven By This UAT

- Real-world mesh performance improvements (requires physical hardware and long-term monitoring).
- Interaction with other Homey apps during high mesh traffic.

## Notes for Tester

The `retryDelayMs` is intentionally much larger than `meshDelayMs` (200ms vs 50ms) to ensure they are easily distinguishable in trace logs and tests.
