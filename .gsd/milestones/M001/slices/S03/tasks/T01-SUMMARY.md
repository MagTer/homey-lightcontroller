---
id: T01
parent: S03
milestone: M001
key_files:
  - src/lib/engine/EvaluationContext.ts
  - src/lib/engine/getScheduleType.ts
key_decisions:
  - Holidays are cached in a module-level Map keyed by countryCode to avoid repeated initialization overhead during engine ticks
  - Only 'public' and 'bank' holiday types count as weekend days; 'observance' holidays (like flag days) are treated as regular weekdays
  - Logger is optional via optional chaining (?.) to allow no-op behavior when not provided
duration: 
verification_result: passed
completed_at: 2026-04-25T22:53:34.488Z
blocker_discovered: false
---

# T01: Defined EvaluationContext type and getScheduleType helper with date-holidays integration

**Defined EvaluationContext type and getScheduleType helper with date-holidays integration**

## What Happened

Created the input contract for the phase engine with the EvaluationContext type containing now, lux, latitude, longitude, countryCode, and an optional injectable logger. Implemented getScheduleType helper that uses date-holidays to detect public holidays and bank holidays as weekend days, while observance holidays do not count as days off. The Holiday instances are cached per-country in a module-level Map to avoid reconstruction on repeated ticks. Invalid country codes log a single warning via the injected logger and fall back to plain Sat/Sun check.

## Verification

TypeScript compilation passed (npx tsc --noEmit). Runtime verification confirmed: 2026-12-25 (Christmas, public holiday in NL) returns 'weekend'; 2026-04-22 (regular Wednesday in NL) returns 'weekday'; empty country code falls back correctly to 'weekday'.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npx tsc --noEmit` | 0 | ✅ pass | 5000ms |
| 2 | `node --input-type=module -e "import('./.homeybuild/src/lib/engine/getScheduleType.js').then(m => { if (m.getScheduleType(new Date('2026-12-25T12:00:00Z'),'NL') !== 'weekend') process.exit(1); if (m.getScheduleType(new Date('2026-04-22T12:00:00Z'),'NL') !== 'weekday') process.exit(1); if (m.getScheduleType(new Date('2026-04-22T12:00:00Z'),'') !== 'weekday') process.exit(1); console.log('OK'); })"` | 0 | ✅ pass | 500ms |

## Deviations

None.

## Known Issues

None

## Files Created/Modified

- `src/lib/engine/EvaluationContext.ts`
- `src/lib/engine/getScheduleType.ts`
