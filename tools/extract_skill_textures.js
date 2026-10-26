const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const boxDir = path.join(__dirname, '../../THE BOX WORLD');
const effectsDir = path.join(__dirname, '../assets/effects');
const skillsDir = path.join(__dirname, '../assets/skills');
for (const d of [effectsDir, skillsDir]) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

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

function decodeBmp(buf, mode = 'magenta') {
  if (!buf || buf.length < 54 || buf.toString('ascii', 0, 2) !== 'BM') return null;
  const pixelOffset = buf.readUInt32LE(10);
  const headerSize = buf.readUInt32LE(14);
  const width = buf.readInt32LE(18);
  const rawHeight = buf.readInt32LE(22);
  const topDown = rawHeight < 0;
  const height = Math.abs(rawHeight);
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
        if (r >= 245 && g <= 12 && b >= 245) {
          rgba[dst + 3] = 0;
        } else if (mode === 'additive') {
          const lum = Math.max(r, g, b);
          if (lum < 14) {
            rgba[dst + 3] = 0;
          } else {
            rgba[dst] = r; rgba[dst + 1] = g; rgba[dst + 2] = b;
            rgba[dst + 3] = Math.min(255, Math.round(lum * 1.35));
          }
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
        if (r >= 245 && g <= 12 && b >= 245) {
          rgba[dst + 3] = 0;
        } else if (mode === 'additive') {
          const lum = Math.max(r, g, b);
          if (lum < 14) {
            rgba[dst + 3] = 0;
          } else {
            rgba[dst] = r; rgba[dst + 1] = g; rgba[dst + 2] = b;
            rgba[dst + 3] = Math.min(255, Math.round(lum * 1.35));
          }
        } else {
          rgba[dst] = r; rgba[dst + 1] = g; rgba[dst + 2] = b; rgba[dst + 3] = 255;
        }
      }
    }
  } else {
    return null;
  }
  return { width, height, rgba };
}

function asciiLowerStr(buf) {
  let s = '';
  for (let i = 0; i < buf.length; i++) {
    let b = buf[i];
    if (b >= 0x41 && b <= 0x5A) b += 32;
    s += String.fromCharCode(b);
  }
  return s;
}

const grfPath = path.join(boxDir, '_textures.grf');
const fd = fs.openSync(grfPath, 'r');
const h = Buffer.alloc(46);
fs.readSync(fd, h, 0, 46, 0);
const off = Number(BigInt(h.readUInt32LE(30)) + 46n);
const th = Buffer.alloc(8);
fs.readSync(fd, th, 0, 8, off);
const compBuf = Buffer.alloc(th.readUInt32LE(0));
fs.readSync(fd, compBuf, 0, compBuf.length, off + 8);
const tbl = zlib.inflateSync(compBuf);

const texIndex = new Map();
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

function readEntry(entry) {
  const b = Buffer.alloc(entry.cAlign);
  fs.readSync(fd, b, 0, entry.cAlign, entry.offset);
  if (entry.cSize === entry.uSize) return b.slice(0, entry.uSize);
  return zlib.inflateSync(b.slice(0, entry.cSize));
}

// 1. Extract all 24 skill icons + extra class skills
const uiPrefix = Buffer.from([0x64,0x61,0x74,0x61,0x5c,0x74,0x65,0x78,0x74,0x75,0x72,0x65,0x5c,0xc0,0xaf,0xc0,0xfa,0xc0,0xce,0xc5,0xcd,0xc6,0xe4,0xc0,0xcc,0xbd,0xba,0x5c]).toString('latin1');
const skillCodes = [
  'nv_firstaid', 'sm_bash', 'sm_magnum', 'sm_endure',
  'kn_bowlingbash', 'kn_twohandquicken', 'lk_spiralpierce', 'lk_aurablade', 'lk_berserk',
  'rk_ignitionbreak', 'rk_dragonbreath',
  'mg_firebolt', 'mg_coldbolt', 'mg_lightningbolt', 'mg_energycoat',
  'wz_stormgust', 'wz_meteor', 'wz_vermilion', 'hw_magicpower',
  'wl_crimsonrock', 'wl_chainlightning', 'wl_recognizedspell',
  'ac_double', 'ac_shower', 'ac_concentration',
  'ht_blitzbeat', 'sn_sharpshooting', 'sn_windwalk',
  'ra_arrowstorm', 'ra_wugstrike', 'ra_fearbreeze',
  'al_heal', 'al_blessing', 'al_incagi', 'al_angelus', 'al_holywater',
  'pr_magnus', 'pr_sanctuary', 'pr_kyrie', 'pr_gloria', 'hp_assumptio',
  'ab_judex', 'ab_adoramus', 'ab_highnessheal',
  'tf_double', 'tf_poison', 'tf_hiding',
  'as_sonicblow', 'as_grimtooth', 'as_cloaking', 'asc_edp',
  'gc_rollingcutter', 'gc_crossimpact', 'gc_weaponblocking',
  'mc_mammonite', 'mc_cartrevolution', 'mc_loud',
  'bs_hammerfall', 'bs_adrenaline', 'bs_overthrust', 'ws_meltdown',
  'nc_axeboomerang', 'nc_axetornado', 'nc_boostknuckle'
];

let skCount = 0;
for (const code of skillCodes) {
  const entry = texIndex.get(uiPrefix + 'item\\' + code + '.bmp');
  if (entry) {
    const bmp = decodeBmp(readEntry(entry), 'magenta');
    if (bmp) {
      fs.writeFileSync(path.join(skillsDir, `${code}.png`), encodePNG(bmp.width, bmp.height, bmp.rgba));
      skCount++;
    }
  }
}
console.log('Extracted authentic RO skill icons:', skCount, '/', skillCodes.length);

// 2. Extract authentic RO effect BMPs from data\texture\effect\
const EFFECT_BMPS = [
  ['magic_ring_a.bmp', 'tex_magic_circle.png'],
  ['freezing_circle.bmp', 'tex_freezing_circle.png'],
  ['freeze_ice.bmp', 'tex_freeze_ice.png'],
  ['ice_block1.bmp', 'tex_ice_block.png'],
  ['firering.bmp', 'tex_fire_ring.png'],
  ['fire_blast.bmp', 'tex_fire_blast.png'],
  ['exp_fire_04.bmp', 'tex_meteor_exp.png'],
  ['thunder_plazma_blast_a.bmp', 'tex_thunder_blast.png'],
  ['lightning-1.bmp', 'tex_lightning_bolt.png'],
  ['storm_god.bmp', 'tex_storm_god.png'],
  ['cross1.bmp', 'tex_holy_cross.png'],
  ['preist_resurrection_ring.bmp', 'tex_holy_ring.png'],
  ['priest_angel_ring.bmp', 'tex_angel_ring.png'],
  ['invenom_ring.bmp', 'tex_poison_ring.png']
];

let efTexCount = 0;
for (const [bmpName, outName] of EFFECT_BMPS) {
  const entry = texIndex.get('data\\texture\\effect\\' + bmpName);
  if (entry) {
    const bmp = decodeBmp(readEntry(entry), 'additive');
    if (bmp) {
      fs.writeFileSync(path.join(effectsDir, outName), encodePNG(bmp.width, bmp.height, bmp.rgba));
      efTexCount++;
      console.log(`Extracted ${outName} (${bmp.width}x${bmp.height})`);
    }
  }
}

fs.closeSync(fd);
console.log('Extracted authentic RO effect textures:', efTexCount);
