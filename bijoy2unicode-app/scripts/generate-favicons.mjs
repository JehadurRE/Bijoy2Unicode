// Generate favicon.ico and PWA-style PNGs from public/logo-mark.svg.
//
// Run: node scripts/generate-favicons.mjs

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const pub = path.join(root, "public");
const src = path.join(pub, "logo-mark.svg");
const appDir = path.join(root, "src", "app");

const svg = await fs.readFile(src);

// PNG variants for PWA / Apple / Android.
const pngTargets = [
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  { name: "apple-icon.png", size: 180 },
];
for (const t of pngTargets) {
  const out = path.join(pub, t.name);
  await sharp(svg, { density: 384 })
    .resize(t.size, t.size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log(`wrote ${path.relative(root, out)} (${t.size}x${t.size})`);
}

// Multi-size favicon.ico — sharp itself doesn't write .ico directly, so we
// build each size as PNG and assemble the ICO container manually.
async function svgToPng(size) {
  return await sharp(svg, { density: Math.max(96, size * 4) })
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

const icoSizes = [16, 32, 48, 64];
const pngBuffers = await Promise.all(icoSizes.map(svgToPng));

// Build a minimal ICO file (PNG-encoded entries — supported by IE11+ and
// every modern browser).
function buildIco(sizes, buffers) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type 1 = ICO
  header.writeUInt16LE(sizes.length, 4); // number of images

  const dirEntries = [];
  let offset = 6 + sizes.length * 16;
  for (let i = 0; i < sizes.length; i++) {
    const sz = sizes[i];
    const buf = buffers[i];
    const entry = Buffer.alloc(16);
    entry.writeUInt8(sz === 256 ? 0 : sz, 0); // width
    entry.writeUInt8(sz === 256 ? 0 : sz, 1); // height
    entry.writeUInt8(0, 2); // color palette
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(buf.length, 8); // bytes in image
    entry.writeUInt32LE(offset, 12); // offset into file
    offset += buf.length;
    dirEntries.push(entry);
  }
  return Buffer.concat([header, ...dirEntries, ...buffers]);
}

const ico = buildIco(icoSizes, pngBuffers);
const icoPath = path.join(appDir, "favicon.ico");
await fs.writeFile(icoPath, ico);
console.log(`wrote ${path.relative(root, icoPath)} (${icoSizes.join("/")} sizes, ${ico.length} bytes)`);

// Also drop a copy in /public for any framework that looks there.
const pubIco = path.join(pub, "favicon.ico");
await fs.writeFile(pubIco, ico);
console.log(`wrote ${path.relative(root, pubIco)}`);

console.log("\nAll favicons generated.");
