// AI-generated (Claude)
// Draws the app icon set from one description of the mark, so the icon, the
// splash glyph and the favicon cannot drift apart (task 12).
//
// The mark is a dive profile: a descent, a bottom, a safety stop and a
// surfacing, which is the one picture this app is about and reads at 40 px. The
// renderer is deliberately dependency-free - a PNG is a deflate stream in a
// handful of chunks, and everything drawn here is a gradient, a filled polygon
// and a stroked polyline. Anti-aliasing is a 2x supersample.
//
// Run: node scripts/make-icons.mjs

import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SS = 2; // supersample factor

// The profile, in a 0..1 box: x is time, y is depth (0 at the surface).
const PROFILE = [
  [0.06, 0.04],
  [0.3, 0.78],
  [0.46, 0.82],
  [0.56, 0.6],
  [0.68, 0.64],
  [0.78, 0.26],
  [0.87, 0.24],
  [0.94, 0.04],
];

const OCEAN_TOP = [0x14, 0x6f, 0xc4];
const OCEAN_BOTTOM = [0x06, 0x2c, 0x53];

function makeCanvas(size) {
  return { size, data: new Uint8ClampedArray(size * size * 4) };
}

function setPixel(canvas, x, y, [r, g, b], alpha) {
  if (alpha <= 0) {
    return;
  }
  const i = (y * canvas.size + x) * 4;
  const a = Math.min(1, alpha);
  canvas.data[i] = canvas.data[i] * (1 - a) + r * a;
  canvas.data[i + 1] = canvas.data[i + 1] * (1 - a) + g * a;
  canvas.data[i + 2] = canvas.data[i + 2] * (1 - a) + b * a;
  canvas.data[i + 3] = Math.max(canvas.data[i + 3], 255 * a);
}

function fillGradient(canvas, top, bottom) {
  for (let y = 0; y < canvas.size; y += 1) {
    const t = y / (canvas.size - 1);
    const color = top.map((channel, i) => channel + (bottom[i] - channel) * t);
    for (let x = 0; x < canvas.size; x += 1) {
      setPixel(canvas, x, y, color, 1);
    }
  }
}

/** Squared distance from a point to a segment, in pixels. */
function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

/** Even-odd point-in-polygon, which is enough for a curve closed to a baseline. */
function insidePolygon(px, py, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function drawMark(canvas, { inset = 0.16, stroke = 0.055, fillAlpha = 0.22 } = {}) {
  const size = canvas.size;
  const box = size * (1 - 2 * inset);
  const points = PROFILE.map(([x, y]) => [size * inset + x * box, size * inset + y * box]);
  // The water the dive hung in is *above* the curve: the surface is the top of
  // the box and depth grows downwards, so the filled region is closed to the
  // top edge, not to the bottom one.
  const surface = size * inset;
  const area = [...points, [points[points.length - 1][0], surface], [points[0][0], surface]];
  const halfWidth = (stroke * size) / 2;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const px = x + 0.5;
      const py = y + 0.5;

      if (insidePolygon(px, py, area)) {
        setPixel(canvas, x, y, [255, 255, 255], fillAlpha);
      }

      let nearest = Infinity;
      for (let i = 1; i < points.length; i += 1) {
        nearest = Math.min(
          nearest,
          distanceToSegment(px, py, points[i - 1][0], points[i - 1][1], points[i][0], points[i][1])
        );
        if (nearest <= halfWidth) {
          break;
        }
      }
      if (nearest <= halfWidth) {
        setPixel(canvas, x, y, [255, 255, 255], 1);
      }
    }
  }
}

/** Box-filters the supersampled canvas down to `size`. */
function downsample(canvas, size) {
  const out = makeCanvas(size);
  const factor = canvas.size / size;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < factor; sy += 1) {
        for (let sx = 0; sx < factor; sx += 1) {
          const i = ((y * factor + sy) * canvas.size + (x * factor + sx)) * 4;
          r += canvas.data[i];
          g += canvas.data[i + 1];
          b += canvas.data[i + 2];
          a += canvas.data[i + 3];
        }
      }
      const count = factor * factor;
      const i = (y * size + x) * 4;
      out.data[i] = r / count;
      out.data[i + 1] = g / count;
      out.data[i + 2] = b / count;
      out.data[i + 3] = a / count;
    }
  }
  return out;
}

// --- PNG encoding ----------------------------------------------------------

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return c >>> 0;
});

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) {
    c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(canvas) {
  const { size, data } = canvas;
  // One filter byte (0, "none") per scanline, then the RGBA pixels.
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size * 4; x += 1) {
      raw[y * (size * 4 + 1) + 1 + x] = data[y * size * 4 + x];
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // colour type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- The images ------------------------------------------------------------

function write(relative, canvas) {
  const path = join(ROOT, relative);
  writeFileSync(path, encodePng(canvas));
  console.log(`wrote ${relative} (${canvas.size}x${canvas.size})`);
}

function appIcon(size) {
  const canvas = makeCanvas(size * SS);
  fillGradient(canvas, OCEAN_TOP, OCEAN_BOTTOM);
  drawMark(canvas);
  return downsample(canvas, size);
}

/** The mark alone on transparency, for the splash and the Android layers. */
function glyph(size, options) {
  const canvas = makeCanvas(size * SS);
  drawMark(canvas, options);
  return downsample(canvas, size);
}

write('assets/images/icon.png', appIcon(1024));
write('assets/images/favicon.png', appIcon(48));
write('assets/images/splash-icon.png', glyph(512, { inset: 0.06 }));
// The Android layers keep the safe area an adaptive icon needs (task 13).
write('assets/images/android-icon-foreground.png', glyph(512, { inset: 0.28 }));
write('assets/images/android-icon-monochrome.png', glyph(432, { inset: 0.28, fillAlpha: 0.35 }));
