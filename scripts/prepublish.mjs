/**
 * Pre-publish validation gate for Homey App Store submission.
 *
 * Validates:
 *   1. All declared store images are 8-bit, non-indexed PNGs (bit depth 8, color type 2 or 6).
 *      Homey's own validator does NOT check bit depth, so 16-bit PNGs can slip through and be
 *      rejected at human review time. This check catches that class of failure.
 *   2. `homey app validate --level publish` exits 0.
 *
 * Negative-test reminder (for future maintainers):
 *   Temporarily rename one image (e.g. `mv assets/images/small.png assets/images/small.png.bak`)
 *   and re-run `npm run prepublish` — it must exit non-zero with a message naming the missing file.
 *   Then restore: `mv assets/images/small.png.bak assets/images/small.png`
 */

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const COMPOSE_APP_JSON = join(ROOT, '.homeycompose', 'app.json');

// PNG signature (first 8 bytes)
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
// Bit depth byte offset (byte 24 = IHDR[4])
const PNG_BYTE_DEPTH = 24;
// Color type byte offset (byte 25 = IHDR[5])
const PNG_BYTE_COLOR_TYPE = 25;
// Allowed color types: 2 = RGB, 6 = RGBA
const ALLOWED_COLOR_TYPES = new Set([2, 6]);

/**
 * Validate a single PNG file.
 * @param {string} absPath — absolute path to the PNG file
 * @throws never; exits process on failure
 */
function validatePng(absPath) {
  let data;
  try {
    data = readFileSync(absPath);
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.error(`prepublish: image not found: ${absPath}`);
      process.exit(1);
    }
    throw err;
  }

  if (!data.subarray(0, 8).equals(PNG_SIGNATURE)) {
    console.error(`prepublish: ${absPath}: not a valid PNG file`);
    process.exit(1);
  }

  const depth = data[PNG_BYTE_DEPTH];
  const colorType = data[PNG_BYTE_COLOR_TYPE];

  if (depth !== 8) {
    console.error(`prepublish: ${absPath}: bit depth ${depth}, expected 8`);
    process.exit(1);
  }

  if (!ALLOWED_COLOR_TYPES.has(colorType)) {
    console.error(
      `prepublish: ${absPath}: color type ${colorType} (${colorTypeLabel(colorType)}), expected 2 (RGB) or 6 (RGBA)`
    );
    process.exit(1);
  }
}

function colorTypeLabel(n) {
  return { 0: 'grayscale', 1: 'indexed', 2: 'RGB', 3: 'indexed+alpha', 4: 'grayscale+alpha', 6: 'RGBA' }[n] ?? `type-${n}`;
}

// ── 1. Discover declared images from .homeycompose/app.json ──────────────────
let composeConfig;
try {
  composeConfig = JSON.parse(readFileSync(COMPOSE_APP_JSON, 'utf8'));
} catch (err) {
  if (err instanceof SyntaxError) {
    console.error(`prepublish: failed to parse ${COMPOSE_APP_JSON}: ${err.message}`);
    process.exit(1);
  }
  throw err;
}

const images = composeConfig.images;
if (!images || typeof images !== 'object') {
  console.error('prepublish: .homeycompose/app.json is missing an "images" object');
  process.exit(1);
}

// .homeycompose/app.json stores paths as "/assets/images/..." — strip the leading "/"
const imageEntries = Object.entries(images).map(([key, value]) => ({
  name: key,
  // value is a string like "/assets/images/small.png"
  path: join(ROOT, value.startsWith('/') ? value.slice(1) : value),
}));

// ── 2. Byte-level PNG validation ────────────────────────────────────────────────
for (const { name, path } of imageEntries) {
  console.error(`[prepublish] checking ${name}: ${path}`);
  validatePng(path);
}

// ── 3. Run Homey publish-level validator ──────────────────────────────────────
console.error('[prepublish] all image checks passed — running Homey validator...');
const result = spawnSync('npx', ['homey', 'app', 'validate', '--level', 'publish'], {
  cwd: ROOT,
  stdio: 'inherit',
});

if (result.error) {
  console.error(`prepublish: failed to spawn Homey CLI: ${result.error.message}`);
  process.exit(1);
}

if (result.status !== 0) {
  process.exit(result.status);
}

// ── 4. Full success ────────────────────────────────────────────────────────────
console.log(`prepublish: OK (${imageEntries.length} images verified, validator passed)`);
process.exit(0);
