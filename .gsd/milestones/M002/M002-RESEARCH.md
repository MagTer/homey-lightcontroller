# M002: Hardening & Resilience — Research

**Date:** 2026-04-26
**Baseline:** 98 Vitest tests, all passing

## Summary

M002 addresses four surgical hardening points in a mature, well-tested codebase. The work is narrow in scope: a one-line Node.js version change, a retry wrapper around two existing `setCapability` call sites in `Reconciler.ts`, a validated eager-load in `app.ts::onInit()`, and a tie-breaking rule in `PhaseEngine.ts`'s condition evaluation loop. No new files are expected. No new dependencies are needed. All four requirements map to small, localized edits with clear test targets.

The baseline test suite (98 tests, 10 files) is healthy and runs clean. The existing test infrastructure — fake timers in `Reconciler.test.ts`, pure function tests in `PhaseEngine.test.ts` — makes both new behaviors straightforwardly testable without mocks or integration harness changes.

The only non-trivial design question is what R011 ("prioritize time-based conditions during catch-up") actually means operationally. The current `evaluatePhaseConditions` in `PhaseEngine.ts` picks the **earliest** event time from all triggered conditions. Lux conditions always return `eventTime: now`, making them always "latest" among simultaneous triggers — so the existing earliest-first logic already partially satisfies R011. The open question is whether the spec wants strict type-priority (time > solar > lux) or just temporal-priority (earliest wins, which lux will usually lose). Temporal priority is the simpler path and is already structurally present; explicit type-priority would require an additional sort key.

## Recommendation

Implement all four requirements as independent, ordered slices:

1. **Node.js downgrade** (R008) — Zero-risk, one-line change to `package.json`. Prove it first so the build environment is locked before behavioral changes.
2. **Mesh delay + single retry** (R009) — Augment `Reconciler.ts`'s `handleTransitionMode` and `applyMaintenanceUpdate` to retry once on failure after a 200ms delay. Tests use fake timers so retry paths are fully exercisable without real delays.
3. **Eager config validation in `onInit`** (R010) — Add a `parseConfig(getConfigFromStore(...))` call in `app.ts::onInit()` that logs critically and skips engine startup if config is absent or invalid.
4. **Catch-up condition priority** (R011) — Add an explicit tiebreak to `evaluatePhaseConditions` in `PhaseEngine.ts`: when multiple conditions trigger at the same `eventTime`, prefer `time` > `solar` > `lux`. The common case (a real lux event firing at `now` vs. a past time event) is already resolved by earliest-eventTime wins — the tiebreak only fires when two conditions resolve to exactly the same timestamp.

Slice independently; no slice blocks another (they touch separate files). The test for each slice can be written before the implementation.

## Implementation Landscape

### Key Files

- `package.json:8` — `"node": ">=22.0.0"` → change to `">=20.0.0"` (R008)
- `src/lib/engine/Reconciler.ts:186-233` — `handleTransitionMode`: two `setCapability` try/catch blocks need a single retry on failure with 200ms delay before logging to `failed[]` (R009)
- `src/lib/engine/Reconciler.ts:371-430` — `applyMaintenanceUpdate`: same retry pattern (R009)
- `src/lib/engine/Reconciler.ts:30-35` — `ReconcilerOptions` interface: add optional `retryDelayMs?: number` (default 200) (R009)
- `app.ts:46-48` — `getConfig()`: currently returns raw stored value without parsing — R010 is about `onInit`, not this getter
- `app.ts:70-81` — `onInit()`: add eager config load + parse; log `this.error(...)` and return early if null or invalid (R010)
- `src/lib/engine/PhaseEngine.ts:77-99` — `evaluatePhaseConditions`: add type-priority tiebreak after earliest-eventTime selection (R011)

### Build Order

1. `package.json` (R008) — proves the build chain works on the target constraint. Unblocks everything downstream.
2. `Reconciler.ts` (R009) — isolated to the Reconciler class, no cross-file changes.
3. `app.ts` (R010) — only `onInit()` changes; `getConfig()` public API stays the same.
4. `PhaseEngine.ts` (R011) — isolated to `evaluatePhaseConditions`; pure function, easily unit-tested.

### Verification Approach

- R008: `node --version` confirms runtime; `npm run build` confirms TS still compiles; existing 98 tests still pass.
- R009: New Vitest tests using `vi.useFakeTimers()`. Test cases: (a) first attempt fails, retry succeeds → `applied[]`; (b) both attempts fail → `failed[]`; (c) success on first → no extra delay.
- R010: New test in `tests/api/AppSettings.test.ts` or a new `app.test.ts` using a mock `homey.settings`. Cases: (a) valid config → engine starts; (b) null config → `this.error` called, engine not started; (c) invalid config → `this.error` called with validation detail.
- R011: New `PhaseEngine.test.ts` test with a phase that has both a `time` condition and a `lux` condition both triggering in the window at the same evalTime. Assert the `time` reason wins.

## Common Pitfalls

- **Retry creates a second delay** — After the retry attempt (whether it succeeds or fails), the standard `this.delay()` mesh delay should still fire to maintain the command spacing guarantee (R006). Don't skip the mesh delay for the retry branch.
- **`getConfig()` API change** — R010 is about `onInit()` startup behavior, not the `getConfig()` public method. `getConfig()` must remain `AppConfig | null` — the null return is used by callers who check for unconfigured state. Do not change the signature.
- **Lux tiebreak edge case** — Lux `evaluateLux` returns `eventTime: now`. Time/solar evaluators return the actual historical event time. In virtually all real scenarios, time/solar eventTimes are in the past relative to `now`, so they already win the earliest-time comparison. The explicit type-priority tiebreak only matters for the degenerate case where `time` condition fires at exactly `now` (e.g., a time condition of `HH:MM` where `now` falls exactly on that minute). This is rare but the tiebreak is still correct to implement for spec compliance.
- **`@types/node` version** — Currently `^25.6.0`. Node 20 types are a subset of Node 25; no downgrade of `@types/node` is needed.

## Open Risks

- **Transitive dependency using Node 22-only API** — `date-holidays` and `suncalc` are pure logic libraries unlikely to use recent Node APIs. `homey` SDK types are dev-only. Risk is low but should be confirmed by a build+test run after the version change.
- **Retry delay in fake-timer tests** — Existing Reconciler tests use `vi.useFakeTimers()` and advance time manually. New retry tests must account for the additional 200ms retry delay in their `advanceTimersByTimeAsync` calls. Pattern is already established in the existing test file.

## Skills Discovered

| Technology | Skill | Status |
|------------|-------|--------|
| Homey App SDK | homey-app (installed) | installed |
