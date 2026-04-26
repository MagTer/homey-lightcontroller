# S04: Reconciler & Override Detection — UAT

**Milestone:** M001
**Written:** 2026-04-26T09:00:57.440Z

# S04: Reconciler & Override Detection — UAT

**Milestone:** M001
**Written:** 2026-04-26

## UAT Type

- UAT mode: artifact-driven
- Why this mode is sufficient: The core logic for drift detection and command pacing relies on precise timing and state interaction that is best verified in a deterministic, automated test environment with mocked hardware.

## Preconditions

- Environment with Node.js and npm installed.
- Repository dependencies installed (`npm install`).

## Smoke Test

`npm test` confirms all 35 tests (including 11 Reconciler tests) pass.

## Test Cases

### 1. Phase Transition Enforcement

1. Instantiate `Reconciler` and `MockDeviceAPI`.
2. Trigger `reconcile()` with a new phase (e.g., NIGHT).
3. **Expected:** Reconciler calls `setCapability` for every device mapped to roles in that phase. Result mode is `transition`.

### 2. Mesh Protection Pacing

1. Use `vi.useFakeTimers()`.
2. Trigger a reconcile with N commands.
3. Advance timers by `(N-1) * meshDelayMs`.
4. **Expected:** Commands are executed sequentially with the specified delay. All commands are complete only after the full duration has passed.

### 3. Manual Override Detection (Drift)

1. Perform an initial `reconcile` (transition to NIGHT).
2. Use `MockDeviceAPI.simulateManualChange` to toggle a device's power state manually.
3. Trigger `reconcile` again with the same phase (NIGHT).
4. **Expected:** Reconciler detects the drift, skips the device, and records an `override-skip` entry in the result.

### 4. Floating Point Epsilon Tolerance

1. Set a device's dim level to `0.5` via transition.
2. Simulate a slight drift to `0.5000001` (typical of 8-bit precision artifacts).
3. Trigger maintenance reconcile.
4. **Expected:** Reconciler treats this as a `no-op` within epsilon, NOT an override.

## Edge Cases

### Per-Device Error Isolation

1. Configure a device to throw an error on `setCapability`.
2. Trigger a transition reconcile.
3. **Expected:** The failing device is recorded in `failed[]`, but the Reconciler continues to process remaining devices in the queue.

## Failure Signals

- Test suite failures in `tests/engine/Reconciler.test.ts`.
- `failed[]` entries in `ReconcileResult` when running against real hardware (deferred to S08).

## Not Proven By This UAT

- Real-world Zigbee/Z-Wave network reliability (proves the delay is *sent*, not how the network reacts).
- Homey Web API integration (uses `DeviceAPI` mock).

