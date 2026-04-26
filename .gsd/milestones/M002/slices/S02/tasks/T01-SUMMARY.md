---
id: T01
parent: S02
milestone: M002
key_files:
  - src/lib/engine/Reconciler.ts
  - tests/engine/Reconciler.test.ts
key_decisions:
  - (none)
duration: 
verification_result: passed
completed_at: 2026-04-26T21:03:46.839Z
blocker_discovered: false
---

# T01: Add single-retry path to Reconciler.setCapability with configurable retryDelayMs (default 200ms) and full Vitest coverage

**Add single-retry path to Reconciler.setCapability with configurable retryDelayMs (default 200ms) and full Vitest coverage**

## What Happened

Implemented the single-retry resilience path inside Reconciler as specified. Added `retryDelayMs` option to `ReconcilerOptions` with default 200ms, stored it on the instance, and added the `retryDelay()` method. Created the generic `setCapabilityWithRetry<T>()` helper that catches the first error, awaits `retryDelay()`, retries once, and re-throws on second failure. Routed all four `setCapability` call sites through the new helper (lines ~186, ~212 in handleTransitionMode and lines ~382, ~409 in applyMaintenanceUpdate). Extended `MockDeviceAPI` with `setCapabilityFailingOnce(deviceId, capability)` helper that tracks once-per-pair transient failures. Added `describe('retry on transient failure')` block with 4 tests covering: (1) transition mode transient recovery → applied[] with no failed[] entry, (2) persistent failure → failed[] with message from second attempt, (3) maintenance mode recovery via applyMaintenanceUpdate path, and (4) configurable retryDelayMs timer gating. All original 11 tests plus 4 new retry tests pass (15 total). Build succeeds with no TypeScript errors.

## Verification

Build passes (`npm run build`) and all 15 tests pass (`npm test -- tests/engine/Reconciler.test.ts`).

Verification evidence:
- `retryDelayMs` option defaults to 200ms, independently tunable from `meshDelayMs`
- All 4 `setCapability` call sites route through `setCapabilityWithRetry()`
- `MockDeviceAPI.setCapabilityFailingOnce()` properly clears itself after first failure
- Transient failures: first call fails, delay passes, retry succeeds → entry in applied[]
- Persistent failures: both calls fail → entry in failed[] with message from second attempt
- The 50ms mesh delay still fires after retry path completes (existing tests unchanged)
- FailedReconcileEntry contract unchanged — no new logging introduced

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npm run build 2>&1` | 0 | ✅ pass | 2000ms |
| 2 | `npm test -- tests/engine/Reconciler.test.ts 2>&1` | 0 | ✅ pass | 300ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `src/lib/engine/Reconciler.ts`
- `tests/engine/Reconciler.test.ts`
