---
estimated_steps: 50
estimated_files: 2
skills_used: []
---

# T01: Add TYPE_PRIORITY tiebreak in PhaseEngine.evaluatePhaseConditions and verify with four unit tests

Implement R011: a deterministic time > solar > lux type-priority tiebreak inside evaluatePhaseConditions in src/lib/engine/PhaseEngine.ts, and prove it with four new unit tests in tests/engine/PhaseEngine.test.ts.

## What changes in src/lib/engine/PhaseEngine.ts

1. Add a module-scope constant just after the existing MAX_LOOKBACK_MS declaration (around line 27):

   ```ts
   /**
    * Type-priority for tiebreaking conditions that resolve to identical eventTimes.
    * Lower number = higher priority. time > solar > lux.
    */
   const TYPE_PRIORITY: Record<'time' | 'solar' | 'lux', number> = {
     time: 0,
     solar: 1,
     lux: 2
   };
   ```

2. Change the function signature on line 77 from `function evaluatePhaseConditions` to `export function evaluatePhaseConditions` so tests can call it directly. Do not change the return type or parameter list.

3. Modify the tie-handling branch (currently lines 87–95). The existing strict `<` check stays for the primary case; add a separate equal-time branch that consults TYPE_PRIORITY. Final body of the for-loop should be equivalent to:

   ```ts
   if (result.triggered && result.eventTime) {
     const isStrictlyEarlier = !earliestResult ||
       result.eventTime < earliestResult.eventTime!;
     const isTieAndHigherPriority = !!earliestResult &&
       earliestResult.eventTime !== undefined &&
       earliestResult.reason !== undefined &&
       result.eventTime.getTime() === earliestResult.eventTime.getTime() &&
       TYPE_PRIORITY[condition.type] < TYPE_PRIORITY[earliestResult.reason];
     if (isStrictlyEarlier || isTieAndHigherPriority) {
       earliestResult = { ...result, reason: condition.type };
     }
   }
   ```

   Keep behaviour identical to the current implementation when eventTimes differ. Only the equal-time path becomes deterministic.

4. Do not modify src/lib/engine/conditionEvaluators.ts. Do not change PHASE_ORDER, evaluatePhase, getNextPhase, or any other export.

## What changes in tests/engine/PhaseEngine.test.ts

Append a new top-level `describe('type-priority tiebreak', () => { ... })` block (place it after the last existing describe in the file, inside the outer `describe('PhaseEngine', ...)`).

Import the newly-exported `evaluatePhaseConditions` and the `PhaseSchedule` type at the top of the file. The existing imports already pull from `../../src/lib/engine/PhaseEngine.js` — extend that import to include `evaluatePhaseConditions`. Add `PhaseSchedule` to the imports from `../../src/lib/config/Config.js`.

Four test cases — call `evaluatePhaseConditions(schedule, ctx, evalTime)` directly so timestamps are exactly controllable:

**Test (a): time vs solar at identical eventTimes → time wins.**
Use `now = new Date('2026-01-15T07:00:00Z')`, `evalTime = new Date('2026-01-15T06:59:00Z')`. Stub the schedule so `conditions` order is `[solar, time]` (solar first, to prove iteration order does not decide the winner). Use a time condition `{ type: 'time', at: '07:00' }` — that resolves to exactly 07:00:00Z. For the solar condition, instead of relying on SunCalc, mock the solar evaluator: use `vi.spyOn` on the `conditionEvaluators` module if needed, OR — simpler — set a lux condition that fires at `now` to use as a stand-in only if it serves the test intent. **The cleanest approach: import `evaluateCondition` and use `vi.mock('../../src/lib/engine/conditionEvaluators.js', ...)` with a controlled implementation that returns deterministic eventTimes per condition type.** Expect the result to satisfy `result.triggered === true`, `result.reason === 'time'`, `result.eventTime?.getTime() === new Date('2026-01-15T07:00:00Z').getTime()`.

**Test (b): time vs lux at identical eventTimes → time wins.**
Use `now = new Date('2026-01-15T07:00:00Z')`, `evalTime = new Date('2026-01-15T06:59:00Z')`, `ctx.lux = 0` so `evaluateLux` with `{ type: 'lux', operator: 'lt', value: 100 }` triggers at `eventTime = ctx.now`. Add `{ type: 'time', at: '07:00' }`, which also resolves to `2026-01-15T07:00:00Z`. Place lux first in the conditions array. No mock needed. Expect `result.reason === 'time'`.

**Test (c): solar vs lux at identical eventTimes → solar wins.**
Use `vi.mock` to replace `evaluateCondition` (or call `evaluatePhaseConditions` against a constructed schedule and use `vi.spyOn` on the module-exported `evaluateCondition` to return a fixed `{ triggered: true, eventTime: now }` for both the solar and the lux entry). Order in the array: lux first, then solar. Expect `result.reason === 'solar'`.

**Test (d): distinct timestamps — earliest wins regardless of type.**
Use `now = new Date('2026-01-15T12:00:00Z')`, `evalTime = new Date('2026-01-15T06:59:00Z')`. Conditions `[{ type: 'lux', operator: 'lt', value: 100 }, { type: 'time', at: '07:00' }]` with `ctx.lux = 0`. Time fires at 07:00:00Z (earlier); lux fires at 12:00:00Z (now). Expect `result.reason === 'time'` and `result.eventTime` equal to `2026-01-15T07:00:00Z`. This proves the strict-earliest path was not regressed.

For any test using `vi.mock`, scope the mock with a `beforeEach` reset or use `vi.spyOn(...).mockImplementation(...)` inside the test body to avoid leaking into adjacent tests.

Use the existing `makeCtx({ now, lux })` helper in the file. Do not duplicate fixture setup — extend what is already there.

## Quality gates (Q5/Q6/Q7)

**Failure Modes (Q5):** The change is in a pure function — there are no I/O failure modes. The only logical risk is breaking the strict `<` path when eventTimes differ; test (d) defends against that. A second risk is `earliestResult.reason` being undefined while we compare priorities — guarded by the explicit `reason !== undefined` check in the new branch.

**Load Profile (Q6):** evaluatePhaseConditions is called inside the engine tick (once per phase per iteration, capped at MAX_ITERATIONS=4 per evaluation). Adding one map lookup per condition is O(1) and does not change algorithmic complexity. No load impact.

**Negative Tests (Q7):** Test (d) is the negative test for the change — it verifies that the new tiebreak does not steal wins from cases where the eventTimes genuinely differ. Existing tests in the file (standard progression, solar, lux, fast-forward) implicitly cover the no-tie path under realistic schedules.

## Inputs

- ``src/lib/engine/PhaseEngine.ts``
- ``src/lib/engine/conditionEvaluators.ts``
- ``src/lib/config/Config.ts``
- ``tests/engine/PhaseEngine.test.ts``

## Expected Output

- ``src/lib/engine/PhaseEngine.ts``
- ``tests/engine/PhaseEngine.test.ts``

## Verification

From the slice working directory: (1) `npx tsc --noEmit` exits 0; (2) `npx vitest run tests/engine/PhaseEngine.test.ts` reports the new `type-priority tiebreak` describe block with 4 passing tests and no failures in the file; (3) `npm test` reports 110 tests across 11 files, all passing (current baseline 106 + 4 new). Capture stdout/stderr for each command in the task SUMMARY.

## Observability Impact

None. The function is pure; the new branch only changes which result is selected on a tie. The choice is already visible to callers via TransitionRecord.reason and EngineResult.transitions[]. No new logs, metrics, or error paths are added.
