const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { GRFSet } = require('./tools/grf');
const { parseGND, parseRSW } = require('./tools/romap');

const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname);
const BOX_DIR = path.join(__dirname, '..', 'THE BOX WORLD');
const CLIENT_BGM = path.join(BOX_DIR, 'BGM');
const FULL_DB_PATH = path.join(ROOT, 'assets', 'data', 'ro_full_db.json');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.bin': 'application/octet-stream',
  '.ico': 'image/x-icon'
};

// ============================================================================
// PNG Encoder + BMP / SPR / ACT / GND Decoders
// ============================================================================
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

function decodeBmpRaw(buf, stripMagenta = false) {
  if (!buf || buf.length < 54 || buf.toString('ascii', 0, 2) !== 'BM') return null;
  const pixelOffset = buf.readUInt32LE(10);
  const headerSize = buf.readUInt32LE(14);
  const width = buf.readInt32LE(18);
  const rawHeight = buf.readInt32LE(22);
  const topDown = rawHeight < 0;
  const height = Math.abs(rawHeight);
  if (width <= 0 || height <= 0 || width > 2048 || height > 2048) return null;
  const bpp = buf.readUInt16LE(28);
  const rgba = Buffer.alloc(width * height * 4);

  if (bpp === 8) {
    const palOffset = 14 + headerSize;
    const rowStride = (width + 3) & ~3;
    for (let y = 0; y < height; y++) {
      const srcY = topDown ? y : (height - 1 - y);
      const rowStart = pixelOffset + srcY * rowStride;
      for (let x = 0; x < width; x++) {
        const idx = buf[rowStart + x];
        const b = buf[palOffset + idx * 4];
        const g = buf[palOffset + idx * 4 + 1];
        const r = buf[palOffset + idx * 4 + 2];
        const dst = (y * width + x) * 4;
        if (stripMagenta && r >= 245 && g <= 12 && b >= 245) {
          rgba[dst + 3] = 0;
        } else {
          rgba[dst] = r; rgba[dst + 1] = g; rgba[dst + 2] = b; rgba[dst + 3] = 255;
        }
      }
    }
  } else if (bpp === 24 || bpp === 32) {
    const bytesPerPx = bpp / 8;
    const rowStride = (width * bytesPerPx + 3) & ~3;
    for (let y = 0; y < height; y++) {
      const srcY = topDown ? y : (height - 1 - y);
      const rowStart = pixelOffset + srcY * rowStride;
      for (let x = 0; x < width; x++) {
        const pOff = rowStart + x * bytesPerPx;
        const b = buf[pOff];
        const g = buf[pOff + 1];
        const r = buf[pOff + 2];
        const dst = (y * width + x) * 4;
        if (stripMagenta && r >= 245 && g <= 12 && b >= 245) {
          rgba[dst + 3] = 0;
        } else {
          rgba[dst] = r; rgba[dst + 1] = g; rgba[dst + 2] = b; rgba[dst + 3] = 255;
        }
      }
    }
  } else if (bpp === 16) {
    const rowStride = Math.floor((width * 16 + 31) / 32) * 4;
    for (let y = 0; y < height; y++) {
      const srcY = topDown ? y : (height - 1 - y);
      const rowStart = pixelOffset + srcY * rowStride;
      for (let x = 0; x < width; x++) {
        const v = buf.readUInt16LE(rowStart + x * 2);
        const r = ((v >> 10) & 31) << 3;
        const g = ((v >> 5) & 31) << 3;
        const b = (v & 31) << 3;
        const dst = (y * width + x) * 4;
        rgba[dst] = r; rgba[dst + 1] = g; rgba[dst + 2] = b; rgba[dst + 3] = 255;
      }
    }
  } else {
    return null;
  }
  return { w: width, h: height, rgba };
}

function decodeBmpToPng(buf, stripMagenta = true) {
  const res = decodeBmpRaw(buf, stripMagenta);
  return res ? encodePNG(res.w, res.h, res.rgba) : null;
}

function decodeSPR(sprBuffer, palBuffer = null, tintRgb = null) {
  if (!sprBuffer || sprBuffer.length < 8) return [];
  const ver = sprBuffer.readUInt16LE(2);
  const indexedCount = sprBuffer.readUInt16LE(4);
  const palette = (palBuffer && palBuffer.length >= 1024) ? palBuffer : sprBuffer.subarray(sprBuffer.length - 1024);
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
        let r = palette[c * 4];
        let g = palette[c * 4 + 1];
        let b = palette[c * 4 + 2];
        if (tintRgb) {
          r = Math.min(255, Math.round(r * tintRgb[0]));
          g = Math.min(255, Math.round(g * tintRgb[1]));
          b = Math.min(255, Math.round(b * tintRgb[2]));
        }
        rgba[i * 4] = r;
        rgba[i * 4 + 1] = g;
        rgba[i * 4 + 2] = b;
        rgba[i * 4 + 3] = 255;
      }
    }
    frames.push({ width: w, height: h, rgba });
  }
  return frames;
}

function parseAct(buf) {
  if (!buf || buf.length < 16) return [];
  let p = 2;
  const subVersion = buf.readUInt8(p++);
  const version = buf.readUInt8(p++);
  const numActions = buf.readUInt16LE(p); p += 12;
  const actions = [];
  for (let a = 0; a < numActions; a++) {
    if (p + 4 > buf.length) break;
    const numFrames = buf.readUInt32LE(p); p += 4;
    const frames = [];
    for (let f = 0; f < numFrames; f++) {
      if (p + 36 > buf.length) break;
      p += 32;
      const numPatches = buf.readUInt32LE(p); p += 4;
      const patches = [];
      for (let pt = 0; pt < numPatches; pt++) {
        if (p + 20 > buf.length) break;
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
        if (p + 4 <= buf.length) {
          const numAP = buf.readUInt32LE(p); p += 4;
          for (let ap = 0; ap < numAP; ap++) {
            if (p + 16 > buf.length) break;
            p += 4;
            const ax = buf.readInt32LE(p); p += 4;
            const ay = buf.readInt32LE(p); p += 8;
            attachPoints.push({ x: ax, y: ay });
          }
        }
      }
      frames.push({ patches, attachPoints });
    }
    actions.push(frames);
  }
  return actions;
}

// ============================================================================
// Load GRF Archives & ro_full_db.json
// ============================================================================
function asciiLowerStr(buf) {
  let s = '';
  for (let i = 0; i < buf.length; i++) {
    let b = buf[i];
    if (b >= 0x41 && b <= 0x5A) b += 32;
    s += String.fromCharCode(b);
  }
  return s;
}

let texFd = null;
const texIndex = new Map();
let itemResMap = {};
let cardIllustHexMap = {};
let defaultCardRaw = '';
let grfSet = null;

const UI_PREFIX = Buffer.from([
  0x64,0x61,0x74,0x61,0x5c,0x74,0x65,0x78,0x74,0x75,0x72,0x65,0x5c,
  0xc0,0xaf,0xc0,0xfa,0xc0,0xce,0xc5,0xcd,0xc6,0xe4,0xc0,0xcc,0xbd,0xba,0x5c
]).toString('latin1');

try {
  grfSet = new GRFSet(BOX_DIR, ['_block_prontera.grf', '_prontera_box.grf', '_en.grf', '_sprites.grf', '_textures.grf', 'data.grf']);
  const texGrfPath = path.join(BOX_DIR, '_textures.grf');
  if (fs.existsSync(texGrfPath)) {
    texFd = fs.openSync(texGrfPath, 'r');
    const h = Buffer.alloc(46);
    fs.readSync(texFd, h, 0, 46, 0);
    const off = Number(BigInt(h.readUInt32LE(30)) + 46n);
    const th = Buffer.alloc(8);
    fs.readSync(texFd, th, 0, 8, off);
    const compBuf = Buffer.alloc(th.readUInt32LE(0));
    fs.readSync(texFd, compBuf, 0, compBuf.length, off + 8);
    const tbl = zlib.inflateSync(compBuf);
    let pos = 0;
    while (pos < tbl.length) {
      let end = pos;
      while (end < tbl.length && tbl[end] !== 0) end++;
      if (end >= tbl.length) break;
      const rawKey = asciiLowerStr(tbl.slice(pos, end));
      const meta = tbl.slice(end + 1, end + 1 + 17);
      pos = end + 1 + 17;
      texIndex.set(rawKey, {
        cSize: meta.readUInt32LE(0),
        cAlign: meta.readUInt32LE(4),
        uSize: meta.readUInt32LE(8),
        flags: meta[12],
        offset: meta.readUInt32LE(13) + 46
      });
    }
    console.log(`[GRF] Indexed _textures.grf (${texIndex.size} files) + Full GRFSet`);
  }
  if (fs.existsSync(FULL_DB_PATH)) {
    const db = JSON.parse(fs.readFileSync(FULL_DB_PATH, 'utf8'));
    itemResMap = db.itemResMap || {};
    cardIllustHexMap = db.cardIllustHexMap || {};
    defaultCardRaw = cardIllustHexMap[4001] || '';
    console.log(`[DB] Loaded RO Full DB: ${db.counts?.totalItems || 0} items, ${db.counts?.maps || 0} maps`);
  }
} catch (err) {
  console.error('[GRF/DB Init Error]:', err);
}

const pngCache = new Map();
function getGrfBmpAsPng(rawKey, stripMagenta = true) {
  if (pngCache.has(rawKey)) return pngCache.get(rawKey);
  if (!texFd) return null;
  const entry = texIndex.get(rawKey);
  if (!entry) return null;
  try {
    const b = Buffer.alloc(entry.cAlign);
    fs.readSync(texFd, b, 0, entry.cAlign, entry.offset);
    const uncomp = entry.cSize === entry.uSize ? b.slice(0, entry.uSize) : zlib.inflateSync(b.slice(0, entry.cSize));
    const png = decodeBmpToPng(uncomp, stripMagenta);
    if (png) {
      if (pngCache.size > 3000) pngCache.clear();
      pngCache.set(rawKey, png);
    }
    return png;
  } catch (_e) {
    return null;
  }
}

// Render real .gnd 3D ground map for ANY of the 1,272 RO Maps!
const groundMapCache = new Map();
function renderGroundMapPng(mapCode) {
  const key = mapCode.toLowerCase();
  if (groundMapCache.has(key)) return groundMapCache.get(key);
  if (!grfSet) return null;
  try {
    let gndName = `${key}.gnd`;
    const rswBuf = grfSet.get(`data\\${key}.rsw`);
    if (rswBuf) {
      try { const rsw = parseRSW(rswBuf); if (rsw && rsw.gnd) gndName = rsw.gnd; } catch (_e) {}
    }
    const gndBuf = grfSet.get(`data\\${gndName}`) || grfSet.get(`data\\${key}.gnd`);
    if (!gndBuf) return null;

    const gnd = parseGND(gndBuf);
    const texImgs = gnd.textures.map(t => decodeBmpRaw(grfSet.get(`data\\texture\\${t}`), false));
    const cellPx = gnd.width > 220 ? 6 : 8;
    const W = gnd.width * cellPx;
    const H = gnd.height * cellPx;
    const out = Buffer.alloc(W * H * 4);

    for (let cy = 0; cy < gnd.height; cy++) {
      const ry = gnd.height - 1 - cy;
      for (let cx = 0; cx < gnd.width; cx++) {
        const c = gnd.cubes[cx + cy * gnd.width];
        const s = c.up > -1 ? gnd.surfaces[c.up] : null;
        const tex = (s && s.tex > -1) ? texImgs[s.tex] : null;
        const lmBase = (s && s.lm > -1) ? s.lm * 256 : -1;
        for (let py = 0; py < cellPx; py++) {
          const vf = py / cellPx;
          for (let px = 0; px < cellPx; px++) {
            const uf = px / cellPx;
            const di = ((ry * cellPx + py) * W + (cx * cellPx + px)) * 4;
            if (!tex) {
              out[di] = 28; out[di + 1] = 34; out[di + 2] = 42; out[di + 3] = 255;
              continue;
            }
            const u = (1 - uf) * (1 - vf) * s.u[0] + uf * (1 - vf) * s.u[1] + (1 - uf) * vf * s.u[2] + uf * vf * s.u[3];
            const v = (1 - uf) * (1 - vf) * s.v[0] + uf * (1 - vf) * s.v[1] + (1 - uf) * vf * s.v[2] + uf * vf * s.v[3];
            const tx = Math.max(0, Math.min(tex.w - 1, Math.floor((((u % 1) + 1) % 1) * tex.w)));
            const ty = Math.max(0, Math.min(tex.h - 1, Math.floor((((v % 1) + 1) % 1) * tex.h)));
            const ti = (ty * tex.w + tx) * 4;
            let r = tex.rgba[ti] * s.color[0];
            let g = tex.rgba[ti + 1] * s.color[1];
            let b = tex.rgba[ti + 2] * s.color[2];
            if (lmBase >= 0) {
              const lx = Math.min(7, Math.floor(uf * 7) + 1);
              const ly = Math.min(7, Math.floor(vf * 7) + 1);
              const li = ly * 8 + lx;
              const sh = Math.max(0.45, gnd.lightmaps[lmBase + li] / 255);
              r = Math.min(255, r * sh + gnd.lightmaps[lmBase + 64 + li * 3] * 0.25);
              g = Math.min(255, g * sh + gnd.lightmaps[lmBase + 64 + li * 3 + 1] * 0.25);
              b = Math.min(255, b * sh + gnd.lightmaps[lmBase + 64 + li * 3 + 2] * 0.25);
            }
            out[di] = r; out[di + 1] = g; out[di + 2] = b; out[di + 3] = 255;
          }
        }
      }
    }
    const png = encodePNG(W, H, out);
    if (groundMapCache.size > 40) groundMapCache.clear();
    groundMapCache.set(key, png);
    return png;
  } catch (e) {
    return null;
  }
}

// Render any of the 2,057 Monster .spr + .act walk frames onto a fixed 140x140 canvas!
// Supports both 8-dir: <sprName>_d<0..7>_<frameIdx> and legacy: <sprName>_[fb]<0..3>
const monsterSprCache = new Map();
function getMonsterFramePng(targetSpec) {
  if (pngCache.has(`mon_${targetSpec}`)) return pngCache.get(`mon_${targetSpec}`);
  if (!grfSet) return null;

  let sprName, dirIdx = 0, frameIdx = 0;
  const m8 = targetSpec.match(/^(.+?)_d(\d+)_(\d+)$/i);
  if (m8) {
    sprName = m8[1].toLowerCase();
    dirIdx = parseInt(m8[2], 10) % 8;
    frameIdx = parseInt(m8[3], 10);
  } else {
    const m = targetSpec.match(/^(.+?)_([fb])(\d+)$/i);
    sprName = (m ? m[1] : targetSpec).toLowerCase();
    const dirMode = m ? m[2].toLowerCase() : 'f';
    dirIdx = dirMode === 'b' ? 4 : 0;
    frameIdx = m ? parseInt(m[3], 10) : 0;
  }

  try {
    let decoded = monsterSprCache.get(sprName);
    if (!decoded) {
      let sprBuf = grfSet.get(`data\\sprite\\몬스터\\${sprName}.spr`);
      let actBuf = grfSet.get(`data\\sprite\\몬스터\\${sprName}.act`);
      if (!sprBuf) {
        sprBuf = grfSet.get(`data\\sprite\\npc\\${sprName}.spr`);
        actBuf = grfSet.get(`data\\sprite\\npc\\${sprName}.act`);
      }
      decoded = {
        spr: decodeSPR(sprBuf),
        act: parseAct(actBuf)
      };
      if (monsterSprCache.size > 150) monsterSprCache.clear();
      monsterSprCache.set(sprName, decoded);
    }

    const { spr, act } = decoded;
    if (!spr || !spr.length) return null;

    const cw = 140, ch = 140, ax = 70, ay = 116;
    const canvasRgba = Buffer.alloc(cw * ch * 4);

    let actionIdx = 8 + dirIdx;
    let mirrorX = false;
    if (act.length <= 8) {
      actionIdx = dirIdx % act.length;
    } else if (act.length < 16) {
      // 5-direction monster format: 0..4 (South, SW, West, NW, North). Directions 5, 6, 7 mirror 3, 2, 1
      const mapDir = [0, 1, 2, 3, 4, 3, 2, 1][dirIdx % 8];
      mirrorX = dirIdx >= 5;
      actionIdx = 8 + mapDir;
      if (actionIdx >= act.length) actionIdx = 8;
    } else if (actionIdx >= act.length) {
      actionIdx = 8;
    }

    const walkAct = act[actionIdx] || act[8] || act[0];

    if (walkAct && walkAct.length > 0) {
      const actFrame = walkAct[frameIdx % walkAct.length];
      for (const patch of (actFrame.patches || [])) {
        if (patch.sprNo < 0 || !spr[patch.sprNo]) continue;
        const sf = spr[patch.sprNo];
        const px = mirrorX ? -patch.x : patch.x;
        const patchMirror = mirrorX ? !patch.mirror : Boolean(patch.mirror);
        const left = Math.round(ax + px - sf.width / 2);
        const top = Math.round(ay + patch.y - sf.height / 2);
        for (let y = 0; y < sf.height; y++) {
          for (let x = 0; x < sf.width; x++) {
            const srcX = patchMirror ? (sf.width - 1 - x) : x;
            const si = (y * sf.width + srcX) * 4;
            if (sf.rgba[si + 3] === 0) continue;
            const dx = left + x, dy = top + y;
            if (dx < 0 || dx >= cw || dy < 0 || dy >= ch) continue;
            const di = (dy * cw + dx) * 4;
            canvasRgba[di] = sf.rgba[si];
            canvasRgba[di + 1] = sf.rgba[si + 1];
            canvasRgba[di + 2] = sf.rgba[si + 2];
            canvasRgba[di + 3] = 255;
          }
        }
      }
    } else {
      const sf = spr[frameIdx % spr.length] || spr[0];
      if (!sf) return null;
      const left = Math.round(ax - sf.width / 2);
      const top = Math.round(ay - sf.height);
      for (let y = 0; y < sf.height; y++) {
        for (let x = 0; x < sf.width; x++) {
          const si = (y * sf.width + x) * 4;
          if (sf.rgba[si + 3] === 0) continue;
          const dx = left + x, dy = top + y;
          if (dx < 0 || dx >= cw || dy < 0 || dy >= ch) continue;
          const di = (dy * cw + dx) * 4;
          canvasRgba[di] = sf.rgba[si];
          canvasRgba[di + 1] = sf.rgba[si + 1];
          canvasRgba[di + 2] = sf.rgba[si + 2];
          canvasRgba[di + 3] = 255;
        }
      }
    }

    const png = encodePNG(cw, ch, canvasRgba);
    pngCache.set(`mon_${targetSpec}`, png);
    return png;
  } catch (_e) {
    return null;
  }
}

// ============================================================================
// Authentic RO Dynamic Player Character Compositing (Body + Hair + Palettes)
// Supports all 40 jobs, male & female, 30 hairstyles, and authentic hair dyes
// ============================================================================
const JOB_KOR_MAP = {
  novice: '초보자', swordsman: '검사', knight: '기사', lord_knight: '로드나이트', rune_knight: '룬나이트',
  crusader: '크루세이더', paladin: '팔라딘', royal_guard: '가드',
  mage: '마법사', wizard: '위저드', high_wizard: '하이위저드', warlock: '워록',
  sage: '세이지', professor: '프로페서', sorcerer: '소서러',
  archer: '궁수', hunter: '헌터', sniper: '스나이퍼', ranger: '레인져',
  thief: '도둑', assassin: '어세신', assassin_cross: '어쌔신크로스', guillotine_cross: '길로틴크로스',
  rogue: '로그', stalker: '스토커', shadow_chaser: '쉐도우체이서',
  acolyte: '성직자', priest: '프리스트', high_priest: '하이프리', arch_bishop: '아크비숍',
  monk: '몽크', champion: '챔피온', sura: '슈라',
  merchant: '상인', blacksmith: '제철공', whitesmith: '화이트스미스', mechanic: '미케닉',
  alchemist: '연금술사', creator: '크리에이터', genetic: '제네릭'
};

const HAIR_TINTS_RGB = {
  blonde: [1.0, 0.95, 0.7],
  brown: [0.65, 0.45, 0.28],
  black: [0.35, 0.35, 0.38],
  silver: [0.9, 0.92, 0.98],
  pink: [1.1, 0.6, 0.8],
  blue: [0.45, 0.65, 1.0],
  green: [0.5, 0.95, 0.6],
  purple: [0.75, 0.45, 0.95],
  red: [1.0, 0.35, 0.35]
};
const HAIR_PAL_MAP = {
  blonde: 1, brown: 3, black: 7, silver: 8, pink: 2, blue: 5, green: 6, purple: 2, red: 4
};

const charSprCache = new Map();
function getCharacterFramePng(targetSpec) {
  if (pngCache.has(`char_${targetSpec}`)) return pngCache.get(`char_${targetSpec}`);
  if (!grfSet) return null;

  // Pattern: <job>_<gender>_h<hairStyle>_c<hairColor>_<actionType>_d<dir>_<frameIdx>
  const m = targetSpec.match(/^([a-z_]+?)_([mf])_h(\d+)_c([a-z0-9]+)_([a-z]+)_d(\d+)_(\d+)$/i);
  if (!m) return null;

  const jobKey = m[1].toLowerCase();
  const gender = m[2].toLowerCase();
  const hairStyle = parseInt(m[3], 10) || 1;
  const hairColor = m[4].toLowerCase();
  const actionType = m[5].toLowerCase(); // 'stand' | 'walk' | 'atk'
  const dir = parseInt(m[6], 10) % 8;
  const frameIdx = parseInt(m[7], 10);

  const genderKor = (gender === 'f' || gender === 'female') ? '여' : '남';
  const jobKor = JOB_KOR_MAP[jobKey] || '초보자';

  try {
    const bodyCacheKey = `body_${jobKor}_${genderKor}`;
    let bodyDecoded = charSprCache.get(bodyCacheKey);
    if (!bodyDecoded) {
      const bSprBuf = grfSet.get(`data\\sprite\\인간족\\몸통\\${genderKor}\\${jobKor}_${genderKor}.spr`);
      const bActBuf = grfSet.get(`data\\sprite\\인간족\\몸통\\${genderKor}\\${jobKor}_${genderKor}.act`);
      if (!bSprBuf || !bActBuf) return null;
      bodyDecoded = { spr: decodeSPR(bSprBuf), act: parseAct(bActBuf) };
      if (charSprCache.size > 200) charSprCache.clear();
      charSprCache.set(bodyCacheKey, bodyDecoded);
    }

    const hairCacheKey = `hair_${hairStyle}_${genderKor}_${hairColor}`;
    let hairDecoded = charSprCache.get(hairCacheKey);
    if (!hairDecoded) {
      const hSprBuf = grfSet.get(`data\\sprite\\인간족\\머리통\\${genderKor}\\${hairStyle}_${genderKor}.spr`);
      const hActBuf = grfSet.get(`data\\sprite\\인간족\\머리통\\${genderKor}\\${hairStyle}_${genderKor}.act`);
      if (!hSprBuf || !hActBuf) return null;
      const tintRgb = HAIR_TINTS_RGB[hairColor] || null;
      const palIdx = HAIR_PAL_MAP[hairColor] ?? 0;
      let palBuf = palIdx > 0 ? grfSet.get(`data\\palette\\머리\\머리${hairStyle}_${genderKor}_${palIdx}.pal`) : null;
      hairDecoded = { spr: decodeSPR(hSprBuf, palBuf, tintRgb), act: parseAct(hActBuf) };
      charSprCache.set(hairCacheKey, hairDecoded);
    }

    const { spr: bSpr, act: bAct } = bodyDecoded;
    const { spr: hSpr, act: hAct } = hairDecoded;

    let baseAction = 8; // walk by default
    if (actionType === 'stand') baseAction = 0;
    else if (actionType === 'atk') baseAction = (bAct.length > 32 ? 32 : (bAct.length > 24 ? 24 : 8));

    const bActionIdx = (baseAction + dir) % bAct.length;
    const hActionIdx = (baseAction + dir) % hAct.length;

    const bAction = bAct[bActionIdx] || bAct[0];
    const hAction = hAct[hActionIdx] || hAct[0];

    const bf = bAction ? bAction[frameIdx % bAction.length] : null;
    const hf = hAction ? hAction[frameIdx % hAction.length] : null;

    const cw = 110, ch = 120, anchorX = 55, anchorY = 105;
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
          canvasRgba[di] = spr.rgba[si];
          canvasRgba[di + 1] = spr.rgba[si + 1];
          canvasRgba[di + 2] = spr.rgba[si + 2];
          canvasRgba[di + 3] = 255;
        }
      }
    }

    if (bf && bf.patches) {
      for (const p of bf.patches) if (p.sprNo >= 0 && bSpr[p.sprNo]) drawPatch(bSpr[p.sprNo], p, 0, 0);
    }
    if (hf && hf.patches) {
      const bodyAP = (bf && bf.attachPoints && bf.attachPoints[0]) || { x: 0, y: -56 };
      const hairAP = (hf.attachPoints && hf.attachPoints[0]) || { x: 0, y: -56 };
      for (const p of hf.patches) if (p.sprNo >= 0 && hSpr[p.sprNo]) drawPatch(hSpr[p.sprNo], p, bodyAP.x - hairAP.x, bodyAP.y - hairAP.y);
    }

    const png = encodePNG(cw, ch, canvasRgba);
    if (pngCache.size > 2500) pngCache.clear();
    pngCache.set(`char_${targetSpec}`, png);
    return png;
  } catch (_e) {
    return null;
  }
}

const server = http.createServer((req, res) => {
  let reqPath = decodeURI(req.url.split('?')[0]);
  if (reqPath === '/') reqPath = '/index.html';

  // Dynamic On-The-Fly GRF Asset Routes
  if (reqPath.startsWith('/grf/')) {
    const parts = reqPath.split('/');
    const kind = parts[2];
    const target = (parts[3] || '').replace(/\.png$/i, '');
    let png = null;

    if (kind === 'icon') {
      const resHex = itemResMap[target];
      if (resHex) {
        const resRaw = Buffer.from(resHex, 'hex').toString('latin1');
        png = getGrfBmpAsPng(`${UI_PREFIX}item\\${resRaw}.bmp`, true);
      }
    } else if (kind === 'collection') {
      const resHex = itemResMap[target];
      if (resHex) {
        const resRaw = Buffer.from(resHex, 'hex').toString('latin1');
        png = getGrfBmpAsPng(`${UI_PREFIX}collection\\${resRaw}.bmp`, true);
      }
    } else if (kind === 'card') {
      const illustHex = cardIllustHexMap[target] || defaultCardRaw;
      if (illustHex) {
        const illustRaw = Buffer.from(illustHex, 'hex').toString('latin1');
        png = getGrfBmpAsPng(`${UI_PREFIX}cardbmp\\${illustRaw}.bmp`, false);
      }
    } else if (kind === 'map') {
      const mapCode = target.toLowerCase();
      png = getGrfBmpAsPng(`${UI_PREFIX}map\\${mapCode}.bmp`, true);
    } else if (kind === 'groundmap') {
      png = renderGroundMapPng(target);
      if (!png) png = getGrfBmpAsPng(`${UI_PREFIX}map\\${target.toLowerCase()}.bmp`, false);
    } else if (kind === 'monster') {
      png = getMonsterFramePng(target);
    } else if (kind === 'character') {
      png = getCharacterFramePng(target);
    } else if (kind === 'skill') {
      const skCode = target.toLowerCase();
      png = getGrfBmpAsPng(`${UI_PREFIX}item\\${skCode}.bmp`, true);
    }

    if (png) {
      res.writeHead(200, {
        'Content-Type': 'image/png',
        'Content-Length': png.length,
        'Cache-Control': 'public, max-age=86400'
      });
      res.end(png);
      return;
    }

    // Fallback to static image if missing in GRF
    const fallbackFile = kind === 'card'
      ? path.join(ROOT, 'assets', 'cards', 'card_0.png')
      : (kind === 'map' || kind === 'groundmap'
          ? path.join(ROOT, 'assets', 'ui', 'map_prontera.png')
          : (kind === 'monster'
              ? path.join(ROOT, 'assets', 'sprites', 'monster_poring_0.png')
              : path.join(ROOT, 'assets', 'items', 'red_potion.png')));
    if (fs.existsSync(fallbackFile)) {
      const fb = fs.readFileSync(fallbackFile);
      res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': fb.length });
      res.end(fb);
      return;
    }
  }

  let filePath = path.join(ROOT, reqPath);
  if (reqPath.startsWith('/bgm/')) {
    filePath = path.join(CLIENT_BGM, path.basename(reqPath));
  } else if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME[ext] || 'application/octet-stream';

    const range = req.headers.range;
    if (range && contentType.startsWith('audio/')) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(filePath, { start, end });
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stats.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType
      });
      file.pipe(res);
      return;
    }

    const isCodeOrMarkup = ext === '.html' || ext === '.css' || ext === '.js' || ext === '.json';
    const cacheHeader = isCodeOrMarkup
      ? 'no-cache, no-store, must-revalidate, max-age=0'
      : 'public, max-age=86400';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': cacheHeader,
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[THE BOX WORLD 2] Web App running at http://localhost:${PORT}/`);
});
