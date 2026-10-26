const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { GRFSet } = require('./grf');

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
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}
function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
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

function decodeSPR(sprBuffer) {
  if (!sprBuffer || sprBuffer.length < 8) return [];
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

const grf = new GRFSet('./THE BOX WORLD', ['_sprites.grf', '_textures.grf', 'data.grf', '_prontera_box.grf', '_en.grf']);
const outDir = './ro-survivors/assets/effects/refine';
fs.mkdirSync(outDir, { recursive: true });

const sprs = [
  'data\\sprite\\npc\\1_m_smith.spr',
  'data\\sprite\\아이템\\ws_weaponrefine.spr',
  'data\\sprite\\아이템\\검은모루.spr',
  'data\\sprite\\아이템\\대장장이의망치.spr'
];

for (const s of sprs) {
  const buf = grf.get(s);
  if (buf) {
    const frames = decodeSPR(buf);
    let bName = path.basename(s, '.spr');
    if (bName === '1_m_smith') bName = 'hollgrehenn';
    if (bName === '검은모루') bName = 'anvil';
    if (bName === '대장장이의망치') bName = 'hammer';
    frames.forEach((f, idx) => {
      if (f) {
        const png = encodePNG(f.width, f.height, f.rgba);
        const pth = path.join(outDir, bName + '_' + idx + '.png');
        fs.writeFileSync(pth, png);
        console.log('Saved:', pth, f.width, 'x', f.height);
      }
    });
  } else {
    console.log('Missing:', s);
  }
}
