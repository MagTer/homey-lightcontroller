---
id: S03
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
completed_at: 2026-04-26T21:11:04.021Z
blocker_discovered: false
---

# S03: Eager config validation in onInit

**Eager Zod-validated configuration guard in onInit prevents execution on corrupt or missing settings.**

## What Happened

This slice hardened the application startup sequence by introducing an eager validation gate in MyApp.onInit(). Previously, the app would proceed with initialization even if the persisted configuration was missing or invalid, potentially leading to runtime errors in the engine. We integrated safeParseConfig into the boot flow, ensuring that getConfigFromStore() is called and validated before any flow cards are registered or the engine is prepared.

On failure (null config or Zod validation errors), the app now logs a structured error via this.error()—including specific Zod path/message details for corrupt configs—and returns early. This effectively prevents the app from entering a running state with an invalid configuration. The public getConfig() signature was preserved to ensure backward compatibility with existing engine code. Verification was achieved through a new suite of SDK-free unit tests in tests/api/AppInit.test.ts that simulate cold starts and corrupted stores.

## Verification

- npm run build: Clean tsc output.
- npm test: 106 tests passing (including 4 new AppInit scenarios).
- tests/api/AppInit.test.ts: Covers null config, invalid config (missing phase), valid config, and error message actionability.
- Manual check: app.ts getConfig() signature remains AppConfig | null.

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
