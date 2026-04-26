---
estimated_steps: 21
estimated_files: 1
skills_used: []
---

# T04: Write Vitest suite covering valid + 4 invalid config cases

Create `tests/config/ConfigParser.test.ts` with a Vitest suite that proves the parser. The vitest.config.ts globs `tests/**/*.test.ts`, so this exact path is required — do NOT colocate under `src/`. The directory `tests/config/` does not yet exist; the writer tool will create it.

Steps (do them in this order):

1. Add imports at the top (NodeNext ESM — `.js` suffix on relative imports):
   ```
   import { describe, it, expect } from 'vitest';
   import { parseConfig, safeParseConfig, ConfigValidationError } from '../../src/lib/config/ConfigParser.js';
   ```

2. Define a `validConfig` constant inline at the top of the file — a minimal but complete object literal with: `version: '1.0.0'`, `roles: [{ id: 'living', name: 'Living Room' }]`, and `phases` containing all four keys NIGHT/MORNING/DAY/EVENING. Each PhaseConfig should have:
   - `weekday: { conditions: [{ type: 'time', at: '07:00' }] }`
   - `weekend: { conditions: [{ type: 'solar', event: 'sunrise', offsetMinutes: -30 }] }`
   - `states: { living: { onoff: true, dim: 0.5 } }`
   Use a different condition variant in at least one phase so all three discriminated-union branches (time, solar, lux) are exercised across the fixture. Use `as const` on the literal-typed fields if needed to keep TypeScript happy, or cast via `as unknown` since the input type is `unknown`.

3. Wrap all tests in `describe('ConfigParser', () => { ... })`.

4. Add these 5 `it` blocks:
   - `it('parses a fully valid config into a typed AppConfig', ...)` — call `parseConfig(validConfig)`, expect the result to deeply equal `validConfig` (use `expect(result).toEqual(validConfig)`).
   - `it('throws ConfigValidationError when a phase key is missing', ...)` — clone validConfig, delete `phases.EVENING`, expect `() => parseConfig(broken)` to throw an instance of `ConfigValidationError`.
   - `it('rejects invalid time strings like 25:99', ...)` — clone validConfig, set `phases.MORNING.weekday.conditions[0]` to `{ type: 'time', at: '25:99' }`, expect throw of `ConfigValidationError`.
   - `it('rejects malformed conditions (unknown solar event)', ...)` — clone, set a condition to `{ type: 'solar', event: 'midnight', offsetMinutes: 0 }`, expect throw of `ConfigValidationError`.
   - `it('safeParseConfig returns ok:false on invalid input instead of throwing', ...)` — call `safeParseConfig({ totally: 'wrong' })`, expect `result.ok` to be `false` and `result.error` to be an instance of `ConfigValidationError`.

5. Use structured cloning helpers: `const clone = <T>(o: T): T => JSON.parse(JSON.stringify(o));` near the top so each test gets an independent copy of validConfig.

No dependencies on paths under `.gsd/`, `.planning/`, or `.audits/` — fixtures are inline only.

## Inputs

- ``src/lib/config/Config.ts``
- ``src/lib/config/ConfigParser.ts``

## Expected Output

- ``tests/config/ConfigParser.test.ts``

## Verification

Run `npm test` from the project root — the suite at tests/config/ConfigParser.test.ts must report 5 passing tests and 0 failing. Then `npx tsc --noEmit` returns zero errors.
