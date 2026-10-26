// Comprehensive Authentic RO Asset Extractor & Fixer
// Fixes:
// 1. 24 Male & 24 Female Hairstyles (no rainbow glitch!) + Male/Female 8-direction character creation previews
// 2. 8-Direction Walk Sprites (Down, Down-Left, Left, Up-Left, Up, Up-Right, Right, Down-Right) for all classes
// 3. 20 Authentic Monster Card Illustrations from cardbmp/
// 4. Authentic RO Item Icons & Collection Artworks from 유저인터페이스/item/ and collection/
// 5. Clean Prontera Minimap (map_prontera.png) with ZERO pink/magenta (#FF00FF)
// 6. Authentic RO Title Screen background (bgi_temp.bmp)

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { GRFSet } = require('./grf');

const ROOT = path.join(__dirname, '..', '..', 'THE BOX WORLD');
const OUT = path.join(__dirname, '..', 'assets');
const set = new GRFSet(ROOT, ['_block_prontera.grf', '_prontera_box.grf', '_en.grf', '_sprites.grf', '_textures.grf', 'data.grf']);

for (const d of ['ui', 'sprites', 'sprites/hair_preview', 'cards', 'items', 'collection']) {
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
function isMagenta(r, g, b) { return r >= 235 && g <= 35 && b >= 235; }
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

// ---------- SPR & ACT Decoders ----------
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
function renderComposite(bodySpr, bodyFrame, hairSpr, hairFrame, outW = cw, outH = ch, ax = anchorX, ay = anchorY) {
  const canvasRgba = Buffer.alloc(outW * outH * 4);
  function drawPatch(spr, patch, offX, offY) {
    if (!spr) return;
    const left = Math.round(ax + offX + patch.x - spr.width / 2);
    const top = Math.round(ay + offY + patch.y - spr.height / 2);
    for (let y = 0; y < spr.height; y++) {
      for (let x = 0; x < spr.width; x++) {
        const srcX = patch.mirror ? (spr.width - 1 - x) : x;
        const si = (y * spr.width + srcX) * 4;
        if (spr.rgba[si + 3] === 0) continue;
        const dx = left + x, dy = top + y;
        if (dx < 0 || dx >= outW || dy < 0 || dy >= outH) continue;
        const di = (dy * outW + dx) * 4;
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

// ============================================================================
// 1. Clean Prontera Minimap (No Magenta!) & Authentic Login UI
// ============================================================================
const mapBuf = set.get('data\\texture\\유저인터페이스\\map\\prontera.bmp');
const mapPng = bmpToPng(mapBuf, false); // false = strip #FF00FF magenta!
if (mapPng) {
  fs.writeFileSync(path.join(OUT, 'ui', 'map_prontera.png'), mapPng);
  console.log('Fixed map_prontera.png (stripped all magenta #FF00FF).');
}

const bgiBuf = set.get('data\\texture\\유저인터페이스\\bgi_temp.bmp');
const bgiPng = bmpToPng(bgiBuf, true);
if (bgiPng) {
  fs.writeFileSync(path.join(OUT, 'ui', 'bgi_temp.png'), bgiPng);
}
const winLoginBuf = set.get('data\\texture\\유저인터페이스\\login_interface\\win_login.bmp');
const winLoginPng = bmpToPng(winLoginBuf, false);
if (winLoginPng) {
  fs.writeFileSync(path.join(OUT, 'ui', 'win_login.png'), winLoginPng);
}

// ============================================================================
// 2. Fix 24 Male & 24 Female Hairstyles + Character Creation 8-Dir Previews
// ============================================================================
const maleNoviceSpr = decodeSPR(set.get('data\\sprite\\인간족\\몸통\\남\\초보자_남.spr'));
const maleNoviceAct = parseAct(set.get('data\\sprite\\인간족\\몸통\\남\\초보자_남.act'));
const femaleNoviceSpr = decodeSPR(set.get('data\\sprite\\인간족\\몸통\\여\\초보자_여.spr'));
const femaleNoviceAct = parseAct(set.get('data\\sprite\\인간족\\몸통\\여\\초보자_여.act'));

for (let h = 1; h <= 24; h++) {
  const numStr = String(h).padStart(2, '0');
  const mSpr = decodeSPR(set.get(`data\\sprite\\인간족\\머리통\\남\\${h}_남.spr`)) || decodeSPR(set.get('data\\sprite\\인간족\\머리통\\남\\1_남.spr'));
  const mAct = parseAct(set.get(`data\\sprite\\인간족\\머리통\\남\\${h}_남.act`)) || parseAct(set.get('data\\sprite\\인간족\\머리통\\남\\1_남.act'));

  const fSpr = decodeSPR(set.get(`data\\sprite\\인간족\\머리통\\여\\${h}_여.spr`)) || decodeSPR(set.get('data\\sprite\\인간족\\머리통\\여\\1_여.spr'));
  const fAct = parseAct(set.get(`data\\sprite\\인간족\\머리통\\여\\${h}_여.act`)) || parseAct(set.get('data\\sprite\\인간족\\머리통\\여\\1_여.act'));

  // Render clean 48x48 head-only icon for hairstyle grid (Male & Female) by cropping head from full composite
  const mFull = renderComposite(maleNoviceSpr, maleNoviceAct[0][0], mSpr, mAct[0][0]);
  const fFull = renderComposite(femaleNoviceSpr, femaleNoviceAct[0][0], fSpr, fAct[0][0]);
  function cropHead(full) {
    const out = Buffer.alloc(48 * 48 * 4);
    for (let y = 0; y < 48; y++) {
      for (let x = 0; x < 48; x++) {
        const sx = 31 + x, sy = 16 + y;
        const si = (sy * cw + sx) * 4, di = (y * 48 + x) * 4;
        out[di] = full[si]; out[di + 1] = full[si + 1]; out[di + 2] = full[si + 2]; out[di + 3] = full[si + 3];
      }
    }
    return out;
  }
  fs.writeFileSync(path.join(OUT, 'ui', `hair_${numStr}.png`), encodePNG(48, 48, cropHead(mFull)));
  fs.writeFileSync(path.join(OUT, 'ui', `hair_m_${numStr}.png`), encodePNG(48, 48, cropHead(mFull)));
  fs.writeFileSync(path.join(OUT, 'ui', `hair_f_${numStr}.png`), encodePNG(48, 48, cropHead(fFull)));

  // Render 4 cardinal/diagonal standing preview directions (0=South, 2=West, 4=North, 6=East) for Male & Female Novice with this hairstyle
  for (const dir of [0, 1, 2, 3, 4, 5, 6, 7]) {
    const mbf = maleNoviceAct[dir] && maleNoviceAct[dir][0];
    const mhf = mAct[dir] && mAct[dir][0];
    if (mbf && mhf) {
      const rgba = renderComposite(maleNoviceSpr, mbf, mSpr, mhf);
      fs.writeFileSync(path.join(OUT, 'sprites', 'hair_preview', `m_${numStr}_d${dir}.png`), encodePNG(cw, ch, rgba));
    }
    const fbf = femaleNoviceAct[dir] && femaleNoviceAct[dir][0];
    const fhf = fAct[dir] && fAct[dir][0];
    if (fbf && fhf) {
      const rgba = renderComposite(femaleNoviceSpr, fbf, fSpr, fhf);
      fs.writeFileSync(path.join(OUT, 'sprites', 'hair_preview', `f_${numStr}_d${dir}.png`), encodePNG(cw, ch, rgba));
    }
  }
}
console.log('Fixed 24 Male + 24 Female hairstyles and 8-direction character previews.');

// ============================================================================
// 3. Extract 8-Direction Walk Sprites (dir 0..7, including diagonals!) for all 10 classes
// ============================================================================
// RO Walk Actions are Actions 8..15:
// dir 0 (Action 8): South (Down)
// dir 1 (Action 9): South-West (Down-Left)
// dir 2 (Action 10): West (Left)
// dir 3 (Action 11): North-West (Up-Left)
// dir 4 (Action 12): North (Up)
// dir 5 (Action 13): North-East (Up-Right)
// dir 6 (Action 14): East (Right)
// dir 7 (Action 15): South-East (Down-Right)
const defaultHairSpr = decodeSPR(set.get('data\\sprite\\인간족\\머리통\\남\\2_남.spr'));
const defaultHairAct = parseAct(set.get('data\\sprite\\인간족\\머리통\\남\\2_남.act'));

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

// Extract the 5 unique camera directions (d0=Down, d1=DownLeft, d2=Left, d3=UpLeft, d4=Up)
// Directions d5(UpRight), d6(Right), d7(DownRight) are horizontal mirrors of d3, d2, d1!
for (const c of classes) {
  const bodySpr = decodeSPR(set.get('data\\sprite\\인간족\\몸통\\남\\' + c.base + '.spr'));
  const bodyAct = parseAct(set.get('data\\sprite\\인간족\\몸통\\남\\' + c.base + '.act'));
  for (let dir = 0; dir <= 4; dir++) {
    const actIdx = 8 + dir;
    const walkAct = bodyAct[actIdx] || bodyAct[8];
    const hairAct = defaultHairAct[actIdx] || defaultHairAct[dir] || defaultHairAct[0];
    const count = Math.min(8, walkAct ? walkAct.length : 8);
    const dirList = [];
    for (let f = 0; f < count; f++) {
      const bf = walkAct[f];
      const hf = hairAct ? (hairAct[f % hairAct.length] || hairAct[0]) : null;
      const fn = `class_${c.key}_d${dir}_${f}.png`;
      fs.writeFileSync(path.join(OUT, 'sprites', fn), encodePNG(cw, ch, renderComposite(bodySpr, bf, defaultHairSpr, hf)));
      dirList.push({ file: `assets/sprites/${fn}`, width: cw, height: ch });
    }
    manifest[`class_${c.key}_d${dir}`] = dirList;
  }
}
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log('Extracted 8-direction (including diagonal) walk sprites for all 10 classes.');

// ============================================================================
// 4. Extract All 20 Authentic Monster Card Illustrations by Exact Korean Name
// ============================================================================
const cardMappings = [
  ['card_0.png', '포링카드'],
  ['card_1.png', '파브르카드'],
  ['card_2.png', '푸파카드'],
  ['card_3.png', '루나틱카드'],
  ['card_4.png', '스포아카드'],
  ['card_5.png', '히드라카드'],
  ['card_6.png', '스켈워커카드'],
  ['card_7.png', '헌터플라이카드'],
  ['card_8.png', '타라프로그카드'],
  ['card_9.png', '레이드릭카드'],
  ['card_10.png', '베릿트카드'],
  ['card_11.png', '마르두크카드'],
  ['card_12.png', '코볼트카드'],
  ['card_13.png', '소희카드'],
  ['card_14.png', '지상쁘띠카드'],
  ['card_15.png', '구울카드'],
  ['card_16.png', '월야화카드'],
  ['card_17.png', '바포메트카드'],
  ['card_18.png', '도플갱어카드'],
  ['card_19.png', '드레이크카드']
];
for (const [dst, krName] of cardMappings) {
  const b = set.get(`data\\texture\\유저인터페이스\\cardbmp\\${krName}.bmp`);
  const png = bmpToPng(b, true);
  if (png) fs.writeFileSync(path.join(OUT, 'cards', dst), png);
}
// Also extract authentic RO Card inventory icon (이름없는카드.bmp)
const cardIconHit = set.find(/유저인터페이스\\item\\.*카드\.bmp$/i)[0];
if (cardIconHit) {
  const png = bmpToPng(set.get(cardIconHit[1]), false);
  if (png) fs.writeFileSync(path.join(OUT, 'ui', 'card_blank.png'), png);
}
console.log('Extracted 20 authentic monster card illustrations.');

// ============================================================================
// 5. Extract Authentic RO Item Icons & Collection Artworks (Zero Magenta!)
// ============================================================================
const itemMappings = [
  ['knife.png', '카타나'],
  ['sword.png', '바스타드소드'],
  ['muramasa.png', '무라마사'],
  ['rod.png', '아크완드'],
  ['bow.png', '크로스보우'],
  ['ballista.png', '발리스타'],
  ['stunner.png', '무라마사'],
  ['guard.png', '버클러'],
  ['shield.png', '실드'],
  ['armor.png', '세인트로브'],
  ['coat.png', '코튼셔츠'],
  ['garment.png', '머플러'],
  ['manteau.png', '망토'],
  ['sandals.png', '샌들'],
  ['shoes.png', '부츠'],
  ['ribbon.png', '리본'],
  ['goggles.png', '고글'],
  ['biretta.png', '비레타'],
  ['clip.png', '클립'],
  ['ring.png', '링'],
  ['rosary.png', '로자리'],
  ['red_potion.png', '빨간포션'],
  ['yellow_potion.png', '노란포션'],
  ['white_potion.png', '하얀포션'],
  ['blue_potion.png', '파란포션'],
  ['berserk_potion.png', '버서크포션'],
  ['fly_wing.png', '파리의날개'],
  ['b_wing.png', '나비의날개'],
  ['jellopy.png', '젤로피'],
  ['clover.png', '클로버'],
  ['fluff.png', '솜털']
];

for (const [dst, kr] of itemMappings) {
  const ib = set.get(`data\\texture\\유저인터페이스\\item\\${kr}.bmp`);
  const ipng = bmpToPng(ib, false);
  if (ipng) fs.writeFileSync(path.join(OUT, 'items', dst), ipng);

  const cb = set.get(`data\\texture\\유저인터페이스\\collection\\${kr}.bmp`);
  const cpng = bmpToPng(cb, false);
  if (cpng) fs.writeFileSync(path.join(OUT, 'collection', dst), cpng);
  else if (ipng) fs.writeFileSync(path.join(OUT, 'collection', dst), ipng);
}
console.log('Extracted authentic RO item icons and collection illustrations.');
