---
id: T02
parent: S03
milestone: M001
key_files:
  - src/lib/engine/conditionEvaluators.ts
key_decisions:
  - Import suncalc as default import (import SunCalc from 'suncalc') rather than namespace import to work with CommonJS module
duration: 
verification_result: passed
completed_at: 2026-04-25T22:58:11.149Z
blocker_discovered: false
---

# T02: Implement pure condition evaluators for Time, Solar, and Lux conditions

**Implement pure condition evaluators for Time, Solar, and Lux conditions**

## What Happened

Created src/lib/engine/conditionEvaluators.ts with three pure evaluator functions sharing a common EvalResult shape:

1. evaluateTime(cond, lastEvalTime, now) - Parses HH:MM times and builds candidates for today and yesterday, returning the earliest that falls in the window (lastEvalTime, now].

2. evaluateSolar(cond, lastEvalTime, now, lat, lon) - Uses suncalc to get solar times (sunrise, sunset, goldenHour, goldenHourEnd) for today and yesterday, applies offset, and returns the earliest in-window result. Handles invalid dates from polar regions by returning triggered: false.

3. evaluateLux(cond, lux, now) - Returns triggered: false when lux is null, otherwise evaluates lt/gt operators and returns eventTime: now on hit.

Also exports evaluateCondition dispatcher that routes to the appropriate evaluator based on cond.type. All functions are pure (no logging or side effects), producing the eventTime diagnostic signal that callers use for transition logging.

Fixed suncalc import to use default import syntax for CommonJS compatibility.

## Verification

TypeScript compilation passes with zero errors. Manual runtime verification confirmed:
- Time conditions correctly evaluate in window (lastEvalTime, now]
- Solar conditions return sunrise/sunset/goldenHour times with offset support
- Lux conditions handle null values and lt/gt operators correctly  
- evaluateCondition dispatcher routes to correct evaluator by type

Full behavioral verification will be completed in T04 via Vitest.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npx tsc --noEmit` | 0 | ✅ pass | 3000ms |
| 2 | `node --input-type=module -e "import { evaluateTime, evaluateSolar, evaluateLux } from './.homeybuild/src/lib/engine/conditionEvaluators.js'; console.log('All exports loadable')"` | 0 | ✅ pass | 500ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `src/lib/engine/conditionEvaluators.ts`
