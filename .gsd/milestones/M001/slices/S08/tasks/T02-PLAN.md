---
estimated_steps: 28
estimated_files: 2
skills_used: []
---

# T02: Write prepublish.mjs script and wire npm prepublish entry

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

## Inputs

- ``.homeycompose/app.json``
- ``assets/images/small.png``
- ``assets/images/large.png``
- ``assets/images/xlarge.png``
- ``package.json``

## Expected Output

- ``scripts/prepublish.mjs``
- ``package.json``

## Verification

npm run prepublish && (mv assets/images/small.png assets/images/small.png.bak; ! npm run prepublish; mv assets/images/small.png.bak assets/images/small.png) && npm test

## Observability Impact

Adds an inspection surface (`npm run prepublish`) whose stderr output names the offending file and byte-level reason on every failure path. This is the canonical store-readiness diagnostic for the project going forward.
