# Lighting Scheduler

A Homey Pro app that automates your lights through a four-phase daily state machine:
**Night → Morning → Day → Evening → Night**.

## Requirements

- **Homey Pro** (the app only runs on local Homey hardware).
- `platforms: ["local"]`
- `compatibility: ">=12.0.1"`

## What it does

- Runs a four-phase state machine and advances the active phase based on time, solar events (sunrise/sunset), or indoor lux levels.
- Assigns lights to **roles** so one configuration controls many devices.
- Applies each role's target state (on/off, dim level) when a phase transition occurs.
- Performs periodic **maintenance** ticks to recover devices that drift from the target state.
- Respects manual overrides: if you change a light yourself, the app skips that device during maintenance until the next phase transition.
- Supports **lux-driven twilight dimming** so lights can follow the ambient brightness in real time.

## Setup

1. Open the app's settings page.
2. Check the **status panel** to see the current phase and live lux readings.
3. Use **Quick Setup presets** to create common roles (window lights, outdoor lights, ambient twilight, etc.).
4. Select your **lux sensors**:
   - **Outdoor** — shown in the status panel for diagnostics.
   - **Indoor downstairs / upstairs** — used for lux conditions and dynamic dimming.
5. Adjust **phase schedules** for each phase. Each schedule can mix time, solar, and lux conditions for weekdays and weekends.
6. Configure **roles & devices**: create roles, assign your lights, and set each role's on/off and dim state per phase.
7. Enable **lux-based dimming** on a role if you want its dim level to follow indoor lux during selected phases.
8. Save — the app starts the engine on the next tick.

## Phase schedules & lux conditions

Each phase has separate weekday and weekend schedules. The earliest triggering condition wins, so you can mix:

- **Time** — e.g. `06:30`
- **Solar** — e.g. `sunrise` with ± offset
- **Lux** — e.g. `lux > 50`

Lux conditions are useful to **skip a phase**. For example, add a lux condition to **Morning** so the wake-up lights stay off when it's already bright outside.

## Forced phase

The Flow action **"Set Phase"** forces the active phase to a specific value and applies it immediately. The forced phase persists until:

- it is changed again with another **Set Phase** action, or
- the app restarts.

After a restart, automatic phase evaluation resumes from the stored current phase.

## Manual override / drift-aware maintenance

During a phase transition, the app updates every assigned device to the target state.

During maintenance (same phase, periodic tick), the app checks whether a device still matches the state it last set:

- If the device has drifted — for example, you turned it on/off manually — the app **skips** that device until the next phase transition.
- If the device matches the expected state but has not reached the target, the app applies the target state.

This prevents the app from fighting your manual changes while still recovering devices that missed a command.

## Lux sensors

- **Outdoor** lux sensor is used for status and diagnostics only.
- **Indoor** lux sensors (downstairs / upstairs) feed the smoothed lux value used by:
  - lux conditions in phase schedules
  - lux-based dynamic dimming per role

## Dynamic dimming

In a role's phase state you can configure a static dim level, or enable **lux-based dimming**. When enabled, the app maps indoor lux readings to a dim level:

- brighter room → lower dim / off
- darker room → higher dim

You define the lux and dim boundaries, and select which phases the dimming is active in.

## Flow cards

- **Trigger:** "Phase Changed" — fires when the lighting phase changes.
- **Condition:** "The lighting phase is/isn't ..." — check the current phase.
- **Action:** "Set Phase" — force a specific phase.

## Support

- Repository: https://github.com/MagTer/homey-lightcontroller
- Issues: https://github.com/MagTer/homey-lightcontroller/issues
