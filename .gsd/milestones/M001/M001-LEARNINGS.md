---
phase: M001
phase_name: Core State Machine & Store Readiness
project: Homey Light Controller
generated: 2026-04-26T10:45:00Z
counts:
  decisions: 5
  lessons: 3
  patterns: 2
  surprises: 1
missing_artifacts: []
---

### Decisions

- **Zod for domain model and configuration validation**: Using Zod provides both runtime validation and TypeScript type inference from a single source of truth.
  Source: .gsd/DECISIONS.md
- **Pure Phase Engine**: Decoupling logic for calculating phase transitions allows for fast-forward catchup for reboots and deterministic testing.
  Source: .gsd/milestones/M001/slices/S03/S03-SUMMARY.md
- **Smart Reconciliation with Drift Detection**: Maintain an internal `lastAppSetState` map. If a device's current state differs from the last state the app set, skip reconciliation.
  Source: .gsd/milestones/M001/slices/S04/S04-SUMMARY.md
- **Lux sensor averaging (3-reading window)**: Filtering transient spikes using a rolling window ensures transitions are physically reliable.
  Source: .gsd/milestones/M001/slices/S05/S05-SUMMARY.md
- **Pre-publish bit-depth verification**: Implementing a custom script to check PNG bit depth avoids store rejections that the official validator misses.
  Source: .gsd/milestones/M001/slices/S08/S08-SUMMARY.md

### Lessons

- **SDK Decoupling**: Decoupling logic from the Homey SDK via a DeviceAPI abstraction was critical for achieving high test coverage (98 tests).
  Source: .gsd/milestones/M001/slices/S04/S04-SUMMARY.md
- **Validator Gaps**: The official Homey CLI validator does not check PNG bit depth, which is a common cause for human-review rejection.
  Source: .gsd/milestones/M001/slices/S08/S08-SUMMARY.md
- **Catchup Safety**: Windowed evaluation in the PhaseEngine (clamped to 24h/4 iterations) successfully prevents infinite loops during reboot catchup.
  Source: .gsd/milestones/M001/slices/S03/S03-SUMMARY.md

### Patterns

- **Delegated Validation**: Entry points (API/Flow) perform minimal logic and rely on the core App class to enforce state rules via shared schemas.
  Source: .gsd/milestones/M001/slices/S07/S07-SUMMARY.md
- **Pure Persistence Helpers**: Decoupled SettingsStore logic for config storage and validation enables full unit testing of the API layer.
  Source: .gsd/PROJECT.md

### Surprises

- **PNG Bit-Depth Oversight**: Discovered that 16-bit PNGs pass `homey app validate` but fail manual store review; necessitated a custom byte-level checker.
  Source: .gsd/milestones/M001/slices/S08/S08-SUMMARY.md
