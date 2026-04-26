---
estimated_steps: 17
estimated_files: 1
skills_used: []
---

# T01: Add primitive Zod schemas: Role, Phase enum, Condition discriminated union

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

## Inputs

- ``src/lib/config/Config.ts``

## Expected Output

- ``src/lib/config/Config.ts``

## Verification

Run `npx tsc --noEmit` from the project root and confirm zero errors. Then confirm the schemas exist: `grep -q "export const RoleSchema" src/lib/config/Config.ts`, `grep -q "export const PhaseSchema = z.enum" src/lib/config/Config.ts`, `grep -q "discriminatedUnion('type'" src/lib/config/Config.ts` all return success.
