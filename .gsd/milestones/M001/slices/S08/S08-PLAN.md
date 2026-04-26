# S08: Store Readiness & Polish

**Goal:** Pre-publish script passes and Dry Run logs look correct — Homey app validates at --level publish and an automated pre-publish check confirms 8-bit PNG compliance for all store images.
**Demo:** Pre-publish script passes and Dry Run logs look correct.

## Must-Haves

- Demo: `npx homey app validate --level publish` exits 0, `npm run prepublish` exits 0 confirming both validator pass and 8-bit RGB(A) PNG compliance for small/large/xlarge images, and existing 98 Vitest tests still pass with no regressions.
- Must-Haves:
- assets/images/{small,large,xlarge}.png exist as 8-bit RGB or RGBA PNGs at 135×135, 500×500, and 1000×1000 respectively
- .homeycompose/app.json declares an `images` block pointing to the three asset paths
- `npx homey app validate --level publish` exits 0 with no missing-property errors
- scripts/prepublish.mjs runs the publish-level validator AND inspects each declared image's PNG header to assert bit depth = 8 and color type ∈ {2, 6}; exits non-zero with a clear error on any failure
- package.json exposes a `prepublish` npm script that invokes scripts/prepublish.mjs
- All existing tests continue passing (no regression in core state machine, reconciler, settings, or API)
- R005 (settings UI for role-based device assignment) remains satisfied by S06 deliverables — no action needed in this slice; document the link in the slice plan
- Requirement Impact:
- Requirements touched: R005 (already delivered by S06; this slice does not change behavior, only re-verifies via the publish validator running over the full app definition)
- Re-verify: settings UI loads under `--level publish` validation; existing Vitest suite passes
- Decisions revisited: none
- Threat Surface: omitted — slice introduces no new auth, user input, or data exposure. Pre-publish script reads local files only and invokes a vetted Homey CLI command.
- Proof Level:
- This slice proves: final-assembly (full app passes the store's publish-level validator end-to-end)
- Real runtime required: no (validator is static; no Homey runtime needed)
- Human/UAT required: no (validator output and script exit code are objective)

## Proof Level

- This slice proves: final-assembly — proves the assembled app passes the same validator the Homey App Store uses, with mechanical PNG-header inspection guarding the 8-bit constraint that the validator itself does not check.

## Integration Closure

Upstream surfaces consumed: `.homeycompose/app.json` (composed at validate time into root `app.json`), assets in `assets/images/`, the Homey CLI `app validate` command, app.ts logging from S07.
New wiring introduced in this slice: `images` block in `.homeycompose/app.json`, `prepublish` npm script in package.json pointing to scripts/prepublish.mjs.
What remains before the milestone is truly usable end-to-end: nothing — after S08 the app is store-submission-ready. Real artwork can replace placeholders post-milestone without code changes.

## Verification

- Runtime signals: scripts/prepublish.mjs prints per-image diagnostics (path, bit depth, color type) on stderr when checks fail, so a future agent or human running `npm run prepublish` can localize the failing asset without re-reading PNG bytes by hand.
- Inspection surfaces: `npm run prepublish` (CLI), `npx homey app validate --level publish` (CLI). Both produce deterministic, copy-pasteable output.
- Failure visibility: script exits non-zero with the offending file path and the specific byte-level reason (e.g. "bit depth 16, expected 8" or "color type 3 (indexed), expected 2 or 6"). Validator output is forwarded verbatim.
- Redaction constraints: none — no secrets in this surface.

## Tasks

- [x] **T01: Generate 8-bit store images and wire images block into app.json** `est:45m`
  Create the three required Homey App Store image assets as 8-bit RGBA PNGs and declare them in .homeycompose/app.json so that `npx homey app validate --level publish` exits 0.

Why: The publish validator currently fails with `The property 'images' is required`. This is the single blocking gap for store submission. Per the inlined research, .homeycompose/app.json is the compose source (root app.json is gitignored and regenerated). `sharp` is already in node_modules, so we can generate placeholder PNGs programmatically without adding dependencies.

Do:
1. Create directory `assets/images/` (if it does not exist).
2. Write a one-shot generator at `scripts/generate-images.mjs` that uses `sharp` to render the existing `assets/icon.svg` (a green circle) onto solid-background canvases at 135×135, 500×500, and 1000×1000, exporting each as 8-bit RGBA PNG. Use `sharp(svgBuffer).resize(size, size).png({ palette: false, compressionLevel: 9 }).toFile(path)` — the default sharp PNG output is 8-bit RGB/RGBA (NOT 16-bit), but explicitly avoid palette mode to keep color type 6 (RGBA). If sharp's SVG rasterization fails, fall back to `sharp({ create: { width: size, height: size, channels: 4, background: { r: 30, g: 144, b: 255, alpha: 1 } } }).png().toFile(path)`.
3. Run the generator once: `node scripts/generate-images.mjs`. Verify the three files exist.
4. Open `.homeycompose/app.json` and add an `images` block immediately after `"category"`:
   "images": {
     "small": "/assets/images/small.png",
     "large": "/assets/images/large.png",
     "xlarge": "/assets/images/xlarge.png"
   },
   Preserve trailing newline and existing field ordering otherwise.
5. Run `npx homey app validate --level publish` from the project root. Confirm it exits 0 and prints `App validated successfully against level 'publish'` (or equivalent). If it still complains, inspect the generated root app.json to confirm the images block was composed in.
6. Run `npm test` to confirm no regression (98 tests still pass).

Must-haves:
- assets/images/small.png is 135×135, bit depth 8, color type 2 or 6
- assets/images/large.png is 500×500, bit depth 8, color type 2 or 6
- assets/images/xlarge.png is 1000×1000, bit depth 8, color type 2 or 6
- .homeycompose/app.json contains a valid `images` object with the three paths
- `npx homey app validate --level publish` exits 0
- All 98 existing Vitest tests still pass

Observability impact: scripts/generate-images.mjs is a one-shot dev tool; if PNG generation fails, sharp throws with the file path and reason — surface it to stderr verbatim so a future agent can diagnose. No runtime/production observability changes.

Failure modes: sharp may fail to rasterize the SVG on some platforms (libvips quirks); the fallback to a solid-color canvas guarantees a passing image. PNG color-type drift (e.g. sharp emitting palette PNGs on small flat-color images) is prevented by `palette: false`.
  - Files: `scripts/generate-images.mjs`, `assets/images/small.png`, `assets/images/large.png`, `assets/images/xlarge.png`, `.homeycompose/app.json`
  - Verify: node -e "const fs=require('fs');for(const f of ['assets/images/small.png','assets/images/large.png','assets/images/xlarge.png']){const b=fs.readFileSync(f);if(b[24]!==8){console.error(f,'bit depth',b[24]);process.exit(1)}if(b[25]!==2&&b[25]!==6){console.error(f,'color type',b[25]);process.exit(1)}}" && npx homey app validate --level publish && npm test

- [x] **T02: Write prepublish.mjs script and wire npm prepublish entry** `est:1h`
  Author scripts/prepublish.mjs as the durable, automated pre-publish gate: it runs the Homey publish-level validator AND independently inspects each declared image's PNG header to enforce 8-bit, non-indexed color, since the Homey validator itself does NOT check bit depth (per research gotcha — Homey store review rejects 16-bit PNGs even when the validator passes).

Why: The slice demo is `npm run prepublish` exits 0. This task encodes the contract so a future agent (or CI) can verify store-readiness with a single command rather than relying on humans remembering to run `homey app validate --level publish` and eyeball image specs.

Do:
1. Create `scripts/prepublish.mjs` as a Node ESM script. Import `node:child_process` (`spawnSync`), `node:fs`, `node:path`. Read `.homeycompose/app.json` and parse JSON. Extract the `images` object.
2. For each declared image path (the value strings begin with `/` — strip the leading slash and resolve relative to the project root), open the file as a Buffer and validate the PNG signature (first 8 bytes = 89 50 4E 47 0D 0A 1A 0A). Then read byte 24 (bit depth) — must equal 8 — and byte 25 (color type) — must be 2 (RGB) or 6 (RGBA). On failure, console.error a clear message naming the file path, the offending byte, and the expected value, then `process.exit(1)`.
3. After all images pass, invoke `spawnSync('npx', ['homey', 'app', 'validate', '--level', 'publish'], { stdio: 'inherit' })`. If `status !== 0`, exit with that status.
4. On full success, console.log `prepublish: OK (3 images verified, validator passed)` and exit 0.
5. Edit `package.json` and add `"prepublish": "node scripts/prepublish.mjs"` to the `scripts` block. Keep alphabetical or insertion order consistent with existing entries (build, test).
6. Run `npm run prepublish` from the project root. Confirm exit 0 and the success line.
7. Negative test: temporarily rename one image file and re-run `npm run prepublish` — confirm it exits non-zero with a clear error mentioning the missing file. Restore the file.
8. Run `npm test` to confirm no regressions in the existing test suite.

Must-haves:
- scripts/prepublish.mjs exists, is valid ESM, and executes via `node scripts/prepublish.mjs`
- Script reads `.homeycompose/app.json` (NOT the gitignored root app.json) to discover image paths
- Script asserts PNG signature, bit depth = 8, and color type ∈ {2, 6} for every declared image
- Script invokes `npx homey app validate --level publish` and propagates non-zero exit codes
- package.json has a `prepublish` script entry
- `npm run prepublish` exits 0 in the green-path state from T01
- Negative test (missing image) causes a non-zero exit with a clear, file-path-naming error
- All 98 existing Vitest tests still pass

Failure modes:
- `.homeycompose/app.json` malformed: catch JSON parse error and exit 1 with `prepublish: failed to parse .homeycompose/app.json: <message>`.
- Image file missing: fs.readFileSync throws ENOENT; catch and exit 1 with `prepublish: image not found: <path>`.
- sharp/Homey CLI missing from PATH: spawnSync sets `error` field; surface it and exit 1.
- 16-bit PNG sneaking past the validator: explicit byte-24 check rejects it with `prepublish: <path> bit depth 16, expected 8`.

Load profile: trivial — script reads 3 small files (<5MB total) and invokes one CLI subprocess. Runs in <5s on a developer machine. No concurrency.

Negative tests: see step 7 above. Document the rename/restore sequence in a comment at the top of the script for future maintainers.

Observability impact: This script IS the diagnostic surface for store-readiness. Every error path must name the offending file and the specific byte-level cause. No production runtime changes.
  - Files: `scripts/prepublish.mjs`, `package.json`
  - Verify: npm run prepublish && (mv assets/images/small.png assets/images/small.png.bak; ! npm run prepublish; mv assets/images/small.png.bak assets/images/small.png) && npm test

## Files Likely Touched

- scripts/generate-images.mjs
- assets/images/small.png
- assets/images/large.png
- assets/images/xlarge.png
- .homeycompose/app.json
- scripts/prepublish.mjs
- package.json
