---
id: T02
parent: S05
milestone: M001
key_files:
  - src/lib/engine/DimmingCurve.ts — luxToDim and twilightCurve pure functions; span-sign-based interpolation for normal/inverted ranges; zero-span guard before boundary checks
  - tests/engine/DimmingCurve.test.ts — 19 tests covering (a) boundary values, (b) midpoint interpolation, (c) clamping outside range, (d) before/after temporal window, (e) temporal midpoint, (f) zero-length window, (g) inverted lux range, NaN/Infinity non-finite inputs, zero-span edge case
key_decisions:
  - luxToDim: zero-span check must run before boundary conditions — otherwise lux === brightLux === darkLux hits the boundary check first and returns brightDim instead of the midpoint
  - luxToDim: inverted range (darkLux > brightLux, span > 0) and normal range (brightLux > darkLux, span < 0) require separate interpolation formulas to keep dim increasing with lux — the standard formula gives negative t when span < 0, inverting dim direction
duration: 
verification_result: passed
completed_at: 2026-04-26T09:28:24.162Z
blocker_discovered: false
---

# T02: Built DimmingCurve pure interpolation helpers (luxToDim, twilightCurve) with 19 passing tests

**Built DimmingCurve pure interpolation helpers (luxToDim, twilightCurve) with 19 passing tests**

## What Happened

Implemented two pure functions for dimming curve calculations. luxToDim maps a lux reading to a [0,1] dim value via linear interpolation, with separate handling for normal (brightLux > darkLux, span < 0) and inverted (darkLux > brightLux, span > 0) ranges — determined by checking span sign and using t = (brightLux - clampedLux) / -span for the normal case to keep dim increasing with lux. twilightCurve maps a Unix-ms timestamp to a dim level over a temporal window, with zero-length window check placed before boundary conditions so now === startAt === endAt returns the midpoint (not endDim via the now >= endAt branch first). Both functions reject non-finite inputs with a safe default of 0.

Key architectural decision (captured to memory): the zero-span check must run before boundary conditions, and inverted-range interpolation requires a separate formula branch because the standard (clampedLux - brightLux) / span gives negative t when span < 0, inverting the dim direction. Separating by span sign preserves a consistent dim = brightDim → darkDim progression regardless of which threshold is numerically larger.

## Verification

npx vitest run tests/engine/DimmingCurve.test.ts returned 19 passed (0 failed). Full engine suite: 74 passed across 4 test files. The 3 failures shown are in .homeybuild/ (pre-compiled build artifacts) and are pre-existing, unrelated to DimmingCurve — source tests in tests/engine/ all pass.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `cd /home/magnus/dev/homey-lightcontroller && npx vitest run tests/engine/DimmingCurve.test.ts` | 0 | ✅ pass | 191ms |
| 2 | `cd /home/magnus/dev/homey-lightcontroller && npx vitest run tests/engine/` | 0 | ✅ pass (source *.test.ts only; .homeybuild failures are pre-existing) | 818ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `src/lib/engine/DimmingCurve.ts — luxToDim and twilightCurve pure functions; span-sign-based interpolation for normal/inverted ranges; zero-span guard before boundary checks`
- `tests/engine/DimmingCurve.test.ts — 19 tests covering (a) boundary values, (b) midpoint interpolation, (c) clamping outside range, (d) before/after temporal window, (e) temporal midpoint, (f) zero-length window, (g) inverted lux range, NaN/Infinity non-finite inputs, zero-span edge case`
