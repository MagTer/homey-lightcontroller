# M002: Hardening & Resilience

**Vision:** Address four surgical hardening points from external audit: Node 20 compatibility for Homey Pro deployment, single-retry resilience against transient mesh failures, eager config validation at the app boundary, and deterministic time-priority tiebreaks in PhaseEngine catch-up.

## Success Criteria

- package.json declares engines.node >=20.0.0 and the full Vitest suite plus tsc --noEmit pass under that constraint.
- Reconciler retries failed setCapability calls exactly once after a configurable delay (default 200ms) in both transition and maintenance modes; verified by Vitest fake timers.
- MyApp.onInit eagerly loads and parses stored config; on null or invalid config it logs via this.error and refuses to enter the running state, while getConfig() public signature is unchanged.
- PhaseEngine.evaluatePhaseConditions applies a strict type tiebreak (time > solar > lux) when multiple conditions resolve to identical eventTimes; verified by unit test.

## Slices

- [x] **S01: S01** `risk:Transitive dependency or TypeScript toolchain assumes a Node 22 API and fails to build or run under Node 20, blocking deployment to current Homey Pro firmware.` `depends:[]`
  > After this: Run node --version on the target runtime and show 20.x; run npm run build and npm run test from a clean clone and show tsc --noEmit clean plus all 98 Vitest tests passing under engines.node >=20.0.0.

- [x] **S02: S02** `risk:Retry logic doubles command pressure on a stuck mesh, skips the standard 50ms inter-command delay, or fires more than once and amplifies failure cascades — regressing R006.` `depends:[]`
  > After this: Vitest fake-timer test in tests/engine/Reconciler.test.ts proves: (a) first setCapability fails, second succeeds after retryDelayMs → entry lands in applied[] with no failed[] entry; (b) both attempts fail → entry lands in failed[]; (c) success on first attempt → no extra delay observed; (d) the 50ms mesh delay still fires after the retry path completes. All cases observable through ReconcileResult.

- [x] **S03: S03** `risk:Eager parsing changes startup semantics — a fresh install with no saved config currently completes onInit silently; the new path must log critically and skip engine startup without crashing or breaking the unconfigured installation flow.` `depends:[]`
  > After this: Vitest test for MyApp.onInit (against a mock SettingsStore) proves: (a) valid stored config → no error logged, app marked ready for engine startup; (b) null stored config → this.error called with a 'config-missing' detail and engine startup is skipped; (c) invalid stored config → this.error called with structured Zod issue detail and engine startup is skipped. getConfig() signature remains AppConfig | null.

- [x] **S04: S04** `risk:Adding a tiebreak silently regresses the existing earliest-eventTime ordering for non-tied cases, or picks the wrong winner when conditions resolve to identical timestamps.` `depends:[]`
  > After this: New unit test in tests/engine/PhaseEngine.test.ts proves: (a) two conditions with identical eventTimes (one type='time', one type='solar') → time wins; (b) time vs lux at identical eventTimes → time wins; (c) solar vs lux at identical eventTimes → solar wins; (d) existing earliest-eventTime scenario with distinct timestamps still picks the earliest regardless of type. All other PhaseEngine tests continue to pass.

## Boundary Map

| Boundary | Module / File | Slice |
|---|---|---|
| Build target / engine constraint | package.json | S01 |
| Device control hot path | src/lib/engine/Reconciler.ts | S02 |
| App lifecycle / config boundary | app.ts, src/lib/config/ConfigParser.ts | S03 |
| Phase decision logic | src/lib/engine/PhaseEngine.ts | S04 |
