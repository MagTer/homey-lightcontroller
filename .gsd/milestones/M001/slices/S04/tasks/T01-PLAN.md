---
estimated_steps: 12
estimated_files: 2
skills_used: []
---

# T01: Define DeviceAPI interface and Reconciler types

Create the DeviceAPI contract that abstracts Homey device interaction so the Reconciler is fully testable with mocks. Also define the Reconciler's public types: RoleDeviceMapping, ReconcileResult, and the per-entry result shapes used by both production code and tests. This task lands the typed boundary that T02 (implementation) and T03 (tests) both import from.

Steps:
1. Create `src/lib/engine/DeviceAPI.ts` exporting a `DeviceAPI` interface with two methods: `getState(deviceId: string): Promise<{ onoff?: boolean; dim?: number }>` and `setCapability(deviceId: string, capability: 'onoff' | 'dim', value: boolean | number): Promise<void>`.
2. In the same file, export a `RoleDeviceMapping` type: `Record<string /* roleId */, string[] /* deviceIds */>`.
3. Create `src/lib/engine/ReconcilerTypes.ts` (or co-locate in DeviceAPI.ts if cleaner — pick one and stay consistent) exporting `ReconcileEntry` (a discriminated union with reason: 'transition' | 'maintenance-target' | 'override-skip' | 'no-op' | 'error', plus deviceId, roleId, capability, value (when applied), observed (when override-skip), message (when error)) and `ReconcileResult` ({ applied: ReconcileEntry[]; skipped: ReconcileEntry[]; failed: ReconcileEntry[]; phase: Phase; mode: 'transition' | 'maintenance' }).
4. Add a brief JSDoc to each exported symbol explaining its role.
5. Run `npx tsc --noEmit` to confirm types compile cleanly against the existing Phase import from `src/lib/config/Config.ts`.

Must-haves:
- DeviceAPI methods are minimal and Homey-agnostic (no Homey SDK imports).
- Capability parameter is typed as the union 'onoff' | 'dim' (not arbitrary string) to keep the surface tight.
- ReconcileResult is structured enough for assertion-based tests in T03 (each entry distinguishable by reason).
- File compiles with the project's existing tsconfig and ESM .js import suffix convention (see PhaseEngine.ts imports for reference).

## Inputs

- ``src/lib/config/Config.ts``
- ``src/lib/engine/PhaseEngine.ts``

## Expected Output

- ``src/lib/engine/DeviceAPI.ts``
- ``src/lib/engine/ReconcilerTypes.ts``

## Verification

npx tsc --noEmit

## Observability Impact

Defines the ReconcileResult shape that production code and tests both consume — this is the diagnostic surface for the entire slice.
