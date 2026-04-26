---
estimated_steps: 13
estimated_files: 2
skills_used: []
---

# T01: Add eager config validation to MyApp.onInit and unit-test the four guard scenarios

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

## Inputs

- ``app.ts``
- ``src/lib/config/ConfigParser.ts``
- ``src/lib/config/saveConfig.ts``
- ``tests/api/FlowCards.test.ts``
- ``tests/api/AppSettings.test.ts``
- ``.gsd/milestones/M002/slices/S03/S03-RESEARCH.md``

## Expected Output

- ``app.ts``
- ``tests/api/AppInit.test.ts``

## Verification

From `/home/magnus/dev/homey-lightcontroller/.gsd/worktrees/M002` run `npm run build` (must exit 0, no tsc errors) and `npm test` (must show all prior tests still passing plus the new `AppInit.test.ts` cases — ≥ 98 + new tests, zero failures). Manually re-read `app.ts` `getConfig()` to confirm its signature is unchanged: `getConfig(): AppConfig | null`.

## Observability Impact

Adds two new `this.error(...)` call sites in `onInit()`. Both include a structured detail object: the null path logs `{ }` (or no detail), and the invalid-parse path logs `{ issues }` with the Zod issue array. This is the sole diagnostic surface for boot-time config problems on a Homey Pro device, so the error messages must be human-readable and the issue payload must include path+message — both are asserted in the new test.
