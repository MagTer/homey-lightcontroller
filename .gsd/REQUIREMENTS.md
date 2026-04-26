# Requirements

This file is the explicit capability and coverage contract for the project.

## Active

### R007 — All PNG assets must be 8-bit RGBA; app must explicitly exclude "cloud" platforms.
- Class: compliance/security
- Status: active
- Description: All PNG assets must be 8-bit RGBA; app must explicitly exclude "cloud" platforms.
- Why it matters: Prevents portal rejection.
- Source: user
- Primary owning slice: M001/S11
- Supporting slices: none
- Validation: mapped
- Notes: Automate verification in pre-publish script.

## Validated

### R001 — App must maintain exactly one of four phases (NIGHT, MORNING, DAY, EVENING) and survive reboots.
- Class: core-capability
- Status: validated
- Description: App must maintain exactly one of four phases (NIGHT, MORNING, DAY, EVENING) and survive reboots.
- Why it matters: Centralizes all lighting logic into a single source of truth.
- Source: user
- Primary owning slice: M001/S03
- Supporting slices: none
- Validation: Logic implemented in PhaseEngine and verified by unit tests in S03. Integration into app lifecycle (Reconciler) completed in S04 and verified by integration tests. Persistence of forced phases verified in S07.
- Notes: Logic implemented in PhaseEngine and verified by unit tests in S03. Integration into app lifecycle pending S04.

### R002 — App must enforce target states for all roles every 60s, but skip devices that have drifted from the "last app-set state" (manual override).
- Class: core-capability
- Status: validated
- Description: App must enforce target states for all roles every 60s, but skip devices that have drifted from the "last app-set state" (manual override).
- Why it matters: Prevents "fighting" the user while ensuring eventual consistency.
- Source: user
- Primary owning slice: M001/S05
- Supporting slices: M001/S06
- Validation: Verified in tests/engine/Reconciler.test.ts (drift detection logic) where simulated manual changes are correctly identified as overrides and skipped during maintenance ticks. Integration with smoothed lux in S05 ensures that transient spikes do not trigger spurious phase transitions that would override manual states.
- Notes: Maintenance check every 60s.

### R003 — Phase transitions must support "OR" logic between Lux thresholds and Solar events (Sunrise/Sunset/Golden Hours) with offsets.
- Class: core-capability
- Status: validated
- Description: Phase transitions must support "OR" logic between Lux thresholds and Solar events (Sunrise/Sunset/Golden Hours) with offsets.
- Why it matters: Ensures reliability across seasons and weather conditions.
- Source: user
- Primary owning slice: M001/S07
- Supporting slices: none
- Validation: Verified in tests/engine/PhaseEngine.test.ts (solar/lux logic) and tests/engine/LuxDebounceIntegration.test.ts (robustness against transients). The combination of PhaseEngine's OR logic and LuxAggregator's smoothing ensures transitions are both logically correct and physically reliable.
- Notes: Evaluators for Solar and Lux conditions implemented in conditionEvaluators.ts and verified in S03.

### R004 — Wakeup schedules for "Weekend" must automatically apply to Public Holidays.
- Class: core-capability
- Status: validated
- Description: Wakeup schedules for "Weekend" must automatically apply to Public Holidays.
- Why it matters: Prevents early alarms/lights on non-working weekdays.
- Source: user
- Primary owning slice: M001/S04
- Supporting slices: none
- Validation: Verified in S03 (tests/engine/PhaseEngine.test.ts) using Dutch public holidays. The getScheduleType helper correctly identifies public holidays as weekends.
- Notes: getScheduleType helper integrates date-holidays and is used by the PhaseEngine. Verified in S03.

### R005 — Users must be able to assign any Homey device with onoff/dim capabilities to specific logic roles via a settings UI.
- Class: primary-user-loop
- Status: validated
- Description: Users must be able to assign any Homey device with onoff/dim capabilities to specific logic roles via a settings UI.
- Why it matters: Decouples logic from hardware.
- Source: user
- Primary owning slice: M001/S08
- Supporting slices: M001/S09
- Validation: Homey publish validator ('npx homey app validate --level publish') confirms the settings UI ('settings' block in app.json) is correctly defined and all required assets/fields for the store are present. User selection of devices and config saving was manually verified in S06.
- Notes: Requires homey:manager:api permission.

### R006 — All device control commands must have an enforced 50ms delay between them.
- Class: quality-attribute
- Status: validated
- Description: All device control commands must have an enforced 50ms delay between them.
- Why it matters: Prevents Zigbee/Z-Wave mesh saturation during large reconciliation events.
- Source: user
- Primary owning slice: M001/S05
- Supporting slices: none
- Validation: Verified in tests/engine/Reconciler.test.ts using Vitest fake timers to prove that commands are consistently spaced by at least 50ms, preventing mesh saturation.
- Notes: Critical for stability.

## Traceability

| ID | Class | Status | Primary owner | Supporting | Proof |
|---|---|---|---|---|---|
| R001 | core-capability | validated | M001/S03 | none | Logic implemented in PhaseEngine and verified by unit tests in S03. Integration into app lifecycle (Reconciler) completed in S04 and verified by integration tests. Persistence of forced phases verified in S07. |
| R002 | core-capability | validated | M001/S05 | M001/S06 | Verified in tests/engine/Reconciler.test.ts (drift detection logic) where simulated manual changes are correctly identified as overrides and skipped during maintenance ticks. Integration with smoothed lux in S05 ensures that transient spikes do not trigger spurious phase transitions that would override manual states. |
| R003 | core-capability | validated | M001/S07 | none | Verified in tests/engine/PhaseEngine.test.ts (solar/lux logic) and tests/engine/LuxDebounceIntegration.test.ts (robustness against transients). The combination of PhaseEngine's OR logic and LuxAggregator's smoothing ensures transitions are both logically correct and physically reliable. |
| R004 | core-capability | validated | M001/S04 | none | Verified in S03 (tests/engine/PhaseEngine.test.ts) using Dutch public holidays. The getScheduleType helper correctly identifies public holidays as weekends. |
| R005 | primary-user-loop | validated | M001/S08 | M001/S09 | Homey publish validator ('npx homey app validate --level publish') confirms the settings UI ('settings' block in app.json) is correctly defined and all required assets/fields for the store are present. User selection of devices and config saving was manually verified in S06. |
| R006 | quality-attribute | validated | M001/S05 | none | Verified in tests/engine/Reconciler.test.ts using Vitest fake timers to prove that commands are consistently spaced by at least 50ms, preventing mesh saturation. |
| R007 | compliance/security | active | M001/S11 | none | mapped |

## Coverage Summary

- Active requirements: 1
- Mapped to slices: 1
- Validated: 6 (R001, R002, R003, R004, R005, R006)
- Unmapped active requirements: 0
