---
estimated_steps: 11
estimated_files: 1
skills_used: []
---

# T04: Write Vitest suite for PhaseEngine covering progression, holidays, day-crossing, and reboot catchup

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

## Inputs

- ``src/lib/engine/PhaseEngine.ts` — function under test`
- ``src/lib/engine/EvaluationContext.ts` — input shape for tests`
- ``src/lib/engine/getScheduleType.ts` — referenced for the holiday/fallback scenarios`
- ``src/lib/engine/conditionEvaluators.ts` — referenced for solar/lux scenarios`
- ``src/lib/config/Config.ts` — AppConfig fixture shape`
- ``tests/config/ConfigParser.test.ts` — pattern to mirror for the inline `validConfig` style fixture`
- ``vitest.config.ts` — confirms test runner config`

## Expected Output

- ``tests/engine/PhaseEngine.test.ts` — Vitest suite with at least 9 test cases covering progression, no-op, day-crossing, holidays, reboot catchup, iteration cap, lux, solar, and invalid country fallback`

## Verification

Run `npm test` — all tests in `tests/engine/PhaseEngine.test.ts` plus prior `tests/config/ConfigParser.test.ts` and `tests/smoke.test.ts` must pass green. Then run `npx tsc --noEmit` — must pass with zero errors.

## Observability Impact

Tests assert on the `transitions[]` and `cappedAt` fields of `EngineResult`, which is the documented diagnostic surface — green tests prove the surface is populated correctly so future agents can rely on it for failure analysis.
