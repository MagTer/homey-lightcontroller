# S02: Configuration & Settings Model — UAT

**Milestone:** M001
**Written:** 2026-04-25T22:45:45.095Z

# S02: Configuration & Settings Model — UAT

**Milestone:** M001
**Written:** 2026-04-26

## UAT Type

- UAT mode: artifact-driven
- Why this mode is sufficient: The core delivery is a pure validation library. Unit tests (Vitest) are the authoritative proof of correctness for a library with no UI or side effects.

## Preconditions

- Node.js environment with dependencies installed (`npm install`).
- `vitest` and `typescript` available.

## Smoke Test

- Run `npm test`.
- **Expected:** `tests/config/ConfigParser.test.ts` passes all 5 tests.

## Test Cases

### 1. Valid Configuration Parsing

1. Pass a valid `AppConfig` literal to `parseConfig()`.
2. **Expected:** The function returns the object exactly as provided, and TypeScript correctly infers the `AppConfig` type.

### 2. Structural Integrity (Missing Keys)

1. Delete a required phase (e.g., `EVENING`) from a valid config.
2. Pass the broken config to `parseConfig()`.
3. **Expected:** Throws `ConfigValidationError` mentioning the missing path (`phases.EVENING`).

### 3. Leaf-level Validation (Time Strings)

1. Set a time condition to `"25:00"`.
2. Pass to `parseConfig()`.
3. **Expected:** Throws `ConfigValidationError` because the HH:MM regex fails.

### 4. Leaf-level Validation (Enums)

1. Set a solar event to `"midnight"`.
2. Pass to `parseConfig()`.
3. **Expected:** Throws `ConfigValidationError` because `"midnight"` is not in the allowed `PhaseSchema` enum.

### 5. Error Handling API

1. Call `safeParseConfig()` with a totally malformed object.
2. **Expected:** Returns `{ ok: false, error: ConfigValidationError }`.

## Edge Cases

### Empty Roles Array

1. Set `roles: []` in a config.
2. **Expected:** Passes validation (as per schema definition).

## Failure Signals

- `npm test` failure.
- `npx tsc --noEmit` reporting type errors in `AppConfig` usage.

## Not Proven By This UAT

- Disk persistence (saving/loading this config to Homey store).
- Runtime behavior of the conditions (e.g., whether the app actually triggers at the specified time).

## Notes for Tester

- All tests are colocated in `tests/config/ConfigParser.test.ts`.
- The `validConfig` fixture in the test file is a great reference for the expected JSON structure.
