---
estimated_steps: 21
estimated_files: 1
skills_used: []
---

# T02: Implement Reconciler with drift detection and 50ms mesh delay

Implement the Reconciler class that enforces phase target states on devices via the DeviceAPI, with override-aware drift detection during maintenance ticks and a strict 50ms inter-command delay for mesh-network protection.

Steps:
1. Create `src/lib/engine/Reconciler.ts`. Export a `Reconciler` class with constructor `constructor(deviceApi: DeviceAPI, options?: { meshDelayMs?: number; dimEpsilon?: number })`. Defaults: meshDelayMs=50, dimEpsilon=0.01.
2. Internal state: `private currentPhase: Phase | null = null` and `private lastAppSetState: Map<string, { onoff?: boolean; dim?: number }> = new Map()`. Also keep `private lastResult: ReconcileResult | null = null` exposed via a `getLastResult()` getter.
3. Implement `async reconcile(phase: Phase, config: AppConfig, roleDeviceMapping: RoleDeviceMapping): Promise<ReconcileResult>`:
   - Determine `mode`: if `phase !== this.currentPhase`, mode='transition' AND set `this.currentPhase = phase`. Otherwise mode='maintenance'.
   - For each role in `config.phases[phase].states`, look up `roleDeviceMapping[roleId] ?? []`.
   - For each device in that role: branch on mode.
   - **Transition mode**: For each capability present in the target RoleState (onoff always; dim only if defined), call `deviceApi.setCapability(deviceId, cap, value)`. After each successful call, update `lastAppSetState.get(deviceId)` (initialize empty object if missing). Record an 'transition' entry in applied[]. Wrap each setCapability in try/catch — on error push an 'error' entry to failed[] and continue (don't update lastAppSetState for that capability).
   - **Maintenance mode**: For each device, first `await deviceApi.getState(deviceId)`. Compare to lastAppSetState entry: for `onoff`, strict !==; for `dim`, `Math.abs(actual - lastSet) > dimEpsilon`. If ANY tracked capability has drifted from lastAppSetState, push an 'override-skip' entry with `observed` = actual state and skip further work for that device. If actual matches lastAppSetState but differs from target (recovery case), apply target (same flow as transition but record as 'maintenance-target' in applied[]). If actual matches both lastAppSetState AND target, push a 'no-op' entry to skipped[].
   - Apply the 50ms delay AFTER each successful or attempted setCapability call (use `await new Promise(r => setTimeout(r, this.meshDelayMs))`). The delay applies between commands; reads (getState) do not need to be delayed. Critically: use a sequential `for...of` loop — never `Promise.all`.
   - Handle missing capabilities gracefully: if a device's getState returns no `dim` key but the target requires dim, only set onoff (don't crash). The Reconciler does not pre-query device capability lists — it lets setCapability fail and routes the error into failed[].
4. Set `this.lastResult = result` before returning so a future status surface can read it.
5. Run `npx tsc --noEmit` to confirm no type errors.

Must-haves:
- No `Promise.all` over device commands (mesh delay would be violated).
- Floating-point dim comparison uses `Math.abs(a - b) > dimEpsilon` (default 0.01).
- Per-device errors are isolated; queue continues after a failure.
- `meshDelayMs` is parameterized so tests can use `vi.useFakeTimers()` cleanly.
- The `lastResult` getter reflects the most recent reconcile call.
- Code follows existing project conventions: ESM imports with `.js` suffix, JSDoc on exported symbols (see PhaseEngine.ts).

## Inputs

- ``src/lib/engine/DeviceAPI.ts``
- ``src/lib/engine/ReconcilerTypes.ts``
- ``src/lib/config/Config.ts``

## Expected Output

- ``src/lib/engine/Reconciler.ts``

## Verification

npx tsc --noEmit

## Observability Impact

Populates ReconcileResult with applied/skipped/failed entries on every tick. Exposes lastResult getter for future status endpoint integration. Per-device errors are captured (not thrown) so a future agent can read failed[] entries to diagnose unreachable devices.
