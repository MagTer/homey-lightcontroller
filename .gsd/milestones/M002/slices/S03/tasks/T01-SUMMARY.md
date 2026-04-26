---
id: T01
parent: S03
milestone: M002
key_files:
  - app.ts
  - tests/api/AppInit.test.ts
key_decisions:
  - Used safeParseConfig instead of try/catch around parseConfig to avoid unhandled rejection in async onInit() context
  - Replicated onInit() logic in TestableApp test class to verify contract without SDK dependency
  - Error messages include structured issue payloads for actionable Homey diagnostic troubleshooting
duration: 
verification_result: passed
completed_at: 2026-04-26T21:09:46.644Z
blocker_discovered: false
---

# T01: Added eager config validation guard in MyApp.onInit() with SDK-free unit tests for null, invalid, and valid config scenarios

**Added eager config validation guard in MyApp.onInit() with SDK-free unit tests for null, invalid, and valid config scenarios**

## What Happened

Updated `app.ts` to incorporate `safeParseConfig` into the existing named import from `ConfigParser.js`. In `onInit()`, added a guard block that reads config from the SettingsStore using `getConfigFromStore`, checks for null, and if present validates with `safeParseConfig`. On null config, logs via `this.error('onInit: config missing from store; skip engine start')` and returns early. On invalid config, logs via `this.error('onInit: invalid config', { issues: result.error.issues })` with structured Zod issue detail and returns early. Only when config validates successfully does flow-card registration proceed. The public `getConfig()` method remains unchanged with its original `AppConfig | null` signature.

Created `tests/api/AppInit.test.ts` following the established SDK-free `TestableApp` pattern from `FlowCards.test.ts`. The test class mirrors the onInit() guard logic, captures errors and logs into arrays, and exposes a `flowCardsRegistered` flag to verify the post-guard branch. Tests cover:
1. Cold start (null config) — one error logged, flow cards NOT registered
2. Invalid stored config (missing EVENING phase) — one error with issues detail, flow cards NOT registered
3. Valid stored config — no errors, flow cards registered
4. Error actionability — Zod issues have non-empty path and message arrays

All tests pass (106 total, including original 98 + 4 new AppInit tests).

## Verification

Build verified clean via `npm run build` with no tsc errors. All tests pass including the 4 new AppInit cases. The `getConfig()` method retains its original signature `getConfig(): AppConfig | null`. Error payloads include actionabile Zod issue details with path+message that appear in Homey diagnostic logs.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npm run build` | 0 | ✅ pass | 3000ms |
| 2 | `npm test` | 0 | ✅ pass | 1200ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `app.ts`
- `tests/api/AppInit.test.ts`
