import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  const combined = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(combined), 0);
  return Buffer.concat([len, combined, crcBuf]);
}

function encodePNG(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0;
    rgba.copy(raw, y * stride + 1, y * width * 4, (y + 1) * width * 4);
  }
  const compressed = zlib.deflateSync(raw);
  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

function renderIcon(size, maskable = false) {
  const rgba = Buffer.alloc(size * size * 4);
  const pad = maskable ? 0.16 : 0.08;
  const cardLeft = size * (0.24 + pad * 0.25);
  const cardRight = size * (0.76 - pad * 0.25);
  const cardTop = size * (0.14 + pad * 0.25);
  const cardBottom = size * (0.86 - pad * 0.25);
  const border = Math.max(3, Math.round(size * 0.032));

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const t = (x + y) / (size * 2);
      // Deep obsidian gradient background
      let r = Math.round(11 + t * 14);
      let g = Math.round(13 + t * 18);
      let b = Math.round(20 + t * 30);

      const inOuterCard = x >= cardLeft && x <= cardRight && y >= cardTop && y <= cardBottom;
      const inInnerCard =
        x >= cardLeft + border &&
        x <= cardRight - border &&
        y >= cardTop + border &&
        y <= cardBottom - border;

      if (inOuterCard && !inInnerCard) {
        // Prism cyan -> magenta -> gold gradient border
        const p = (x - cardLeft) / Math.max(1, cardRight - cardLeft);
        if (p < 0.5) {
          const k = p * 2;
          r = Math.round(56 + (232 - 56) * k);
          g = Math.round(189 + (121 - 189) * k);
          b = Math.round(248 + (249 - 248) * k);
        } else {
          const k = (p - 0.5) * 2;
          r = Math.round(232 + (245 - 232) * k);
          g = Math.round(121 + (158 - 121) * k);
          b = Math.round(249 + (11 - 249) * k);
        }
      } else if (inInnerCard) {
        r = 19;
        g = 24;
        b = 40;
        // Center diamond emblem
        const cx = size / 2;
        const cy = size * 0.45;
        const dx = Math.abs(x - cx);
        const dy = Math.abs(y - cy);
        if (dx + dy < size * 0.12) {
          r = 56;
          g = 189;
          b = 248;
        }
        // Bottom foil bar
        if (y > size * 0.67 && y < size * 0.72 && x > cardLeft + size * 0.08 && x < cardRight - size * 0.08) {
          r = 245;
          g = 158;
          b = 11;
        }
      }

      rgba[idx] = r;
      rgba[idx + 1] = g;
      rgba[idx + 2] = b;
      rgba[idx + 3] = 255;
    }
  }
  return encodePNG(size, size, rgba);
}

const outDir = path.resolve(process.cwd(), 'public');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'pwa-192x192.png'), renderIcon(192, false));
fs.writeFileSync(path.join(outDir, 'pwa-512x512.png'), renderIcon(512, false));
fs.writeFileSync(path.join(outDir, 'pwa-maskable-512x512.png'), renderIcon(512, true));
fs.writeFileSync(path.join(outDir, 'apple-touch-icon.png'), renderIcon(180, false));
console.log('Generated PWA PNG icons in public/');
