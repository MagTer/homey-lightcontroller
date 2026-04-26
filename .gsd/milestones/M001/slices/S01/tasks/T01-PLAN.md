---
estimated_steps: 1
estimated_files: 7
skills_used: []
---

# T01: Scaffold Homey SDK v3 project with TypeScript ESM and plain api.js

Create the project skeleton at the worktree root so `npx homey app validate --level debug` exits 0. The research in `.gsd/milestones/M001/slices/S01/S01-RESEARCH.md` proved this exact configuration works (see the working sample under `test-app/`). Establish: package.json with `"type": "module"` + Node 22 engines + a `build` script that invokes `tsc`; tsconfig.json with `outDir: ./.homeybuild`, NodeNext module/moduleResolution, ES2022 target; `.homeycompose/app.json` with `id: net.magnus.lightcontroller`, `sdk: 3`, `compatibility: >=12.0.1`, name/description/category/author; a flat `app.ts` extending `Homey.App` (compiles to `.homeybuild/app.js`); a flat plain `api.js` exporting an empty router (copied verbatim by Homey CLI); `assets/icon.svg` placeholder; and `.gitignore` covering `node_modules/` and `.homeybuild/`. Install runtime deps (`homey`, `date-holidays`, `suncalc`) and dev deps (`typescript`, `@types/node`, `@types/suncalc`, and `homey-apps-sdk-v3-types` aliased as `@types/homey`). DO NOT use `npx homey app create` — scaffold by writing files directly per the research recommendation. The worktree root is `/home/magnus/dev/homey-lightcontroller/.gsd/worktrees/M001`. The existing `test-app/` and `dummy-create/` directories are research artifacts — do NOT touch them; they will be cleaned up later.

## Inputs

- ``.gsd/milestones/M001/slices/S01/S01-RESEARCH.md` — proven scaffold recipe and pitfall list`
- ``.gsd/milestones/M001/M001-CONTEXT.md` — milestone constraints (SDK 3, TS ESM, plain api.js, 8-bit PNGs)`
- ``test-app/package.json` — reference of working manifest fields`
- ``test-app/tsconfig.json` — reference of mandatory tsc options`
- ``test-app/.homeycompose/app.json` — reference of working compose manifest`

## Expected Output

- ``package.json` — Node 22 ESM project with build script and pinned Homey/date-holidays/suncalc deps`
- ``tsconfig.json` — NodeNext ES2022 with `outDir: ./.homeybuild``
- ``.homeycompose/app.json` — Homey manifest source of truth (id, sdk, compatibility, etc.)`
- ``app.ts` — TypeScript entry extending `Homey.App` with an `onInit()` log`
- ``api.js` — plain JS API router stub (default export of empty object)`
- ``assets/icon.svg` — placeholder SVG icon required by validator`
- ``.gitignore` — ignores `node_modules/` and `.homeybuild/``

## Verification

cd /home/magnus/dev/homey-lightcontroller/.gsd/worktrees/M001 && npm install && npx homey app validate --level debug
