---
id: S07
parent: M001
milestone: M001
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
completed_at: 2026-04-26T10:17:44.941Z
blocker_discovered: false
---

# S07: S07: Flow Cards & REST API

**Expose phase state machine via Homey Flow Action cards and REST PUT endpoint.**

## What Happened

In this slice, we unified the app's state machine with external control surfaces. We extended the `App` class with a `_forcedPhase` property and a `forcePhase()` setter that uses the shared `PhaseSchema` for strict input validation. This setter was then wired to a new `set_phase` Homey Flow action card and a `PUT /phase` REST API handler in `src/api.ts`. We also registered a `phase_changed` trigger card, preparing the app for reactive automation in subsequent slices. The implementation follows the "Delegated Validation" pattern, where the entry points (API/Flow) perform minimal logic and rely on the core App class to enforce state rules. Extensive Vitest coverage ensures that both valid phase changes and invalid inputs (resulting in Zod errors) are handled correctly without corrupting the app's internal state.

## Verification

98 tests passing in Vitest (including new API/Flow coverage). Homey CLI validator confirms correct registration of `set_phase` action and `phase_changed` trigger cards. TypeScript compilation is clean.

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
