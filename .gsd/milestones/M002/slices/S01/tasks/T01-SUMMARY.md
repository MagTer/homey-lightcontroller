---
id: T01
parent: S01
milestone: M002
key_files:
  - package.json
key_decisions:
  - Lowered engines.node to >=20.0.0 — ES2022 target and NodeNext module are both Node 20 features; no tsconfig, type-dep, or code changes were needed to pass the full build and test suite under the new constraint.
duration: 
verification_result: passed
completed_at: 2026-04-26T20:11:42.514Z
blocker_discovered: false
---

# T01: Lowered engines.node from >=22.0.0 to >=20.0.0; tsc clean + 98/98 Vitest tests pass

**Lowered engines.node from >=22.0.0 to >=20.0.0; tsc clean + 98/98 Vitest tests pass**

## What Happened

Changed the `engines.node` field in `package.json` from `">=22.0.0"` to `">=20.0.0"` via a single-line text replacement. Confirmed `tsconfig.json` targets ES2022 / NodeNext module — both supported by Node 20, so no tsconfig changes were needed. `@types/node` on `^25.6.0` is a superset of Node 20 types, so no type-dep changes were required. After the edit, ran `npm run build` (tsc — no diagnostics) and `npm run test` (Vitest — all 10 test files, 98 tests, 0 failures). All verification checks passed on the first attempt. No code, dependency, or config changes were made beyond the single `engines.node` field.

## Verification

Three sequential checks verified the change. (1) `grep -q '"node": ">=20.0.0"' package.json` confirmed the new constraint is present. (2) `! grep -q '"node": ">=22' package.json` confirmed the old constraint is gone. (3) `npm run build` ran `tsc` with zero diagnostics and exit 0. (4) `npm run test` ran the full Vitest suite: 10 test files, 98 tests, all passing in 1.09s.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `grep -q '"node": ">=20.0.0"' package.json` | 0 | ✅ pass | 0ms |
| 2 | `! grep -q '"node": ">=22' package.json` | 0 | ✅ pass | 0ms |
| 3 | `npm run build` | 0 | ✅ pass | 0ms |
| 4 | `npm run test` | 0 | ✅ pass | 1090ms |

## Deviations

None. The plan called for a single-line edit and two script runs; all were executed exactly as specified.

## Known Issues

None.

## Files Created/Modified

- `package.json`
