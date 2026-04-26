---
estimated_steps: 24
estimated_files: 5
skills_used: []
---

# T01: Generate 8-bit store images and wire images block into app.json

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

## Inputs

- ``.homeycompose/app.json``
- ``assets/icon.svg``
- ``package.json``

## Expected Output

- ``scripts/generate-images.mjs``
- ``assets/images/small.png``
- ``assets/images/large.png``
- ``assets/images/xlarge.png``
- ``.homeycompose/app.json``

## Verification

node -e "const fs=require('fs');for(const f of ['assets/images/small.png','assets/images/large.png','assets/images/xlarge.png']){const b=fs.readFileSync(f);if(b[24]!==8){console.error(f,'bit depth',b[24]);process.exit(1)}if(b[25]!==2&&b[25]!==6){console.error(f,'color type',b[25]);process.exit(1)}}" && npx homey app validate --level publish && npm test

## Observability Impact

Generator script writes per-image success/failure to stdout/stderr. No runtime production logging changes; existing app.ts forcePhase / saveConfig structured logs from S07 already satisfy the Dry Run readability criterion.
