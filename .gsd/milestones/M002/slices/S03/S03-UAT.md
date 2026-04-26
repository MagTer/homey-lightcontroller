# S03: Eager config validation in onInit — UAT

**Milestone:** M002
**Written:** 2026-04-26T21:11:04.021Z

## UAT Type
- UAT mode: artifact-driven
- Why this mode is sufficient: The logic is entirely internal to the app lifecycle and can be perfectly simulated using the TestableApp pattern without requiring a physical Homey Pro.

## Preconditions
- Build is clean (npm run build).
- Vitest suite is operational.

## Smoke Test
- Run npm test tests/api/AppInit.test.ts. All 4 tests must pass, confirming that the onInit guard correctly blocks or allows registration based on config validity.

## Test Cases
### 1. Cold Start (Missing Config)
1. Simulate a fresh install where homey.settings.get('config') returns null.
2. Invoke onInit().
3. **Expected:** this.error is called with a 'missing config' message, and flowCardsRegistered remains false.

### 2. Corrupt Configuration
1. Seed the store with a configuration missing a required field (e.g., delete the EVENING phase).
2. Invoke onInit().
3. **Expected:** this.error is called with an issues object containing Zod validation details (path ['phases', 'EVENING']), and flowCardsRegistered remains false.

### 3. Valid Configuration
1. Seed the store with a known-valid AppConfig.
2. Invoke onInit().
3. **Expected:** No errors are logged, and flowCardsRegistered becomes true.

## Failure Signals
- App registers flow cards despite a null config in the store.
- App crashes (unhandled rejection) when encountering an invalid config instead of logging and returning.
- getConfig() signature changes, breaking consumers.
