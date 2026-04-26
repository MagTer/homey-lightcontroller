---
id: T03
parent: S07
milestone: M001
key_files:
  - tests/api/RestApi.test.ts
  - tests/api/FlowCards.test.ts
key_decisions:
  - FlowCards.test.ts uses a plain TestableApp class mirroring MyApp.forcePhase logic — avoids the Homey SDK module dependency and lets tests run in Node environment without a mock module stub.
  - FlowCards tests verify the ZodError leaves _forcedPhase unchanged rather than setting it — this is critical because a partial write before throwing would corrupt the forced-phase state.
duration: 
verification_result: passed
completed_at: 2026-04-26T10:16:57.747Z
blocker_discovered: false
---

# T03: Added Vitest coverage for REST putPhase handler and App forcePhase/getForcedPhase contract

**Added Vitest coverage for REST putPhase handler and App forcePhase/getForcedPhase contract**

## What Happened

Created two test files using the existing fake-Homey mock pattern. RestApi.test.ts verified the PUT /phase handler delegates to app.forcePhase, propagates ZodError on invalid phase, and passes undefined for missing body/body.phase (the App is the single validation point — no validation in the handler). FlowCards.test.ts verified the forcePhase/getForcedPhase contract: valid phases set _forcedPhase and are observable via getForcedPhase(); invalid phases throw ZodError while leaving _forcedPhase unchanged; consecutive overrides (NIGHT then DAY) result in getForcedPhase() === 'DAY'. All 98 tests pass (82 from S06 + 16 new).

## Verification

Verified by running `npx vitest run tests/api/RestApi.test.ts tests/api/FlowCards.test.ts` (16 tests, all pass) and `npx vitest run` (all 98 tests pass including the 82 pre-existing from S06). FlowCards negative-path tests confirm that ZodError for invalid/undefined phase leaves _forcedPhase unchanged, protecting the redaction contract — the error log `{ raw }` captures only the offending value (an enum), not PII.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npx vitest run tests/api/RestApi.test.ts tests/api/FlowCards.test.ts` | 0 | ✅ pass | 205ms |
| 2 | `npx vitest run` | 0 | ✅ pass | 1000ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `tests/api/RestApi.test.ts`
- `tests/api/FlowCards.test.ts`
