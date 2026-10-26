const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const boxDir = path.join(__dirname, '../../THE BOX WORLD');
const outDir = path.join(__dirname, '../assets/effects');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

// CRC32 + PNG encoder
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  crcTable[n] = c >>> 0;
}
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}
function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0;
    rgba.copy(raw, y * stride + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = zlib.deflateSync(raw);
  return Buffer.concat([sig, makeChunk('IHDR', ihdr), makeChunk('IDAT', idat), makeChunk('IEND', Buffer.alloc(0))]);
}

function parseSpr(buf) {
  if (!buf || buf.length < 8 || buf.toString('ascii', 0, 2) !== 'SP') return null;
  const verMinor = buf[2];
  const verMajor = buf[3];
  const version = verMajor * 10 + verMinor;
  const palCount = buf.readUInt16LE(4);
  let rgbaCount = 0;
  let pos = 6;
  if (version >= 20) {
    rgbaCount = buf.readUInt16LE(6);
    pos = 8;
  }
  const palOffset = buf.length - 1024;
  const palette = buf.slice(palOffset, buf.length);
  const frames = [];
  for (let i = 0; i < palCount; i++) {
    const w = buf.readUInt16LE(pos);
    const h = buf.readUInt16LE(pos + 2);
    pos += 4;
    const pixels = new Uint8Array(w * h);
    if (version >= 21) {
      const encodedSize = buf.readUInt16LE(pos);
      pos += 2;
      const endPos = pos + encodedSize;
      let dst = 0;
      while (pos < endPos && dst < w * h) {
        const c = buf[pos++];
        if (c === 0) {
          const run = buf[pos++];
          if (run === 0) pixels[dst++] = 0;
          else dst += run;
        } else {
          pixels[dst++] = c;
        }
      }
      pos = endPos;
    } else {
      for (let p = 0; p < w * h; p++) pixels[p] = buf[pos++];
    }
    const rgba = Buffer.alloc(w * h * 4);
    for (let p = 0; p < w * h; p++) {
      const idx = pixels[p];
      if (idx === 0) continue;
      const r = palette[idx * 4];
      const g = palette[idx * 4 + 1];
      const b = palette[idx * 4 + 2];
      if (r >= 248 && g <= 8 && b >= 248) continue;
      rgba[p * 4] = r;
      rgba[p * 4 + 1] = g;
      rgba[p * 4 + 2] = b;
      rgba[p * 4 + 3] = 255;
    }
    frames.push({ w, h, rgba });
  }
  for (let i = 0; i < rgbaCount; i++) {
    const w = buf.readUInt16LE(pos);
    const h = buf.readUInt16LE(pos + 2);
    pos += 4;
    const rgba = Buffer.alloc(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const srcOff = pos + ((h - 1 - y) * w + x) * 4;
        const dstOff = (y * w + x) * 4;
        const a = buf[srcOff];
        const b = buf[srcOff + 1];
        const g = buf[srcOff + 2];
        const r = buf[srcOff + 3];
        if (r >= 248 && g <= 8 && b >= 248) continue;
        rgba[dstOff] = r;
        rgba[dstOff + 1] = g;
        rgba[dstOff + 2] = b;
        rgba[dstOff + 3] = a;
      }
    }
    pos += w * h * 4;
    frames.push({ w, h, rgba });
  }
  return frames;
}

// Open _sprites.grf
const grfPath = path.join(boxDir, '_sprites.grf');
const fd = fs.openSync(grfPath, 'r');
const h = Buffer.alloc(46);
fs.readSync(fd, h, 0, 46, 0);
const off = Number(BigInt(h.readUInt32LE(30)) + 46n);
const th = Buffer.alloc(8);
fs.readSync(fd, th, 0, 8, off);
const compBuf = Buffer.alloc(th.readUInt32LE(0));
fs.readSync(fd, compBuf, 0, compBuf.length, off + 8);
const tbl = zlib.inflateSync(compBuf);
const td = new TextDecoder('euc-kr');

const sprMap = new Map();
let pos = 0;
while (pos < tbl.length) {
  let end = pos;
  while (end < tbl.length && tbl[end] !== 0) end++;
  if (end >= tbl.length) break;
  const kr = td.decode(tbl.slice(pos, end));
  const meta = tbl.slice(end + 1, end + 1 + 17);
  pos = end + 1 + 17;
  if (kr.includes('이팩트') && kr.endsWith('.spr')) {
    const baseName = kr.split('\\').pop().replace(/\.spr$/i, '');
    sprMap.set(baseName, {
      cSize: meta.readUInt32LE(0),
      cAlign: meta.readUInt32LE(4),
      uSize: meta.readUInt32LE(8),
      flags: meta[12],
      offset: meta.readUInt32LE(13) + 46
    });
  }
}

function readEntry(entry) {
  const b = Buffer.alloc(entry.cAlign);
  fs.readSync(fd, b, 0, entry.cAlign, entry.offset);
  if (entry.cSize === entry.uSize) return b.slice(0, entry.uSize);
  return zlib.inflateSync(b.slice(0, entry.cSize));
}

const EFFECTS_TO_EXTRACT = [
  ['fireball', 'ef_fireball'],
  ['firewall', 'ef_firewall'],
  ['waterball', 'ef_waterball'],
  ['썬더스톰', 'ef_thunderstorm'],
  ['거스트', 'ef_stormgust'],
  ['어스퀘이크', 'ef_earthquake'],
  ['축복', 'ef_blessing'],
  ['천사', 'ef_angelus'],
  ['천사날개', 'ef_angelwings'],
  ['헌드레드스피어', 'ef_hundredspear'],
  ['창', 'ef_spear'],
  ['안개베기', 'ef_slash1'],
  ['그림자베기', 'ef_slash2'],
  ['일섬', 'ef_flashslash'],
  ['매', 'ef_falcon'],
  ['windhawk_wolf', 'ef_warg'],
  ['동전', 'ef_coin'],
  ['dragon_breath_water', 'ef_dragonbreath'],
  ['darkbreath', 'ef_darkbreath'],
  ['ab_offertorium', 'ef_holy'],
  ['성수뜨기', 'ef_sanctuary'],
  ['독', 'ef_poison'],
  ['poisonhit', 'ef_poisonhit'],
  ['mvp', 'ef_mvp'],
  ['status-stun', 'ef_stun'],
  ['fast', 'ef_quicken'],
  ['shield', 'ef_shield'],
  ['sight', 'ef_sight']
];

let extractedCount = 0;
for (const [krName, outPrefix] of EFFECTS_TO_EXTRACT) {
  const entry = sprMap.get(krName);
  if (!entry) {
    console.log('Not found:', krName);
    continue;
  }
  const spr = parseSpr(readEntry(entry));
  if (!spr || !spr.length) continue;
  // Save up to 6 key frames (evenly spaced if more than 6)
  const maxFrames = Math.min(6, spr.length);
  for (let i = 0; i < maxFrames; i++) {
    const fIdx = Math.floor((i * spr.length) / maxFrames);
    const fr = spr[fIdx];
    if (fr.w > 1 && fr.h > 1) {
      fs.writeFileSync(path.join(outDir, `${outPrefix}_${i}.png`), encodePNG(fr.w, fr.h, fr.rgba));
      extractedCount++;
    }
  }
  console.log(`Extracted ${outPrefix}: ${maxFrames} frames (from ${spr.length} total, ${spr[0].w}x${spr[0].h})`);
}

fs.closeSync(fd);
console.log('Total effect PNG frames extracted:', extractedCount);
