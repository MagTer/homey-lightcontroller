# S04: PhaseEngine type-priority tiebreak in catch-up — Research

**Date:** 2026-04-26

## Summary

S04 addresses R011: PhaseEngine must prioritize time-based conditions over sensor-based conditions during reboot catch-up. The tiebreak rule is `time > solar > lux` when multiple conditions on the same phase schedule resolve to identical `eventTime` values.

The change is surgical and confined entirely to the `evaluatePhaseConditions` function in `src/lib/engine/PhaseEngine.ts` (lines 77–99). Currently the function iterates over `schedule.conditions`, calls `evaluateCondition` for each, and keeps only the one with the strictly earliest `eventTime` (line 89: `result.eventTime < earliestResult.eventTime!`). This strict less-than comparison means ties are silently broken by iteration order (i.e., whichever condition appears first in the config array wins), which is non-deterministic from the caller's perspective. The fix adds a secondary sort key on type priority so that ties always resolve deterministically in favour of `time`, then `solar`, then `lux`.

The existing test suite covers time, solar, and lux triggers in isolation and exercises the fast-forward catch-up loop, but has no test where two conditions produce the same `eventTime`. The four new test cases for S04 all belong inside a new `describe('type-priority tiebreak')` block in `tests/engine/PhaseEngine.test.ts`.

## Recommendation

Add a `TYPE_PRIORITY` map (`{ time: 0, solar: 1, lux: 2 }`) at module scope in `PhaseEngine.ts` and change the tie-breaking logic inside `evaluatePhaseConditions` so that when a new result's `eventTime` is **equal** to `earliestResult.eventTime`, the new result replaces the current winner only if its type has a lower priority number. The final comparison becomes:

```
if (
  !earliestResult ||
  result.eventTime < earliestResult.eventTime! ||
  (result.eventTime.getTime() === earliestResult.eventTime!.getTime() &&
   TYPE_PRIORITY[condition.type] < TYPE_PRIORITY[earliestResult.reason!])
)
```

This is preferable to a post-selection sort because it is O(n) (single pass), requires no intermediate array, and makes the priority rule explicit at the point of decision. No other functions in `PhaseEngine.ts` or `conditionEvaluators.ts` need to change.

## Implementation Landscape

### Key Files

- `src/lib/engine/PhaseEngine.ts` — `evaluatePhaseConditions` (lines 77–99) is the only site that needs modification. The current logic at lines 87–95 keeps the strictly-earlier `eventTime`; the change adds a tie-breaking branch. A `TYPE_PRIORITY` constant (`Record<'time'|'solar'|'lux', number>`) should be added near the top of the file, after the existing module-level constants (`MAX_ITERATIONS`, `MAX_LOOKBACK_MS`, lines 22–27). The return type annotation on line 81 (`EvalResult & { reason?: 'time' | 'solar' | 'lux' }`) and the `earliestResult` variable on line 82 do not need to change. The `condition.type` field (sourced from `Condition` in `Config.ts`) is already narrowed to `'time' | 'solar' | 'lux'` by the discriminated union, so no casting is required.

- `tests/engine/PhaseEngine.test.ts` — Add a new `describe('type-priority tiebreak')` block (after the existing `describe` blocks, following the established pattern of inline `AppConfig` construction). Each test case needs a config where the target phase has two conditions that both trigger within the evaluation window at the same `eventTime`. For time vs solar/lux ties, constructing a deterministic identical timestamp requires a lux condition (which always returns `ctx.now` as `eventTime`) paired with a time condition whose `at` string equals the UTC HH:MM of `ctx.now`. For solar vs lux, the same pattern works: a lux condition at `ctx.now` paired with a solar condition where `offsetMinutes` is engineered so that the solar event lands at `ctx.now` — but solar times are computed by SunCalc and are not round numbers, making exact equality hard to guarantee. The safer pattern for solar tiebreak tests is to mock the solar evaluator or to use a time condition as the "known" anchor and introduce a helper that stubs `evaluateCondition`. Alternatively, test (a), (b), (c) can all use the lux-at-now pattern: lux always returns `eventTime === ctx.now`; a time condition with `at` equal to the HH:MM of `ctx.now` also returns `eventTime === ctx.now`; this gives exact equality without SunCalc involvement. For solar vs lux, a solar condition is not easily pegged to `ctx.now` without mocking, so the simplest approach is to directly unit-test `evaluatePhaseConditions` as a named export (currently unexported), or to accept a slightly different scenario where lux fires at `ctx.now` and a solar condition fires at `ctx.now` by choosing a date/location/event where SunCalc returns a time equal to `ctx.now` to the minute — which is fragile. The recommended approach: **export `evaluatePhaseConditions`** from `PhaseEngine.ts` so it can be tested directly with stubbed `EvalResult` objects fed through a mock schedule, bypassing SunCalc entirely for the tiebreak tests.

- `src/lib/engine/conditionEvaluators.ts` — No changes. The three type values (`'time'`, `'solar'`, `'lux'`) are confirmed from the `Condition` discriminated union in `Config.ts`. `evaluateLux` always returns `eventTime: ctx.now`; `evaluateTime` returns the HH:MM wall-clock time on the matching day; `evaluateSolar` returns the SunCalc event time ± offset. These are independent of the tiebreak logic.

### Build Order

1. Add `TYPE_PRIORITY` constant to `PhaseEngine.ts` (non-breaking, no tests yet affected).
2. Modify the tie-breaking condition inside `evaluatePhaseConditions` (lines 87–95).
3. Optionally export `evaluatePhaseConditions` to enable direct unit testing.
4. Add the four new test cases in `PhaseEngine.test.ts`.
5. Run `npm test` — all 98 existing tests must still pass.

### Verification Approach

The four required test cases from the roadmap:

**(a) time vs solar at identical eventTimes → time wins**
Construct a phase schedule with two conditions: `{ type: 'time', at: 'HH:MM' }` and `{ type: 'solar', event: 'sunrise', offsetMinutes: N }` where both resolve to the same `eventTime`. If testing via `evaluatePhase`, this requires careful SunCalc coordination; if testing via exported `evaluatePhaseConditions` with a stubbed schedule where both `evaluateCondition` calls return the same `eventTime`, it is straightforward. Expect `result.reason === 'time'`.

**(b) time vs lux at identical eventTimes → time wins**
Set `ctx.now` to a round HH:MM (e.g., `2026-01-15T07:00:00Z`), `lastEvalTime` to one minute before. Phase schedule has `{ type: 'time', at: '07:00' }` and `{ type: 'lux', operator: 'gt', value: 0 }`. Both return `eventTime = 2026-01-15T07:00:00Z`. Expect `result.reason === 'time'`.

**(c) solar vs lux at identical eventTimes → solar wins**
Same principle: lux fires at `ctx.now`; arrange solar to also fire at `ctx.now` (requires SunCalc coordination or direct export). Expect `result.reason === 'solar'`.

**(d) distinct timestamps → earliest wins regardless of type**
Use a standard config where a time condition fires at 07:00 and a lux condition fires at `ctx.now = 12:00`. The time condition's `eventTime` (07:00) is earlier, so it wins even though lux is lower priority. Expect `result.reason === 'time'` and `result.eventTime` equals the 07:00 timestamp. This test already effectively exists in the suite (the `lux trigger` describe block) — add one that explicitly has both types in the same schedule to confirm the earliest-wins behaviour is not broken.

## Common Pitfalls

- **Iteration-order dependence** — The current code silently breaks ties by whichever condition appears first in `schedule.conditions`. Without the tiebreak fix, tests (a)–(c) would be flaky if the config array order changed. The fix must use the priority map, not array position.

- **Strict less-than vs less-than-or-equal** — The existing check at line 89 uses `<`. Changing it to `<=` without the priority guard would make the last-seen condition of equal time win (still iteration-order dependent). The correct fix is: keep `<` for the primary check, and add a separate `=== getTime()` branch for the tiebreak.

- **`evaluatePhaseConditions` not exported** — Currently unexported, which forces integration-style tests through `evaluatePhase`. Exporting it unlocks direct unit tests that bypass SunCalc and avoid needing specific geographic/date combinations to produce exact equal timestamps for solar vs lux.

- **SunCalc non-determinism for solar tiebreak tests** — Solar `eventTime` values are floating-point millisecond timestamps computed from latitude/longitude/date. Getting an exact millisecond match with `ctx.now` without mocking is unreliable. Prefer direct export of `evaluatePhaseConditions` or a mock/stub approach for test case (c).

- **TYPE_PRIORITY must cover all three types** — The map must be typed as `Record<'time' | 'solar' | 'lux', number>` to get TypeScript exhaustiveness checking. Missing a key would cause a runtime `undefined` comparison that silently fails.
