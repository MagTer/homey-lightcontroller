# S01: Project Scaffold & Infrastructure — UAT

**Milestone:** M001
**Written:** 2026-04-25T22:03:21.787Z

# S01: Project Scaffold & Infrastructure — UAT

**Milestone:** M001
**Written:** 2026-04-26

## UAT Type

- UAT mode: artifact-driven
- Why this mode is sufficient: The slice's success is defined by a successful build and test runner execution, which can be verified through CLI output.

## Preconditions

- Node.js 22+ installed.
- Dependencies installed via `npm install`.

## Smoke Test

- Run `npm run test` and confirm it passes.

## Test Cases

### 1. Homey App Validation

1. Run `npx homey app validate --level debug`.
2. **Expected:** Output shows "Typescript compilation successful" and "App validated successfully".

### 2. Vitest Test Runner

1. Run `npm test`.
2. **Expected:** Vitest runs and passes all tests in `tests/smoke.test.ts`, including the ESM import check.

## Edge Cases

### Missing .homeybuild

1. Remove `.homeybuild/` directory if it exists.
2. Run `npx homey app validate`.
3. **Expected:** The Homey CLI regenerates the directory and validation still passes.

## Failure Signals

- `npx homey app validate` returns a non-zero exit code or compilation errors.
- `npm test` fails due to ESM import errors (e.g., missing file extensions in imports).

## Not Proven By This UAT

- Runtime behavior on a physical Homey Pro device.
- Success of the actual lighting state machine logic (to be built in later slices).

