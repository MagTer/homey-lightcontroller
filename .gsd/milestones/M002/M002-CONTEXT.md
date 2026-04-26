# M002: Hardening & Resilience

**Gathered:** 2026-04-26
**Status:** Ready for planning

## Project Description

Milestone M002 addresses four critical hardening points identified in an external audit to ensure production readiness, network stability, and environment compatibility for Homey Pro.

## Why This Milestone

This milestone fixes deployment blockers (Node.js version mismatch) and addresses transient network instability issues that were identified as risks in M001. It also hardens the application's configuration boundary and state recovery logic.

## User-Visible Outcome

### When this milestone is complete, the user can:

- Install the app on Homey Pro running Node.js 20.
- Experience more reliable device updates in dense mesh networks.
- Trust that the app recovers deterministically after a Homey reboot.

### Entry point / environment

- Entry point: Homey App Lifecycle (onInit, Periodic Reconcile)
- Environment: Homey Pro (Node.js >=20.0.0)
- Live dependencies involved: Homey Mesh Network (Zigbee/Z-Wave)

## Completion Class

- Contract complete means: All audit points implemented and verified by Vitest unit tests (specifically retries and catch-up priority).
- Integration complete means: Build chain targeting Node 20 is stable.

## Final Integrated Acceptance

To call this milestone complete, we must prove:

- The app builds and installs in a Node 20 environment.
- The `Reconciler` performs exactly one retry on capability update failure.
- The `PhaseEngine` favors time-based conditions when multiple triggers occur during catch-up.

## Architectural Decisions

### Node.js Downgrade

**Decision:** Downgrade `package.json` engine requirement to `>=20.0.0`.

**Rationale:** Broad compatibility with existing Homey Pro firmware that may not yet be on v12.9.0 (Node 22).

**Alternatives Considered:**
- Stay on Node 22 — Rejected due to audit identifying it as a deployment blocker.

### Single-Retry Strategy

**Decision:** Implement a single retry after a short delay for failed device updates.

**Rationale:** Provides resilience against transient mesh collisions without the complexity or potential delay cascade of full exponential backoff.

**Alternatives Considered:**
- Exponential backoff — Rejected by user for simplicity.

### Eager Config Validation

**Decision:** MyApp will perform an eager, validated load of the configuration during `onInit()`.

**Rationale:** Surfaces configuration errors immediately at startup and ensures the internal engine always has access to a validated contract.

**Alternatives Considered:**
- Lazy loading — Rejected to avoid performance hit on first reconciliation.

## Error Handling Strategy

- **Persistent Failures:** Log to `Homey.error()` after retry failure.
- **Startup:** Critical log if config is invalid; engine will not start.
- **Fail-safe:** PhaseEngine maintains current phase if recovery evaluation fails.

## Risks and Unknowns

- **Node 20 Compatibility:** Risk of hidden Node 22 features in transitive dependencies.

## Relevant Requirements

- R008, R009, R010, R011

## Scope

### In Scope

- package.json Node downgrade.
- Reconciler retry logic and mesh delay increase.
- Config boundary hardening in app.ts.
- PhaseEngine catch-up determinism logic.

### Out of Scope / Non-Goals

- Full exponential backoff.
- Continuous config re-parsing.

## Testing Requirements

- Unit tests for Reconciler retry logic.
- Unit tests for PhaseEngine catch-up priority.
