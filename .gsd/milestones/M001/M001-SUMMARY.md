---
id: M001
title: "Core State Machine & Store Readiness"
status: complete
completed_at: 2026-04-26T10:36:26.995Z
key_decisions:
  - Zod for domain model and configuration validation.
  - Pure Phase Engine for deterministic testing.
  - Internal `lastAppSetState` map for override detection.
  - Lux sensor averaging with transient suppression (3-reading window).
  - Low-level PNG bit-depth verification in prepublish script.
key_files:
  - src/lib/engine/PhaseEngine.ts
  - src/lib/engine/Reconciler.ts
  - src/lib/engine/LuxAggregator.ts
  - scripts/prepublish.mjs
lessons_learned:
  - Decoupling logic from the Homey SDK (DeviceAPI abstraction) was critical for high test coverage.
  - Homey's built-in validator misses PNG bit-depth issues, justifying the custom pre-publish script.
  - Windowed evaluation in PhaseEngine successfully prevents infinite loops during catchup.
---

# M001: Core State Machine & Store Readiness

**State machine integrity with automated store-readiness gating, robust reconciliation, and 98/98 test pass.**

## What Happened

M001 successfully established the foundational architecture for the Homey Light Controller. We delivered a deterministic 4-phase state machine (NIGHT, MORNING, DAY, EVENING) with a pure engine that handles complex solar, lux, and holiday-aware transitions. The core execution is driven by a "Smart Reconciler" that ensures eventual consistency (60s pulse) while respecting manual user overrides through drift detection. To protect the Homey mesh, a 50ms serial delay is enforced between all device commands. We also delivered a strongly typed AppConfig model (Zod), a smoothed LuxAggregator (3-reading debounce), and a unified external surface (REST API and Flow Cards). Finally, we established a "pre-publish" gate that automates PNG bit-depth verification and publish-level metadata validation, ensuring a friction-free path to the Homey App Store.

## Success Criteria Results

- **App survives reboots and restores phase state**: Met. S03 implemented reboot catchup logic; S07 implemented persistence of forced phases.
- **Transitions fire within 60s of thresholds/schedules**: Met. S04 Reconciler runs on a 60s pulse, verified by timing-sensitive Vitest tests.
- **Manual overrides are respected until the next phase change**: Met. S04 Reconciler implements drift detection that identifies manual changes and skips reconciliation for those devices.
- **50ms mesh protection delay is consistently applied**: Met. S04 Reconciler enforces a 50ms serial delay between device API calls, verified with Vitest fake timers.
- **8-bit PNG compliance is verified by script**: Met. S08 implemented `scripts/prepublish.mjs` which performs low-level bit-depth checks, wired into `npm run prepublish`.

## Definition of Done Results

- All slices (S01-S08) are complete and summarized.
- 98 Vitest tests provide comprehensive coverage of core logic, API, and integration.
- TypeScript compilation is clean (tsc --noEmit).
- Homey CLI validation passes at `--level publish`.

## Requirement Outcomes

- R001: active -> validated — Verified by Unit tests in S03 and Reconciler integration in S04.
- R002: validated -> validated — Already validated in S05/S06.
- R003: validated -> validated — Already validated in S07.
- R004: active -> validated — Verified by holiday-aware tests in S03.
- R005: validated -> validated — Already validated in S08.
- R006: validated -> validated — Already validated in S05.
- R007: active -> active — Bit-depth check automated in S08; cloud exclusion pending S11.

## Deviations

None.

## Follow-ups

None.
