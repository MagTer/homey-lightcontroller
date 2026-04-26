# Project: Homey Light Controller

## What This Is

A logic-driven Homey Pro app (`net.magnus.lightcontroller`) that implements a deterministic four-phase state machine for home lighting automation. It orchestrates existing devices via the Homey Web API, replacing traditional event-driven flow logic with a centralized reconciler pattern.

## Core Value

Eliminating automation "race conditions" and "orphaned lights" by replacing independent triggers with an enforced, state-aware reconciliation loop that respects manual user overrides.

## Current State

Milestone M001 Complete. All core logic (Phase Engine, Reconciler, Lux Aggregator, Dimming Curves) is implemented and verified by 98 Vitest tests. The app is store-ready with a pre-publish gate ensuring 8-bit PNG compliance and valid publish-level metadata.

## Architecture / Key Patterns

- **Deterministic State Machine:** Rotation through NIGHT, MORNING, DAY, EVENING phases.
- **Role-Based Abstraction:** Devices are assigned to logical roles (Window Lights, Twilight, etc.) via a settings UI.
- **Zod-Backed Configuration:** Strongly typed AppConfig model with runtime validation for time strings, solar events, and lux thresholds.
- **Pure Phase Engine:** Decoupled logic for calculating phase transitions, supporting fast-forward catchup for reboots.
- **Smart Reconciliation:** A periodic (60s) pulse that enforces target states while detecting and respecting manual user overrides via a `lastAppSetState` map.
- **DeviceAPI Abstraction:** Hardware-agnostic interface for getting/setting device capabilities, enabling deterministic testing with mocks.
- **Dual-Trigger Transitions:** Combined Lux threshold and Solar Event (Sunrise/Sunset/Golden Hour) logic with user-configurable offsets.
- **Lux Aggregation:** 3-reading rolling window (LuxAggregator) across multiple sensors to filter transient spikes and handle sensor dropout.
- **Dimming Curves:** Pure interpolation helpers (DimmingCurve) for lux-based and temporal (twilight) dimming ramps.
- **Environment Awareness:** Automatic integration with Homey Geolocation for solar calculations and Bank Holiday detection via `date-holidays`.
- **Mesh Protection:** Enforced 50ms delays between all Homey API device commands.
- **TypeScript ESM Scaffold:** Modern development with NodeNext module resolution and automated compilation to `.homeybuild/`.
- **Pure Persistence Helpers:** Decoupled SettingsStore logic for config storage and validation, enabling full unit testing of the API layer.
- **Unified External Surfaces:** REST API and Flow Cards share a single validation path via `App.forcePhase`, protecting internal state from malformed external input.
- **Pre-Publish Guard:** Durable `npm run prepublish` gate that enforces low-level PNG constraints (8-bit bit depth) and publish-level metadata validity.

## Capability Contract

See `.gsd/REQUIREMENTS.md` for the explicit capability contract, requirement status, and coverage mapping.

## Milestone Sequence

- [x] M001: Core State Machine & Store Readiness — Implementation of the 4-phase logic, reconciler, holiday/solar support, settings UI, and store-ready packaging. (Complete)
