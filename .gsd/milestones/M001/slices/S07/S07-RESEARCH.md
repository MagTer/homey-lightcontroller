# S07: Flow Cards & REST API — Research

**Date:** 2026-04-26
**Status:** Ready for planning

## Summary

S07 is a straightforward wiring slice — no novel technology, no risky integration. All the logic already exists; this slice connects it to Homey's two external surfaces: Flow automation cards and the REST API endpoint.

**Flow Cards** are declared in `.homeycompose/flow/` JSON files and registered in `onInit()` using `this.homey.flow.getActionCard(id).registerRunListener(...)`. The action card for "force phase override" needs one `autocomplete`-type argument listing the four phase values (NIGHT, MORNING, DAY, EVENING). A trigger card for "phase changed" will fire tokens on each reconciler cycle. No Homey Compose drivers or conditions are needed for V1.

**REST API** (`PUT /phase`) is handled by adding a `putPhase` method to `src/api.ts` (loosely typed, per MEM022) and re-exporting it via the existing `api.js` root shim (per MEM020). The handler validates the incoming phase string against the `Phase` enum from `Config.ts` and delegates to a new `forcePhase(phase)` method on the App class, which sets a `_forcedPhase` flag. The existing `getConfig`/`saveConfig`/`getDevices` handler pattern is the direct template.

## Recommendation

Follow the established `src/api.ts → api.js → .homeybuild/api.js` pattern. For flow cards, use Homey Compose (`.homeycompose/flow/actions/` and `.homeycompose/flow/triggers/`) so `app.json` stays auto-generated. Register cards in `app.ts` `onInit()`. Keep the `forcePhase` state in App itself (a simple `_forcedPhase: Phase | null` property) since the PhaseEngine and Reconciler are stateless pure-function / class modules — no changes needed to them.

## Implementation Landscape

### Key Files

- `.homeycompose/app.json` — source of truth for permissions; no changes needed (already has `homey:manager:api`)
- `.homeycompose/flow/actions/set_phase.json` — **CREATE**: action card declaration; id `set_phase`, one `autocomplete` arg named `phase`
- `.homeycompose/flow/triggers/phase_changed.json` — **CREATE**: trigger card declaration; id `phase_changed`, one token `phase` of type `string`
- `src/api.ts` — **MODIFY**: add `putPhase({ homey, body })` handler that validates `body.phase` against `PhaseSchema` and calls `homey.app.forcePhase(body.phase)`
- `app.ts` — **MODIFY**: add `_forcedPhase: Phase | null = null`, `forcePhase(phase)` setter, `getForcedPhase()` getter; register flow cards in `onInit()`
- `app.json` — **AUTO-GENERATED** by `npx homey app build` from `.homeycompose/`; never edit directly
- `tests/api/FlowCards.test.ts` — **CREATE**: unit tests for the flow card run-listener logic (extracted pure helper)
- `tests/api/RestApi.test.ts` — **CREATE**: unit tests for `putPhase` handler validating schema rejection and delegation

### Build Order

1. **Declare flow card JSON files** in `.homeycompose/flow/` first — these are data files with zero risk. Confirm `npx homey app validate` still passes after adding them.
2. **Add `forcePhase` / `getForcedPhase` to `app.ts`** — pure App state; testable in isolation with the mock `homey.settings` pattern from S06.
3. **Add `putPhase` to `src/api.ts`** — follows the exact pattern of `saveConfig`; validates with `PhaseSchema.parse()`, calls `homey.app.forcePhase()`.
4. **Register flow cards in `onInit()`** — `this.homey.flow.getActionCard('set_phase').registerRunListener(...)` delegates to `this.forcePhase()`.
5. **Wire trigger card** — `this.homey.flow.getTriggerCard('phase_changed')` stored as a class field; called with `{ phase }` token in each reconciler callback.
6. **Tests** — mock `homey.flow` with `{ getActionCard: () => ({ registerRunListener: vi.fn() }), getTriggerCard: ... }` pattern.

### Verification Approach

```bash
# All existing tests still pass
npx vitest run

# TypeScript clean
npx tsc --noEmit

# Validate includes flow cards
npx homey app validate --level publish
```

Observable: `app.json` (in `.homeybuild/` after build) should contain a `flow.actions` array with `set_phase` and `flow.triggers` with `phase_changed`.

## Constraints

- `app.js` root **must** re-export from `./.homeybuild/api.js` (not `./build/` or other paths) per MEM020.
- API handlers in `src/api.ts` must be loosely typed `({ homey: any, body?: any })` per MEM022.
- Flow card IDs in `.homeycompose/flow/*.json` must match the IDs used in `this.homey.flow.getActionCard(id)` calls exactly — mismatch causes a silent no-op at runtime.
- The `phase` autocomplete arg for the action card should use a static list (no live fetch needed) since phases are a fixed enum.
- `app.json` is auto-generated — edit `.homeycompose/app.json` and `.homeycompose/flow/**` only.
