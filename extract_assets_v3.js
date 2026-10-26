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

// BMP to PNG
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

// TGA to PNG
function tgaToPng(tgaBuf) {
  const idLen = tgaBuf[0];
  const type = tgaBuf[2];
  const w = tgaBuf.readUInt16LE(12);
  const h = tgaBuf.readUInt16LE(14);
  const bpp = tgaBuf[16];
  const desc = tgaBuf[17];
  const isTopDown = (desc & 0x20) !== 0;

  const dataOffset = 18 + idLen;
  const rgba = Buffer.alloc(w * h * 4);
  const bytesPerPixel = Math.floor(bpp / 8);

  for (let y = 0; y < h; y++) {
    const srcY = isTopDown ? y : (h - 1 - y);
    const rowStart = dataOffset + srcY * w * bytesPerPixel;
    for (let x = 0; x < w; x++) {
      const pi = rowStart + x * bytesPerPixel;
      const b = tgaBuf[pi];
      const g = tgaBuf[pi + 1];
      const r = tgaBuf[pi + 2];
      const a = bytesPerPixel === 4 ? tgaBuf[pi + 3] : 255;

      const dstIdx = (y * w + x) * 4;
      // Magenta or black alpha check
      if (r === 255 && g === 0 && b === 255) {
        rgba[dstIdx + 3] = 0;
      } else {
        rgba[dstIdx] = r;
        rgba[dstIdx + 1] = g;
        rgba[dstIdx + 2] = b;
        rgba[dstIdx + 3] = a;
      }
    }
  }
  return encodePNG(w, h, rgba);
}

// Open _textures.grf
console.log('Loading _textures.grf...');
const texFd = fs.openSync('./THE BOX WORLD/_textures.grf', 'r');
const texHeader = Buffer.alloc(46);
fs.readSync(texFd, texHeader, 0, 46, 0);

const texTableOffset = texHeader.readUInt32LE(30) + 46;
const texTableHeader = Buffer.alloc(8);
fs.readSync(texFd, texTableHeader, 0, 8, texTableOffset);
const texCompSize = texTableHeader.readUInt32LE(0);
const texCompBuf = Buffer.alloc(texCompSize);
fs.readSync(texFd, texCompBuf, 0, texCompSize, texTableOffset + 8);
const texDecTable = zlib.inflateSync(texCompBuf);

const dec = new TextDecoder('euc-kr');
const texMap = new Map();
let offset = 0;
while (offset < texDecTable.length) {
  let strEnd = offset;
  while (strEnd < texDecTable.length && texDecTable[strEnd] !== 0) strEnd++;
  const rawBytes = texDecTable.subarray(offset, strEnd);
  offset = strEnd + 1;
  if (offset + 17 > texDecTable.length) break;
  const csize = texDecTable.readUInt32LE(offset);
  const foffset = texDecTable.readUInt32LE(offset + 13);
  offset += 17;

  const fn = dec.decode(rawBytes).toLowerCase().replace(/\//g, '\\');
  texMap.set(fn, { csize, foffset });
}
console.log(`_textures.grf loaded: ${texMap.size} files.`);

function getTexFile(target) {
  const norm = target.toLowerCase().replace(/\//g, '\\');
  const info = texMap.get(norm);
  if (!info) return null;
  const buf = Buffer.alloc(info.csize);
  fs.readSync(texFd, buf, 0, info.csize, info.foffset + 46);
  return zlib.inflateSync(buf);
}

// 1. Extract 33 Authentic RO Skill Icons
const iconsDir = './ro-survivors/assets/skills';
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });

const SKILL_ICONS = [
  // Swordsman
  { id: 'sm_bash', path: 'data\\texture\\유저인터페이스\\item\\sm_bash.bmp' },
  { id: 'sm_magnum', path: 'data\\texture\\유저인터페이스\\item\\sm_magnum.bmp' },
  { id: 'sm_sword', path: 'data\\texture\\유저인터페이스\\item\\sm_sword.bmp' },
  { id: 'sm_endure', path: 'data\\texture\\유저인터페이스\\item\\sm_endure.bmp' },
  { id: 'kn_bowlingbash', path: 'data\\texture\\유저인터페이스\\item\\kn_bowlingbash.bmp' },
  // Mage
  { id: 'mg_firebolt', path: 'data\\texture\\유저인터페이스\\item\\mg_firebolt.bmp' },
  { id: 'mg_coldbolt', path: 'data\\texture\\유저인터페이스\\item\\mg_coldbolt.bmp' },
  { id: 'mg_lightningbolt', path: 'data\\texture\\유저인터페이스\\item\\mg_lightningbolt.bmp' },
  { id: 'mg_soulstrike', path: 'data\\texture\\유저인터페이스\\item\\mg_soulstrike.bmp' },
  { id: 'mg_frostdiver', path: 'data\\texture\\유저인터페이스\\item\\mg_frostdiver.bmp' },
  { id: 'wz_stormgust', path: 'data\\texture\\유저인터페이스\\item\\wz_stormgust.bmp' },
  { id: 'wz_meteor', path: 'data\\texture\\유저인터페이스\\item\\wz_meteorstorm.bmp' },
  // Archer
  { id: 'ac_double', path: 'data\\texture\\유저인터페이스\\item\\ac_double.bmp' },
  { id: 'ac_shower', path: 'data\\texture\\유저인터페이스\\item\\ac_shower.bmp' },
  { id: 'ac_owl', path: 'data\\texture\\유저인터페이스\\item\\ac_owl.bmp' },
  { id: 'ac_vulture', path: 'data\\texture\\유저인터페이스\\item\\ac_vulture.bmp' },
  { id: 'ac_chargearrow', path: 'data\\texture\\유저인터페이스\\item\\ac_chargearrow.bmp' },
  { id: 'ht_blitzbeat', path: 'data\\texture\\유저인터페이스\\item\\ht_blitzbeat.bmp' },
  // Acolyte
  { id: 'al_heal', path: 'data\\texture\\유저인터페이스\\item\\al_heal.bmp' },
  { id: 'al_holylight', path: 'data\\texture\\유저인터페이스\\item\\al_holylight.bmp' },
  { id: 'al_blessing', path: 'data\\texture\\유저인터페이스\\item\\al_blessing.bmp' },
  { id: 'al_incagi', path: 'data\\texture\\유저인터페이스\\item\\al_incagi.bmp' },
  { id: 'pr_kyrie', path: 'data\\texture\\유저인터페이스\\item\\pr_kyrie.bmp' },
  { id: 'pr_magnus', path: 'data\\texture\\유저인터페이스\\item\\pr_magnus.bmp' },
  // Thief
  { id: 'tf_double', path: 'data\\texture\\유저인터페이스\\item\\tf_double.bmp' },
  { id: 'tf_poison', path: 'data\\texture\\유저인터페이스\\item\\tf_poison.bmp' },
  { id: 'as_sonicblow', path: 'data\\texture\\유저인터페이스\\item\\as_sonicblow.bmp' },
  { id: 'as_grimtooth', path: 'data\\texture\\유저인터페이스\\item\\as_grimtooth.bmp' },
  // Merchant
  { id: 'mc_mammonite', path: 'data\\texture\\유저인터페이스\\item\\mc_mammonite.bmp' },
  { id: 'mc_cartrevolution', path: 'data\\texture\\유저인터페이스\\item\\mc_cartrevolution_on.bmp' },
  { id: 'mc_loud', path: 'data\\texture\\유저인터페이스\\item\\mc_loud_on.bmp' },
  // Novice
  { id: 'nv_firstaid', path: 'data\\texture\\유저인터페이스\\item\\nv_firstaid_on.bmp' },
  { id: 'nv_trickdead', path: 'data\\texture\\유저인터페이스\\item\\nv_trickdead_on.bmp' }
];

console.log('Extracting authentic RO skill icons...');
for (const icon of SKILL_ICONS) {
  const buf = getTexFile(icon.path);
  if (!buf) {
    console.log(`Skill icon not found: ${icon.path}`);
    continue;
  }
  const png = bmpToPng(buf);
  fs.writeFileSync(path.join(iconsDir, `${icon.id}.png`), png);
}
console.log('Saved 33 authentic skill icons!');

// 2. Extract Skill Visual Effects
const effectsDir = './ro-survivors/assets/effects';
if (!fs.existsSync(effectsDir)) fs.mkdirSync(effectsDir, { recursive: true });

const SKILL_EFFECTS = [
  { id: 'effect_arrow', path: 'data\\texture\\effect\\arrown.tga' },
  { id: 'effect_slash', path: 'data\\texture\\effect\\e9_counter_slash.tga' },
  { id: 'effect_fire', path: 'data\\texture\\effect\\firering.bmp' },
  { id: 'effect_ice', path: 'data\\texture\\effect\\freeze_ice.bmp' },
  { id: 'effect_blast', path: 'data\\texture\\effect\\blast.bmp' },
  { id: 'effect_light', path: 'data\\texture\\effect\\colo_light.bmp' }
];

for (const eff of SKILL_EFFECTS) {
  const buf = getTexFile(eff.path);
  if (!buf) continue;
  let png;
  if (eff.path.endsWith('.tga')) {
    png = tgaToPng(buf);
  } else {
    png = bmpToPng(buf);
  }
  fs.writeFileSync(path.join(effectsDir, `${eff.id}.png`), png);
  console.log(`Saved effect: ${eff.id}.png`);
}

fs.closeSync(texFd);

// 3. Extract Attack Slashing Frames for Player Characters
console.log('Extracting authentic attack animation frames from _sprites.grf...');
const sprFd = fs.openSync('./THE BOX WORLD/_sprites.grf', 'r');
const sprHeader = Buffer.alloc(46);
fs.readSync(sprFd, sprHeader, 0, 46, 0);

const sprTableOffset = sprHeader.readUInt32LE(30) + 46;
const sprTableHeader = Buffer.alloc(8);
fs.readSync(sprFd, sprTableHeader, 0, 8, sprTableOffset);
const sprCompSize = sprTableHeader.readUInt32LE(0);
const sprCompBuf = Buffer.alloc(sprCompSize);
fs.readSync(sprFd, sprCompBuf, 0, sprCompSize, sprTableOffset + 8);
const sprDecTable = zlib.inflateSync(sprCompBuf);

const sprMap = new Map();
let sproff = 0;
while (sproff < sprDecTable.length) {
  let strEnd = sproff;
  while (strEnd < sprDecTable.length && sprDecTable[strEnd] !== 0) strEnd++;
  const rawBytes = sprDecTable.subarray(sproff, strEnd);
  sproff = strEnd + 1;
  if (sproff + 17 > sprDecTable.length) break;
  const csize = sprDecTable.readUInt32LE(sproff);
  const foffset = sprDecTable.readUInt32LE(sproff + 13);
  sproff += 17;

  const fn = dec.decode(rawBytes).toLowerCase().replace(/\//g, '\\');
  sprMap.set(fn, { csize, foffset });
}

function getSprFile(target) {
  const norm = target.toLowerCase().replace(/\//g, '\\');
  const info = sprMap.get(norm);
  if (!info) return null;
  const buf = Buffer.alloc(info.csize);
  fs.readSync(sprFd, buf, 0, info.csize, info.foffset + 46);
  return zlib.inflateSync(buf);
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
    frames.push({ width: w, height: h, rgba });
  }
  return frames;
}

const hairSpr = decodeSPR(getSprFile('data\\sprite\\인간족\\머리통\\남\\1_남.spr'));
const hairFrame0 = hairSpr[0];

const classBodies = [
  { key: 'novice', bodyFile: 'data\\sprite\\인간족\\몸통\\남\\초보자_남.spr', atkStart: 45 },
  { key: 'swordsman', bodyFile: 'data\\sprite\\인간족\\몸통\\남\\검사_남.spr', atkStart: 45 },
  { key: 'mage', bodyFile: 'data\\sprite\\인간족\\몸통\\남\\마법사_남.spr', atkStart: 45 },
  { key: 'archer', bodyFile: 'data\\sprite\\인간족\\몸통\\남\\궁수_남.spr', atkStart: 45 },
  { key: 'thief', bodyFile: 'data\\sprite\\인간족\\몸통\\남\\도둑_남.spr', atkStart: 45 },
  { key: 'merchant', bodyFile: 'data\\sprite\\인간족\\몸통\\남\\상인_남.spr', atkStart: 45 },
  { key: 'acolyte', bodyFile: 'data\\sprite\\인간족\\몸통\\남\\프리스트_남.spr', atkStart: 45 },
  { key: 'knight', bodyFile: 'data\\sprite\\인간족\\몸통\\남\\페코페코_기사_남.spr', atkStart: 45 }
];

const spriteDir = './ro-survivors/assets/sprites';
for (const cb of classBodies) {
  const bData = getSprFile(cb.bodyFile);
  if (!bData) continue;
  const bFrames = decodeSPR(bData);

  // Extract 3 slashing attack frames
  for (let a = 0; a < 3; a++) {
    const frameIdx = cb.atkStart + a;
    const b = bFrames[frameIdx];
    if (!b) continue;

    const cw = Math.max(b.width, hairFrame0.width) + 24;
    const ch = b.height + hairFrame0.height + 12;
    const compRgba = Buffer.alloc(cw * ch * 4);

    const bx = Math.floor((cw - b.width) / 2);
    const by = ch - b.height - 4;

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

    const hx = Math.floor((cw - hairFrame0.width) / 2);
    const hy = by - hairFrame0.height + 14;
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

    const filename = `class_${cb.key}_attack_${a}.png`;
    fs.writeFileSync(path.join(spriteDir, filename), encodePNG(cw, ch, compRgba));
  }
}

fs.closeSync(sprFd);
console.log('All authentic skill icons, effects, and slashing animations extracted 100%!');
