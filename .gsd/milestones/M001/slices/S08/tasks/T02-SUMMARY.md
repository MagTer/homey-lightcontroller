---
id: T02
parent: S08
milestone: M001
key_files:
  - scripts/prepublish.mjs
  - package.json
key_decisions:
  - Used `fileURLToPath(import.meta.url)` + `__dirname` pattern for robust project-root resolution regardless of CWD
  - PNG byte validation uses Buffer comparison via `.equals()` for signature check rather than manual loop
  - stderr (`console.error`) used for per-check progress and all failure messages so the output is machine-parseable; stdout only for the final OK line
  - Allowed color types 2 (RGB) and 6 (RGBA) — rejects type 0 (grayscale), 1 (indexed), 3 (indexed+alpha), 4 (grayscale+alpha) per PNG spec
duration: 
verification_result: passed
completed_at: 2026-04-26T10:29:49.472Z
blocker_discovered: false
---

# T02: Created prepublish.mjs gate script that validates PNG bit depth + runs Homey publish validator

**Created prepublish.mjs gate script that validates PNG bit depth + runs Homey publish validator**

## What Happened

Created `scripts/prepublish.mjs` as a Node ESM script wired into `npm run prepublish`. The script reads `.homeycompose/app.json`, strips the leading `/` from each declared image path, opens the file as a Buffer, and enforces: (1) PNG signature bytes match, (2) byte 24 (bit depth) equals exactly 8, and (3) byte 25 (color type) is 2 (RGB) or 6 (RGBA) — rejecting indexed-color (3) and 16-bit (depth 16) variants that the Homey validator itself does not catch. After all image checks pass, it calls `spawnSync('npx', ['homey', 'app', 'validate', '--level', 'publish'], { stdio: 'inherit' })` and propagates the exit code. All four failure modes (malformed JSON, missing file, CLI spawn failure, 16-bit PNG) exit non-zero with a file-path-named message. A `prepublish` entry was added to `package.json` scripts in alphabetical order. Green path: all 3 images verified, validator passed (exit 0). Negative path: `mv small.png small.png.bak` → exit 1 with "prepublish: image not found: ...small.png" — restored after confirm. All 98 Vitest tests still pass.

## Verification

npm run prepublish green path (3 images verified, validator passed); negative test (mv small.png → exit 1 with named file path); npm test (98/98 passed)

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npm run prepublish` | 0 | ✅ pass | 15000ms |
| 2 | `mv assets/images/small.png assets/images/small.png.bak && npm run prepublish; mv assets/images/small.png.bak assets/images/small.png` | 1 | ✅ pass (correctly exits non-zero, names missing file) | 5000ms |
| 3 | `npm test` | 0 | ✅ pass (98/98 Vitest tests passed) | 1040ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `scripts/prepublish.mjs`
- `package.json`
