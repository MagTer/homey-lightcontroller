---
estimated_steps: 6
estimated_files: 2
skills_used: []
---

# T01: Add retry helper and wire it through transition + maintenance paths with full Vitest coverage

Implement the single-retry resilience path inside Reconciler. Add an optional `retryDelayMs` field to `ReconcilerOptions` (default 200), store it on the instance, add a private `retryDelay()` method, and add a private generic `setCapabilityWithRetry<T extends 'onoff' | 'dim'>(deviceId, capability, value)` helper that calls `this.deviceApi.setCapability`, catches the first error, awaits `retryDelay()`, retries once, and re-throws on the second failure. Replace all four `await this.deviceApi.setCapability(...)` call sites in `handleTransitionMode` (lines 186 and 212) and `applyMaintenanceUpdate` (lines 382 and 409) with calls to the new helper. The surrounding try/catch blocks, the early `return` after onoff-failure (lines 206 and 402), the `await this.delay()` mesh-pacing call, and the existing `failed.push(...)` shape stay exactly as they are. Then extend `MockDeviceAPI` in tests/engine/Reconciler.test.ts with a `setCapabilityFailingOnce(deviceId, capability)` helper that fails on the first call for that (device, capability) pair and clears itself, so tests can simulate transient failure. Add a new `describe('retry on transient failure')` block inside the top-level `describe('Reconciler')` containing four tests:
  1. transition mode + transient onoff failure → after advancing fake timers by retryDelayMs, setCapability call count = 2, entry lands in `applied[]`, nothing in `failed[]`.
  2. transition mode + persistent onoff failure → setCapability call count = 2, entry lands in `failed[]`, message comes from the second-attempt error.
  3. maintenance mode (applyMaintenanceUpdate) + transient onoff failure → same as #1 but reached via the recovery path (establish state via prior MORNING reconcile, simulate manual change back to off so onoff needs update, then run reconcile under transient failure).
  4. configurable retryDelayMs → instantiate Reconciler with `retryDelayMs: 100`, advance timers by 99ms after the first failure: setCapability still at 1; advance another 2ms (101 total): setCapability now at 2.
Follow the existing fake-timer test pattern exactly: start the reconcile promise, `await vi.advanceTimersByTimeAsync(...)`, then `await` the promise, then assert. Keep `meshDelayMs` and `retryDelayMs` numerically distinct in tests (e.g. meshDelayMs: 10, retryDelayMs: 200) so timing assertions are unambiguous.

## Inputs

- ``src/lib/engine/Reconciler.ts` — current Reconciler with handleTransitionMode and applyMaintenanceUpdate that already use try/catch around setCapability and await this.delay()`
- ``tests/engine/Reconciler.test.ts` — existing MockDeviceAPI with setCapabilityFailing, setDeviceFailing, getCallCounts and the fake-timer test pattern used by the mesh-delay describe block`
- ``src/lib/engine/DeviceAPI.ts` — DeviceAPI.setCapability generic signature that the new helper must mirror exactly`
- ``src/lib/engine/ReconcilerTypes.ts` — FailedReconcileEntry shape (unchanged by this slice)`
- ``.gsd/milestones/M002/slices/S02/S02-RESEARCH.md` — line-level guidance for where each edit lands`

## Expected Output

- ``src/lib/engine/Reconciler.ts` — modified: `ReconcilerOptions` gains optional `retryDelayMs` field, constructor stores `this.retryDelayMs = options.retryDelayMs ?? 200`, two new private methods (`retryDelay()` and `setCapabilityWithRetry<T>()`) added at the bottom of the class, four `setCapability` call sites in handleTransitionMode and applyMaintenanceUpdate routed through the retry helper`
- ``tests/engine/Reconciler.test.ts` — modified: MockDeviceAPI gains `setCapabilityFailingOnce(deviceId, capability)`, new top-level `describe('retry on transient failure')` block contains the four tests above, all 98 prior tests still pass`

## Verification

npm run build && npm test -- tests/engine/Reconciler.test.ts

## Observability Impact

No new structured signals — the slice deliberately keeps transient failures invisible (they look like any other success in `applied[]`). On persistent failure the existing FailedReconcileEntry surfaces the second-attempt error message, which is the operationally meaningful one (the first error is the one that triggered the retry; the second is the one that proves the device is actually down). A future agent diagnosing 'reconcile keeps reporting this device as failed' inspects `lastResult.failed[].message` exactly as before.
