# S01: Project Scaffold & Infrastructure — Research

**Date:** 2026-04-25

## Summary

The goal of S01 is to scaffold a Homey App targeting SDK v3 with TypeScript ESM and a plain JavaScript `api.js`, culminating in a clean pass from `npx homey app validate`. Through research and tests with the Homey CLI (`npx homey`), we verified how Homey's built-in TypeScript pipeline functions.

Homey CLI natively supports TypeScript, but it is highly opinionated. If it detects a `tsconfig.json`, it copies the source code to `.homeybuild/` and then runs `npm run build` in the project root. It strictly enforces that `tsconfig.json` has `"outDir": "./.homeybuild"`. Furthermore, ESM applications (`"type": "module"`) require a specific compatibility flag (`"compatibility": ">=12.0.1"`) in their `app.json`. 

## Recommendation

We should scaffold the project from scratch rather than wrestling with the interactive `homey app create` CLI prompts. We will establish a flat structure for the entry points (`app.ts` and `api.js`) so that when the Homey CLI compiles them into `.homeybuild/`, they reside at the expected root paths (`.homeybuild/app.js` and `.homeybuild/api.js`).

## Implementation Landscape

### Key Files

- `package.json` — Must include `"type": "module"`, `"scripts": { "build": "tsc", "test": "vitest run" }`, dependencies (`date-holidays`, `suncalc`, `homey`), and devDependencies (`typescript`, `vitest`, `@types/node`, `@types/suncalc`, `@types/homey` mapped to `homey-apps-sdk-v3-types`).
- `tsconfig.json` — Must define `"outDir": "./.homeybuild"`, `"module": "NodeNext"`, `"moduleResolution": "NodeNext"`, and `"target": "ES2022"`.
- `.homeycompose/app.json` — The source of truth for the manifest. Must include `"id": "net.magnus.lightcontroller"`, `"version": "1.0.0"`, `"sdk": 3`, and crucially `"compatibility": ">=12.0.1"`.
- `app.ts` — The main entry point in TypeScript, extending `Homey.App`.
- `api.js` — The API router entry point. As mandated by requirements, this must be plain JavaScript (not compiled by TypeScript).
- `assets/icon.svg` — A dummy SVG required for the project to pass strict validation.
- `.gitignore` — Should ignore `node_modules/` and `.homeybuild/`.

### Build Order

1. **`package.json` & dependencies** — Establishes the Node environment (Node 22 / ESM).
2. **`tsconfig.json`** — Hooks into Homey's built-in build step.
3. **`.homeycompose/app.json` & `assets/icon.svg`** — Sets up the Homey metadata structure.
4. **`app.ts` & `api.js`** — Fulfills the entry-point requirement.

### Verification Approach

Run `npm install` followed by `npx homey app validate --level debug`. A successful exit code confirms the scaffolding respects Homey's constraints, including the strict TypeScript `outDir` check and ESM compatibility threshold.

## Constraints

- Homey CLI throws a hard error if `tsconfig.json` specifies an `outDir` other than `./.homeybuild`.
- ESM applications require `app.json` to have `"compatibility": ">=12.0.1"`.
- `api.js` must be plain JavaScript. Place it in the root so it gets copied verbatim to `.homeybuild/` without TS transformation.

## Common Pitfalls

- **Incorrect TS Output Path** — Using standard output paths like `dist/` or `build/` will crash `homey app validate` with an explicit check failure.
- **Editing `app.json` directly** — The root `app.json` is generated. All manifest edits must happen in `.homeycompose/app.json`.
- **Missing NPM Scripts** — The Homey CLI will attempt to execute `npm run build`; if this script is missing from `package.json`, validation will fail.

## Skills Discovered

| Technology | Skill | Status |
|------------|-------|--------|
| Homey App  | dvflw/homey-app-skill@homey-app | installed |
| Homey CLI  | sundial-org/awesome-openclaw-skills@homey-cli | installed |