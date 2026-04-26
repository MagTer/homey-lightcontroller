# S01: Node 20 engine downgrade — UAT

**Milestone:** M002
**Written:** 2026-04-26T20:12:24.583Z

# S01: Node 20 engine downgrade — UAT

**Milestone:** M002
**Written:** 2026-04-26

## UAT Type

- UAT mode: artifact-driven
- Why this mode is sufficient: The slice is a metadata change (package.json) verified by the existing automated test suite and build pipeline.

## Preconditions

- Node.js runtime (v22.x used for verification) and dependencies installed.

## Smoke Test

Run `npm run build` and `npm run test` and verify they exit with code 0.

## Test Cases

### 1. Engine Constraint Verification

1. Open package.json.
2. Check the engines.node field.
3. **Expected:** Value is ">=20.0.0".

### 2. Build Toolchain Compatibility

1. Run npm run build.
2. **Expected:** tsc completes with exit code 0 and no diagnostic errors.

### 3. Runtime API Compatibility (Test Suite)

1. Run npm run test.
2. **Expected:** Vitest reports 98 passed tests across 10 test files with 0 failures.

## Failure Signals

- tsc erroring on Node 20+ incompatible syntax or types.
- Vitest failures indicating use of Node 22+ specific APIs.
- package.json still showing >=22.0.0.

## Not Proven By This UAT

- Actual deployment on Homey Pro hardware (Node 20.x).
- Behavior of third-party libraries at runtime on a literal Node 20.x process.
