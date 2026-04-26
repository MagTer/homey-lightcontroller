# S01: Node 20 engine downgrade

**Goal:** Lower the declared Node engine constraint to >=20.0.0 so the app installs on current Homey Pro firmware, and prove the existing TypeScript build and Vitest suite still pass under that constraint without any code or dependency changes.
**Demo:** Run node --version on the target runtime and show 20.x; run npm run build and npm run test from a clean clone and show tsc --noEmit clean plus all 98 Vitest tests passing under engines.node >=20.0.0.

## Must-Haves

- After this: `package.json` declares `"engines": { "node": ">=20.0.0" }`; `npm run build` (tsc) emits no errors; `npm run test` runs the full Vitest suite (98 tests across 10 files) with all green; no source files outside `package.json` are modified by this slice.

## Proof Level

- This slice proves: - This slice proves: contract (the build/test toolchain is compatible with the target engine constraint).
- Real runtime required: no — verification runs on the dev host; live Node 20 runtime smoke is deferred to milestone validation.
- Human/UAT required: no.

## Integration Closure

- Upstream surfaces consumed: `package.json` (engines field) — no source code consumers.
- New wiring introduced in this slice: none — purely a manifest/metadata change.
- What remains before the milestone is truly usable end-to-end: S02 (Reconciler retry), S03 (eager config validation), S04 (PhaseEngine tiebreak). All depend on this slice locking the toolchain.

## Verification

- Not provided.

## Tasks

- [x] **T01: Lower engines.node to >=20.0.0 and prove build + tests still pass** `est:10m`
  Change the `engines.node` field in `package.json` from `">=22.0.0"` to `">=20.0.0"` (single-line edit, line 8). No other files in the repo should change. After the edit, run `npm run build` to confirm `tsc` emits no diagnostics and `npm run test` to confirm the full Vitest suite (currently 98 tests across 10 files) passes unchanged.

**Why this is one task, not several:** The work is a one-line manifest change plus running two existing scripts. There is no implementation to split, no test to author (the existing 98 tests are the verification), and no fixture to set up. Splitting into separate "edit" / "build" / "test" tasks would create three context-window starts for ~5 minutes of work.

**Assumption recorded:** The dev host currently runs Node 22.22.2. A `>=20.0.0` constraint is satisfied by Node 22.x, so `npm run build` and `npm run test` on the dev host are valid evidence that the TS toolchain and runtime APIs the code uses are compatible with the constraint. A literal Node 20.x process check (e.g. via `nvm use 20`) is not required for this slice — it belongs to milestone validation, where a Homey Pro emulator or Node 20 runtime smoke is appropriate. `@types/node` is on `^25.6.0` (a superset of Node 20 types) and `tsconfig.json` targets `ES2022` / `module: NodeNext` — both compatible with Node 20.

**Scope guardrails:**
- Do NOT touch `Reconciler.ts`, `app.ts`, `PhaseEngine.ts`, or any test file — those edits belong to S02–S04.
- Do NOT bump or downgrade `@types/node`, `typescript`, `vitest`, or any dependency.
- Do NOT add an `.nvmrc` or CI workflow — out of scope; the milestone is a surgical engine change.
- If `npm run build` or `npm run test` fails, that is a real signal of a Node-22-only API in transitive deps; investigate and report back rather than silently fixing.
  - Files: `package.json`
  - Verify: Run `grep -q '"node": ">=20.0.0"' package.json` (exit 0), then `npm run build` (exit 0, no tsc errors), then `npm run test` (exit 0; Vitest reports the same passing test count as the milestone baseline of 98 tests across 10 files). Also run `! grep -q '"node": ">=22' package.json` to confirm the old constraint is gone.

## Files Likely Touched

- package.json
