---
estimated_steps: 21
estimated_files: 1
skills_used: []
---

# T02: Add composite Zod schemas: PhaseSchedule, PhaseConfig, AppConfig

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

## Inputs

- ``src/lib/config/Config.ts``

## Expected Output

- ``src/lib/config/Config.ts``

## Verification

Run `npx tsc --noEmit` from the project root and confirm zero errors. Then confirm the composites exist: `grep -q "export const PhaseConfigSchema" src/lib/config/Config.ts`, `grep -q "export const AppConfigSchema" src/lib/config/Config.ts`, `grep -q "NIGHT: PhaseConfigSchema" src/lib/config/Config.ts` all return success.
