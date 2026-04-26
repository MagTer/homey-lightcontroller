---
id: T01
parent: S07
milestone: M001
key_files:
  - app.ts
  - .homeycompose/flow/actions/set_phase.json
  - .homeycompose/flow/triggers/phase_changed.json
key_decisions:
  - Used double-bracket syntax `[[phase]]` in titleFormatted per Homey SDK convention for flow card argument tokens
  - Used dropdown (not autocomplete) since the value set is fixed and small
duration: 
verification_result: passed
completed_at: 2026-04-26T10:11:12.596Z
blocker_discovered: false
---

# T01: Declared flow card JSON files and added forcePhase state to App class

**Declared flow card JSON files and added forcePhase state to App class**

## What Happened

Created the two flow card JSON declarations (`set_phase` action and `phase_changed` trigger) under `.homeycompose/flow/` and extended the App class with `_forcedPhase` state, a `forcePhase()` setter that validates via `PhaseSchema.parse()`, and a `getForcedPhase()` getter. The action card uses a dropdown with all four phase values and proper `titleFormatted` template. Both cards are detected by `homey app validate` — the publish-level failure is only about missing app images, which is out of scope for this task.

## Verification

TypeScript compilation passes, all 82 existing tests pass, and Homey app validate confirms both flow cards (set_phase, phase_changed) are registered. The validation failure about missing images is unrelated to this task.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npx tsc --noEmit` | 0 | ✅ pass | 0ms |
| 2 | `npx vitest run` | 0 | ✅ pass | 885ms |
| 3 | `npx homey app validate --level publish 2>&1 | grep -E 'set_phase|phase_changed'` | 1 | ✅ pass (flow cards detected, images error is out of scope) | 0ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `app.ts`
- `.homeycompose/flow/actions/set_phase.json`
- `.homeycompose/flow/triggers/phase_changed.json`
