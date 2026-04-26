# S04: Reconciler & Override Detection

**Goal:** Implement a Reconciler that translates the current Phase into device commands via a dependency-injected DeviceAPI, with a 50ms inter-command delay for mesh protection and drift-detection that respects manual overrides until the next phase transition.
**Demo:** Mocks prove the 50ms delay and that manual overrides are respected.

## Must-Haves

- Vitest proves: (1) the 50ms inter-command delay is consistently applied; (2) drifted devices are skipped during same-phase maintenance ticks; (3) phase transitions force-apply target state and reset override tracking; (4) per-device errors do not halt the queue; (5) floating-point dim comparisons use an epsilon.
- Demo: With a mocked DeviceAPI, calling reconcile() during a phase transition applies the target state to all role devices in 50ms-spaced sequence; calling reconcile() with the same phase after the mock simulates a manual user change leaves that device alone; calling reconcile() with a new phase forcibly overrides the manual change.
- Must-haves:
- DeviceAPI interface defining getState/setCapability with a Homey-agnostic shape.
- Reconciler class with reconcile(phase, config, roleDeviceMapping) entrypoint.
- Internal lastAppSetState Map<string, {onoff?, dim?}> for drift detection.
- Sequential command execution with 50ms delay between commands (no Promise.all).
- Epsilon comparison (0.01) for dim values; strict equality for onoff.
- Per-device try/catch so a single failure does not halt the queue.
- Graceful handling of devices missing optional capabilities (e.g., dim).
- All assertions covered by tests in tests/engine/Reconciler.test.ts using vi.useFakeTimers().

## Proof Level

- This slice proves: Contract — proves Reconciler behavior against a mock DeviceAPI. Real Homey runtime wiring is deferred to S08 (final assembly). No human/UAT required for this slice; verification is fully automated via Vitest.

## Integration Closure

Upstream surfaces consumed: src/lib/config/Config.ts (Phase, AppConfig, RoleState types).
New wiring introduced: DeviceAPI interface + Reconciler class — both internal to src/lib/engine/. No driver wiring or app.ts hookup in this slice.
What remains before milestone is end-to-end usable: S05 wires lux/twilight signals into reconcile cadence; S06 surfaces device selection in settings UI; S07 exposes phase-change Flow cards; S08 wires Reconciler into the real Homey runtime via a concrete DeviceAPI implementation (Homey Web API) and a 60s tick scheduler.

## Verification

- Reconciler exposes a structured per-tick result (applied[], skipped[], failed[]) so a future agent can inspect why a device was/wasn't touched on the most recent reconcile call. Each entry includes deviceId, role, capability, reason ('transition'|'maintenance-target'|'override-skip'|'error'), and (for errors) the message. Tests assert on this structure to lock in the diagnostic surface.
- Inspection surfaces: Reconciler.lastResult getter (in-memory, queryable from a future status endpoint or driver log).
- Failure visibility: failed[] entries carry deviceId + error message; override-skip entries carry the observed actual state vs. lastAppSetState for postmortem.
- Redaction constraints: none — only device IDs and capability values, no user PII.

## Tasks

- [x] **T01: Define DeviceAPI interface and Reconciler types** `est:30m`
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
  - Files: `src/lib/engine/DeviceAPI.ts`, `src/lib/engine/ReconcilerTypes.ts`
  - Verify: npx tsc --noEmit

- [x] **T02: Implement Reconciler with drift detection and 50ms mesh delay** `est:1h30m`
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
  - Files: `src/lib/engine/Reconciler.ts`
  - Verify: npx tsc --noEmit

- [x] **T03: Verify Reconciler with mock DeviceAPI and fake timers** `est:1h30m`
  Write the slice's verification tests in `tests/engine/Reconciler.test.ts`, exercising the Reconciler against a stateful mock DeviceAPI with `vi.useFakeTimers()`. These tests are the slice's objective stopping condition.

Steps:
1. Create `tests/engine/Reconciler.test.ts`. Use Vitest's `describe`/`it`/`expect` and `vi.useFakeTimers()` at the top of the suite (with `afterEach(() => vi.useRealTimers())`).
2. Build a `MockDeviceAPI` helper class that implements DeviceAPI: holds a `Map<deviceId, { onoff?, dim? }>` of "actual" state, increments a per-method call counter, and lets tests directly mutate the underlying state (to simulate manual user override) via `simulateManualChange(deviceId, partial)`.
3. Build a small AppConfig fixture inline: 2 roles ('living', 'kitchen'), each mapped to 1–2 device IDs. Define NIGHT and MORNING target states differing in onoff and dim.
4. Test cases (each is a separate `it`):
   - **Transition applies target state to all role devices**: mode='transition', expect applied[] length matches device×capability count; expect each setCapability called once with the target value.
   - **50ms mesh delay between commands**: with fake timers, queue N=4 commands. `vi.advanceTimersByTime(150)` — only 4 commands should have executed (loosely: assert callCount progression with `await vi.advanceTimersByTimeAsync(50)` increments).
   - **Override-skip during maintenance**: do a transition, then `simulateManualChange` to flip onoff on one device, then call reconcile() with same phase. Expect that device in skipped[] with reason='override-skip' and `observed` reflecting the manual state. Expect setCapability NOT called for that device on the second tick.
   - **Dim epsilon tolerance**: after transition sets dim=0.8, simulate actual=0.8000001. Same-phase reconcile MUST NOT treat this as drift (no override-skip; record as 'no-op' in skipped[]).
   - **Phase transition overrides manual change**: do transition to NIGHT, simulateManualChange, then reconcile to MORNING. Expect setCapability called for that device with MORNING's target despite the prior "override".
   - **Per-device error isolation**: configure mock to throw on setCapability for one device. Reconcile a transition. Expect that device in failed[]; expect remaining devices applied normally.
   - **Missing capability tolerated**: target includes dim but mock throws on setCapability(_, 'dim', _). Expect failed[] entry for the dim attempt; onoff still applied.
   - **lastResult exposes most recent tick**: after each reconcile, `reconciler.getLastResult()` returns the same object as the awaited return value.
5. Run `npm test` — all existing tests (PhaseEngine, ConfigParser, smoke) plus new Reconciler tests must pass. Run `npx tsc --noEmit` for type cleanliness.

Must-haves:
- Uses `vi.useFakeTimers()` (research-doc requirement).
- Tests assert on the structured ReconcileResult shape, not on console output.
- Mock DeviceAPI is stateful (lets tests simulate manual user overrides between ticks).
- All cases listed above are covered by at least one `it` block.
- Tests run from repo root via `npm test` and pass.
  - Files: `tests/engine/Reconciler.test.ts`
  - Verify: npm test

## Files Likely Touched

- src/lib/engine/DeviceAPI.ts
- src/lib/engine/ReconcilerTypes.ts
- src/lib/engine/Reconciler.ts
- tests/engine/Reconciler.test.ts
