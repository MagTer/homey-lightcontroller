---
id: T03
parent: S05
milestone: M001
key_files:
  - src/lib/engine/EvaluationContext.ts
  - tests/engine/LuxDebounceIntegration.test.ts
key_decisions:
  - buildEvaluationContext is the single seam where LuxAggregator enters the PhaseEngine — aggregator.tick() called before getSmoothedLux() so cold-start readings are adopted immediately without waiting for a tick; stale check uses < staleAfterMs (not <=) so a reading exactly at the boundary is considered stale — consistent with LuxAggregator's own staleCheck boundary
duration: 
verification_result: mixed
completed_at: 2026-04-26T09:33:47.603Z
blocker_discovered: false
---

# T03: Wired LuxAggregator into PhaseEngine via buildEvaluationContext factory; 6 integration tests prove debounce blocks transient phase changes

**Wired LuxAggregator into PhaseEngine via buildEvaluationContext factory; 6 integration tests prove debounce blocks transient phase changes**

## What Happened

Added buildEvaluationContext() factory to EvaluationContext.ts — it calls aggregator.tick(args.now) then injects aggregator.getSmoothedLux(args.now) as ctx.lux. The EvaluationContext interface required no changes since lux: number | null already accommodates the smoothed value. No engine internals were modified; evaluateCondition and evaluatePhase consume ctx.lux unchanged.

The integration test suite (LuxDebounceIntegration.test.ts) covers: (a) a single 500-lux spike in a window of three readings averages to ~173, staying below the 200-lux threshold, so NIGHT→MORNING does not fire; (b) three consecutive 500-lux readings average to 500, crossing the 100-lux threshold and triggering the transition with reason: 'lux'; (c) null lux when the aggregator has no readings; (d) sensor dropout staleness does not retroactively invalidate the already-committed rolling window entries; (e) buildEvaluationContext correctly calls tick() before getSmoothedLux() so a pre-recorded reading appears in ctx.lux via cold-start adoption.

No TypeScript errors were introduced — the only pre-existing tsc error is in DimmingCurve.test.ts (missing .js import extension, unrelated to this task).

## Verification

npx vitest run: 73 tests across 7 test files passed (6 new integration tests + 67 existing). npx tsc --noEmit: pre-existing error in DimmingCurve.test.ts only (missing .js extension), no new errors introduced. The new EvaluationContext.ts compiles cleanly.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npx vitest run` | 0 | ✅ pass | 800ms |
| 2 | `npx tsc --noEmit` | 2 | ❌ fail (pre-existing, DimmingCurve.test.ts only) | 5000ms |
| 3 | `npx vitest run tests/engine/LuxDebounceIntegration.test.ts` | 0 | ✅ pass | 356ms |

## Deviations

None — all task plan steps implemented as specified.

## Known Issues

None.

## Files Created/Modified

- `src/lib/engine/EvaluationContext.ts`
- `tests/engine/LuxDebounceIntegration.test.ts`
