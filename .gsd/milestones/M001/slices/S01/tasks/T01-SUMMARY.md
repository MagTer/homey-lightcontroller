---
id: T01
parent: S01
milestone: M001
key_files:
  - (none)
key_decisions:
  - (none)
duration: 
verification_result: passed
completed_at: 2026-04-25T21:52:47.531Z
blocker_discovered: false
---

# T01: Scaffold Homey SDK v3 project with TypeScript ESM and plain api.js

**Scaffold Homey SDK v3 project with TypeScript ESM and plain api.js**

## What Happened

Scaffolded the root directory with `package.json`, `tsconfig.json`, `.homeycompose/app.json`, `app.ts`, `api.js`, and `assets/icon.svg`. Installed required dependencies including `homey`, `suncalc`, `date-holidays`, alongside the TypeScript and Vitest toolchains. Manually established the root `app.json` so that `npx homey app validate` functions perfectly out of the box with the mandated `.homeybuild/` structure. Added a basic `vitest` suite to verify test execution capability.

## Verification

Successfully executed `npx homey app validate --level debug` to verify Homey's built-in TypeScript compilation respects `.homeybuild/` structure and ESM constraints. Additionally verified test capabilities via `npm run test` using Vitest.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npx homey app validate --level debug` | 0 | pass | 4000ms |
| 2 | `npm run test` | 0 | pass | 169ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

None.
