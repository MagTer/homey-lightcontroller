# S01: Project Scaffold & Infrastructure

**Goal:** Establish a buildable, validate-clean Homey App SDK v3 project (TypeScript ESM + plain `api.js`) with Vitest wired up, so subsequent slices can land logic against a working foundation.
**Demo:** Project validates with npx homey app validate.

## Must-Haves

- A demo run of `npm install && npx homey app validate --level debug` exits 0, and `npm test` runs a Vitest smoke test that passes — proving the toolchain (Homey CLI build pipeline + Vitest) is end-to-end functional from the project root.

## Proof Level

- This slice proves: - This slice proves: contract (the project's build/validate contract with the Homey CLI is satisfied)
- Real runtime required: no (no Homey Pro device involved; CLI validation only)
- Human/UAT required: no

## Integration Closure

Not provided.

## Verification

- Not provided.

## Tasks

- [x] **T01: Scaffold Homey SDK v3 project with TypeScript ESM and plain api.js** `est:1h`
  Create the project skeleton at the worktree root so `npx homey app validate --level debug` exits 0. The research in `.gsd/milestones/M001/slices/S01/S01-RESEARCH.md` proved this exact configuration works (see the working sample under `test-app/`). Establish: package.json with `"type": "module"` + Node 22 engines + a `build` script that invokes `tsc`; tsconfig.json with `outDir: ./.homeybuild`, NodeNext module/moduleResolution, ES2022 target; `.homeycompose/app.json` with `id: net.magnus.lightcontroller`, `sdk: 3`, `compatibility: >=12.0.1`, name/description/category/author; a flat `app.ts` extending `Homey.App` (compiles to `.homeybuild/app.js`); a flat plain `api.js` exporting an empty router (copied verbatim by Homey CLI); `assets/icon.svg` placeholder; and `.gitignore` covering `node_modules/` and `.homeybuild/`. Install runtime deps (`homey`, `date-holidays`, `suncalc`) and dev deps (`typescript`, `@types/node`, `@types/suncalc`, and `homey-apps-sdk-v3-types` aliased as `@types/homey`). DO NOT use `npx homey app create` — scaffold by writing files directly per the research recommendation. The worktree root is `/home/magnus/dev/homey-lightcontroller/.gsd/worktrees/M001`. The existing `test-app/` and `dummy-create/` directories are research artifacts — do NOT touch them; they will be cleaned up later.
  - Files: `package.json`, `tsconfig.json`, `.homeycompose/app.json`, `app.ts`, `api.js`, `assets/icon.svg`, `.gitignore`
  - Verify: cd /home/magnus/dev/homey-lightcontroller/.gsd/worktrees/M001 && npm install && npx homey app validate --level debug

- [x] **T02: Wire Vitest with a smoke test that proves the test runner works** `est:30m`
  Add Vitest as a dev dependency, add a `test` script (`vitest run`) to `package.json`, create a `vitest.config.ts` (or rely on defaults — pick one and document the choice), and write `tests/smoke.test.ts` containing one trivial assertion (e.g. `expect(1 + 1).toBe(2)`) plus one assertion that imports something from `app.ts` to confirm TS ESM resolution works inside Vitest. Vitest must run without needing the Homey runtime — if importing `app.ts` triggers the `homey` package and that fails under Node, instead import a small typed helper module (e.g. create `src/lib/version.ts` that exports a constant) and assert against it. The point is to prove the test toolchain is functional end-to-end so S02+ can write real unit tests immediately. Do NOT alter the Homey scaffold from T01 beyond appending the `test` script and `vitest` to devDependencies in `package.json`.
  - Files: `package.json`, `vitest.config.ts`, `tests/smoke.test.ts`, `src/lib/version.ts`
  - Verify: cd /home/magnus/dev/homey-lightcontroller/.gsd/worktrees/M001 && npm test

## Files Likely Touched

- package.json
- tsconfig.json
- .homeycompose/app.json
- app.ts
- api.js
- assets/icon.svg
- .gitignore
- vitest.config.ts
- tests/smoke.test.ts
- src/lib/version.ts
