const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const boxDir = path.join(__dirname, '../../THE BOX WORLD');

function asciiLowerStr(buf) {
  let s = '';
  for (let i = 0; i < buf.length; i++) {
    let b = buf[i];
    if (b >= 0x41 && b <= 0x5A) b += 32;
    s += String.fromCharCode(b);
  }
  return s;
}

function loadGrfIndex(grfName) {
  const p = path.join(boxDir, grfName);
  const fd = fs.openSync(p, 'r');
  const h = Buffer.alloc(46);
  fs.readSync(fd, h, 0, 46, 0);
  const ver = h.readUInt32LE(42);
  const hdrLen = ver === 0x300 ? 12 : 8;
  const entryLen = ver === 0x300 ? 21 : 17;
  const off = Number(BigInt(h.readUInt32LE(30)) + 46n);
  const th = Buffer.alloc(hdrLen);
  fs.readSync(fd, th, 0, hdrLen, off);
  const compSize = th.readUInt32LE(hdrLen - 8);
  const compBuf = Buffer.alloc(compSize);
  fs.readSync(fd, compBuf, 0, compSize, off + hdrLen);
  const tbl = zlib.inflateSync(compBuf);
  const map = new Map();
  let pos = 0;
  while (pos < tbl.length) {
    let end = pos;
    while (end < tbl.length && tbl[end] !== 0) end++;
    if (end >= tbl.length) break;
    const rawKey = asciiLowerStr(tbl.slice(pos, end));
    const meta = tbl.slice(end + 1, end + 1 + entryLen);
    pos = end + 1 + entryLen;
    map.set(rawKey, {
      cSize: meta.readUInt32LE(0),
      cAlign: meta.readUInt32LE(4),
      uSize: meta.readUInt32LE(8),
      flags: meta[12],
      offset: ver === 0x300 ? Number(meta.readBigUInt64LE(13)) + 46 : meta.readUInt32LE(13) + 46
    });
  }
  fs.closeSync(fd);
  return map;
}

const texIndex = loadGrfIndex('_textures.grf');
const uiPrefix = Buffer.from([0x64,0x61,0x74,0x61,0x5c,0x74,0x65,0x78,0x74,0x75,0x72,0x65,0x5c,0xc0,0xaf,0xc0,0xfa,0xc0,0xce,0xc5,0xcd,0xc6,0xe4,0xc0,0xcc,0xbd,0xba,0x5c]).toString('latin1');

// Parse itemInfo_true.lub raw buffer for identifiedResourceName and Thai text
const itemBuf = fs.readFileSync(path.join(boxDir, 'System/itemInfo_true.lub'));
const itemLatin1 = itemBuf.toString('latin1');

const resRegex = /identifiedResourceName\s*=\s*"([^"]*)"/g;
let m;
let totalRes = 0, matchedIcon = 0, matchedColl = 0;
while ((m = resRegex.exec(itemLatin1)) !== null) {
  totalRes++;
  const rawRes = m[1];
  let lowerRes = '';
  for (let i = 0; i < rawRes.length; i++) {
    let c = rawRes.charCodeAt(i);
    if (c >= 0x41 && c <= 0x5A) c += 32;
    lowerRes += String.fromCharCode(c);
  }
  if (texIndex.has(uiPrefix + 'item\\' + lowerRes + '.bmp')) matchedIcon++;
  if (texIndex.has(uiPrefix + 'collection\\' + lowerRes + '.bmp')) matchedColl++;
}
console.log('Total items in itemInfo_true.lub:', totalRes, '| matched icon in _textures.grf:', matchedIcon, '| matched collection:', matchedColl);
