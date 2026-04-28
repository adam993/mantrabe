// Renders public/icon.svg -> assets/icon.png (512x512).
//
// We don't take an external PNG dependency — instead, we draw the same
// design as icon.svg directly to a PNG using a minimal hand-rolled
// rasterizer. This keeps the build self-contained and reproducible.
//
// The "art" is intentionally simple: a rounded-rect background with a
// soft gradient, plus a stylized bell silhouette. It's a fallback icon —
// users are encouraged to replace assets/icon.png with their own artwork
// before publishing.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SIZE = 512;

function lerp(a, b, t) { return a + (b - a) * t; }

function bgGradient(x, y) {
  // Diagonal gradient from #1a1f2e (top-left) to #242b3d (bottom-right).
  const t = (x + y) / (2 * SIZE);
  return [
    Math.round(lerp(0x1a, 0x24, t)),
    Math.round(lerp(0x1f, 0x2b, t)),
    Math.round(lerp(0x2e, 0x3d, t)),
  ];
}

function bellGradient(t) {
  // From #8b9dff to #a4c8a4.
  return [
    Math.round(lerp(0x8b, 0xa4, t)),
    Math.round(lerp(0x9d, 0xc8, t)),
    Math.round(lerp(0xff, 0xa4, t)),
  ];
}

function inRoundedRect(x, y, w, h, r, px, py) {
  if (px < x || px > x + w || py < y || py > y + h) return false;
  const cx = Math.max(x + r, Math.min(px, x + w - r));
  const cy = Math.max(y + r, Math.min(py, y + h - r));
  const dx = px - cx, dy = py - cy;
  return dx * dx + dy * dy <= r * r;
}

// Bell shape — approximated by combining a circle (top) and a tapering
// trapezoid (skirt), in a 512x512 canvas centered on (256, 256).
function inBell(px, py) {
  const cx = 256;
  const topCy = 230;
  const topR = 130;

  // Bell crown (upper round dome).
  if (py <= topCy) {
    const dx = px - cx;
    const dy = py - topCy;
    if (dx * dx + dy * dy <= topR * topR && py >= topCy - topR + 30) return true;
  }

  // Bell skirt (widening trapezoid from the dome down to the lip).
  if (py > topCy && py <= 380) {
    const t = (py - topCy) / (380 - topCy);
    const halfWidth = lerp(topR - 5, topR + 30, t);
    if (Math.abs(px - cx) <= halfWidth) return true;
  }

  // Lip flange.
  if (py > 380 && py <= 400) {
    const halfWidth = 175;
    if (Math.abs(px - cx) <= halfWidth) return true;
  }

  // Clapper ball.
  const ballR = 18;
  const dxb = px - cx;
  const dyb = py - 422;
  if (dxb * dxb + dyb * dyb <= ballR * ballR) return true;

  return false;
}

function buildPixels() {
  const pixels = Buffer.alloc(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4;
      let r, g, b, a = 255;

      if (!inRoundedRect(0, 0, SIZE, SIZE, 96, x, y)) {
        // Outside rounded square -> transparent.
        pixels[i] = 0; pixels[i + 1] = 0; pixels[i + 2] = 0; pixels[i + 3] = 0;
        continue;
      }

      [r, g, b] = bgGradient(x, y);

      if (inBell(x, y)) {
        const t = (y - 100) / 350;
        const [br, bg, bb] = bellGradient(Math.max(0, Math.min(1, t)));
        r = br; g = bg; b = bb;
      }

      pixels[i] = r;
      pixels[i + 1] = g;
      pixels[i + 2] = b;
      pixels[i + 3] = a;
    }
  }
  return pixels;
}

// --- Minimal PNG encoder ----------------------------------------------------

function crc32(buf) {
  let c, table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = (table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)) >>> 0;
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  const crc = crc32(Buffer.concat([typeBuf, data]));
  crcBuf.writeUInt32BE(crc, 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(pixels, width, height) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8);    // bit depth
  ihdr.writeUInt8(6, 9);    // color type RGBA
  ihdr.writeUInt8(0, 10);   // compression
  ihdr.writeUInt8(0, 11);   // filter
  ihdr.writeUInt8(0, 12);   // interlace

  // Build raw IDAT data with filter byte 0 per scanline.
  const rowSize = width * 4;
  const raw = Buffer.alloc((rowSize + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (rowSize + 1)] = 0;
    pixels.copy(raw, y * (rowSize + 1) + 1, y * rowSize, y * rowSize + rowSize);
  }
  const idat = zlib.deflateSync(raw);

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const pixels = buildPixels();
const png = encodePng(pixels, SIZE, SIZE);
const out = path.join(__dirname, '..', 'assets', 'icon.png');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, png);
console.log(`Wrote ${out} (${png.length.toLocaleString()} bytes)`);
