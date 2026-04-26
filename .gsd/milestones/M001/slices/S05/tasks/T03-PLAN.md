---
estimated_steps: 1
estimated_files: 2
skills_used: []
---

# T03: Wire LuxAggregator into EvaluationContext and prove debounce blocks transient phase changes

Add a `buildEvaluationContext` factory to `src/lib/engine/EvaluationContext.ts` with signature `buildEvaluationContext(args: { aggregator: LuxAggregator; now: Date; latitude: number; longitude: number; countryCode: string; logger?: Logger }): EvaluationContext`. The factory calls `aggregator.tick(args.now)` and then returns an `EvaluationContext` whose `lux` field is `aggregator.getSmoothedLux()`. Do NOT modify the `EvaluationContext` interface itself — `lux: number | null` already accommodates the smoothed value. Do NOT modify `evaluateLux` or `evaluatePhase` — they continue to consume `ctx.lux` exactly as before. Then write `tests/engine/LuxDebounceIntegration.test.ts` that builds a minimal `AppConfig` with a single lux-triggered phase transition (e.g. NIGHT→MORNING when `lux > 100`), and proves: (a) a single transient spike (one tick at lux 500 surrounded by ticks at lux 10) does NOT trigger a phase change because the smoothed value stays low, (b) sustained bright readings (3+ ticks at lux 500) DO trigger the transition once the smoothed value crosses the threshold. Use the real `evaluatePhase` and a real `LuxAggregator` — this is the integration proof that the smoothing actually filters transients in the engine pipeline. Run the full test suite at the end to verify no regressions.

## Inputs

- ``src/lib/engine/LuxAggregator.ts``
- ``src/lib/engine/EvaluationContext.ts``
- ``src/lib/engine/PhaseEngine.ts``
- ``src/lib/engine/conditionEvaluators.ts``
- ``src/lib/config/Config.ts``

## Expected Output

- ``src/lib/engine/EvaluationContext.ts``
- ``tests/engine/LuxDebounceIntegration.test.ts``

## Verification

npx vitest run && npx tsc --noEmit

## Observability Impact

`buildEvaluationContext` is the single seam where smoothed lux enters the engine. A future agent can swap the factory to log `aggregator.getDiagnostics()` on each call without touching the engine internals. The integration test itself documents the contract: 'transients are filtered, sustained changes propagate.'
