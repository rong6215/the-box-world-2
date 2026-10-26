// Extracts ALL Authentic RO Job Class Sprites (Class 1, Class 2, High Class, Class 3)
// with 8-direction walk frames (Actions 8..12) AND 4-frame Attack poses (Action 80/56)
// from THE BOX WORLD/_sprites.grf!

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { GRFSet } = require('./grf');

const ROOT = path.join(__dirname, '..', '..', 'THE BOX WORLD');
const OUT = path.join(__dirname, '..', 'assets', 'sprites');
fs.mkdirSync(OUT, { recursive: true });

const set = new GRFSet(ROOT, ['_sprites.grf', 'data.grf']);

// PNG encoder
const crcTable = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const tb = Buffer.from(type, 'ascii'); const cb = Buffer.alloc(4); cb.writeUInt32BE(crc32(Buffer.concat([tb, data])));
  return Buffer.concat([len, tb, data, cb]);
}
function encodePNG(w, h, rgba) {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++) { raw[y * (1 + w * 4)] = 0; rgba.copy(raw, y * (1 + w * 4) + 1, y * w * 4, (y + 1) * w * 4); }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

function decodeSPR(sprBuffer) {
  if (!sprBuffer) return [];
  const ver = sprBuffer.readUInt16LE(2);
  const indexedCount = sprBuffer.readUInt16LE(4);
  const rgbaCount = ver >= 0x200 ? sprBuffer.readUInt16LE(6) : 0;
  const palette = sprBuffer.subarray(sprBuffer.length - 1024);
  const frames = [];
  let p = 8;
  for (let f = 0; f < indexedCount; f++) {
    const w = sprBuffer.readUInt16LE(p);
    const h = sprBuffer.readUInt16LE(p + 2);
    p += 4;
    if (w === 0 || h === 0) { frames.push(null); continue; }
    const rawPixels = Buffer.alloc(w * h);
    if (ver >= 0x201) {
      const encLen = sprBuffer.readUInt16LE(p);
      p += 2;
      let px = 0;
      const end = p + encLen;
      while (p < end && px < rawPixels.length) {
        const b = sprBuffer[p++];
        if (b === 0) px += sprBuffer[p++]; else rawPixels[px++] = b;
      }
      p = end;
    } else {
      sprBuffer.copy(rawPixels, 0, p, p + w * h);
      p += w * h;
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

function parseAct(buf) {
  if (!buf) return [];
  let p = 2;
  const subVersion = buf.readUInt8(p++);
  const version = buf.readUInt8(p++);
  const numActions = buf.readUInt16LE(p); p += 12;
  const actions = [];
  for (let a = 0; a < numActions; a++) {
    const numFrames = buf.readUInt32LE(p); p += 4;
    const frames = [];
    for (let f = 0; f < numFrames; f++) {
      p += 32;
      const numPatches = buf.readUInt32LE(p); p += 4;
      const patches = [];
      for (let pt = 0; pt < numPatches; pt++) {
        const x = buf.readInt32LE(p), y = buf.readInt32LE(p + 4), sprNo = buf.readInt32LE(p + 8), mirror = buf.readInt32LE(p + 12);
        p += 20;
        if (version >= 2) {
          p += 16;
          if (version > 2 || (version === 2 && subVersion >= 5)) p += 8;
        }
        patches.push({ x, y, sprNo, mirror });
      }
      if (version > 2 || (version === 2 && subVersion >= 1)) p += 4;
      const attachPoints = [];
      if (version > 2 || (version === 2 && subVersion >= 3)) {
        const numAP = buf.readUInt32LE(p); p += 4;
        for (let ap = 0; ap < numAP; ap++) {
          p += 4; const ax = buf.readInt32LE(p); p += 4; const ay = buf.readInt32LE(p); p += 8;
          attachPoints.push({ x: ax, y: ay });
        }
      }
      frames.push({ patches, attachPoints });
    }
    actions.push(frames);
  }
  return actions;
}

const cw = 110, ch = 120, anchorX = 55, anchorY = 105;
function renderComposite(bodySpr, bodyFrame, hairSpr, hairFrame) {
  const canvasRgba = Buffer.alloc(cw * ch * 4);
  function drawPatch(spr, patch, offX, offY) {
    if (!spr) return;
    const left = Math.round(anchorX + offX + patch.x - spr.width / 2);
    const top = Math.round(anchorY + offY + patch.y - spr.height / 2);
    for (let y = 0; y < spr.height; y++) {
      for (let x = 0; x < spr.width; x++) {
        const srcX = patch.mirror ? (spr.width - 1 - x) : x;
        const si = (y * spr.width + srcX) * 4;
        if (spr.rgba[si + 3] === 0) continue;
        const dx = left + x, dy = top + y;
        if (dx < 0 || dx >= cw || dy < 0 || dy >= ch) continue;
        const di = (dy * cw + dx) * 4;
        canvasRgba[di] = spr.rgba[si]; canvasRgba[di + 1] = spr.rgba[si + 1]; canvasRgba[di + 2] = spr.rgba[si + 2]; canvasRgba[di + 3] = 255;
      }
    }
  }
  if (bodyFrame && bodyFrame.patches) {
    for (const p of bodyFrame.patches) if (p.sprNo >= 0 && bodySpr[p.sprNo]) drawPatch(bodySpr[p.sprNo], p, 0, 0);
  }
  if (hairFrame && hairFrame.patches) {
    const bodyAP = (bodyFrame && bodyFrame.attachPoints && bodyFrame.attachPoints[0]) || { x: 0, y: -56 };
    const hairAP = (hairFrame.attachPoints && hairFrame.attachPoints[0]) || { x: 0, y: -56 };
    for (const p of hairFrame.patches) if (p.sprNo >= 0 && hairSpr[p.sprNo]) drawPatch(hairSpr[p.sprNo], p, bodyAP.x - hairAP.x, bodyAP.y - hairAP.y);
  }
  return canvasRgba;
}

const defaultHairSpr = decodeSPR(set.get('data\\sprite\\인간족\\머리통\\남\\2_남.spr'));
const defaultHairAct = parseAct(set.get('data\\sprite\\인간족\\머리통\\남\\2_남.act'));

const ALL_JOBS = [
  { key: 'novice',           base: '초보자_남' },
  // Swordsman Branch
  { key: 'swordsman',        base: '검사_남' },
  { key: 'knight',           base: '기사_남' },
  { key: 'lord_knight',      base: '로드나이트_남' },
  { key: 'rune_knight',      base: '룬나이트_남' },
  { key: 'crusader',         base: '크루세이더_남' },
  { key: 'paladin',          base: '팔라딘_남' },
  { key: 'royal_guard',      base: '가드_남' },
  // Mage Branch
  { key: 'mage',             base: '마법사_남' },
  { key: 'wizard',           base: '위저드_남' },
  { key: 'high_wizard',      base: '하이위저드_남' },
  { key: 'warlock',          base: '워록_남' },
  { key: 'sage',             base: '세이지_남' },
  { key: 'professor',        base: '프로페서_남' },
  { key: 'sorcerer',         base: '소서러_남' },
  // Archer Branch
  { key: 'archer',           base: '궁수_남' },
  { key: 'hunter',           base: '헌터_남' },
  { key: 'sniper',           base: '스나이퍼_남' },
  { key: 'ranger',           base: '레인져_남' },
  // Thief Branch
  { key: 'thief',            base: '도둑_남' },
  { key: 'assassin',         base: '어세신_남' },
  { key: 'assassin_cross',   base: '어쌔신크로스_남' },
  { key: 'guillotine_cross', base: '길로틴크로스_남' },
  { key: 'rogue',            base: '로그_남' },
  { key: 'stalker',          base: '스토커_남' },
  { key: 'shadow_chaser',    base: '쉐도우체이서_남' },
  // Acolyte Branch
  { key: 'acolyte',          base: '성직자_남' },
  { key: 'priest',           base: '프리스트_남' },
  { key: 'high_priest',      base: '하이프리_남' },
  { key: 'arch_bishop',      base: '아크비숍_남' },
  { key: 'monk',             base: '몽크_남' },
  { key: 'champion',         base: '챔피온_남' },
  { key: 'sura',             base: '슈라_남' },
  // Merchant Branch
  { key: 'merchant',         base: '상인_남' },
  { key: 'blacksmith',       base: '제철공_남' },
  { key: 'whitesmith',       base: '화이트스미스_남' },
  { key: 'mechanic',         base: '미케닉_남' },
  { key: 'alchemist',        base: '연금술사_남' },
  { key: 'creator',          base: '크리에이터_남' },
  { key: 'genetic',          base: '제네릭_남' }
];

const manifestPath = path.join(OUT, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

let extractedJobs = 0;
for (const c of ALL_JOBS) {
  const sprBuf = set.get('data\\sprite\\인간족\\몸통\\남\\' + c.base + '.spr');
  const actBuf = set.get('data\\sprite\\인간족\\몸통\\남\\' + c.base + '.act');
  if (!sprBuf || !actBuf) {
    console.warn('Missing job sprite:', c.key, c.base);
    continue;
  }
  const bodySpr = decodeSPR(sprBuf);
  const bodyAct = parseAct(actBuf);

  // 1. Standing Front (Action 0) + Walk Front (class_<key>_0..7)
  const standBf = bodyAct[0] && bodyAct[0][0];
  const standHf = defaultHairAct[0] && defaultHairAct[0][0];
  if (standBf) {
    fs.writeFileSync(path.join(OUT, `class_${c.key}_0.png`), encodePNG(cw, ch, renderComposite(bodySpr, standBf, defaultHairSpr, standHf)));
  }

  // 2. 5 Camera Directions Walk (d0=Down, d1=DownLeft, d2=Left, d3=UpLeft, d4=Up)
  for (let dir = 0; dir <= 4; dir++) {
    const actIdx = 8 + dir;
    const walkAct = bodyAct[actIdx] || bodyAct[8] || bodyAct[0];
    const hairAct = defaultHairAct[actIdx] || defaultHairAct[dir] || defaultHairAct[0];
    const count = Math.min(8, walkAct ? walkAct.length : 8);
    const dirList = [];
    for (let f = 0; f < count; f++) {
      const bf = walkAct[f];
      const hf = hairAct ? (hairAct[f % hairAct.length] || hairAct[0]) : null;
      const fn = `class_${c.key}_d${dir}_${f}.png`;
      fs.writeFileSync(path.join(OUT, fn), encodePNG(cw, ch, renderComposite(bodySpr, bf, defaultHairSpr, hf)));
      dirList.push({ file: `assets/sprites/${fn}`, width: cw, height: ch });
    }
    manifest[`class_${c.key}_d${dir}`] = dirList;
    if (dir === 0) manifest[`class_${c.key}`] = dirList;
  }

  // 3. Normal Attack Animation Frames (Action 80 = Weapon Attack dir 1, or Action 56 = Fist/Weapon Attack dir 1)
  const atkAct = bodyAct[81] || bodyAct[80] || bodyAct[57] || bodyAct[56] || bodyAct[10];
  const atkHairAct = defaultHairAct[81] || defaultHairAct[80] || defaultHairAct[57] || defaultHairAct[1];
  const atkCount = Math.min(4, atkAct ? atkAct.length : 3);
  for (let a = 0; a < 4; a++) {
    const idx = Math.min(atkCount - 1, a);
    const bf = atkAct && atkAct[idx];
    const hf = atkHairAct ? (atkHairAct[idx % atkHairAct.length] || atkHairAct[0]) : standHf;
    if (bf) {
      fs.writeFileSync(path.join(OUT, `class_${c.key}_attack_${a}.png`), encodePNG(cw, ch, renderComposite(bodySpr, bf, defaultHairSpr, hf)));
    }
  }
  extractedJobs++;
}

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`Successfully extracted ${extractedJobs} authentic RO job classes with 8-dir walk & attack frames!`);
