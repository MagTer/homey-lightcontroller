---
estimated_steps: 1
estimated_files: 2
skills_used: []
---

# T02: Implement DimmingCurve pure interpolation helpers

Create `src/lib/engine/DimmingCurve.ts` exporting two pure functions: `luxToDim({ lux, brightLux, darkLux, brightDim, darkDim })` returning a clamped [0,1] dim value linearly interpolated so `lux >= brightLux` maps to `brightDim` (typically 0) and `lux <= darkLux` maps to `darkDim` (typically 1). And `twilightCurve({ now, startAt, endAt, startDim, endDim })` returning a clamped [0,1] dim value linearly interpolated across the temporal window so `now <= startAt` returns `startDim`, `now >= endAt` returns `endDim`, and values in between are linearly mixed. Both functions must: handle inverted ranges (e.g. `darkLux > brightLux`) consistently, clamp output to [0,1], and reject NaN/Infinity inputs by returning the closer-clamped boundary. Edge cases: when `startAt === endAt`, return `endDim` if `now >= startAt` else `startDim` (no division-by-zero). Write the test file with cases covering: (a) `luxToDim` boundary values, (b) `luxToDim` midpoint interpolation, (c) `luxToDim` clamping outside range, (d) `twilightCurve` before/after window, (e) `twilightCurve` midpoint interpolation, (f) `twilightCurve` zero-length window, (g) `luxToDim` with inverted range. These are pure functions — no timers, no IO, no dependencies beyond the input objects. Do not modify any existing files in this task.

## Inputs

- ``src/lib/config/Config.ts``
- ``.gsd/milestones/M001/slices/S05/S05-RESEARCH.md``

## Expected Output

- ``src/lib/engine/DimmingCurve.ts``
- ``tests/engine/DimmingCurve.test.ts``

## Verification

npx vitest run tests/engine/DimmingCurve.test.ts
