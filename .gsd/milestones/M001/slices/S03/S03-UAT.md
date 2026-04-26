# S03: Phase Engine & Environment Logic — UAT

**Milestone:** M001
**Written:** 2026-04-25T23:20:03.943Z

### UAT S03: Phase Engine Logic

**Preconditions:**
- Environment has Node.js and dependencies installed.
- `npm run build` has been executed.

**Scenario 1: Standard Time Transition (Weekday)**
1. Set current time to Monday 07:01.
2. Set `lastEvalTime` to Monday 06:59.
3. Config: MORNING phase starts at 07:00 (TimeCondition).
4. **Expected:** Engine returns phase `MORNING` with one transition record (reason: `time`).

**Scenario 2: Holiday Support**
1. Set `countryCode` to `NL`.
2. Set time to Friday, Dec 25, 2026 (Christmas).
3. Config: Weekday MORNING at 07:00, Weekend MORNING at 09:00.
4. **Expected:** Engine uses weekend schedule; if time is 08:00, phase remains `NIGHT`.

**Scenario 3: Solar Transition with Offset**
1. Set time to 31 minutes after sunset in Amsterdam.
2. Config: EVENING starts at `sunset + 30m`.
3. **Expected:** Engine returns phase `EVENING` (reason: `solar`).

**Scenario 4: Reboot Catchup (Multi-transition)**
1. Set `lastEvalTime` to 12 hours ago.
2. Config defines a full cycle (NIGHT -> MORNING -> DAY -> EVENING).
3. **Expected:** Engine returns the current correct phase and a list of all skipped transitions.

**Scenario 5: Iteration Cap**
1. Use a degenerate config where conditions always trigger.
2. **Expected:** Engine stops after 4 transitions and sets `cappedAt: 4`.
