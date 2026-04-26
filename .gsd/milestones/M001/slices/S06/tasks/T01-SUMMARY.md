---
id: T01
parent: S06
milestone: M001
key_files:
  - src/api.ts
  - api.js
  - app.ts
  - .homeycompose/app.json
  - src/lib/config/saveConfig.ts
  - tests/api/AppSettings.test.ts
key_decisions:
  - Chose strategy (a): extracted pure SettingsStore helper so saveConfig/getConfig logic is testable without Homey SDK mocks — cleaner than testing the App class directly
  - api.ts saveConfig handler relies on app.ts saveConfig to throw ConfigValidationError on bad input rather than catching and re-throwing, keeping the handler thin
  - Did NOT run parseConfig inside getConfig — raw storage value is returned as-is so callers can run parseConfig at their own boundary
  - api.js re-exports from .homeybuild/api.js (NOT ./build/) matching tsconfig outDir
  - Owner API token is NOT logged anywhere — only localUrl is surfaced by getDevices handler
duration: 
verification_result: mixed
completed_at: 2026-04-26T09:59:06.918Z
blocker_discovered: false
---

# T01: Wire backend API handlers, App settings methods, and homey:manager:api permission

**Wire backend API handlers, App settings methods, and homey:manager:api permission**

## What Happened

Built the backend layer for the settings UI in four steps. Created `src/lib/config/saveConfig.ts` as a pure helper with a `SettingsStore` interface so the core logic is testable without Homey SDK mocks — this implements the recommended strategy (a) from the task plan. Extended `app.ts` with `getConfig()` (returns raw stored config or null, no double-parsing) and `saveConfig(raw)` (validates via parseConfig, persists on success, logs structured outcomes with Zod issues on failure). Created `src/api.ts` exporting three loosely-typed handlers: `getConfig` delegates to `homey.app.getConfig()`, `saveConfig` calls through to `homey.app.saveConfig()` and wraps the result as `{ ok: true, version }` (validation errors propagate as thrown errors which Homey's API engine surfaces as 400), and `getDevices` returns the owner API token and local URL without logging the sensitive token. Replaced the root `api.js` with a re-export from `.homeybuild/api.js` (not `./build/`, matching the tsconfig `outDir`). Added `homey:manager:api` permission to `.homeycompose/app.json` so the compiled root `app.json` picks it up after `homey app validate` triggers a TypeScript compile pass. Created `tests/api/AppSettings.test.ts` covering all three required cases (round-trip, validation-no-write, cold-start-null) plus the non-throwing `saveConfigToStoreResult` variant — all 9 new tests pass alongside the existing 73.

## Verification

All 82 tests pass (including 9 new AppSettings tests). TypeScript compiles clean. Homey app validate passes typescript compilation and structural validation; the only remaining publish-level failure is the pre-existing missing `images` property which was already present before this task.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npm test` | 0 | ✅ pass | 935ms |
| 2 | `npx tsc --noEmit` | 0 | ✅ pass | 0ms |
| 3 | `npx homey app validate --level publish` | 1 | ⚠️  pre-existing images issue only | 0ms |

## Deviations

None — used strategy (a) (pure helper `saveConfig.ts`) as recommended, not strategy (b) (App class direct test). This is the cleaner path per the task plan.

## Known Issues

None.

## Files Created/Modified

- `src/api.ts`
- `api.js`
- `app.ts`
- `.homeycompose/app.json`
- `src/lib/config/saveConfig.ts`
- `tests/api/AppSettings.test.ts`
