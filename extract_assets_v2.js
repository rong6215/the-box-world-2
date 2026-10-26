const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// PNG encoder
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

// BMP to PNG (handles 8-bit & 24-bit with magenta #ff00ff transparency)
function bmpToPng(bmpBuf) {
  if (bmpBuf.toString('ascii', 0, 2) !== 'BM') throw new Error('Not BMP');
  const offset = bmpBuf.readUInt32LE(10);
  const w = bmpBuf.readInt32LE(18);
  const h = Math.abs(bmpBuf.readInt32LE(22));
  const bpp = bmpBuf.readUInt16LE(28);
  const isTopDown = bmpBuf.readInt32LE(22) < 0;

  const rgba = Buffer.alloc(w * h * 4);

  if (bpp === 8) {
    const palette = bmpBuf.subarray(54, offset);
    const rowBytes = Math.floor((w + 3) / 4) * 4;

    for (let y = 0; y < h; y++) {
      const srcY = isTopDown ? y : (h - 1 - y);
      const rowStart = offset + srcY * rowBytes;
      for (let x = 0; x < w; x++) {
        const idx = bmpBuf[rowStart + x];
        const palOffset = idx * 4;
        const b = palette[palOffset];
        const g = palette[palOffset + 1];
        const r = palette[palOffset + 2];
        const dstIdx = (y * w + x) * 4;

        if (r === 255 && g === 0 && b === 255) {
          rgba[dstIdx + 3] = 0;
        } else {
          rgba[dstIdx] = r;
          rgba[dstIdx + 1] = g;
          rgba[dstIdx + 2] = b;
          rgba[dstIdx + 3] = 255;
        }
      }
    }
  } else if (bpp === 24) {
    const rowBytes = Math.floor((w * 3 + 3) / 4) * 4;
    for (let y = 0; y < h; y++) {
      const srcY = isTopDown ? y : (h - 1 - y);
      const rowStart = offset + srcY * rowBytes;
      for (let x = 0; x < w; x++) {
        const b = bmpBuf[rowStart + x * 3];
        const g = bmpBuf[rowStart + x * 3 + 1];
        const r = bmpBuf[rowStart + x * 3 + 2];
        const dstIdx = (y * w + x) * 4;

        if (r === 255 && g === 0 && b === 255) {
          rgba[dstIdx + 3] = 0;
        } else {
          rgba[dstIdx] = r;
          rgba[dstIdx + 1] = g;
          rgba[dstIdx + 2] = b;
          rgba[dstIdx + 3] = 255;
        }
      }
    }
  }
  return encodePNG(w, h, rgba);
}

// Decode RO SPR into frame array
function decodeSPR(sprBuffer) {
  if (sprBuffer.toString('utf8', 0, 2) !== 'SP') throw new Error('Not SPR');
  const versionMinor = sprBuffer[2];
  const versionMajor = sprBuffer[3];
  const indexedCount = sprBuffer.readUInt16LE(4);
  const palette = sprBuffer.subarray(sprBuffer.length - 1024);
  const frames = [];
  let offset = versionMajor >= 2 ? 8 : 6;

  for (let f = 0; f < indexedCount; f++) {
    if (offset + 4 > sprBuffer.length) break;
    const w = sprBuffer.readUInt16LE(offset);
    const h = sprBuffer.readUInt16LE(offset + 2);
    offset += 4;
    if (w === 0 || h === 0) { frames.push(null); continue; }

    const rawPixels = Buffer.alloc(w * h);
    if (versionMajor === 2 && versionMinor === 1) {
      const encLen = sprBuffer.readUInt16LE(offset);
      offset += 2;
      let p = 0;
      const end = offset + encLen;
      while (offset < end && p < rawPixels.length) {
        const b = sprBuffer[offset++];
        if (b === 0) { p += sprBuffer[offset++]; } else { rawPixels[p++] = b; }
      }
    } else {
      sprBuffer.copy(rawPixels, 0, offset, offset + w * h);
      offset += w * h;
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
    frames.push({ width: w, height: h, rgba });
  }
  return frames;
}

// Load GRF
console.log('Loading _sprites.grf table...');
const grfFd = fs.openSync('./THE BOX WORLD/_sprites.grf', 'r');
const grfHeader = Buffer.alloc(46);
fs.readSync(grfFd, grfHeader, 0, 46, 0);

const tableOffset = grfHeader.readUInt32LE(30) + 46;
const tableHeader = Buffer.alloc(8);
fs.readSync(grfFd, tableHeader, 0, 8, tableOffset);
const compSize = tableHeader.readUInt32LE(0);
const compBuf = Buffer.alloc(compSize);
fs.readSync(grfFd, compBuf, 0, compSize, tableOffset + 8);
const decTable = zlib.inflateSync(compBuf);

const dec = new TextDecoder('euc-kr');
const grfMap = new Map();
let offset = 0;
while (offset < decTable.length) {
  let strEnd = offset;
  while (strEnd < decTable.length && decTable[strEnd] !== 0) strEnd++;
  const rawBytes = decTable.subarray(offset, strEnd);
  offset = strEnd + 1;
  if (offset + 17 > decTable.length) break;
  const csize = decTable.readUInt32LE(offset);
  const rsize = decTable.readUInt32LE(offset + 8);
  const foffset = decTable.readUInt32LE(offset + 13);
  offset += 17;

  const fn = dec.decode(rawBytes).toLowerCase().replace(/\//g, '\\');
  grfMap.set(fn, { csize, rsize, foffset });
}
console.log(`GRF loaded: ${grfMap.size} files.`);

function getGrfFile(target) {
  const norm = target.toLowerCase().replace(/\//g, '\\');
  const info = grfMap.get(norm);
  if (!info) return null;
  const buf = Buffer.alloc(info.csize);
  fs.readSync(grfFd, buf, 0, info.csize, info.foffset + 46);
  return zlib.inflateSync(buf);
}

// 1. Extract Skin UI Bitmaps
console.log('Extracting authentic RO UI from Skin folder...');
const uiDir = './ro-survivors/assets/ui';
if (!fs.existsSync(uiDir)) fs.mkdirSync(uiDir, { recursive: true });

const skinFiles = [
  { src: 'THE BOX WORLD/Skin/scribbling kid/BTN_OK.BMP', out: 'btn_ok.png' },
  { src: 'THE BOX WORLD/Skin/scribbling kid/btn_cancel.bmp', out: 'btn_cancel.png' },
  { src: 'THE BOX WORLD/Skin/scribbling kid/BTN_NEXT.BMP', out: 'btn_next.png' },
  { src: 'THE BOX WORLD/Skin/scribbling kid/btn_close.bmp', out: 'btn_close.png' },
  { src: 'THE BOX WORLD/Skin/scribbling kid/basic_interface/basewin_bg.bmp', out: 'basewin_bg.png' },
  { src: 'THE BOX WORLD/Skin/scribbling kid/basic_interface/dialog_bg.bmp', out: 'dialog_bg.png' }
];

for (const sf of skinFiles) {
  if (fs.existsSync(sf.src)) {
    const png = bmpToPng(fs.readFileSync(sf.src));
    fs.writeFileSync(path.join(uiDir, sf.out), png);
    console.log(`Saved UI: ${sf.out}`);
  }
}

// 2. Extract Authentic RO Monsters
const monsterList = [
  { key: 'poring', file: 'data\\sprite\\몬스터\\poring.spr' },
  { key: 'drops', file: 'data\\sprite\\몬스터\\drops.spr' },
  { key: 'poporing', file: 'data\\sprite\\몬스터\\poporing.spr' },
  { key: 'marin', file: 'data\\sprite\\몬스터\\marin.spr' },
  { key: 'fabre', file: 'data\\sprite\\몬스터\\fabre.spr' },
  { key: 'pupa', file: 'data\\sprite\\몬스터\\pupa.spr' },
  { key: 'lunatic', file: 'data\\sprite\\몬스터\\lunatic.spr' },
  { key: 'smokie', file: 'data\\sprite\\몬스터\\smokie.spr' },
  { key: 'spore', file: 'data\\sprite\\몬스터\\spore.spr' },
  { key: 'poison_spore', file: 'data\\sprite\\몬스터\\poison_spore.spr' },
  { key: 'zombie', file: 'data\\sprite\\몬스터\\zombie.spr' },
  { key: 'mummy', file: 'data\\sprite\\몬스터\\mummy.spr' },
  { key: 'orc_zombie', file: 'data\\sprite\\몬스터\\orc_zombie.spr' },
  { key: 'mastering', file: 'data\\sprite\\몬스터\\mastering.spr' },
  { key: 'angeling', file: 'data\\sprite\\몬스터\\angeling.spr' },
  { key: 'deviling', file: 'data\\sprite\\몬스터\\deviling.spr' },
  { key: 'moonlight', file: 'data\\sprite\\몬스터\\moonlight.spr' },
  { key: 'baphomet', file: 'data\\sprite\\몬스터\\baphomet.spr' }
];

const spriteDir = './ro-survivors/assets/sprites';
const manifest = fs.existsSync(path.join(spriteDir, 'manifest.json'))
  ? JSON.parse(fs.readFileSync(path.join(spriteDir, 'manifest.json'), 'utf8'))
  : {};

console.log('Extracting 18 authentic RO monsters...');
for (const m of monsterList) {
  const sprData = getGrfFile(m.file);
  if (!sprData) {
    console.log(`Warning: Monster file not found: ${m.file}`);
    continue;
  }
  const frames = decodeSPR(sprData).filter(f => f && f.width > 0 && f.height > 0);
  const outKey = `monster_${m.key}`;
  manifest[outKey] = [];
  const numSave = Math.min(frames.length, 6);
  for (let i = 0; i < numSave; i++) {
    const f = frames[i];
    const filename = `${outKey}_${i}.png`;
    fs.writeFileSync(path.join(spriteDir, filename), encodePNG(f.width, f.height, f.rgba));
    manifest[outKey].push({
      file: `assets/sprites/${filename}`,
      width: f.width,
      height: f.height
    });
  }
  console.log(`Extracted monster ${m.key}: ${numSave} frames.`);
}

// 3. Extract & Composite Authentic Original RO Player Characters (Body + Hair)
console.log('Compositing authentic RO Player Character sprites (Body + Hair)...');
const hairSpr = decodeSPR(getGrfFile('data\\sprite\\인간족\\머리통\\남\\1_남.spr'));
const hairFrame0 = hairSpr[0];

const classBodies = [
  { key: 'novice', bodyFile: 'data\\sprite\\인간족\\몸통\\남\\초보자_남.spr', hairYOff: 14 },
  { key: 'swordsman', bodyFile: 'data\\sprite\\인간족\\몸통\\남\\검사_남.spr', hairYOff: 14 },
  { key: 'mage', bodyFile: 'data\\sprite\\인간족\\몸통\\남\\마법사_남.spr', hairYOff: 14 },
  { key: 'archer', bodyFile: 'data\\sprite\\인간족\\몸통\\남\\궁수_남.spr', hairYOff: 14 },
  { key: 'thief', bodyFile: 'data\\sprite\\인간족\\몸통\\남\\도둑_남.spr', hairYOff: 14 },
  { key: 'merchant', bodyFile: 'data\\sprite\\인간족\\몸통\\남\\상인_남.spr', hairYOff: 14 },
  { key: 'acolyte', bodyFile: 'data\\sprite\\인간족\\몸통\\남\\프리스트_남.spr', hairYOff: 14 },
  { key: 'knight', bodyFile: 'data\\sprite\\인간족\\몸통\\남\\페코페코_기사_남.spr', hairYOff: 30 },
  { key: 'hunter', bodyFile: 'data\\sprite\\인간족\\몸통\\남\\헌터_남.spr', hairYOff: 14 },
  { key: 'assassin', bodyFile: 'data\\sprite\\인간족\\몸통\\남\\도둑_남.spr', hairYOff: 14 }
];

for (const c of classBodies) {
  const bodyData = getGrfFile(c.bodyFile);
  if (!bodyData) continue;
  const bodyFrames = decodeSPR(bodyData).filter(f => f && f.width > 0 && f.height > 0);
  const outKey = `class_${c.key}`;
  manifest[outKey] = [];

  const numSave = Math.min(bodyFrames.length, 6);
  for (let i = 0; i < numSave; i++) {
    const b = bodyFrames[i];
    // Composite on canvas
    const cw = Math.max(b.width, hairFrame0.width) + 20;
    const ch = b.height + hairFrame0.height + 10;
    const compRgba = Buffer.alloc(cw * ch * 4);

    const bx = Math.floor((cw - b.width) / 2);
    const by = ch - b.height - 4;

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

    // Blit hair
    const hx = Math.floor((cw - hairFrame0.width) / 2);
    const hy = by - hairFrame0.height + c.hairYOff;
    for (let y = 0; y < hairFrame0.height; y++) {
      for (let x = 0; x < hairFrame0.width; x++) {
        if (hy + y < 0 || hy + y >= ch || hx + x < 0 || hx + x >= cw) continue;
        const si = (y * hairFrame0.width + x) * 4;
        const di = ((hy + y) * cw + (hx + x)) * 4;
        if (hairFrame0.rgba[si + 3] > 0) {
          compRgba[di] = hairFrame0.rgba[si];
          compRgba[di + 1] = hairFrame0.rgba[si + 1];
          compRgba[di + 2] = hairFrame0.rgba[si + 2];
          compRgba[di + 3] = 255;
        }
      }
    }

    const filename = `${outKey}_${i}.png`;
    fs.writeFileSync(path.join(spriteDir, filename), encodePNG(cw, ch, compRgba));
    manifest[outKey].push({
      file: `assets/sprites/${filename}`,
      width: cw,
      height: ch
    });
  }
  console.log(`Saved authentic composite class ${c.key}: ${numSave} frames.`);
}

fs.writeFileSync(path.join(spriteDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log('Updated manifest.json with authentic assets!');
fs.closeSync(grfFd);
