# M001/S03 — Research

**Date:** 2026-04-26

## Summary

The Phase Engine (S03) is the core state machine that determines the active lighting phase (`NIGHT`, `MORNING`, `DAY`, `EVENING`). It evaluates configuration conditions (Time, Solar, Lux) and date contexts (weekdays vs. holidays) to trigger phase transitions. The engine can be implemented as a pure function that takes `currentPhase`, `lastEvalTime`, `AppConfig`, and an `EvaluationContext`, returning the newly active phase. By using a discrete event simulation approach (fast-forwarding through missed transitions up to 24 hours in the past), the engine inherently supports robust reboot recovery without complex state persistence beyond simply saving the last known phase and evaluation timestamp.

## Recommendation

Implement a pure `PhaseEngine` class or function in `src/lib/engine/PhaseEngine.ts`. It should evaluate conditions for the *next* sequential phase using a `[lastEvalTime, now]` time window. 
When a transition triggers, shrink the evaluation window by updating `evalTime` to the exact `eventTime` of the triggered condition, and continue evaluating subsequent phases until no more conditions are met. This elegantly handles both normal 60-second tick evaluations and large offline gaps (reboots) natively. Use `date-holidays` to map public holidays to the "weekend" schedule, and `suncalc` to resolve solar events into absolute `Date` objects for these window comparisons.

## Implementation Landscape

### Key Files

- `src/lib/engine/PhaseEngine.ts` (New) — The core logic. Should export an `evaluatePhase` function or class that manages the `[lastEvalTime, now]` window and sequential fast-forwarding.
- `src/lib/engine/EvaluationContext.ts` (New) — Defines the inputs: `{ now: Date, lux: number | null, latitude: number, longitude: number, countryCode: string }`.
- `tests/engine/PhaseEngine.test.ts` (New) — Vitest suite to verify sequential transitions, holiday overrides, and fast-forward reboot scenarios.

### Build Order

1. **Evaluation Context & Helpers:** Define the `EvaluationContext` and implement `getScheduleType(now, countryCode)` using `date-holidays` to reliably identify weekends and public holidays.
2. **Condition Evaluators:** Implement `didTimePass`, `didSolarPass`, and `isLuxMet`. Time/Solar evaluators must check both today and yesterday, returning `{ triggered: boolean, eventTime?: Date }`.
3. **The Engine Loop:** Build the main evaluation loop. It must clamp the initial `lastEvalTime` to `now - 24h`, check conditions for the *next* phase, and if triggered, update the window start to the condition's `eventTime`.
4. **Test Suite:** Write the Vitest suite covering standard progression, holiday schedules, and a 24-hour reboot catchup. This unblocks downstream integration (S04).

### Verification Approach

Verify purely in Vitest (`npm test`). No Homey SDK mocks are needed because the `EvaluationContext` strictly isolates the engine from the platform. Tests should construct a valid `AppConfig`, set up a simulated context, and tick `now` forward, verifying that the engine transitions through phases exactly when expected, including edge cases like midday reboots and day crossings.

## Constraints

- **Time Window Shrinking:** Solar and Time conditions must return the exact `Date` they triggered so the evaluation window can shrink correctly during fast-forwards. Lux conditions are instantaneous and use `now` as their event time.
- **Infinite Loop Prevention:** To prevent infinite loops if the configuration is logically circular or the time gap is exactly 24 hours, the engine must cap fast-forward iterations at 4 (one full cycle) per evaluation tick.
- **Holiday Fallbacks:** `date-holidays` expects valid country codes. If initialization fails or an invalid code is provided, the engine must gracefully fall back to a standard `weekday`/`weekend` calculation.

## Common Pitfalls

- **Evaluating Time Statelessly:** Checking `time === now` or `time <= now` without a window will cause transitions to be missed (due to polling intervals) or trigger repeatedly (causing rapid cycling). Always evaluate if the event occurred *between* `lastEvalTime` and `now`.
- **Day Crossings in Time Checks:** A phase scheduled for `23:00` being evaluated at `01:00` the next day. The evaluator must check if the time occurred *yesterday* as well as *today* to correctly identify events that passed midnight.