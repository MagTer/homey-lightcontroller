# S04: PhaseEngine type-priority tiebreak in catch-up — UAT

**Milestone:** M002
**Written:** 2026-04-26T21:25:11.080Z

# UAT: PhaseEngine Tiebreak Verification

## Preconditions
- Development environment with Node.js and dependencies installed.
- All existing tests pass.

## Test Case 1: Time vs Solar Tie
1. **Action**: Run the unit test "type-priority tiebreak > time vs solar at identical eventTimes -> time wins".
2. **Setup**: Inject two conditions (Time at 07:00, Solar at 07:00).
3. **Expected Outcome**: `PhaseEngine` selects 'time' as the reason for transition.

## Test Case 2: Solar vs Lux Tie
1. **Action**: Run the unit test "type-priority tiebreak > solar vs lux at identical eventTimes -> solar wins".
2. **Setup**: Inject two conditions (Solar at 07:00, Lux at 07:00).
3. **Expected Outcome**: `PhaseEngine` selects 'solar' as the reason for transition.

## Test Case 3: Earliest Wins (No Tie)
1. **Action**: Run the unit test "type-priority tiebreak > distinct timestamps - earliest wins regardless of type".
2. **Setup**: Inject Lux at 12:00 (higher priority type) and Time at 07:00 (earlier timestamp).
3. **Expected Outcome**: `PhaseEngine` selects 'time' because 07:00 is strictly earlier than 12:00, despite Lux having a lower priority (numerically higher).

## Test Case 4: Full Suite Regression
1. **Action**: Run `npm test`.
2. **Expected Outcome**: All 108 tests pass, ensuring deterministic tiebreaks didn't break standard phase progression or solar/lux logic.
