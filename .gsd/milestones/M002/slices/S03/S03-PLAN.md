# S03: Eager config validation in onInit

**Goal:** Make `MyApp.onInit()` eagerly read and validate the stored config via the Zod parser. On null or invalid config, log via `this.error(...)` with structured detail and return early without registering flow cards. Preserve `getConfig()`'s existing `AppConfig | null` signature and behavior.
**Demo:** Vitest test for MyApp.onInit (against a mock SettingsStore) proves: (a) valid stored config → no error logged, app marked ready for engine startup; (b) null stored config → this.error called with a 'config-missing' detail and engine startup is skipped; (c) invalid stored config → this.error called with structured Zod issue detail and engine startup is skipped. getConfig() signature remains AppConfig | null.

## Must-Haves

- `app.ts` `onInit()` reads stored config via `getConfigFromStore` before doing anything else.
- On `null` config: `this.error('onInit: no config found, skipping engine init')` is called and the method returns before flow-card registration.
- On invalid config: `safeParseConfig` returns `ok:false`; `this.error(...)` is called with `{ issues }` structured detail and the method returns before flow-card registration.
- On valid config: no error logged, flow-card registration proceeds exactly as before.
- `getConfig()` signature, return type (`AppConfig | null`), and behavior are unchanged.
- New Vitest file `tests/api/AppInit.test.ts` covers the four scenarios listed in S03-RESEARCH.md.
- Full test suite (was 98 tests; now ≥98 + new AppInit cases) passes; `tsc --noEmit` is clean.

## Proof Level

- This slice proves: unit-test

## Integration Closure

Boundary closed: app lifecycle ↔ persisted settings store. Before this slice, `onInit()` ignored the store entirely and any invalidity surfaced only at the next `saveConfig()` call. After this slice, every cold start checks the store and refuses to register flow cards on an unconfigured/corrupt install. Engine startup wiring remains explicitly out of scope (D004, MEM004) — M002 only establishes the contract; a future milestone wires the engine to it.

## Verification

- A new failure mode at app boot is now logged via `this.error(...)`. This is the only surface that diagnoses a missing or corrupted persisted config without requiring the user to reproduce a save flow. The error payload includes Zod issues for invalid configs so the Homey diagnostic log identifies the offending field path. No metrics or traces — Homey App SDK exposes only `this.log` / `this.error`.

## Tasks

- [x] **T01: Add eager config validation to MyApp.onInit and unit-test the four guard scenarios** `est:1h`
  Update `app.ts` so `onInit()` reads the stored config via `getConfigFromStore`, runs it through `safeParseConfig`, and on any failure (null or Zod-invalid) calls `this.error(...)` with a structured detail object and returns before the existing flow-card registration block. On a successful parse, the existing flow-card registration code runs unchanged. The public `getConfig()` method must remain `AppConfig | null` and untouched.

Add `safeParseConfig` to the existing named import on `app.ts` line 2 (do not add a new import line). Use `safeParseConfig` rather than wrapping `parseConfig` in try/catch — the discriminated-union return is cleaner and matches the Homey-async-void context where a thrown error would surface as an unhandled rejection.

Create `tests/api/AppInit.test.ts` following the SDK-free `TestableApp` pattern from `tests/api/FlowCards.test.ts`. Mirror the new `onInit` logic in a local class that:
- accepts a stub `SettingsStore` in its constructor,
- exposes captured `errors: Array<{ msg: string; detail?: unknown }>` and `logs: string[]`,
- exposes a captured `flowCardsRegistered: boolean` flag set inside the post-guard branch,
- replicates the new guard exactly so the test verifies the contract logic (not the SDK wiring).

Reuse the `validConfig` fixture from `tests/api/AppSettings.test.ts` (copy or import — copying is fine and matches existing test style). Cover four cases:
  1. **Cold start (null):** stub store returns `null` for `'config'`. Expect exactly one `errors` entry whose msg starts with 'onInit:' and references missing/no config; expect `flowCardsRegistered === false`.
  2. **Invalid stored config:** stub store returns a malformed object (e.g. delete `phases.EVENING` from a clone of `validConfig`). Expect one `errors` entry whose detail contains a non-empty `issues` array (Zod issues with at least one `path`/`message`); expect `flowCardsRegistered === false`.
  3. **Valid stored config:** stub store returns a clone of `validConfig`. Expect `errors.length === 0` and `flowCardsRegistered === true`.
  4. **Error message actionability:** for the invalid case, assert at least one issue has a non-empty `path` array AND a non-empty `message` so the Homey diagnostic log will contain enough detail to fix the config.

Run `npm run build` and `npm test` from the worktree root and confirm tsc is clean and the full suite (previously 98 tests) plus the new AppInit cases all pass.
  - Files: `app.ts`, `tests/api/AppInit.test.ts`
  - Verify: From `/home/magnus/dev/homey-lightcontroller/.gsd/worktrees/M002` run `npm run build` (must exit 0, no tsc errors) and `npm test` (must show all prior tests still passing plus the new `AppInit.test.ts` cases — ≥ 98 + new tests, zero failures). Manually re-read `app.ts` `getConfig()` to confirm its signature is unchanged: `getConfig(): AppConfig | null`.

## Files Likely Touched

- app.ts
- tests/api/AppInit.test.ts
