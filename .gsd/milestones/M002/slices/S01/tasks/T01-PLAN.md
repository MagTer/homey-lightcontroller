---
estimated_steps: 8
estimated_files: 1
skills_used: []
---

# T01: Lower engines.node to >=20.0.0 and prove build + tests still pass

Change the `engines.node` field in `package.json` from `">=22.0.0"` to `">=20.0.0"` (single-line edit, line 8). No other files in the repo should change. After the edit, run `npm run build` to confirm `tsc` emits no diagnostics and `npm run test` to confirm the full Vitest suite (currently 98 tests across 10 files) passes unchanged.

**Why this is one task, not several:** The work is a one-line manifest change plus running two existing scripts. There is no implementation to split, no test to author (the existing 98 tests are the verification), and no fixture to set up. Splitting into separate "edit" / "build" / "test" tasks would create three context-window starts for ~5 minutes of work.

**Assumption recorded:** The dev host currently runs Node 22.22.2. A `>=20.0.0` constraint is satisfied by Node 22.x, so `npm run build` and `npm run test` on the dev host are valid evidence that the TS toolchain and runtime APIs the code uses are compatible with the constraint. A literal Node 20.x process check (e.g. via `nvm use 20`) is not required for this slice — it belongs to milestone validation, where a Homey Pro emulator or Node 20 runtime smoke is appropriate. `@types/node` is on `^25.6.0` (a superset of Node 20 types) and `tsconfig.json` targets `ES2022` / `module: NodeNext` — both compatible with Node 20.

**Scope guardrails:**
- Do NOT touch `Reconciler.ts`, `app.ts`, `PhaseEngine.ts`, or any test file — those edits belong to S02–S04.
- Do NOT bump or downgrade `@types/node`, `typescript`, `vitest`, or any dependency.
- Do NOT add an `.nvmrc` or CI workflow — out of scope; the milestone is a surgical engine change.
- If `npm run build` or `npm run test` fails, that is a real signal of a Node-22-only API in transitive deps; investigate and report back rather than silently fixing.

## Inputs

- ``package.json` — the manifest whose `engines.node` field is being lowered (current value `">=22.0.0"` at line 8)`
- ``tsconfig.json` — read-only; confirms `target: ES2022` and `module: NodeNext` are Node 20-compatible (no change required)`

## Expected Output

- ``package.json` — modified so `engines.node` is `">=20.0.0"` and no other field changes`

## Verification

Run `grep -q '"node": ">=20.0.0"' package.json` (exit 0), then `npm run build` (exit 0, no tsc errors), then `npm run test` (exit 0; Vitest reports the same passing test count as the milestone baseline of 98 tests across 10 files). Also run `! grep -q '"node": ">=22' package.json` to confirm the old constraint is gone.
