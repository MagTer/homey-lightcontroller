---
id: T01
parent: S08
milestone: M001
key_files:
  - scripts/generate-images.mjs
  - assets/images/small.png
  - assets/images/large.png
  - assets/images/xlarge.png
  - .homeycompose/app.json
key_decisions:
  - Corrected store image dimensions from 135×135/500×500/1000×1000 to 250×175/500×350/1000×700 based on validator feedback — the plan's estimates were wrong
  - Added brandColor: #1E90FF to .homeycompose/app.json — a required field not mentioned in the task plan, discovered when validation still failed after images were added
duration: 
verification_result: passed
completed_at: 2026-04-26T10:27:11.033Z
blocker_discovered: false
---

# T01: Generated 8-bit store images at correct dimensions and wired them into .homeycompose/app.json

**Generated 8-bit store images at correct dimensions and wired them into .homeycompose/app.json**

## What Happened

Created a sharp-based one-shot generator at scripts/generate-images.mjs that renders assets/icon.svg onto solid-background canvases at three sizes, exporting each as 8-bit RGBA PNG (palette: false, color type 6). When the generator was first run with the task-plan dimensions (135×135, 500×500, 1000×1000), the Homey publish validator revealed two plan deviations: (1) the correct required sizes are 250×175, 500×350, 1000×700 (10:7 aspect ratio), and (2) a `brandColor` field is additionally required. Both were corrected inline — dimensions updated in the generator script, `brandColor: "#1E90FF"` added to .homeycompose/app.json. Final run: all three PNGs are bit depth 8 / color type 6, `npx homey app validate --level publish` exits 0, and all 98 Vitest tests pass.

## Verification

Three PNG byte-level checks (bit depth = 8, color type = 2 or 6 per PNG spec word), Homey publish validator (`npx homey app validate --level publish` exits 0), Vitest suite (98 tests in 10 files).

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `node -e "const fs=require('fs');for(const f of ['assets/images/small.png','assets/images/large.png','assets/images/xlarge.png']){const b=fs.readFileSync(f);if(b[24]!==8){console.error(f,'bit depth',b[24]);process.exit(1)}if(b[25]!==2&&b[25]!==6){console.error(f,'color type',b[25]);process.exit(1)}};"` | 0 | ✅ pass | 5ms |
| 2 | `npx homey app validate --level publish` | 0 | ✅ pass | 15000ms |
| 3 | `npm test` | 0 | ✅ pass | 990ms |

## Deviations

Task plan specified image dimensions as 135×135, 500×500, 1000×1000 — discovered during execution that the Homey App Store requires 250×175, 500×350, 1000×700 (10:7 ratio) and also mandates a brandColor field. Both were corrected inline with no downstream impact.

## Known Issues

None.

## Files Created/Modified

- `scripts/generate-images.mjs`
- `assets/images/small.png`
- `assets/images/large.png`
- `assets/images/xlarge.png`
- `.homeycompose/app.json`
