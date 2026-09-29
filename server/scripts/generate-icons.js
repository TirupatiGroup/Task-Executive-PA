// Generates PWA icons referenced by manifest.webmanifest (Phase 7 PWA polish).
// Pure Node (zlib only) - no image libraries required. Run: node scripts/generate-icons.js
//
// Design: rounded-square brand tile, primary-900 background (#1e2d8a),
// accent-400 (#fb923c) "PA" monogram drawn on a coarse pixel grid, then upscaled
// with simple box filtering. Safe zone respected for maskable purpose (icon
// content sits within the inner 80% diameter circle).

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const BG = [30, 45, 138];      // #1e2d8a (tailwind primary-900)
const FG = [251, 146, 60];     // #fb923c (tailwind accent-400)
const CORNER = 0.22;           // rounded corner radius as fraction of size

// 16x16 coarse grid: rows of the "PA" monogram (1 = accent pixel).
const GLYPH = [
  '................',
  '................',
  '..1111....1111..',
  '.111111..111111.',
  '.111111..111111.',
  '.11..11..11..11.',
  '.11..11..11..11.',
  '.11..11..111111.',
  '.11..11..111111.',
  '.111111..11..11.',
  '.111111..11..11.',
  '.11..11..11..11.',
  '.11..11..11..11.',
  '................',
  '................',
  '................',
];

function insideRoundedSquare(x, y, size) {
  const r = size * CORNER;
  const cx = Math.min(Math.max(x, r), size - r);
  const cy = Math.min(Math.max(y, r), size - r);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r || (x >= r && x <= size - r) || (y >= r && y <= size - r);
}

function renderRGBA(size) {
  const rgba = Buffer.alloc(size * size * 4, 0);
  // Glyph occupies the central 56% of the canvas (maskable-safe).
  const glyphSize = Math.floor(size * 0.56);
  const glyphStart = Math.floor((size - glyphSize) / 2);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const idx = (y * size + x) * 4;
      if (!insideRoundedSquare(x, y, size)) continue; // transparent outside

      const gx = Math.floor(((x - glyphStart) / glyphSize) * 16);
      const gy = Math.floor(((y - glyphStart) / glyphSize) * 16);
      const on = gx >= 0 && gx < 16 && gy >= 0 && gy < 16 && GLYPH[gy][gx] === '1';
      const color = on ? FG : BG;

      rgba[idx] = color[0];
      rgba[idx + 1] = color[1];
      rgba[idx + 2] = color[2];
      rgba[idx + 3] = 255;
    }
  }
  return rgba;
}

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i += 1) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePNG(rgba, size) {
  // Filter type 0 (None) per scanline.
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // colour type RGBA

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const outDir = path.resolve(__dirname, '../../client/public/icons');
fs.mkdirSync(outDir, { recursive: true });

for (const size of [192, 512]) {
  const png = encodePNG(renderRGBA(size), size);
  const file = path.join(outDir, `icon-${size}.png`);
  fs.writeFileSync(file, png);
  // eslint-disable-next-line no-console
  console.log(`Wrote ${file} (${png.length} bytes)`);
}
