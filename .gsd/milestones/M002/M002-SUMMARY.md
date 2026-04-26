---
id: M002
title: "Hardening & Resilience"
status: complete
completed_at: 2026-04-26T21:29:52.342Z
key_decisions:
  - D002: One slice per hardening requirement for independent verification.
  - D003: Node 20 toolchain lock-in first to verify subsequent work on the target engine.
  - D004: Eager validation guard at boundary, deferring engine startup wiring to a later milestone.
key_files:
  - package.json
  - app.ts
  - src/lib/engine/Reconciler.ts
  - src/lib/engine/PhaseEngine.ts
  - tests/api/AppInit.test.ts
  - tests/engine/Reconciler.test.ts
  - tests/engine/PhaseEngine.test.ts
lessons_learned:
  - Vitest fake timers and mock APIs are sufficient for verifying complex timing logic (mesh pacing and retries) without physical hardware.
  - Eager boundary validation with Zod provides a high-confidence 'fail-fast' mechanism that prevents inconsistent application state.
  - Deterministic tiebreaks in state machines are critical for predictable recovery in time-aware systems.
---

# M002: Hardening & Resilience

**Hardened the application against toolchain incompatibility, mesh instability, configuration corruption, and non-deterministic state recovery.**

## What Happened

Milestone M002 ("Hardening & Resilience") addressed four critical production-readiness points. First, we lowered the Node.js engine constraint to >=20.0.0, ensuring compatibility with current Homey Pro firmware while verifying that our modern TS toolchain remains stable. Second, we introduced single-retry resilience in the Reconciler, allowing the app to transparently handle transient Zigbee/Z-Wave mesh failures without violating the 50ms command delay safety constraint. Third, we hardened the app boundary by implementing eager Zod-based configuration validation in `onInit`, ensuring that missing or corrupt settings are surfaced immediately at boot rather than causing runtime errors in the reconciliation loop. Finally, we added a deterministic type-priority tiebreak (time > solar > lux) to the PhaseEngine, ensuring predictable state recovery during reboot catch-up scenarios when multiple triggers resolve to the same millisecond.

## Success Criteria Results

- **Node 20 Compatibility:** PASS. `package.json` declares `>=20.0.0` and all 108 tests pass.
- **Reconciler Retry:** PASS. Commands retry exactly once after 200ms; verified by fake timers.
- **Eager Config Validation:** PASS. `MyApp.onInit` logs critical errors and skips startup on invalid config.
- **Deterministic Tiebreak:** PASS. `time > solar > lux` tiebreak verified for identical `eventTimes`.

## Definition of Done Results

- All 4 slices (S01-S04) are marked as complete in the roadmap.
- Full slice summaries exist for all slices, documenting implementation and verification.
- Cross-slice integration (Node 20 toolchain, Reconciler resilience, AppInit guard, PhaseEngine tiebreak) verified via full test suite (108 tests passing).

## Requirement Outcomes

- **R008 (Node 20 support):** Moved to `validated`. Verified by engine constraint update and full build/test cycle.
- **R009 (Mesh retry):** Moved to `validated`. Verified by Reconciler unit tests with simulated transient failures.
- **R010 (Validated config):** Moved to `validated`. Verified by AppInit unit tests for missing/invalid config paths.
- **R011 (Tiebreak priority):** Moved to `validated`. Verified by PhaseEngine unit tests for simultaneous event catch-up.

## Deviations

None.

## Follow-ups

None.
