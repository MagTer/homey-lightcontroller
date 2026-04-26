# S02: Configuration & Settings Model — Research

**Date:** 2026-04-26

## Summary

Slice S02 establishes the Configuration & Settings Model, the core domain types that drive the 4-phase state machine (NIGHT, MORNING, DAY, EVENING), device roles, and transition schedules (Time, Solar, Lux). It ensures that raw JSON configuration (which will eventually come from the Homey Settings UI) is robustly validated into a strongly typed TypeScript object using a schema validator.

By building this first, we create a strict type boundary between user input and our internal state engine, satisfying R001, R003, R004, and R005 structurally before we write the engine logic.

## Recommendation

I recommend defining the `Config` domain model using `zod` (already installed during research). This prevents us from having to write and maintain complex, brittle manual validation logic for nested schedule/phase objects. Zod schemas will serve as the single source of truth, from which we infer the TypeScript types. 

The configuration should be structured so that each Phase (MORNING, DAY, EVENING, NIGHT) explicitly declares its `weekday` and `weekend` schedules (which evaluate arrays of conditions as "OR" logic), as well as the target `states` for each defined `Role`.

## Implementation Landscape

### Key Files

- `src/lib/config/types.ts` — The source of truth for the Config model. Will contain the Zod schemas and the inferred TypeScript types (e.g., `export type AppConfig = z.infer<typeof AppConfigSchema>`). Must define the discriminated union for `time`, `solar`, and `lux` conditions.
- `src/lib/config/ConfigParser.ts` — Provides a `parseConfig(raw: unknown): AppConfig` function that wraps the Zod parsing, normalizing any missing or legacy fields, and mapping Zod errors into domain-specific error messages if needed.
- `src/lib/config/ConfigParser.spec.ts` — Vitest suite that feeds valid and invalid JSON into the parser to verify that type safety is enforced and expected errors are thrown.

### Build Order

1. **Define the Types and Schema (`types.ts`):** Build the Zod schemas for `Role`, `Condition` (Time, Solar, Lux), `PhaseSchedule`, and `PhaseConfig`. Ensure `phases` strictly requires MORNING, DAY, EVENING, and NIGHT keys.
2. **Implement `ConfigParser.ts`:** Create the pure validation wrapper.
3. **Vitest Verification:** Write tests for valid configs, and edge cases (missing fields, wrong types, invalid time strings) to prove the schema is air-tight.

### Verification Approach

- Run `npm run test` to execute `ConfigParser.spec.ts`.
- A valid JSON config mimicking the structure described in `M001-CONTEXT.md` (with weekday/weekend schedules and time/solar/lux conditions) should parse to the exact typed object.
- Invalid JSON (e.g., missing a phase, invalid time format, missing condition properties) should throw a clear `ZodError` or custom validation error.

## Don't Hand-Roll

| Problem | Existing Solution | Why Use It |
|---------|------------------|------------|
| Validating complex, nested user configuration | `zod` | Provides robust runtime validation and static type inference automatically, avoiding brittle manual `if/else` checks. |

## Open Risks

- **Schema Evolution:** If we change the structure later, we will need to handle migration of existing users' `this.homey.settings.get('config')`. We should structure the parser to allow default fallbacks for optional fields so future updates don't break on old config shapes.