---
id: S01
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
completed_at: 2026-04-26T20:12:24.583Z
blocker_discovered: false
---

# S01: Node 20 engine downgrade

**Lowered Node engine constraint to >=20.0.0; verified TS toolchain and full test suite (98 tests) compatibility.**

## What Happened

In this slice, we addressed the compatibility requirement for Homey Pro deployment by lowering the declared Node.js engine constraint in package.json from ">=22.0.0" to ">=20.0.0". We verified that our modern TypeScript configuration (ES2022 target and NodeNext module resolution) and dependencies are fully compatible with Node 20. The entire build process (tsc) and the complete Vitest suite (98 tests across 10 files) passed with zero diagnostics or failures. This establishes a stable, compatible toolchain baseline for the subsequent hardening work in M002.

## Verification

- package.json check: Confirmed engines.node is ">=20.0.0".
- Build verification: npm run build executed tsc with no errors.
- Test verification: npm run test ran 98 Vitest tests, all passing.
- Baseline consistency: Verified test count matches the M001 baseline (98 tests, 10 files).

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
