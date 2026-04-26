# S02: Reconciler single-retry on transient failure

**Goal:** Add a single-retry path to Reconciler.setCapability calls so transient mesh-network failures are absorbed before being reported in failed[]. The retry uses a configurable retryDelayMs (default 200ms) that is independently tunable from the existing 50ms meshDelayMs, satisfies R009, and preserves R006's mesh-pacing guarantees.
**Demo:** Vitest fake-timer test in tests/engine/Reconciler.test.ts proves: (a) first setCapability fails, second succeeds after retryDelayMs → entry lands in applied[] with no failed[] entry; (b) both attempts fail → entry lands in failed[]; (c) success on first attempt → no extra delay observed; (d) the 50ms mesh delay still fires after the retry path completes. All cases observable through ReconcileResult.

## Must-Haves

- Vitest fake-timer test in tests/engine/Reconciler.test.ts proves: (a) first setCapability fails, second succeeds after retryDelayMs → entry lands in applied[] with no failed[] entry; (b) both attempts fail → entry lands in failed[]; (c) success on first attempt → no extra delay observed; (d) the 50ms mesh delay still fires after the retry path completes. All cases observable through ReconcileResult. Full Vitest suite (98 existing + new retry tests) and `npm run build` pass.

## Proof Level

- This slice proves: contract — slice proves a single-module behavior contract via unit tests. No real runtime / no human UAT required (Reconciler is fully exercised by injectable DeviceAPI mock).

## Integration Closure

Upstream surfaces consumed: existing DeviceAPI.setCapability contract — unchanged. New wiring introduced in this slice: none (no app-level integration; the change is internal to the Reconciler class). What remains: nothing for this slice — Reconciler is a leaf module already integrated by M001/S04 and the retry behavior is transparent to all callers.

## Verification

- Failed reconcile entries already carry { deviceId, roleId, capability, reason: 'error', message } — that surface remains the only observability signal. Transient failures (recovered by retry) are intentionally invisible: they land in applied[] like any other success. Persistent failures still surface message from the second-attempt error so an operator sees the actual root cause, not the swallowed first one. No new logging is introduced; the public ReconcileResult contract is unchanged.

## Tasks

- [x] **T01: Add retry helper and wire it through transition + maintenance paths with full Vitest coverage** `est:1.5h`
  Implement the single-retry resilience path inside Reconciler. Add an optional `retryDelayMs` field to `ReconcilerOptions` (default 200), store it on the instance, add a private `retryDelay()` method, and add a private generic `setCapabilityWithRetry<T extends 'onoff' | 'dim'>(deviceId, capability, value)` helper that calls `this.deviceApi.setCapability`, catches the first error, awaits `retryDelay()`, retries once, and re-throws on the second failure. Replace all four `await this.deviceApi.setCapability(...)` call sites in `handleTransitionMode` (lines 186 and 212) and `applyMaintenanceUpdate` (lines 382 and 409) with calls to the new helper. The surrounding try/catch blocks, the early `return` after onoff-failure (lines 206 and 402), the `await this.delay()` mesh-pacing call, and the existing `failed.push(...)` shape stay exactly as they are. Then extend `MockDeviceAPI` in tests/engine/Reconciler.test.ts with a `setCapabilityFailingOnce(deviceId, capability)` helper that fails on the first call for that (device, capability) pair and clears itself, so tests can simulate transient failure. Add a new `describe('retry on transient failure')` block inside the top-level `describe('Reconciler')` containing four tests:
  1. transition mode + transient onoff failure → after advancing fake timers by retryDelayMs, setCapability call count = 2, entry lands in `applied[]`, nothing in `failed[]`.
  2. transition mode + persistent onoff failure → setCapability call count = 2, entry lands in `failed[]`, message comes from the second-attempt error.
  3. maintenance mode (applyMaintenanceUpdate) + transient onoff failure → same as #1 but reached via the recovery path (establish state via prior MORNING reconcile, simulate manual change back to off so onoff needs update, then run reconcile under transient failure).
  4. configurable retryDelayMs → instantiate Reconciler with `retryDelayMs: 100`, advance timers by 99ms after the first failure: setCapability still at 1; advance another 2ms (101 total): setCapability now at 2.
Follow the existing fake-timer test pattern exactly: start the reconcile promise, `await vi.advanceTimersByTimeAsync(...)`, then `await` the promise, then assert. Keep `meshDelayMs` and `retryDelayMs` numerically distinct in tests (e.g. meshDelayMs: 10, retryDelayMs: 200) so timing assertions are unambiguous.
  - Files: `src/lib/engine/Reconciler.ts`, `tests/engine/Reconciler.test.ts`
  - Verify: npm run build && npm test -- tests/engine/Reconciler.test.ts

## Files Likely Touched

- src/lib/engine/Reconciler.ts
- tests/engine/Reconciler.test.ts
