---
phase: completion
phase_name: M002 Complete
project: homey-lightcontroller
generated: 2026-04-26T21:30:00Z
counts:
  decisions: 3
  lessons: 3
  patterns: 2
  surprises: 0
missing_artifacts: []
---

### Decisions

- **M002 slice decomposition granularity**: Chose one slice per hardening requirement (R008-R011) to ensure independent verification surfaces and clean per-requirement traceability.
  - Source: .gsd/DECISIONS.md/D002
- **M002 slice ordering**: Locked Node 20 toolchain (S01) first so downstream slices verify on the real target engine.
  - Source: .gsd/DECISIONS.md/D003
- **Scope exclusion for R010**: Restricted S03 to eager validation and failure logging, deferring actual engine startup wiring to avoid integration risk in a hardening milestone.
  - Source: .gsd/DECISIONS.md/D004

### Lessons

- **Mock-driven timing verification**: Vitest fake timers and enhanced mock APIs are highly effective for verifying mesh resilience and pacing constraints (R009) without physical Zigbee/Z-Wave hardware.
  - Source: .gsd/milestones/M002/slices/S02/S02-SUMMARY.md/What Happened
- **Fail-fast application boot**: Eagerly validating configuration in `onInit` significantly simplifies downstream logic by guaranteeing a valid state contract before the engine starts.
  - Source: .gsd/milestones/M002/slices/S03/S03-SUMMARY.md/What Happened
- **Deterministic state recovery**: In time-aware state machines, explicit type-priority (e.g., time > solar > lux) is required to handle simultaneous event collisions during reboot catch-up.
  - Source: .gsd/milestones/M002/slices/S04/S04-SUMMARY.md/What Happened

### Patterns

- **Single-Retry Pacing**: Combining a single-retry mechanism (200ms) with a baseline command-pacing delay (50ms) provides resilience against transient network failures without saturating the mesh.
  - Source: .gsd/milestones/M002/slices/S02/S02-SUMMARY.md/What Happened
- **Boundary Validation Guard**: Centralizing configuration validation via Zod at the application entry point (`onInit`) ensures the internal engine always operates on a validated contract.
  - Source: .gsd/milestones/M002/slices/S03/S03-SUMMARY.md/What Happened

### Surprises

- None.
