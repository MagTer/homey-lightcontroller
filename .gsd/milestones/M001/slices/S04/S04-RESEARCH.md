## Summary

This slice implements the `Reconciler`, which is responsible for translating the current abstract `Phase` into actual Homey device commands based on the user's configuration. It serves as the enforcement engine for the "Smart Reconciler" architectural decision, ensuring that devices reach their intended state without frustrating the user by fighting manual overrides. 

The Reconciler will manage an internal `lastAppSetState` Map. During a phase transition, it forcefully applies the new target states. During periodic 60s maintenance ticks (same phase), it detects if a device's actual state has drifted from `lastAppSetState`. If drift is detected, the device is considered "overridden" by the user and skipped until the next phase transition. Additionally, all commands are serialized with a 50ms delay to protect mesh networks.

## Recommendation

Implement a `Reconciler` class that takes a dependency-injected `DeviceAPI` (to abstract away the Homey SDK for Vitest). 

The `DeviceAPI` should provide:
- `getState(deviceId: string): Promise<{ onoff?: boolean, dim?: number }>`
- `setCapability(deviceId: string, capability: string, value: any): Promise<void>`

The `Reconciler` will maintain two pieces of state:
1. `currentPhase`: To detect when a transition occurs.
2. `lastAppSetState`: `Map<string, { onoff?: boolean, dim?: number }>` to track what the app last successfully applied to each device.

When `reconcile(phase, config, roleDeviceMapping)` is called:
1. **Transition Check**: If `phase !== this.currentPhase`, it's a transition. `this.currentPhase = phase`.
2. **Device Iteration**: For each role, get target state. For each device in that role:
    - If Transition: Apply target state. Update `lastAppSetState`.
    - If Maintenance: Fetch actual state. Compare actual to `lastAppSetState`. 
        - If different (drifted > epsilon for dim, or mismatched boolean for onoff), skip it.
        - If same, but actual != target, apply target. (This handles missed network commands if actual eventually reverts to target, though normally actual == lastAppSet means no action needed).
3. **Execution**: All device commands are executed sequentially with `await delay(50)`. Try/catch wraps each device so one failure doesn't halt the whole queue.

## Implementation Landscape

### Key Files

- `src/lib/engine/Reconciler.ts` — The new class containing the state enforcement and drift detection logic.
- `src/lib/engine/DeviceAPI.ts` — The interface for device interaction (abstracts Homey Web API).
- `tests/engine/Reconciler.test.ts` — Mock tests proving the 50ms delay, override skipping, and transition forcing.

### Build Order

1. **DeviceAPI Interface**: Define the contract for getting/setting capabilities.
2. **Reconciler Class**: Implement `reconcile` method with drift detection and delay logic.
3. **Vitest Verification**: Write tests using a mock `DeviceAPI` to verify:
   - 50ms delay is respected (use `vi.useFakeTimers()`).
   - Drift detection skips maintenance.
   - Transitions override drift.
   - Errors on one device do not stop the queue.

### Verification Approach

We will verify this slice entirely via Vitest. 
- Use `vi.useFakeTimers()` to assert that `N` device commands take `N * 50ms` to complete.
- Use a stateful mock `DeviceAPI` to simulate a user changing the light state manually.
- Assert that calling `reconcile` with the same phase does *not* trigger `setCapability` if the mock's state differs from what the Reconciler last set.
- Assert that calling `reconcile` with a *new* phase does trigger `setCapability` despite the override.

## Common Pitfalls

- **Floating Point Equality**: Homey may return `0.8000001` for a dim value set to `0.8`. Comparing `lastAppSetState` to actual state must use an epsilon for numbers (e.g., `Math.abs(actual - expected) < 0.01`).
- **Parallel Execution**: Using `Promise.all` for device commands will violate the 50ms mesh protection rule. Must use a `for...of` loop with `await new Promise(r => setTimeout(r, 50))`.
- **Capability Availability**: A device mapped to a role might only support `onoff` but not `dim`. The `DeviceAPI` or `Reconciler` must handle/ignore missing capabilities gracefully without throwing fatal errors.