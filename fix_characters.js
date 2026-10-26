const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function encodePNG(width, height, rgba) {
  const crcTable = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = ((c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1));
    crcTable[n] = c;
  }
  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  function makeChunk(type, data) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  const scanlines = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const rowOffset = y * (1 + width * 4);
    scanlines[rowOffset] = 0;
    rgba.copy(scanlines, rowOffset + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    sig,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', zlib.deflateSync(scanlines)),
    makeChunk('IEND', Buffer.alloc(0))
  ]);
}

function decodeSPR(sprBuffer) {
  const indexedCount = sprBuffer.readUInt16LE(4);
  const palette = sprBuffer.subarray(sprBuffer.length - 1024);
  const frames = [];
  let p = 8;
  for (let f = 0; f < indexedCount; f++) {
    const w = sprBuffer.readUInt16LE(p);
    const h = sprBuffer.readUInt16LE(p + 2);
    p += 4;
    if (w === 0 || h === 0) { frames.push(null); continue; }
    const rawPixels = Buffer.alloc(w * h);
    const encLen = sprBuffer.readUInt16LE(p);
    p += 2;
    let px = 0;
    const end = p + encLen;
    while (p < end && px < rawPixels.length) {
      const b = sprBuffer[p++];
      if (b === 0) { px += sprBuffer[p++]; } else { rawPixels[px++] = b; }
    }
    const rgba = Buffer.alloc(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      const c = rawPixels[i];
      if (c > 0) {
        rgba[i * 4] = palette[c * 4];
        rgba[i * 4 + 1] = palette[c * 4 + 1];
        rgba[i * 4 + 2] = palette[c * 4 + 2];
        rgba[i * 4 + 3] = 255;
      }
    }
    frames.push({ width: w, height: h, raw: rawPixels, rgba });
  }
  return frames;
}

const fd = fs.openSync('./THE BOX WORLD/_sprites.grf', 'r');
const header = Buffer.alloc(46);
fs.readSync(fd, header, 0, 46, 0);
const tableOffset = header.readUInt32LE(30) + 46;
const tableHeader = Buffer.alloc(8);
fs.readSync(fd, tableHeader, 0, 8, tableOffset);
const compSize = tableHeader.readUInt32LE(0);
const compBuf = Buffer.alloc(compSize);
fs.readSync(fd, compBuf, 0, compSize, tableOffset + 8);
const decTable = zlib.inflateSync(compBuf);

const dec = new TextDecoder('euc-kr');
const sprMap = new Map();
let offset = 0;
while (offset < decTable.length) {
  let strEnd = offset;
  while (strEnd < decTable.length && decTable[strEnd] !== 0) strEnd++;
  const rawBytes = decTable.subarray(offset, strEnd);
  offset = strEnd + 1;
  if (offset + 17 > decTable.length) break;
  const csize = decTable.readUInt32LE(offset);
  const foffset = decTable.readUInt32LE(offset + 13);
  offset += 17;
  const fn = dec.decode(rawBytes).toLowerCase().replace(/\//g, '\\');
  sprMap.set(fn, { csize, foffset });
}

function getSprFile(target) {
  const norm = target.toLowerCase().replace(/\//g, '\\');
  const info = sprMap.get(norm);
  if (!info) return null;
  const buf = Buffer.alloc(info.csize);
  fs.readSync(fd, buf, 0, info.csize, info.foffset + 46);
  return zlib.inflateSync(buf);
}

const hairSpr = decodeSPR(getSprFile('data\\sprite\\인간족\\머리통\\남\\1_남.spr'));
const h0 = hairSpr[0]; // South facing hair

// Find chin center of hair 0
let chinY = 0, chinMinX = 999, chinMaxX = 0;
for (let y = h0.height - 1; y >= 0; y--) {
  let found = false;
  for (let x = 0; x < h0.width; x++) {
    if (h0.raw[y * h0.width + x] > 0) {
      found = true;
      chinMinX = Math.min(chinMinX, x);
      chinMaxX = Math.max(chinMaxX, x);
    }
  }
  if (found) { chinY = y; break; }
}
const chinCenterX = (chinMinX + chinMaxX) / 2;

const classBodies = [
  { key: 'novice', bodyFile: 'data\\sprite\\인간족\\몸통\\남\\초보자_남.spr' },
  { key: 'swordsman', bodyFile: 'data\\sprite\\인간족\\몸통\\남\\검사_남.spr' },
  { key: 'mage', bodyFile: 'data\\sprite\\인간족\\몸통\\남\\마법사_남.spr' },
  { key: 'archer', bodyFile: 'data\\sprite\\인간족\\몸통\\남\\궁수_남.spr' },
  { key: 'thief', bodyFile: 'data\\sprite\\인간족\\몸통\\남\\도둑_남.spr' },
  { key: 'merchant', bodyFile: 'data\\sprite\\인간족\\몸통\\남\\상인_남.spr' },
  { key: 'acolyte', bodyFile: 'data\\sprite\\인간족\\몸통\\남\\프리스트_남.spr' },
  { key: 'knight', bodyFile: 'data\\sprite\\인간족\\몸통\\남\\페코페코_기사_남.spr' },
  { key: 'hunter', bodyFile: 'data\\sprite\\인간족\\몸통\\남\\헌터_남.spr' },
  { key: 'assassin', bodyFile: 'data\\sprite\\인간족\\몸통\\남\\도둑_남.spr' }
];

const spriteDir = './ro-survivors/assets/sprites';

for (const cb of classBodies) {
  const bData = getSprFile(cb.bodyFile);
  if (!bData) continue;
  const bFrames = decodeSPR(bData);

  // 1. Walk / Idle Frames (frames 0..5)
  for (let i = 0; i < 6; i++) {
    const b = bFrames[i];
    if (!b) continue;

    // Find neck top row and neck center x
    let neckY = 0, neckMinX = 999, neckMaxX = 0;
    for (let y = 0; y < b.height; y++) {
      let found = false;
      for (let x = 0; x < b.width; x++) {
        if (b.raw[y * b.width + x] > 0) {
          found = true;
          neckMinX = Math.min(neckMinX, x);
          neckMaxX = Math.max(neckMaxX, x);
        }
      }
      if (found) { neckY = y; break; }
    }
    const neckCenterX = (neckMinX + neckMaxX) / 2;

    const cw = Math.max(b.width, h0.width) + 30;
    const ch = b.height + h0.height + 15;
    const compRgba = Buffer.alloc(cw * ch * 4);

    const bx = Math.floor((cw - b.width) / 2);
    const by = h0.height + 6;

    // Blit body
    for (let y = 0; y < b.height; y++) {
      for (let x = 0; x < b.width; x++) {
        const si = (y * b.width + x) * 4;
        const di = ((by + y) * cw + (bx + x)) * 4;
        if (b.rgba[si + 3] > 0) {
          compRgba[di] = b.rgba[si];
          compRgba[di + 1] = b.rgba[si + 1];
          compRgba[di + 2] = b.rgba[si + 2];
          compRgba[di + 3] = 255;
        }
      }
    }

    // Align chin center exactly to neck center!
    const hx = Math.round(bx + neckCenterX - chinCenterX);
    const hy = Math.round(by + neckY - chinY + 1);

    // Blit head
    for (let y = 0; y < h0.height; y++) {
      for (let x = 0; x < h0.width; x++) {
        if (hy + y < 0 || hy + y >= ch || hx + x < 0 || hx + x >= cw) continue;
        const si = (y * h0.width + x) * 4;
        const di = ((hy + y) * cw + (hx + x)) * 4;
        if (h0.rgba[si + 3] > 0) {
          compRgba[di] = h0.rgba[si];
          compRgba[di + 1] = h0.rgba[si + 1];
          compRgba[di + 2] = h0.rgba[si + 2];
          compRgba[di + 3] = 255;
        }
      }
    }

    const filename = `class_${cb.key}_${i}.png`;
    fs.writeFileSync(path.join(spriteDir, filename), encodePNG(cw, ch, compRgba));
  }

  // 2. Slashing Attack Frames (frames 45..47)
  for (let a = 0; a < 3; a++) {
    const b = bFrames[45 + a];
    if (!b) continue;

    let neckY = 0, neckMinX = 999, neckMaxX = 0;
    for (let y = 0; y < b.height; y++) {
      let found = false;
      for (let x = 0; x < b.width; x++) {
        if (b.raw[y * b.width + x] > 0) {
          found = true;
          neckMinX = Math.min(neckMinX, x);
          neckMaxX = Math.max(neckMaxX, x);
        }
      }
      if (found) { neckY = y; break; }
    }
    const neckCenterX = (neckMinX + neckMaxX) / 2;

    const cw = Math.max(b.width, h0.width) + 30;
    const ch = b.height + h0.height + 15;
    const compRgba = Buffer.alloc(cw * ch * 4);

    const bx = Math.floor((cw - b.width) / 2);
    const by = h0.height + 6;

    for (let y = 0; y < b.height; y++) {
      for (let x = 0; x < b.width; x++) {
        const si = (y * b.width + x) * 4;
        const di = ((by + y) * cw + (bx + x)) * 4;
        if (b.rgba[si + 3] > 0) {
          compRgba[di] = b.rgba[si];
          compRgba[di + 1] = b.rgba[si + 1];
          compRgba[di + 2] = b.rgba[si + 2];
          compRgba[di + 3] = 255;
        }
      }
    }

    const hx = Math.round(bx + neckCenterX - chinCenterX);
    const hy = Math.round(by + neckY - chinY + 1);

    for (let y = 0; y < h0.height; y++) {
      for (let x = 0; x < h0.width; x++) {
        if (hy + y < 0 || hy + y >= ch || hx + x < 0 || hx + x >= cw) continue;
        const si = (y * h0.width + x) * 4;
        const di = ((hy + y) * cw + (hx + x)) * 4;
        if (h0.rgba[si + 3] > 0) {
          compRgba[di] = h0.rgba[si];
          compRgba[di + 1] = h0.rgba[si + 1];
          compRgba[di + 2] = h0.rgba[si + 2];
          compRgba[di + 3] = 255;
        }
      }
    }

    const filename = `class_${cb.key}_attack_${a}.png`;
    fs.writeFileSync(path.join(spriteDir, filename), encodePNG(cw, ch, compRgba));
  }
}

fs.closeSync(fd);
console.log('Regenerated all character sprites with pixel-perfect chin-to-neck alignment!');
