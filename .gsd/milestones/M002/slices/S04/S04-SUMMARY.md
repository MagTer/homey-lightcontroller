---
id: S04
parent: M002
milestone: M002
provides:
  - (none)
requires:
  []
affects:
  []
key_files:
  - (none)
key_decisions:
  - (none)
patterns_established:
  - (none)
observability_surfaces:
  - none
drill_down_paths:
  []
duration: ""
verification_result: passed
completed_at: 2026-04-26T21:25:11.080Z
blocker_discovered: false
---

# S04: PhaseEngine type-priority tiebreak in catch-up

**Deterministic type-priority tiebreak (time > solar > lux) for PhaseEngine transitions.**

## What Happened

This slice addressed the risk of non-deterministic phase transitions during reboot catch-up or simulation when multiple conditions (e.g., a fixed time and a solar event) resolve to the exact same millisecond. We introduced a `TYPE_PRIORITY` constant in `PhaseEngine.ts` that ranks condition types: `time` (0) > `solar` (1) > `lux` (2). 

The `evaluatePhaseConditions` function was updated to use this priority when comparing triggered conditions with identical `eventTime` values. To verify this, we exported `evaluatePhaseConditions` and added a dedicated test suite in `PhaseEngine.test.ts` that mocks condition results to produce controlled timing ties. These tests confirm that the priority is correctly applied and that the existing "earliest wins" logic remains intact for distinct timestamps.

## Verification

- `npx tsc --noEmit`: Success.
- `npx vitest run tests/engine/PhaseEngine.test.ts`: 19 tests passed (including 4 new tiebreak-specific cases).
- `npm test`: 108 tests passed across 11 files, confirming no regressions in the wider engine.

## Requirements Advanced

None.

## Requirements Validated

None.

## New Requirements Surfaced

None.

## Requirements Invalidated or Re-scoped

None.

## Operational Readiness

None.

## Deviations

None.

## Known Limitations

None.

## Follow-ups

None.

## Files Created/Modified

None.
