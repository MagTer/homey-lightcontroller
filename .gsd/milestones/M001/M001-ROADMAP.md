# M001: Core State Machine & Store Readiness

**Vision:** A publish-ready Homey app with a robust 4-phase state machine that eliminates lighting race conditions.

## Success Criteria

- App survives reboots and restores phase state.
- Transitions fire within 60s of thresholds/schedules.
- Manual overrides are respected until the next phase change.
- 50ms mesh protection delay is consistently applied.
- 8-bit PNG compliance is verified by script.

## Slices

- [x] **S01: S01** `risk:low` `depends:[]`
  > After this: Project validates with npx homey app validate.

- [x] **S02: S02** `risk:low` `depends:[]`
  > After this: Vitest verifies that any valid config JSON parses into a typed object.

- [x] **S03: S03** `risk:high` `depends:[]`
  > After this: Vitest verifies transitions across weekday/holiday/solar boundaries.

- [x] **S04: S04** `risk:high` `depends:[]`
  > After this: Mocks prove the 50ms delay and that manual overrides are respected.

- [x] **S05: S05** `risk:medium` `depends:[]`
  > After this: Vitest verifies the 3-reading debounce and dimming curves.

- [x] **S06: S06** `risk:medium` `depends:[]`
  > After this: Manual test: User can select devices and save a valid config.

- [x] **S07: S07** `risk:low` `depends:[]`
  > After this: User can trigger phase changes via Flow or HTTP PUT.

- [x] **S08: S08** `risk:low` `depends:[]`
  > After this: Pre-publish script passes and Dry Run logs look correct.

## Boundary Map

Not provided.
