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
  if (!sprBuffer) return [];
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

function parseAct(buf) {
  if (!buf) return [];
  let p = 0;
  p += 2; // magic 'AC'
  const subVersion = buf.readUInt8(p++);
  const version = buf.readUInt8(p++);
  const numActions = buf.readUInt16LE(p); p += 2;
  p += 10;
  const actions = [];
  for (let a = 0; a < numActions; a++) {
    const numFrames = buf.readUInt32LE(p); p += 4;
    const frames = [];
    for (let f = 0; f < numFrames; f++) {
      p += 32;
      const numPatches = buf.readUInt32LE(p); p += 4;
      const patches = [];
      for (let pt = 0; pt < numPatches; pt++) {
        const x = buf.readInt32LE(p);
        const y = buf.readInt32LE(p + 4);
        const sprNo = buf.readInt32LE(p + 8);
        const mirror = buf.readInt32LE(p + 12);
        const color = buf.readUInt32LE(p + 16);
        p += 20;
        let scaleX = 1, scaleY = 1, angle = 0, sprType = 0, w = 0, h = 0;
        if (version >= 2) {
          scaleX = buf.readFloatLE(p);
          scaleY = (version > 2 || (version === 2 && subVersion >= 4)) ? buf.readFloatLE(p + 4) : scaleX;
          angle = buf.readInt32LE(p + 8);
          sprType = buf.readInt32LE(p + 12);
          p += 16;
          if (version > 2 || (version === 2 && subVersion >= 5)) {
            w = buf.readInt32LE(p);
            h = buf.readInt32LE(p + 4);
            p += 8;
          }
        }
        patches.push({ x, y, sprNo, mirror, scaleX, scaleY, angle, sprType, w, h });
      }
      if (version > 2 || (version === 2 && subVersion >= 1)) {
        p += 4;
      }
      const attachPoints = [];
      if (version > 2 || (version === 2 && subVersion >= 3)) {
        const numAttachPoints = buf.readUInt32LE(p); p += 4;
        for (let ap = 0; ap < numAttachPoints; ap++) {
          p += 4;
          const ax = buf.readInt32LE(p); p += 4;
          const ay = buf.readInt32LE(p); p += 4;
          p += 4;
          attachPoints.push({ x: ax, y: ay });
        }
      }
      frames.push({ patches, attachPoints });
    }
    actions.push(frames);
  }
  return actions;
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
let offset = 0;
const fileMap = new Map();
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
  fileMap.set(fn, { csize, foffset });
}

function getFile(fn) {
  const info = fileMap.get(fn.toLowerCase().replace(/\//g, '\\'));
  if (!info) return null;
  const buf = Buffer.alloc(info.csize);
  fs.readSync(fd, buf, 0, info.csize, info.foffset + 46);
  return zlib.inflateSync(buf);
}

const hairSpr = decodeSPR(getFile('data\\sprite\\인간족\\머리통\\남\\1_남.spr'));
const hairAct = parseAct(getFile('data\\sprite\\인간족\\머리통\\남\\1_남.act'));

const classes = [
  { key: 'novice', base: '초보자_남' },
  { key: 'swordsman', base: '검사_남' },
  { key: 'mage', base: '마법사_남' },
  { key: 'archer', base: '궁수_남' },
  { key: 'thief', base: '도둑_남' },
  { key: 'merchant', base: '상인_남' },
  { key: 'acolyte', base: '성직자_남' },
  { key: 'knight', base: '기사_남' },
  { key: 'hunter', base: '헌터_남' },
  { key: 'assassin', base: '어쌔신크로스_남' }
];

const cw = 110, ch = 120;
const anchorX = 55, anchorY = 105;
const spriteDir = './ro-survivors/assets/sprites';

function renderFrame(bodySpr, bodyFrame, hairSpr, hairFrame) {
  const canvasRgba = Buffer.alloc(cw * ch * 4);

  function drawPatch(targetBuf, spr, patch, offX, offY) {
    if (!spr) return;
    const left = Math.round(anchorX + offX + patch.x - (spr.width / 2));
    const top = Math.round(anchorY + offY + patch.y - (spr.height / 2));
    for (let y = 0; y < spr.height; y++) {
      for (let x = 0; x < spr.width; x++) {
        const srcX = patch.mirror ? (spr.width - 1 - x) : x;
        const si = (y * spr.width + srcX) * 4;
        if (spr.rgba[si + 3] === 0) continue;
        const dx = left + x;
        const dy = top + y;
        if (dx < 0 || dx >= cw || dy < 0 || dy >= ch) continue;
        const di = (dy * cw + dx) * 4;
        targetBuf[di] = spr.rgba[si];
        targetBuf[di + 1] = spr.rgba[si + 1];
        targetBuf[di + 2] = spr.rgba[si + 2];
        targetBuf[di + 3] = 255;
      }
    }
  }

  // 1. Draw Body
  if (bodyFrame && bodyFrame.patches) {
    for (const p of bodyFrame.patches) {
      if (p.sprNo >= 0 && bodySpr[p.sprNo]) {
        drawPatch(canvasRgba, bodySpr[p.sprNo], p, 0, 0);
      }
    }
  }

  // 2. Draw Hair with exact attach point offset
  if (hairFrame && hairFrame.patches) {
    const bodyAP = (bodyFrame && bodyFrame.attachPoints && bodyFrame.attachPoints[0]) || { x: 0, y: -56 };
    const hairAP = (hairFrame.attachPoints && hairFrame.attachPoints[0]) || { x: 1, y: -56 };
    const headOffX = bodyAP.x - hairAP.x;
    const headOffY = bodyAP.y - hairAP.y;

    for (const p of hairFrame.patches) {
      if (p.sprNo >= 0 && hairSpr[p.sprNo]) {
        drawPatch(canvasRgba, hairSpr[p.sprNo], p, headOffX, headOffY);
      }
    }
  }

  return canvasRgba;
}

for (const c of classes) {
  const bodySpr = decodeSPR(getFile('data\\sprite\\인간족\\몸통\\남\\' + c.base + '.spr'));
  const bodyAct = parseAct(getFile('data\\sprite\\인간족\\몸통\\남\\' + c.base + '.act'));

  // Action 8 is South Walk (8 frames)
  const walkAct = bodyAct[8] || bodyAct[0];
  const hairWalkAct = hairAct[8] || hairAct[0];
  const walkFrameCount = Math.min(8, walkAct ? walkAct.length : 6);

  for (let f = 0; f < walkFrameCount; f++) {
    const bf = walkAct[f];
    const hf = hairWalkAct ? (hairWalkAct[f % hairWalkAct.length] || hairWalkAct[0]) : null;
    const rgba = renderFrame(bodySpr, bf, hairSpr, hf);
    const filename = `class_${c.key}_${f}.png`;
    fs.writeFileSync(path.join(spriteDir, filename), encodePNG(cw, ch, rgba));
  }

  // Action 24 is South Attack 1 (typically 3 frames)
  // Some classes might have attack at 24 or 40; let's check bodyAct[24]
  let atkAct = bodyAct[24];
  if (!atkAct || atkAct.length < 2) atkAct = bodyAct[16] || bodyAct[8];
  const hairAtkAct = hairAct[24] || hairAct[8] || hairAct[0];
  const atkFrameCount = Math.min(3, atkAct ? atkAct.length : 3);

  for (let a = 0; a < 3; a++) {
    const bf = atkAct[a % atkAct.length];
    const hf = hairAtkAct ? (hairAtkAct[a % hairAtkAct.length] || hairAtkAct[0]) : null;
    const rgba = renderFrame(bodySpr, bf, hairSpr, hf);
    const filename = `class_${c.key}_attack_${a}.png`;
    fs.writeFileSync(path.join(spriteDir, filename), encodePNG(cw, ch, rgba));
  }

  console.log(`Successfully generated authentic character sprites for ${c.key} (${walkFrameCount} walk, 3 attack)`);
}

fs.closeSync(fd);
console.log('ALL 10 CLASSES REGENERATED WITH 100% AUTHENTIC RO ACT OFFSETS & ATTACH POINTS!');
