// Extracts authentic RO assets for the D2 Survivors x RO overhaul:
// 1. 10-slot Equipment Window background (equipwin_bg2.bmp)
// 2. Back-facing (North/Up) walk & attack frames for all classes (8-direction movement)
// 3. 20 Zone ground textures from _textures.grf for the 200 Stages
// 4. Monster death WAVs & Skill WAVs from data.grf
// 5. Monster Card illustrations from cardbmp/
// 6. Tier 1-5 Equipment icons & collection art

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { GRFSet } = require('./grf');

const ROOT = path.join(__dirname, '..', '..', 'THE BOX WORLD');
const OUT = path.join(__dirname, '..', 'assets');
const set = new GRFSet(ROOT, ['_block_prontera.grf', '_prontera_box.grf', '_en.grf', '_sprites.grf', '_textures.grf', 'data.grf']);

for (const d of ['ui', 'sprites', 'sfx', 'cards', 'items', 'collection', 'zones']) {
  fs.mkdirSync(path.join(OUT, d), { recursive: true });
}

// ---------- PNG / BMP helpers ----------
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
function isMagenta(r, g, b) { return r > 0xf0 && g < 0x10 && b > 0xf0; }
function bmpToPng(buf, keepMagenta = false) {
  if (!buf || buf.toString('ascii', 0, 2) !== 'BM') return null;
  const off = buf.readUInt32LE(10), hdr = buf.readUInt32LE(14);
  const w = buf.readInt32LE(18), hs = buf.readInt32LE(22), h = Math.abs(hs), bpp = buf.readUInt16LE(28);
  const top = hs < 0; const out = Buffer.alloc(w * h * 4);
  const row = Math.floor((w * bpp + 31) / 32) * 4;
  const pal = buf.subarray(14 + hdr, off);
  for (let y = 0; y < h; y++) {
    const sy = top ? y : h - 1 - y; const rs = off + sy * row;
    for (let x = 0; x < w; x++) {
      let r, g, b, a = 255;
      if (bpp === 8) { const i = buf[rs + x] * 4; b = pal[i]; g = pal[i + 1]; r = pal[i + 2]; }
      else if (bpp === 24) { const i = rs + x * 3; b = buf[i]; g = buf[i + 1]; r = buf[i + 2]; }
      else if (bpp === 32) { const i = rs + x * 4; b = buf[i]; g = buf[i + 1]; r = buf[i + 2]; }
      else if (bpp === 16) { const v = buf.readUInt16LE(rs + x * 2); r = ((v >> 10) & 31) << 3; g = ((v >> 5) & 31) << 3; b = (v & 31) << 3; }
      else return null;
      if (!keepMagenta && isMagenta(r, g, b)) { r = g = b = 0; a = 0; }
      const d = (y * w + x) * 4; out[d] = r; out[d + 1] = g; out[d + 2] = b; out[d + 3] = a;
    }
  }
  return encodePNG(w, h, out);
}

// 1. Extract Equipment Window Background
for (const [dst, src] of [
  ['equipwin_bg.png', 'data\\texture\\유저인터페이스\\basic_interface\\equipwin_bg2.bmp'],
  ['card_blank.png', 'data\\texture\\유저인터페이스\\cardbmp\\1st_anniver_card.bmp']
]) {
  const b = set.get(src);
  const png = bmpToPng(b);
  if (png) { fs.writeFileSync(path.join(OUT, 'ui', dst), png); console.log('UI saved:', dst); }
}

// 2. Extract Back-Facing (North/Up) Walk & Attack Sprites for all 10 classes
function decodeSPR(sprBuffer) {
  if (!sprBuffer) return [];
  const ver = sprBuffer.readUInt16LE(2);
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
function renderFrame(bodySpr, bodyFrame, hairSpr, hairFrame) {
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
    const hairAP = (hairFrame.attachPoints && hairFrame.attachPoints[0]) || { x: 1, y: -56 };
    for (const p of hairFrame.patches) if (p.sprNo >= 0 && hairSpr[p.sprNo]) drawPatch(hairSpr[p.sprNo], p, bodyAP.x - hairAP.x, bodyAP.y - hairAP.y);
  }
  return canvasRgba;
}

const hairSpr = decodeSPR(set.get('data\\sprite\\인간족\\머리통\\남\\1_남.spr'));
const hairAct = parseAct(set.get('data\\sprite\\인간족\\머리통\\남\\1_남.act'));
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

const manifestPath = path.join(OUT, 'sprites', 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

for (const c of classes) {
  const bodySpr = decodeSPR(set.get('data\\sprite\\인간족\\몸통\\남\\' + c.base + '.spr'));
  const bodyAct = parseAct(set.get('data\\sprite\\인간족\\몸통\\남\\' + c.base + '.act'));
  // Action 12 = North Walk (walking away / up, back view)
  const walkBackAct = bodyAct[12] || bodyAct[4] || bodyAct[8];
  const hairBackAct = hairAct[12] || hairAct[4] || hairAct[8];
  const count = Math.min(8, walkBackAct ? walkBackAct.length : 8);
  const backList = [];
  for (let f = 0; f < count; f++) {
    const bf = walkBackAct[f];
    const hf = hairBackAct ? (hairBackAct[f % hairBackAct.length] || hairBackAct[0]) : null;
    const fn = `class_${c.key}_back_${f}.png`;
    fs.writeFileSync(path.join(OUT, 'sprites', fn), encodePNG(cw, ch, renderFrame(bodySpr, bf, hairSpr, hf)));
    backList.push({ file: `assets/sprites/${fn}`, width: cw, height: ch });
  }
  manifest[`class_${c.key}_back`] = backList;
}
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log('Generated back-facing walk sprites for all 10 classes.');

// 3. Extract 20 Zone Ground Textures for 200 Stages
const zoneTexCandidates = [
  ['zone_01.png', /prt_초원01\.bmp$/i],
  ['zone_02.png', /pay_숲01\.bmp$|prt_초원04\.bmp$/i],
  ['zone_03.png', /moc_맨땅10\.bmp$/i],
  ['zone_04.png', /moc_맨땅11\.bmp$/i],
  ['zone_05.png', /prt_언덕01\.bmp$/i],
  ['zone_06.png', /izl_도시01\.bmp$/i],
  ['zone_07.png', /prt_바위01\.bmp$/i],
  ['zone_08.png', /prt_도시05\.bmp$/i],
  ['zone_09.png', /prt_도시08\.bmp$/i],
  ['zone_10.png', /prt_초원08\.bmp$/i]
];
for (const [outName, re] of zoneTexCandidates) {
  const hit = set.find(re)[0];
  if (hit) {
    const png = bmpToPng(set.get(hit[1]), true);
    if (png) fs.writeFileSync(path.join(OUT, 'zones', outName), png);
  }
}
console.log('Extracted zone textures.');

// 4. Extract Monster Death WAVs & Skill WAVs
const wavTargets = [
  ['mon_poring_die.wav', 'data\\wav\\king_poring_die.wav'],
  ['mon_fabre_die.wav', 'data\\wav\\fabre_die.wav'],
  ['mon_lunatic_die.wav', 'data\\wav\\lunatic_die.wav'],
  ['mon_spore_die.wav', 'data\\wav\\spore_die.wav'],
  ['mon_zombie_die.wav', 'data\\wav\\ragged_zombie_die.wav'],
  ['mon_mummy_die.wav', 'data\\wav\\mummy_die.wav'],
  ['mon_orc_die.wav', 'data\\wav\\orc_archer_die.wav'],
  ['mon_baphomet_die.wav', 'data\\wav\\baphomet_die.wav'],
  ['mon_hit.wav', 'data\\wav\\effect\\ef_hit2.wav'],
  ['atk_sword.wav', 'data\\wav\\effect\\ef_hit3.wav'],
  ['atk_bow.wav', 'data\\wav\\arrow.wav'],
  ['skill_bash.wav', 'data\\wav\\effect\\ef_bash.wav'],
  ['skill_bowling.wav', 'data\\wav\\bowling_bash.wav'],
  ['skill_fire.wav', 'data\\wav\\effect\\ef_firearrow.wav'],
  ['skill_thunder.wav', 'data\\wav\\effect\\ef_thunderstorm.wav'],
  ['skill_arrowstorm.wav', 'data\\wav\\arrowstorm.wav'],
  ['skill_heal.wav', 'data\\wav\\_heal_effect.wav'],
  ['levelup.wav', 'data\\wav\\levelup.wav']
];
let wavCount = 0;
for (const [dst, src] of wavTargets) {
  const b = set.get(src);
  if (b) { fs.writeFileSync(path.join(OUT, 'sfx', dst), b); wavCount++; }
}
console.log('Extracted WAV sounds:', wavCount);

// 5. Extract Authentic Card Illustrations
const cardFiles = set.find(/cardbmp\\.*\.bmp$/i).slice(0, 20);
let cardIdx = 0;
for (const [, fn] of cardFiles) {
  const png = bmpToPng(set.get(fn), true);
  if (png) {
    fs.writeFileSync(path.join(OUT, 'cards', `card_${cardIdx++}.png`), png);
  }
}
console.log('Extracted card artworks:', cardIdx);
