---
estimated_steps: 5
estimated_files: 1
skills_used: []
---

# T02: Implement pure condition evaluators for Time, Solar, and Lux

Build three pure evaluator functions that share a common return shape `{ triggered: boolean; eventTime?: Date }`. The window for time/solar checks is `(lastEvalTime, now]` (exclusive lower bound, inclusive upper bound). Implementations:
- `evaluateTime(cond: TimeCondition, lastEvalTime: Date, now: Date): EvalResult` — parse `cond.at` (HH:MM) and build the candidate Date for *today* (in the local TZ derived from `now`) and for *yesterday*. Return the earliest candidate that lies in `(lastEvalTime, now]`.
- `evaluateSolar(cond: SolarCondition, lastEvalTime: Date, now: Date, lat: number, lon: number): EvalResult` — call `SunCalc.getTimes(d, lat, lon)` for today and yesterday, pick the field matching `cond.event` (`sunrise`, `sunset`, `goldenHour`, `goldenHourEnd`), add `cond.offsetMinutes * 60_000` ms, and return the earliest result in the window. If `suncalc` returns an Invalid Date (polar regions), treat as `triggered: false`.
- `evaluateLux(cond: LuxCondition, lux: number | null, now: Date): EvalResult` — when `lux` is `null` return `triggered: false`; otherwise apply `cond.operator` (`'lt' | 'gt'`) against `cond.value` and return `eventTime: now` on a hit.
All three functions live in one file and import `Condition`, `TimeCondition`, `SolarCondition`, `LuxCondition` types from `src/lib/config/Config.js`. Export an `evaluateCondition(cond, ctx, lastEvalTime)` dispatcher that switches on `cond.type`.

## Inputs

- ``src/lib/config/Config.ts` — Condition, TimeCondition, SolarCondition, LuxCondition types`
- ``src/lib/engine/EvaluationContext.ts` — EvaluationContext shape`
- ``package.json` — confirms `suncalc` is already installed`

## Expected Output

- ``src/lib/engine/conditionEvaluators.ts` — exports `evaluateTime`, `evaluateSolar`, `evaluateLux`, `evaluateCondition`, and the shared `EvalResult` type`

## Verification

Run `npx tsc --noEmit` — must pass with zero errors. The full behavioral verification happens in T04 via Vitest; this task adds no test of its own.

## Observability Impact

Evaluators are pure with no logging; their output `eventTime` is the diagnostic signal callers use to localize which condition triggered a transition.
