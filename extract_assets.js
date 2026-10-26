const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Pure Node.js PNG encoder
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
  ihdr[8] = 8; // 8-bit
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  const scanlines = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const rowOffset = y * (1 + width * 4);
    scanlines[rowOffset] = 0; // Filter None
    rgba.copy(scanlines, rowOffset + 1, y * width * 4, (y + 1) * width * 4);
  }

  const idatData = zlib.deflateSync(scanlines);
  return Buffer.concat([
    sig,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', idatData),
    makeChunk('IEND', Buffer.alloc(0))
  ]);
}

// Decode RO SPR into frames
function decodeSPR(sprBuffer) {
  if (sprBuffer.toString('utf8', 0, 2) !== 'SP') {
    throw new Error('Not a valid SPR file');
  }
  const versionMinor = sprBuffer[2];
  const versionMajor = sprBuffer[3];
  const indexedCount = sprBuffer.readUInt16LE(4);
  const rgbaCount = versionMajor >= 2 ? sprBuffer.readUInt16LE(6) : 0;
  
  const palette = sprBuffer.subarray(sprBuffer.length - 1024);
  const frames = [];

  let offset = versionMajor >= 2 ? 8 : 6;

  for (let f = 0; f < indexedCount; f++) {
    if (offset + 4 > sprBuffer.length) break;
    const w = sprBuffer.readUInt16LE(offset);
    const h = sprBuffer.readUInt16LE(offset + 2);
    offset += 4;

    if (w === 0 || h === 0) {
      frames.push(null);
      continue;
    }

    const rawPixels = Buffer.alloc(w * h);
    if (versionMajor === 2 && versionMinor === 1) {
      const encLen = sprBuffer.readUInt16LE(offset);
      offset += 2;
      let p = 0;
      const end = offset + encLen;
      while (offset < end && p < rawPixels.length) {
        const b = sprBuffer[offset++];
        if (b === 0) {
          const count = sprBuffer[offset++];
          p += count;
        } else {
          rawPixels[p++] = b;
        }
      }
    } else {
      sprBuffer.copy(rawPixels, 0, offset, offset + w * h);
      offset += w * h;
    }

    const rgba = Buffer.alloc(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      const colorIdx = rawPixels[i];
      if (colorIdx > 0) {
        rgba[i * 4] = palette[colorIdx * 4];
        rgba[i * 4 + 1] = palette[colorIdx * 4 + 1];
        rgba[i * 4 + 2] = palette[colorIdx * 4 + 2];
        rgba[i * 4 + 3] = 255;
      } else {
        rgba[i * 4 + 3] = 0;
      }
    }

    frames.push({ width: w, height: h, rgba });
  }

  return frames;
}

// Load GRF table
console.log('Opening _sprites.grf...');
const grfPath = './THE BOX WORLD/_sprites.grf';
const fd = fs.openSync(grfPath, 'r');
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
const grfFiles = new Map();

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
  grfFiles.set(fn, { csize, rsize, foffset });
}
console.log(`Loaded ${grfFiles.size} files from GRF table.`);

function extractFile(targetPath) {
  const norm = targetPath.toLowerCase().replace(/\//g, '\\');
  const info = grfFiles.get(norm);
  if (!info) {
    console.error(`File not found: ${targetPath}`);
    return null;
  }
  const buf = Buffer.alloc(info.csize);
  fs.readSync(fd, buf, 0, info.csize, info.foffset + 46);
  return zlib.inflateSync(buf);
}

// Targets to extract
const TARGETS = [
  // NPCs
  { path: 'data\\sprite\\npc\\1_m_jobguider.spr', out: 'npc_jobguider' },
  { path: 'data\\sprite\\npc\\4w_f_kafra2.spr', out: 'npc_kafra' },
  // Classes
  { path: 'data\\sprite\\npc\\4_f_novice.spr', out: 'class_novice' },
  { path: 'data\\sprite\\npc\\4_m_swordman.spr', out: 'class_swordsman' },
  { path: 'data\\sprite\\npc\\1_m_wizard.spr', out: 'class_mage' },
  { path: 'data\\sprite\\npc\\4_m_archer.spr', out: 'class_archer' },
  { path: 'data\\sprite\\npc\\1_f_priest.spr', out: 'class_acolyte' },
  { path: 'data\\sprite\\npc\\4_m_rogue.spr', out: 'class_thief' },
  { path: 'data\\sprite\\npc\\4_m_job_blacksmith.spr', out: 'class_merchant' },
  { path: 'data\\sprite\\npc\\1_m_youngknight.spr', out: 'class_knight' },
  { path: 'data\\sprite\\npc\\4_m_job_hunter.spr', out: 'class_hunter' },
  { path: 'data\\sprite\\npc\\4_m_job_assassin.spr', out: 'class_assassin' },
  // Monsters
  { path: 'data\\sprite\\몬스터\\poring.spr', out: 'monster_poring' },
  { path: 'data\\sprite\\몬스터\\fabre.spr', out: 'monster_fabre' },
  { path: 'data\\sprite\\몬스터\\lunatic.spr', out: 'monster_lunatic' },
  { path: 'data\\sprite\\몬스터\\poporing.spr', out: 'monster_poporing' },
  { path: 'data\\sprite\\몬스터\\baphomet.spr', out: 'monster_baphomet' },
  // Items & Drops
  { path: 'data\\sprite\\아이템\\젤로피.spr', out: 'item_jellopy' },
  { path: 'data\\sprite\\아이템\\빨간포션.spr', out: 'item_redpotion' },
  { path: 'data\\sprite\\아이템\\동전주머니.spr', out: 'item_zeny' },
  { path: 'data\\sprite\\아이템\\보물상자.spr', out: 'item_chest' },
];

const outDir = './ro-survivors/assets/sprites';
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const manifest = {};

for (const target of TARGETS) {
  try {
    const sprData = extractFile(target.path);
    if (!sprData) continue;
    const frames = decodeSPR(sprData);
    console.log(`Extracted ${target.out}: ${frames.length} frames`);
    
    // Save first 4 valid frames
    const validFrames = frames.filter(f => f && f.width > 0 && f.height > 0);
    manifest[target.out] = [];

    const numToSave = Math.min(validFrames.length, 6);
    for (let i = 0; i < numToSave; i++) {
      const f = validFrames[i];
      const filename = `${target.out}_${i}.png`;
      const pngBuf = encodePNG(f.width, f.height, f.rgba);
      fs.writeFileSync(path.join(outDir, filename), pngBuf);
      manifest[target.out].push({
        file: `assets/sprites/${filename}`,
        width: f.width,
        height: f.height
      });
    }
  } catch (err) {
    console.error(`Error processing ${target.path}:`, err.message);
  }
}

fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log('Wrote manifest.json!');
fs.closeSync(fd);
