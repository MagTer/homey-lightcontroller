# S03: Phase Engine & Environment Logic

**Goal:** Build a pure, testable phase-resolution engine that decides the active lighting phase (NIGHT/MORNING/DAY/EVENING) from an AppConfig + EvaluationContext, supporting weekday/weekend/holiday schedules, time/solar/lux conditions, and windowed fast-forward catchup for reboots.
**Demo:** Vitest verifies transitions across weekday/holiday/solar boundaries.

## Must-Haves

- Engine is implemented as a pure function with no Homey SDK dependency: input is (currentPhase, lastEvalTime, AppConfig, EvaluationContext); output is { phase, lastEvalTime }.
- Public holidays map to the weekend schedule via `date-holidays` and a country code from EvaluationContext; invalid/unknown country codes fall back to standard weekday/weekend.
- Time conditions are evaluated against the [lastEvalTime, now] window and correctly fire across midnight (yesterday's `at:` value).
- Solar conditions resolve via `suncalc` for both today and yesterday and report the exact event Date so the window can shrink during fast-forward.
- Lux conditions are instantaneous against the current reading and use `now` as their event time when triggered.
- Initial `lastEvalTime` is clamped to `now - 24h` to bound reboot catchup.
- The fast-forward inner loop is capped at 4 iterations per evaluation tick to prevent infinite loops.
- All behavior is verified by `tests/engine/PhaseEngine.test.ts` running under `npm test` with green output, including a 24h reboot scenario, a holiday case, and a day-crossing time case.

## Proof Level

- This slice proves: - This slice proves: contract
- Real runtime required: no
- Human/UAT required: no

## Integration Closure

- Upstream surfaces consumed: `src/lib/config/Config.ts` (AppConfig, Phase, Condition discriminated union), `date-holidays`, `suncalc`.
- New wiring introduced in this slice: none in the Homey runtime (S03 stays pure). The engine module is imported only by tests in this slice; S04 will wire it into a 60s tick driver.
- What remains before the milestone is truly usable end-to-end: S04 (Reconciler & Override Detection) wires this engine into the Homey lifecycle and applies role states; S05–S08 cover lux debouncing, settings UI, flow cards, and store readiness.

## Verification

- Runtime signals: engine returns a structured TransitionResult { phase, lastEvalTime, transitions: Array<{ from, to, reason, eventTime }> } so that callers (S04 reconciler) can log every transition with cause.
- Inspection surfaces: the returned `transitions` array is the inspection surface for tests and for future runtime logging in the Homey app driver.
- Failure visibility: invalid country codes log a single warning string via an injectable `logger` and fall back to plain weekday/weekend; the iteration cap surfaces a `cappedAt` flag in the result when reached.
- Redaction constraints: none — engine handles only timestamps, lux numbers, and phase strings.

## Tasks

- [x] **T01: Define EvaluationContext type and getScheduleType helper with date-holidays** `est:30m`
  Create the input contract for the phase engine and the schedule-resolution helper. The `EvaluationContext` is a plain object with `now: Date`, `lux: number | null`, `latitude: number`, `longitude: number`, `countryCode: string`, and an optional injectable `logger?: (msg: string) => void`. Implement `getScheduleType(now: Date, countryCode: string, logger?): 'weekday' | 'weekend'` that uses `date-holidays` to detect public holidays and returns 'weekend' for Sat/Sun and recognized public holidays, 'weekday' otherwise. Holidays whose `type` is `bank` or `public` count as weekend; `observance` does NOT (these are flag days, not days off). If `date-holidays` initialization throws or `countryCode` is empty/invalid, log one warning via `logger` and fall back to a plain Sat/Sun check. Cache the per-country `Holidays` instance in a module-level `Map<string, Holidays>` so repeated ticks do not re-construct it.
  - Files: `src/lib/engine/EvaluationContext.ts`, `src/lib/engine/getScheduleType.ts`
  - Verify: Run `npx tsc --noEmit` (must pass). Then run `node --input-type=module -e "import('./src/lib/engine/getScheduleType.js').then(m => { if (m.getScheduleType(new Date('2026-12-25T12:00:00Z'),'NL') !== 'weekend') process.exit(1); if (m.getScheduleType(new Date('2026-04-22T12:00:00Z'),'NL') !== 'weekday') process.exit(1); if (m.getScheduleType(new Date('2026-04-22T12:00:00Z'),'') !== 'weekday') process.exit(1); console.log('OK'); })"` — must print OK and exit 0.

- [x] **T02: Implement pure condition evaluators for Time, Solar, and Lux** `est:1h`
  Build three pure evaluator functions that share a common return shape `{ triggered: boolean; eventTime?: Date }`. The window for time/solar checks is `(lastEvalTime, now]` (exclusive lower bound, inclusive upper bound). Implementations:
- `evaluateTime(cond: TimeCondition, lastEvalTime: Date, now: Date): EvalResult` — parse `cond.at` (HH:MM) and build the candidate Date for *today* (in the local TZ derived from `now`) and for *yesterday*. Return the earliest candidate that lies in `(lastEvalTime, now]`.
- `evaluateSolar(cond: SolarCondition, lastEvalTime: Date, now: Date, lat: number, lon: number): EvalResult` — call `SunCalc.getTimes(d, lat, lon)` for today and yesterday, pick the field matching `cond.event` (`sunrise`, `sunset`, `goldenHour`, `goldenHourEnd`), add `cond.offsetMinutes * 60_000` ms, and return the earliest result in the window. If `suncalc` returns an Invalid Date (polar regions), treat as `triggered: false`.
- `evaluateLux(cond: LuxCondition, lux: number | null, now: Date): EvalResult` — when `lux` is `null` return `triggered: false`; otherwise apply `cond.operator` (`'lt' | 'gt'`) against `cond.value` and return `eventTime: now` on a hit.
All three functions live in one file and import `Condition`, `TimeCondition`, `SolarCondition`, `LuxCondition` types from `src/lib/config/Config.js`. Export an `evaluateCondition(cond, ctx, lastEvalTime)` dispatcher that switches on `cond.type`.
  - Files: `src/lib/engine/conditionEvaluators.ts`
  - Verify: Run `npx tsc --noEmit` — must pass with zero errors. The full behavioral verification happens in T04 via Vitest; this task adds no test of its own.

- [x] **T03: Implement PhaseEngine loop with windowed fast-forward and iteration cap** `est:1h`
  Build the main engine function in `src/lib/engine/PhaseEngine.ts`:
```
export interface TransitionRecord { from: Phase; to: Phase; reason: 'time' | 'solar' | 'lux'; eventTime: Date }
export interface EngineResult { phase: Phase; lastEvalTime: Date; transitions: TransitionRecord[]; cappedAt?: number }
export function evaluatePhase(currentPhase: Phase, lastEvalTime: Date, config: AppConfig, ctx: EvaluationContext): EngineResult
```
Logic:
1. Define `PHASE_ORDER: Phase[] = ['NIGHT','MORNING','DAY','EVENING']`. The 'next' phase wraps from EVENING to NIGHT.
2. Clamp the initial window: `let evalTime = max(lastEvalTime, ctx.now - 24h)`.
3. Resolve schedule once per iteration via `getScheduleType(ctx.now, ctx.countryCode, ctx.logger)` — re-resolve each iteration since `evalTime` advances and a fast-forward could cross a day boundary (the schedule for the *target phase* is read off `config.phases[next].weekday|weekend`).
4. Inner loop, capped at 4 iterations:
   - Determine `next = PHASE_ORDER[(idx(currentPhase)+1) % 4]`.
   - Read the matching `PhaseSchedule` (weekday or weekend).
   - For each `condition` in the schedule, call `evaluateCondition(cond, ctx, evalTime)`. The engine fires on the FIRST condition that triggers (OR semantics, per R003) — pick the one with the earliest `eventTime`.
   - If something triggered: append a `TransitionRecord`, set `currentPhase = next`, set `evalTime = eventTime` (window shrinks), continue loop.
   - If nothing triggered: break.
5. If loop reached 4 iterations, set `cappedAt: 4` on the result.
6. Return `{ phase: currentPhase, lastEvalTime: ctx.now, transitions, cappedAt? }`. Note: the returned `lastEvalTime` is always `ctx.now` so the next tick's window is `(now_prev, now]`.
The function imports `evaluateCondition` from T02 and `getScheduleType` from T01. Do not write tests in this task — T04 owns the suite.
  - Files: `src/lib/engine/PhaseEngine.ts`
  - Verify: Run `npx tsc --noEmit` — must pass with zero errors. Behavioral verification is performed by the Vitest suite in T04.

- [x] **T04: Write Vitest suite for PhaseEngine covering progression, holidays, day-crossing, and reboot catchup** `est:1h 30m`
  Create `tests/engine/PhaseEngine.test.ts` and verify the engine end-to-end with at least these scenarios:
1. **Standard progression** — start at NIGHT with `lastEvalTime` just before MORNING's 07:00 weekday time, advance `now` to 07:01, expect `phase === 'MORNING'` and one transition.
2. **No-trigger no-op** — start at NIGHT at 03:00 with `lastEvalTime` at 02:00, expect `phase === 'NIGHT'` and zero transitions.
3. **Day-crossing time condition** — EVENING configured at 23:00; `lastEvalTime = 22:30`, `now = 00:30 next day`. Expect EVENING → NIGHT transition with `eventTime` falling on the previous calendar day's 23:00.
4. **Holiday → weekend schedule** — set `countryCode: 'NL'` and `now` on a known Dutch public holiday (e.g. `2026-12-25T08:00:00Z`); MORNING's weekday is `time 07:00`, weekend is `solar sunrise + 30m`. Verify the engine consults the weekend schedule (the test should construct a config where this difference is observable, e.g. weekend MORNING fires at a later time).
5. **24h reboot catchup** — start at NIGHT with `lastEvalTime = now - 30h` (will be clamped to `now - 24h`); over the 24h window the config naturally cycles NIGHT→MORNING→DAY→EVENING→NIGHT. Expect the final phase to be the correct one (NIGHT after a full cycle) and `transitions.length === 4`.
6. **Iteration cap** — construct a degenerate config where every phase's only condition is `time 00:00` and supply `lastEvalTime = now - 23h`. Expect `cappedAt === 4` and exactly 4 transitions.
7. **Lux trigger** — DAY's weekday schedule has `lux gt 100`; supply `ctx.lux = 250`, expect the transition with `reason === 'lux'` and `eventTime === ctx.now`.
8. **Solar trigger** — configure DAY weekday `solar sunset + 0`; with a fixed lat/lon (e.g. Amsterdam 52.37, 4.90) on a fixed date, set `now` 1 minute after the computed sunset; expect a solar transition.
9. **Invalid country fallback** — pass `countryCode: ''`; engine still uses the weekend schedule on a Saturday `now`, weekday on a Tuesday `now` (no holiday lookup, no throw).

All tests must use real `date-holidays` and `suncalc` (no mocks) and explicit fixed `Date` objects so they are deterministic. Use `it.each` or named `describe` blocks. Tests build their `AppConfig` fixtures inline with the existing schema (mirroring `tests/config/ConfigParser.test.ts`'s `validConfig` shape).
  - Files: `tests/engine/PhaseEngine.test.ts`
  - Verify: Run `npm test` — all tests in `tests/engine/PhaseEngine.test.ts` plus prior `tests/config/ConfigParser.test.ts` and `tests/smoke.test.ts` must pass green. Then run `npx tsc --noEmit` — must pass with zero errors.

## Files Likely Touched

- src/lib/engine/EvaluationContext.ts
- src/lib/engine/getScheduleType.ts
- src/lib/engine/conditionEvaluators.ts
- src/lib/engine/PhaseEngine.ts
- tests/engine/PhaseEngine.test.ts
