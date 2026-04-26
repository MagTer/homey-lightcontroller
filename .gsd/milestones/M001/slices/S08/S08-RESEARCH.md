# S08: Store Readiness & Polish — Research

**Date:** 2026-04-26
**Slice goal:** Pre-publish script passes and Dry Run logs look correct.

## Summary

S08 is the final polish slice before store submission. The single blocking gap is that `npx homey app validate --level publish` fails with `The property 'images' is required`. All other slices are complete, 98 Vitest tests pass, and `--level debug` validates cleanly. The work is well-scoped and mechanical: create placeholder/real app store images, wire `images` into `.homeycompose/app.json`, and write a pre-publish verification script that confirms 8-bit PNG compliance and passes the publish validator.

The "Dry Run logs" criterion maps to verifying that `forcePhase` and config-save operations emit structured logs (they already do — `this.log('forcePhase', {...})` and `this.log('config saved', {...})` exist in `app.ts`). No significant new logic is needed; this is infrastructure and asset work.

## Recommendation

Three sequential tasks:

1. **Create app store images** — add `assets/images/small.png` (135×135), `assets/images/large.png` (500×500), and `assets/images/xlarge.png` (1000×1000) as 8-bit RGBA PNGs. Use `sharp` (already in `node_modules`) to generate solid-color placeholder PNGs from the existing `icon.svg`, or produce minimal valid 8-bit PNGs programmatically. These satisfy the validator; actual artwork can be polished post-milestone.

2. **Update `app.json` composition** — add the `images` block to `.homeycompose/app.json` so it is picked up by `npx homey app build`/`validate`. The generated `app.json` is gitignored, so the source of truth is `.homeycompose/app.json`.

3. **Write `scripts/prepublish.mjs`** — a Node ESM script that:
   - Runs `npx homey app validate --level publish` and asserts exit 0.
   - For each image path declared in `app.json`, reads the PNG header and asserts bit depth = 8 and color type ∈ {2=RGB, 6=RGBA}.
   - Exits non-zero with a clear error message on any failure.
   - Add a `"prepublish": "node scripts/prepublish.mjs"` entry to `package.json`.

## Implementation Landscape

### Key Files

- `.homeycompose/app.json` — add `"images": { "small": "/assets/images/small.png", "large": "/assets/images/large.png", "xlarge": "/assets/images/xlarge.png" }`. This is the compose source; `app.json` at root is generated and gitignored.
- `assets/images/` — directory does not exist yet. Must create and populate with `small.png`, `large.png`, `xlarge.png`.
- `app.ts` — already has structured log calls (`this.log`, `this.error`) in `forcePhase` and `saveConfig`. No changes needed for "Dry Run logs look correct."
- `package.json` — add `"prepublish"` script entry pointing to `scripts/prepublish.mjs`.
- `scripts/prepublish.mjs` — new file; PNG header check + homey validate.

### Build Order

1. Create `assets/images/` with 8-bit RGBA PNGs (unblocks the validator).
2. Add `images` block to `.homeycompose/app.json` (unblocks `--level publish` pass).
3. Confirm `npx homey app validate --level publish` now exits 0.
4. Write `scripts/prepublish.mjs` that encodes both checks.
5. Run `npm run prepublish` to confirm the script passes end-to-end.

### Verification Approach

```bash
# Confirm publish level passes after image assets and app.json update:
npx homey app validate --level publish

# Run pre-publish script (after writing it):
node scripts/prepublish.mjs

# Confirm 98 tests still pass (no regressions):
npm test
```

Observable terminal output: `✓ App validated successfully against level 'publish'` and script exits 0.

## Constraints

- `assets/images/small.png` must be 8-bit per channel (bit depth byte at offset 24 in PNG header = 8). 16-bit PNGs are rejected by the Homey store review process even if the validator doesn't block them.
- PNG color type must be 2 (RGB) or 6 (RGBA) — not grayscale or indexed.
- `app.json` at the project root is generated (gitignored). Only `.homeycompose/app.json` should be edited.
- `sharp` is already installed in `node_modules` (available for programmatic PNG generation); no new dependencies are needed.
- Required image sizes per schema (`homey-lib/assets/app/schema.json`): `small` and `large` are required; `xlarge` is optional but conventional. Typical dimensions from `homey/lib/App.js` scaffold: small=135×135, large=500×500, xlarge=1000×1000.

## Common Pitfalls

- **Editing `app.json` directly** — it is gitignored and regenerated; always edit `.homeycompose/app.json`.
- **16-bit PNGs from design tools** — macOS Preview and some SVG exporters default to 16-bit. The script must assert bit depth explicitly; the Homey `--level publish` validator does NOT check bit depth.
- **`sharp` imports in ESM** — `sharp` uses CJS interop; import it as `import sharp from 'sharp'` in `.mjs` files (works with Node ESM default interop).
