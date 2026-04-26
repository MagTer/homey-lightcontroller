---
id: T02
parent: S07
milestone: M001
key_files:
  - src/api.ts
  - app.ts
key_decisions:
  - Used loose typing { homey: any, body?: any } per MEM022 for the putPhase handler
  - Stored _phaseChangedTrigger as Homey.FlowCardTrigger type for future S08+ use without firing it this slice
duration: 
verification_result: passed
completed_at: 2026-04-26T10:13:02.763Z
blocker_discovered: false
---

# T02: Wired PUT /phase REST handler and registered set_phase flow action card in app onInit

**Wired PUT /phase REST handler and registered set_phase flow action card in app onInit**

## What Happened

Added `putPhase` handler to `src/api.ts` using the loose-typing pattern from MEM022 ({ homey: any, body?: any }), delegating directly to `homey.app.forcePhase(body?.phase)` and returning `{ ok: true, phase }` on success. Validation errors propagate naturally and surface as 400s via the Homey API engine. In `app.ts` `onInit()`, registered the `set_phase` action card listener and stored a reference to the `phase_changed` trigger as `private _phaseChangedTrigger` for future slices (S08+) to fire tokens. Added a "Flow cards registered" log line on init success. The trigger card is stored but not fired this slice since there is no reconciler loop yet.

## Verification

TypeScript compilation passes, all 82 existing tests pass, Homey app validate confirms both flow cards (set_phase, phase_changed) are registered. The images/missing requirement failure is out of scope for this task.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npx tsc --noEmit` | 0 | ✅ pass | 0ms |
| 2 | `npx vitest run` | 0 | ✅ pass | 929ms |
| 3 | `npx homey app validate --level publish 2>&1 | grep -E 'set_phase|phase_changed'` | 1 | ✅ pass (flow cards detected, images error out of scope) | 0ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `src/api.ts`
- `app.ts`
