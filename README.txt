Lighting Scheduler
==================

A Homey Pro app that automates your lights through four daily phases:
Night, Morning, Day, and Evening.

Features
--------
- Four-phase state machine: NIGHT → MORNING → DAY → EVENING → NIGHT
- Transition triggers based on time, solar events (sunrise/sunset), or lux levels
- Dynamic twilight dimming based on indoor lux readings
- Manual override detection with drift-aware maintenance
- Role-based device grouping — configure groups of lights once, apply to many devices
- Flow cards: trigger on phase change, action to set phase, condition to check phase
- Smart morning: weekday/weekend schedules with optional lux skip

Setup
-----
1. Open the app settings.
2. Select lux sensors (optional but recommended for light-aware transitions).
3. Adjust phase schedules to match your daily rhythm.
4. Create roles and assign your lights to them.
5. Save — your lights will now follow the configured phases.

Lux Sensors
-----------
Configure outdoor and indoor lux sensors to enable:
- Light-aware phase transitions (e.g., skip morning wake-up if already bright)
- Dynamic twilight dimming during MORNING and EVENING phases

Phase Schedules
---------------
Each phase has weekday and weekend schedules. The earliest triggering condition
determines when the phase starts. You can mix time, solar, and lux conditions.

Dynamic Dimming
---------------
In a role's phase state, you can configure "dimming" instead of a fixed dim value.
This maps indoor lux readings to a dim level, creating smooth twilight transitions.

Flow Cards
----------
- Trigger: "Phase Changed" — fires when the lighting phase changes
- Action: "Set Phase" — force a specific phase
- Condition: "The lighting phase is/isn't ..." — check current phase

Support
-------
GitHub: https://github.com/MagTer/homey-lightcontroller
Issues: https://github.com/MagTer/homey-lightcontroller/issues
