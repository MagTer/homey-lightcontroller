# S02: Configuration & Settings Model

**Goal:** Define the typed configuration domain model (Roles, Phases, time/solar/lux Conditions) using Zod, and provide a pure parser that validates raw JSON into a strongly typed AppConfig object.
**Demo:** Vitest verifies that any valid config JSON parses into a typed object.

## Must-Haves

- Vitest verifies that any valid config JSON parses into a typed AppConfig object, and invalid configs (missing phases, bad time strings, malformed conditions) are rejected with clear errors via the new tests/config/ConfigParser.test.ts suite.

## Proof Level

- This slice proves: This slice proves: contract — pure validation library, no runtime composition. Real runtime: no. Human/UAT: no.

## Integration Closure

Not provided.

## Verification

- Not provided.

## Tasks

- [x] **T01: Add primitive Zod schemas: Role, Phase enum, Condition discriminated union** `est:30m`
  Append primitive schemas to the empty file `src/lib/config/Config.ts`. These are the leaf-level building blocks that T02 will compose into the full AppConfig. No business logic — schemas and inferred types only.

Steps (do them in this order):

1. At the top of `src/lib/config/Config.ts`, add: `import { z } from 'zod';`

2. Add `RoleSchema` and inferred type `Role`:
   - z.object with fields: `id: z.string().min(1)`, `name: z.string().min(1)`.
   - Export both: `export const RoleSchema = z.object({...});` and `export type Role = z.infer<typeof RoleSchema>;`.

3. Add `PhaseSchema` (the enum of the 4-phase state machine) and inferred type `Phase`:
   - `export const PhaseSchema = z.enum(['NIGHT', 'MORNING', 'DAY', 'EVENING']);`
   - `export type Phase = z.infer<typeof PhaseSchema>;`

4. Add three sub-schemas for the condition variants, then combine them with z.discriminatedUnion on the literal field `type`:
   - `TimeConditionSchema` — z.object with `type: z.literal('time')` and `at: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)` (HH:MM, 24-hour).
   - `SolarConditionSchema` — z.object with `type: z.literal('solar')`, `event: z.enum(['sunrise', 'sunset', 'goldenHour', 'goldenHourEnd'])`, `offsetMinutes: z.number().int()`.
   - `LuxConditionSchema` — z.object with `type: z.literal('lux')`, `operator: z.enum(['lt', 'gt'])`, `value: z.number().nonnegative()`.
   - `export const ConditionSchema = z.discriminatedUnion('type', [TimeConditionSchema, SolarConditionSchema, LuxConditionSchema]);`
   - `export type Condition = z.infer<typeof ConditionSchema>;`

5. Export each sub-schema by name as well (TimeConditionSchema, SolarConditionSchema, LuxConditionSchema) so T02 can reference them if needed.

Do NOT add any other schemas in this task. PhaseConfig and AppConfig are T02's job.
  - Files: `src/lib/config/Config.ts`
  - Verify: Run `npx tsc --noEmit` from the project root and confirm zero errors. Then confirm the schemas exist: `grep -q "export const RoleSchema" src/lib/config/Config.ts`, `grep -q "export const PhaseSchema = z.enum" src/lib/config/Config.ts`, `grep -q "discriminatedUnion('type'" src/lib/config/Config.ts` all return success.

- [x] **T02: Add composite Zod schemas: PhaseSchedule, PhaseConfig, AppConfig** `est:30m`
  Extend `src/lib/config/Config.ts` (already populated by T01 with Role, Phase, Condition primitives) with the composite schemas. Append these BELOW the T01 schemas in the same file. Do not modify or remove anything T01 wrote.

Steps (do them in this order):

1. Add `PhaseScheduleSchema` — represents the OR-list of conditions for one schedule slot (weekday or weekend):
   - `export const PhaseScheduleSchema = z.object({ conditions: z.array(ConditionSchema).min(1) });`
   - `export type PhaseSchedule = z.infer<typeof PhaseScheduleSchema>;`

2. Add `RoleStateSchema` — the desired on/off + dim level for one role within a phase:
   - z.object with `onoff: z.boolean()` and `dim: z.number().min(0).max(1).optional()`.
   - Export both schema and inferred type `RoleState`.

3. Add `PhaseConfigSchema` — the per-phase config (one per Phase enum value):
   - z.object with three fields:
     - `weekday: PhaseScheduleSchema`
     - `weekend: PhaseScheduleSchema`
     - `states: z.record(z.string(), RoleStateSchema)`  (keyed by role id → RoleState)
   - Export both schema and inferred type `PhaseConfig`.

4. Add `AppConfigSchema` — the top-level configuration root:
   - z.object with three fields:
     - `version: z.string().min(1)`
     - `roles: z.array(RoleSchema)`
     - `phases: z.object({ NIGHT: PhaseConfigSchema, MORNING: PhaseConfigSchema, DAY: PhaseConfigSchema, EVENING: PhaseConfigSchema })`  — all four phase keys are required, enforced structurally.
   - Export both schema and inferred type `AppConfig`.

Keep the file schema-only — no parser logic, no error classes, no business code. T03 will import AppConfigSchema and AppConfig from here.
  - Files: `src/lib/config/Config.ts`
  - Verify: Run `npx tsc --noEmit` from the project root and confirm zero errors. Then confirm the composites exist: `grep -q "export const PhaseConfigSchema" src/lib/config/Config.ts`, `grep -q "export const AppConfigSchema" src/lib/config/Config.ts`, `grep -q "NIGHT: PhaseConfigSchema" src/lib/config/Config.ts` all return success.

- [x] **T03: Implement parseConfig and safeParseConfig in ConfigParser.ts** `est:30m`
  Replace the empty file `src/lib/config/ConfigParser.ts` with a pure validation wrapper around `AppConfigSchema` from `./Config.js`. No I/O, no logging, no side effects.

Steps (do them in this order):

1. Add imports at the top:
   - `import { z } from 'zod';`
   - `import { AppConfigSchema, type AppConfig } from './Config.js';`  (NodeNext ESM requires the `.js` extension on relative imports — even though the source file is `.ts`).

2. Define the domain error class:
   ```
   export class ConfigValidationError extends Error {
     readonly issues: z.ZodIssue[];
     constructor(message: string, issues: z.ZodIssue[]) {
       super(message);
       this.name = 'ConfigValidationError';
       this.issues = issues;
     }
   }
   ```

3. Add the throwing parser:
   ```
   export function parseConfig(raw: unknown): AppConfig {
     const result = AppConfigSchema.safeParse(raw);
     if (!result.success) {
       const message = result.error.issues
         .map(i => `${i.path.join('.') || '<root>'}: ${i.message}`)
         .join('; ');
       throw new ConfigValidationError(message, result.error.issues);
     }
     return result.data;
   }
   ```

4. Add the non-throwing variant:
   ```
   export function safeParseConfig(raw: unknown):
     | { ok: true; config: AppConfig }
     | { ok: false; error: ConfigValidationError } {
     try {
       return { ok: true, config: parseConfig(raw) };
     } catch (e) {
       if (e instanceof ConfigValidationError) return { ok: false, error: e };
       throw e;
     }
   }
   ```

5. Re-export the AppConfig type for caller convenience: `export type { AppConfig } from './Config.js';`

Do NOT write tests in this task — T04 owns the test file.
  - Files: `src/lib/config/ConfigParser.ts`
  - Verify: Run `npx tsc --noEmit` from the project root and confirm zero errors. Then confirm the exports exist: `grep -q "export class ConfigValidationError" src/lib/config/ConfigParser.ts`, `grep -q "export function parseConfig" src/lib/config/ConfigParser.ts`, `grep -q "export function safeParseConfig" src/lib/config/ConfigParser.ts` all return success.

- [x] **T04: Write Vitest suite covering valid + 4 invalid config cases** `est:45m`
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
  - Files: `tests/config/ConfigParser.test.ts`
  - Verify: Run `npm test` from the project root — the suite at tests/config/ConfigParser.test.ts must report 5 passing tests and 0 failing. Then `npx tsc --noEmit` returns zero errors.

## Files Likely Touched

- src/lib/config/Config.ts
- src/lib/config/ConfigParser.ts
- tests/config/ConfigParser.test.ts
