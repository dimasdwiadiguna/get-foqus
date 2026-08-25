/**
 * Generates the FOQUS PWA icons.
 *
 * The mark is the wordmark's Q reduced to its essentials (BRIEF §11): a ring on `ink`, with the
 * tail extended into a short vertical line — the same quotation of the day ribbon that the
 * wordmark makes. No gradients, no extra iconography.
 *
 * Written as a generator rather than checked-in binaries produced elsewhere so the icons can be
 * regenerated from the palette, and so no image dependency is added to the project (§15).
 * Run: `node scripts/generate-icons.mjs`
 */

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const INK = [0x16, 0x23, 0x2b];
const PAPER = [0xef, 0xf1, 0xec];

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(size, pixels) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 4 + 1)] = 0; // filter type 0
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Coverage of a pixel by the mark, sampled 3×3 so the ring edge is not jagged. */
function coverage(x, y, size, inset) {
  const cx = size / 2;
  const cy = size * 0.455;
  const outer = size * (0.5 - inset);
  const stroke = size * 0.115;
  const inner = outer - stroke;

  // Tail: a short vertical bar hanging from the ring's lower right — the day ribbon quoted.
  const tailX = cx + outer * 0.52;
  // Start exactly where the bar meets the ring's inner edge, so the tail reads as growing out
  // of the letterform rather than being pasted over it.
  const tailTop = cy + Math.sqrt(Math.max(0, inner * inner - (tailX - cx) ** 2));
  const tailBottom = cy + outer * 1.32;
  const tailHalf = stroke / 2;

  let hits = 0;
  for (let sx = 0; sx < 3; sx += 1) {
    for (let sy = 0; sy < 3; sy += 1) {
      const px = x + (sx + 0.5) / 3;
      const py = y + (sy + 0.5) / 3;
      const distance = Math.hypot(px - cx, py - cy);
      const onRing = distance <= outer && distance >= inner;
      const onTail =
        Math.abs(px - tailX) <= tailHalf && py >= tailTop && py <= tailBottom;
      if (onRing || onTail) hits += 1;
    }
  }
  return hits / 9;
}

function render(size, { maskable = false } = {}) {
  // A maskable icon must keep its mark inside the safe zone, so it sits smaller on the canvas.
  const inset = maskable ? 0.27 : 0.17;
  const pixels = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const alpha = coverage(x, y, size, inset);
      const offset = (y * size + x) * 4;
      pixels[offset] = Math.round(INK[0] + (PAPER[0] - INK[0]) * alpha);
      pixels[offset + 1] = Math.round(INK[1] + (PAPER[1] - INK[1]) * alpha);
      pixels[offset + 2] = Math.round(INK[2] + (PAPER[2] - INK[2]) * alpha);
      pixels[offset + 3] = 255;
    }
  }
  return encodePng(size, pixels);
}

const outDir = resolve(dirname(fileURLToPath(import.meta.url)), '../apps/web/public/icons');
mkdirSync(outDir, { recursive: true });

const targets = [
  ['icon-192.png', 192, {}],
  ['icon-512.png', 512, {}],
  ['icon-maskable-512.png', 512, { maskable: true }],
  ['apple-touch-icon.png', 180, {}],
];

for (const [name, size, options] of targets) {
  writeFileSync(resolve(outDir, name), render(size, options));
  console.log(`wrote ${name} (${size}×${size})`);
}
