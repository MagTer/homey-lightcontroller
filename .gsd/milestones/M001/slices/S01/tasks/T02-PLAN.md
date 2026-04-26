---
estimated_steps: 1
estimated_files: 4
skills_used: []
---

# T02: Wire Vitest with a smoke test that proves the test runner works

Add Vitest as a dev dependency, add a `test` script (`vitest run`) to `package.json`, create a `vitest.config.ts` (or rely on defaults — pick one and document the choice), and write `tests/smoke.test.ts` containing one trivial assertion (e.g. `expect(1 + 1).toBe(2)`) plus one assertion that imports something from `app.ts` to confirm TS ESM resolution works inside Vitest. Vitest must run without needing the Homey runtime — if importing `app.ts` triggers the `homey` package and that fails under Node, instead import a small typed helper module (e.g. create `src/lib/version.ts` that exports a constant) and assert against it. The point is to prove the test toolchain is functional end-to-end so S02+ can write real unit tests immediately. Do NOT alter the Homey scaffold from T01 beyond appending the `test` script and `vitest` to devDependencies in `package.json`.

## Inputs

- ``package.json` — extend with `test` script and vitest devDep (created by T01)`
- ``tsconfig.json` — Vitest uses the same TS config (created by T01)`
- ``app.ts` — confirm TS ESM source layout is testable (created by T01)`

## Expected Output

- ``package.json` — adds `"test": "vitest run"` script and `vitest` in devDependencies`
- ``vitest.config.ts` — minimal Vitest config (Node env, picks up `tests/**/*.test.ts`)`
- ``tests/smoke.test.ts` — passing smoke test asserting toolchain works`
- ``src/lib/version.ts` — small typed helper imported by the smoke test to prove TS ESM resolution`

## Verification

cd /home/magnus/dev/homey-lightcontroller/.gsd/worktrees/M001 && npm test
