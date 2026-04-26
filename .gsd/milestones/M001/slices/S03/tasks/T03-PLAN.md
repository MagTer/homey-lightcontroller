---
estimated_steps: 19
estimated_files: 1
skills_used: []
---

# T03: Implement PhaseEngine loop with windowed fast-forward and iteration cap

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

## Inputs

- ``src/lib/config/Config.ts` — AppConfig, Phase, PhaseSchedule types`
- ``src/lib/engine/EvaluationContext.ts` — EvaluationContext type`
- ``src/lib/engine/getScheduleType.ts` — schedule resolution`
- ``src/lib/engine/conditionEvaluators.ts` — evaluateCondition dispatcher`

## Expected Output

- ``src/lib/engine/PhaseEngine.ts` — exports `evaluatePhase`, `TransitionRecord`, `EngineResult`, and `PHASE_ORDER` constant`

## Verification

Run `npx tsc --noEmit` — must pass with zero errors. Behavioral verification is performed by the Vitest suite in T04.

## Observability Impact

The returned `transitions` array is the primary diagnostic surface for callers — every transition records its trigger condition `reason` and exact `eventTime`. The optional `cappedAt` field signals a misconfigured or pathological loop. No I/O performed.
