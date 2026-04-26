---
estimated_steps: 21
estimated_files: 1
skills_used: []
---

# T03: Verify Reconciler with mock DeviceAPI and fake timers

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

## Inputs

- ``src/lib/engine/Reconciler.ts``
- ``src/lib/engine/DeviceAPI.ts``
- ``src/lib/engine/ReconcilerTypes.ts``
- ``src/lib/config/Config.ts``

## Expected Output

- ``tests/engine/Reconciler.test.ts``

## Verification

npm test

## Observability Impact

Tests lock in the ReconcileResult diagnostic shape (applied/skipped/failed with reason codes), ensuring a future agent debugging a misbehaving device can rely on these fields existing and being populated correctly.
