# S02: Reconciler single-retry on transient failure — Research

**Date:** 2026-04-26

## Summary

Slice S02 implements R009: transient-failure resilience for mesh-network device commands. The requirement calls for a single retry with a 200ms delay before any failed `setCapability` call is logged to `failed[]`. Currently, both `handleTransitionMode` (lines 177–234) and `applyMaintenanceUpdate` (lines 371–431) catch errors from `setCapability` and immediately push to `failed[]` after calling `this.delay()`. There is no retry; every first failure is treated as permanent.

The fix is purely additive: wrap each `setCapability` call in a private helper (e.g., `setCapabilityWithRetry`) that catches the first error, waits 200ms (using `setTimeout`/`this.delay` pattern), retries once, and only re-throws (or resolves the failure path) on the second failure. The `retryDelayMs` value should be configurable via `ReconcilerOptions` with a default of 200ms, keeping it distinct from `meshDelayMs` (50ms). The retry delay must be testable with `vi.useFakeTimers()` exactly as the existing mesh-delay tests do.

The change touches three places: the `ReconcilerOptions` interface, the `Reconciler` constructor, and a new private helper used by both `handleTransitionMode` and `applyMaintenanceUpdate`. No new public API surface is introduced; `ReconcileResult` entries and `FailedReconcileEntry` shape are unchanged.

## Recommendation

Introduce a private `setCapabilityWithRetry` method on `Reconciler` that encapsulates the try/delay/retry/throw pattern. Call it in place of every bare `this.deviceApi.setCapability(...)` call inside `handleTransitionMode` and `applyMaintenanceUpdate`. Store `retryDelayMs` as a private field initialised from `options.retryDelayMs ?? 200`. Do NOT reuse `this.delay()` for the retry wait — implement a dedicated `retryDelay()` private method using `this.retryDelayMs` so the two delays remain independently configurable and independently testable.

This approach is preferred over inline try/catch duplication because both methods share identical retry semantics, and centralising in one helper eliminates four near-identical catch blocks. It also makes unit-testing straightforward: the test advances timers by exactly `retryDelayMs` and asserts that `setCapability` was called twice.

## Implementation Landscape

### Key Files

- `src/lib/engine/Reconciler.ts` — The only production file that changes. Four locations need updating:
  1. **Lines 30–35** (`ReconcilerOptions` interface): add `retryDelayMs?: number` with JSDoc comment `/** Delay before single retry on transient failure (default: 200) */`.
  2. **Lines 56–58** (private fields): add `private retryDelayMs: number`.
  3. **Lines 70–74** (constructor): assign `this.retryDelayMs = options.retryDelayMs ?? 200`.
  4. **Lines 186–233** (`handleTransitionMode`) and **lines 382–430** (`applyMaintenanceUpdate`): replace each `await this.deviceApi.setCapability(...)` call with `await this.setCapabilityWithRetry(deviceId, capability, value)`. The surrounding try/catch structure and `failed.push(...)` logic stays; the helper throws on second failure so the existing catch blocks remain valid.
  5. Add new private methods at the bottom of the class (after `delay()`, before closing brace):
     - `private async retryDelay(): Promise<void>` — `setTimeout(resolve, this.retryDelayMs)`
     - `private async setCapabilityWithRetry<T extends 'onoff' | 'dim'>(deviceId, capability, value): Promise<void>` — calls `this.deviceApi.setCapability`, catches, calls `this.retryDelay()`, retries once, re-throws on second failure.

- `tests/engine/Reconciler.test.ts` — Add a new `describe('retry on transient failure')` block inside the top-level `describe('Reconciler')`. Tests to add:
  1. **transition mode, onoff transient**: configure `setCapabilityFailing` for `onoff` only on first call (needs a `MockDeviceAPI` helper `setCapabilityFailingOnce`), advance timers by `retryDelayMs` (200ms), assert `setCapability` was called twice, assert the entry lands in `applied[]` not `failed[]`.
  2. **transition mode, persistent failure**: configure `setCapabilityFailing` to always fail, advance timers, assert entry lands in `failed[]` and `setCapability` was called exactly twice.
  3. **maintenance mode (applyMaintenanceUpdate), transient onoff**: same pattern in maintenance context (phase unchanged, device has drifted back toward target).
  4. **configurable retryDelayMs**: instantiate with `retryDelayMs: 100`, assert that advancing only 99ms does not trigger retry completion, 101ms does.

  The `MockDeviceAPI` class needs a new helper `setCapabilityFailingOnce(deviceId, capability)` that removes the failure after the first throw, enabling the "succeeds on retry" scenario. This is a simple counter/set addition to the existing mock.

### Build Order

1. Update `ReconcilerOptions`, constructor field, and add `retryDelay()` private method — no behaviour change yet, compiles immediately.
2. Add `setCapabilityWithRetry()` private method.
3. Replace the four `this.deviceApi.setCapability(...)` call sites in `handleTransitionMode` and `applyMaintenanceUpdate` with `this.setCapabilityWithRetry(...)`.
4. Extend `MockDeviceAPI` with `setCapabilityFailingOnce`.
5. Add the new test cases.
6. Run `npm test` and `npm run build` to confirm green.

This order means the production change is complete and type-safe before any test is written, avoiding red-test confusion during development.

### Verification Approach

- `npm run build` (tsc) must pass with zero errors — the only new type surface is the optional `retryDelayMs` field.
- `npm test` (vitest with fake timers): each new test must advance fake timers by exactly `retryDelayMs` between the first failure and the retry assertion to prove the delay is real and observable.
- Manually confirm that existing tests for `mesh delay`, `error handling`, and `maintenance mode` still pass unchanged — the retry helper must not alter the `meshDelayMs` timing guarantees.
- `getCallCounts().setCapability` is the key assertion: transient failure = 2 calls, permanent failure = 2 calls, success = 1 call.

## Common Pitfalls

- **Reusing `this.delay()` for retry** — `meshDelayMs` defaults to 50ms and `retryDelayMs` defaults to 200ms. Using the same method would make the retry undetectable in tests that advance by 200ms but also silently break mesh pacing. Keep `retryDelay()` separate.
- **Forgetting the `return` after failed onoff in `handleTransitionMode`** — line 207 (`return; // Skip dim if onoff failed`) must remain. The retry helper throws on permanent failure; the enclosing catch still executes `return`. Do not remove it when refactoring.
- **`applyMaintenanceUpdate` onoff failure also returns early** — line 403 similarly has `return` after the onoff catch. Must be preserved.
- **Fake-timer advancement order** — `vi.advanceTimersByTimeAsync` must be awaited before checking call counts. The existing test pattern (start promise, advance timers, await promise) is the correct model; replicate it exactly.
- **`setCapabilityFailingOnce` must be thread-safe within the mock** — since tests run sequentially (no real concurrency), a simple `Set` that `delete`s on first throw is sufficient; no complex synchronisation needed.
- **Do not change `FailedReconcileEntry` shape** — S02 adds no new fields to result types. The reason remains `'error'` and the message comes from the second (retry) failure's `Error.message`.

## Constraints

- Only `src/lib/engine/Reconciler.ts` and `tests/engine/Reconciler.test.ts` are in scope; no other source or config files change.
- TypeScript strict mode must remain satisfied — the new generic signature of `setCapabilityWithRetry` must mirror `DeviceAPI.setCapability` exactly (same `T extends 'onoff' | 'dim'` constraint).
- All 98 existing tests must continue to pass; no test may be deleted or modified, only new tests added (except `MockDeviceAPI` additions which are purely additive).
- `retryDelayMs` default is exactly 200ms as specified by R009. Do not substitute a different default.
- The retry is exactly one retry (two total attempts). Do not implement exponential back-off or N-retry loops.
