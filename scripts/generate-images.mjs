import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const imagesDir = join(rootDir, 'assets', 'images');

const SIZES = [
  { name: 'small',  width: 250,  height: 175 },
  { name: 'large',  width: 500,  height: 350 },
  { name: 'xlarge', width: 1000, height: 700 },
];

// Homey green brand colour
const HOMEY_GREEN = { r: 30, g: 144, b: 255, alpha: 1 };

async function generateImage(size, name) {
  const outPath = join(imagesDir, `${name}.png`);

  // Try SVG rasterisation first
  const svgPath = join(rootDir, 'assets', 'icon.svg');
  try {
    const svgBuffer = readFileSync(svgPath);
    await sharp(svgBuffer)
      .resize(size.width, size.height)
      .png({ palette: false, compressionLevel: 9 })
      .toFile(outPath);
    console.log(`Generated ${outPath} from SVG`);
    return;
  } catch (err) {
    console.error(`[generate-images] SVG rasterization failed for ${name}: ${err.message}`, err);
    console.log(`Falling back to solid-color canvas for ${name}`);
  }

  // Fallback: solid colour canvas
  try {
    await sharp({
      create: {
        width: size.width,
        height: size.height,
        channels: 4,
        background: HOMEY_GREEN,
      },
    })
      .png({ palette: false, compressionLevel: 9 })
      .toFile(outPath);
    console.log(`Generated ${outPath} via fallback canvas`);
  } catch (fallbackErr) {
    console.error(`[generate-images] Fallback canvas also failed for ${name}: ${fallbackErr.message}`, fallbackErr);
    process.exit(1);
  }
}

for (const size of SIZES) {
  await generateImage(size, size.name);
}

console.log('All images generated successfully.');
