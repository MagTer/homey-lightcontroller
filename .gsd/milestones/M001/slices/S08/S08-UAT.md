# S08: Store Readiness & Polish — UAT

**Milestone:** M001
**Written:** 2026-04-26T10:30:41.885Z

# S08: Store Readiness & Polish — UAT

**Milestone:** M001
**Written:** 2026-04-26

## UAT Type

- UAT mode: artifact-driven
- Why this mode is sufficient: The slice deliverables are static assets and a validation script; successful execution of the validator proves the assembly is correct.

## Preconditions

- Node.js environment with dependencies installed.
- Homey CLI available.

## Smoke Test

- Run `npm run prepublish` and confirm it prints `prepublish: OK`.

## Test Cases

### 1. Store Image Compliance

1. Run the following command: `node -e "const fs=require('fs'); for(const f of ['assets/images/small.png','assets/images/large.png','assets/images/xlarge.png']){ const b=fs.readFileSync(f); if(b[24]!==8) throw new Error(f+' bit depth '+b[24]); if(b[25]!==2 && b[25]!==6) throw new Error(f+' color type '+b[25]); }"`
2. **Expected:** Command completes with exit code 0, confirming 8-bit RGB/RGBA PNGs.

### 2. Negative Gate Check

1. Move a required image: `mv assets/images/small.png assets/images/small.png.bak`
2. Run `npm run prepublish`
3. **Expected:** Script exits non-zero (exit 1) and names the missing file.
4. Restore image: `mv assets/images/small.png.bak assets/images/small.png`

### 3. Full App Validation

1. Run `npx homey app validate --level publish`
2. **Expected:** Output includes `App validated successfully against level 'publish'`, confirming all metadata, icons, and image declarations meet store requirements.

## Edge Cases

### Missing Brand Color

1. Temporarily remove `"brandColor"` from `.homeycompose/app.json`.
2. Run `npx homey app validate --level publish`.
3. **Expected:** Validator fails, identifying the missing required field.

## Failure Signals

- `prepublish: <path> bit depth 16, expected 8`
- `The property 'brandColor' is required`
- Exit code 1 from `npm run prepublish`

## Not Proven By This UAT

- Does not prove the app will be *manually* approved by Athom reviewers (branding quality is subjective).
- Does not prove runtime behavior on a physical Homey (covered by earlier mocks and unit tests).

## Notes for Tester

- Placeholder green circle icons are used for images; these are technically valid but may be replaced with high-fidelity branding later without changing the automation code.
