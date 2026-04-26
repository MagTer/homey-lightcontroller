---
id: S08
parent: M001
milestone: M001
provides:
  - (none)
requires:
  []
affects:
  []
key_files:
  - (none)
key_decisions:
  - (none)
patterns_established:
  - (none)
observability_surfaces:
  - none
drill_down_paths:
  []
duration: ""
verification_result: passed
completed_at: 2026-04-26T10:30:41.885Z
blocker_discovered: false
---

# S08: Store Readiness & Polish

**Automated store-readiness gate with PNG bit-depth enforcement and publish-level validation pass.**

## What Happened

Slice S08 finalized the app's readiness for the Homey App Store. We generated the required store image assets (small, large, xlarge) using a `sharp`-based generator. During generation, we corrected the image dimensions to the required 10:7 aspect ratio (250x175, 500x350, 1000x700) and added the mandatory `brandColor` field to `.homeycompose/app.json` after the `homey app validate --level publish` command highlighted these gaps. 

To prevent future submission rejections, we authored `scripts/prepublish.mjs`, which performs a low-level byte check on all declared images to ensure they are 8-bit RGB/RGBA (catching a known store-review gotcha that the official validator misses). This script is wired into `npm run prepublish` and also invokes the official Homey validator at the `publish` level. The entire 98-test Vitest suite remains passing, ensuring no regressions in the core engine while we polished the external packaging.

## Verification

- `npm run prepublish`: Confirmed all 3 images pass the bit-depth check and the Homey CLI validator exits 0 at `--level publish`.
- Negative testing: Confirmed `prepublish.mjs` correctly exits non-zero if an image is missing.
- `npm test`: 98/98 Vitest tests passed, covering state machine, reconciler, and API.

## Requirements Advanced

None.

## Requirements Validated

None.

## New Requirements Surfaced

None.

## Requirements Invalidated or Re-scoped

None.

## Operational Readiness

None.

## Deviations

None.

## Known Limitations

None.

## Follow-ups

None.

## Files Created/Modified

None.
