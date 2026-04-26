---
estimated_steps: 1
estimated_files: 2
skills_used: []
---

# T01: Define EvaluationContext type and getScheduleType helper with date-holidays

Create the input contract for the phase engine and the schedule-resolution helper. The `EvaluationContext` is a plain object with `now: Date`, `lux: number | null`, `latitude: number`, `longitude: number`, `countryCode: string`, and an optional injectable `logger?: (msg: string) => void`. Implement `getScheduleType(now: Date, countryCode: string, logger?): 'weekday' | 'weekend'` that uses `date-holidays` to detect public holidays and returns 'weekend' for Sat/Sun and recognized public holidays, 'weekday' otherwise. Holidays whose `type` is `bank` or `public` count as weekend; `observance` does NOT (these are flag days, not days off). If `date-holidays` initialization throws or `countryCode` is empty/invalid, log one warning via `logger` and fall back to a plain Sat/Sun check. Cache the per-country `Holidays` instance in a module-level `Map<string, Holidays>` so repeated ticks do not re-construct it.

## Inputs

- ``src/lib/config/Config.ts` — Phase / AppConfig types referenced by the EvaluationContext shape and consumers`
- ``package.json` — confirms `date-holidays` is already installed`

## Expected Output

- ``src/lib/engine/EvaluationContext.ts` — exports `EvaluationContext` type and `Logger` type alias`
- ``src/lib/engine/getScheduleType.ts` — exports `getScheduleType(now, countryCode, logger?)` returning `'weekday' | 'weekend'``

## Verification

Run `npx tsc --noEmit` (must pass). Then run `node --input-type=module -e "import('./src/lib/engine/getScheduleType.js').then(m => { if (m.getScheduleType(new Date('2026-12-25T12:00:00Z'),'NL') !== 'weekend') process.exit(1); if (m.getScheduleType(new Date('2026-04-22T12:00:00Z'),'NL') !== 'weekday') process.exit(1); if (m.getScheduleType(new Date('2026-04-22T12:00:00Z'),'') !== 'weekday') process.exit(1); console.log('OK'); })"` — must print OK and exit 0.

## Observability Impact

Adds one warn-level log emitted via the injected `logger` callback when the country code cannot initialize `date-holidays`; surfaces no other runtime signals.
