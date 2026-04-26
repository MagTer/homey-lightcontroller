# M001: Core State Machine & Store Readiness — Context

**Gathered:** 2026-04-25
**Status:** Ready for planning

## Project Description

Building "Lighting Scheduler," a Homey Pro app that replaces race-prone lighting flows with a 4-phase state machine (NIGHT, MORNING, DAY, EVENING). It uses a "Smart Reconciler" to enforce lighting states across user-defined device roles while respecting manual overrides.

## Why This Milestone

This milestone establishes the foundational logic, reconciliation engine, and user interface required for a production-ready Homey App Store release. It solves the core problem of "orphaned lights" while providing a robust configuration experience.

## User-Visible Outcome

### When this milestone is complete, the user can:

- Assign their home lights to roles (e.g., "Window Lights Downstairs") and define a single, unified schedule.
- Experience reliable lighting transitions based on a mix of clock time, solar events (Sunrise/Sunset/Golden Hour), and environmental lux.
- Manually turn off a light group without the app immediately turning it back on until the next phase change.
- Sleep in on Bank Holidays as the app automatically applies the "Weekend" schedule.

### Entry point / environment

- Entry point: Homey App Settings, Flow Cards, and REST API.
- Environment: Homey Pro (Local only).
- Live dependencies involved: Homey Web API (ManagerApi), Homey Geolocation, date-holidays, and suncalc.

## Completion Class

- Contract complete means: 100% Vitest coverage on Phase and Config logic units.
- Integration complete means: Reconciler successfully orchestrates multiple mocked devices with enforced 50ms delays and manual override detection.
- Operational complete means: Pre-publish script verifies 8-bit PNGs and "local-only" platform constraints.

## Final Integrated Acceptance

To call this milestone complete, we must prove:

- **The Transition Matrix:** A full cycle (NIGHT → MORNING → DAY → EVENING → NIGHT) triggers correctly across weekday/weekend/holiday boundaries.
- **The Smart Reconciler:** A device manually turned off *during* its intended ON phase stays off, but is forced to its next state when the phase changes.
- **Solar Reliability:** Transitions fire correctly using solar offsets (e.g., Sunset - 30m) regardless of Lux sensor state.

## Architectural Decisions

### Smart Reconciler with Drift Detection
**Decision:** Maintain an internal `lastAppSetState` Map. If a device's current state differs from the last state the app set, skip reconciliation for that device until the next phase transition.
**Rationale:** Prevents "fighting" the user. If they manually turn off a light, they want it off.
**Alternatives:** Listening to every device event (too complex/heavy); strict enforcement (user frustration).

### Solar Event Integration
**Decision:** Use `suncalc` locally seeded with Homey's Latitude/Longitude.
**Rationale:** Homey's built-in solar events are triggers; calculating them locally allows for complex "OR" logic with lux sensors and offsets in a single tick.

### Holiday-Aware Scheduling
**Decision:** Integrate `date-holidays` library.
**Rationale:** Essential for a scheduler to avoid "alarm clock" behavior on non-working weekdays.

### Mesh Protection (50ms Delay)
**Decision:** Enforce a 50ms serial delay between all device API calls.
**Rationale:** Protects Zigbee/Z-Wave meshes from saturation during mass-switching events (Reconciliation).

## Error Handling Strategy

- **Sensor Resilience:** Average only healthy lux sensors in a role; ignore/log failing ones.
- **Non-Blocking Device Ops:** Wrap each device command in a try/catch; one failing device must not stop the reconciliation of others.
- **Implicit Retries:** The 60s polling loop provides eventual consistency.

## Risks and Unknowns

- **Homey Web API Performance:** Controlling 30+ devices at once might still hit API or mesh limits even with 50ms delays.
- **Holiday Accuracy:** `date-holidays` accuracy for regional specificities (e.g., midsummer in Sweden).

## Scope

### In Scope
- 4-phase state machine and persistence.
- Reconciler with manual override detection.
- Multi-sensor lux averaging and debouncing.
- Solar events (Sunrise, Sunset, Golden Hours) with offsets.
- Settings UI with device pickers.
- Flow Cards and REST API.
- Pre-publish compliance automation.

### Out of Scope / Non-Goals
- Cloud support (Local only).
- Custom user-defined roles (Strict schema only for V1).
- Direct wireless protocol interaction (Web API only).

## Technical Constraints
- SDK 3, TypeScript ESM.
- `api.js` must be plain JavaScript.
- 8-bit RGBA PNG assets only.

## Testing Requirements
- Vitest for logic units.
- Mocks for Homey SDK Managers and Device API.
- Verification of 50ms delay in reconciler.

## Acceptance Criteria
- **S03 (Phase Engine):** Transitions fire correctly for all combinations of Time/Lux/Solar.
- **S06 (Reconciler):** `lastAppSetState` logic correctly identifies and respects manual overrides.
- **S08 (Settings UI):** Device list fetches accurately and persists to `config` JSON.
