// Exports a real RO map (RSW/GND/GAT/RSM + textures) from the user's GRFs into web-friendly files.
// Usage: node tools/export_map.js prontera
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { GRFSet } = require('./grf');
const { parseGND, parseGAT, parseRSW, parseRSM } = require('./romap');

const MAP = process.argv[2] || 'prontera';
const ROOT = path.join(__dirname, '..', '..', 'THE BOX WORLD');
const OUT = path.join(__dirname, '..', 'assets', 'maps', MAP);
fs.mkdirSync(path.join(OUT, 'tex'), { recursive: true });

const set = new GRFSet(ROOT, ['_block_prontera.grf', '_prontera_box.grf', '_en.grf', '_sprites.grf', '_textures.grf', 'data.grf']);

// ---------- image helpers ----------
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
function decodeBMP(buf) {
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
      else throw new Error('bpp ' + bpp);
      if (isMagenta(r, g, b)) { r = g = b = 0; a = 0; }
      const d = (y * w + x) * 4; out[d] = r; out[d + 1] = g; out[d + 2] = b; out[d + 3] = a;
    }
  }
  return { w, h, rgba: out };
}
function decodeTGA(buf) {
  const idLen = buf[0], type = buf[2], w = buf.readUInt16LE(12), h = buf.readUInt16LE(14), bpp = buf[16], desc = buf[17];
  const top = (desc & 0x20) !== 0; const px = bpp / 8; let p = 18 + idLen;
  const n = w * h; const src = Buffer.alloc(n * px);
  if (type === 2) buf.copy(src, 0, p, p + n * px);
  else if (type === 10) {
    let i = 0;
    while (i < n) {
      const c = buf[p++]; const cnt = (c & 0x7f) + 1;
      if (c & 0x80) { for (let k = 0; k < cnt; k++) buf.copy(src, (i + k) * px, p, p + px); p += px; }
      else { buf.copy(src, i * px, p, p + cnt * px); p += cnt * px; }
      i += cnt;
    }
  } else throw new Error('tga type ' + type);
  const out = Buffer.alloc(n * 4);
  for (let y = 0; y < h; y++) {
    const sy = top ? y : h - 1 - y;
    for (let x = 0; x < w; x++) {
      const s = (sy * w + x) * px, d = (y * w + x) * 4;
      out[d] = src[s + 2]; out[d + 1] = src[s + 1]; out[d + 2] = src[s]; out[d + 3] = px === 4 ? src[s + 3] : 255;
      if (px === 3 && isMagenta(out[d], out[d + 1], out[d + 2])) out[d + 3] = 0;
    }
  }
  return { w, h, rgba: out };
}

const texIndex = new Map(); // ro path -> output file
const texList = [];
function exportTexture(roName) {
  const key = roName.toLowerCase();
  if (texIndex.has(key)) return texIndex.get(key);
  const buf = set.get('data\\texture\\' + roName);
  let file = null;
  if (buf) {
    try {
      let img;
      if (buf.toString('ascii', 0, 2) === 'BM') img = decodeBMP(buf);
      else if (/\.tga$/i.test(roName)) img = decodeTGA(buf);
      if (img) {
        file = 't' + texList.length + '.png';
        fs.writeFileSync(path.join(OUT, 'tex', file), encodePNG(img.w, img.h, img.rgba));
      } else if (/\.jpe?g$/i.test(roName)) {
        file = 't' + texList.length + '.jpg';
        fs.writeFileSync(path.join(OUT, 'tex', file), buf);
      }
    } catch (e) { console.warn('texture fail', roName, e.message); }
  } else console.warn('texture missing', roName);
  const id = texList.length;
  texList.push(file ? 'tex/' + file : null);
  texIndex.set(key, id);
  return id;
}

// ---------- matrix helpers (column-major, gl-matrix style) ----------
const I = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function mul(a, b) {
  const o = new Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  }
  return o;
}
const T = (v) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, v[0], v[1], v[2], 1];
const S = (v) => [v[0], 0, 0, 0, 0, v[1], 0, 0, 0, 0, v[2], 0, 0, 0, 0, 1];
function R(angle, axis) {
  let [x, y, z] = axis; const len = Math.hypot(x, y, z);
  if (len < 1e-6) return I();
  x /= len; y /= len; z /= len;
  const s = Math.sin(angle), c = Math.cos(angle), t = 1 - c;
  return [x * x * t + c, y * x * t + z * s, z * x * t - y * s, 0,
    x * y * t - z * s, y * y * t + c, z * y * t + x * s, 0,
    x * z * t + y * s, y * z * t - x * s, z * z * t + c, 0, 0, 0, 0, 1];
}
function Q(q) {
  const [x, y, z, w] = q;
  return [1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w), 0,
    2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w), 0,
    2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y), 0, 0, 0, 0, 1];
}
const M3 = (m) => [m[0], m[1], m[2], 0, m[3], m[4], m[5], 0, m[6], m[7], m[8], 0, 0, 0, 0, 1];
function apply(m, v) {
  return [m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12], m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13], m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14]];
}

// ---------- load map ----------
const rsw = parseRSW(set.get(`data\\${MAP}.rsw`));
const gnd = parseGND(set.get('data\\' + rsw.gnd));
const gat = parseGAT(set.get('data\\' + rsw.gat));
console.log(`${MAP}: gnd ${gnd.width}x${gnd.height}, gat ${gat.width}x${gat.height}, models ${rsw.models.length}`);

const lon = rsw.light.longitude * Math.PI / 180, lat = rsw.light.latitude * Math.PI / 180;
const lightDir = [-Math.cos(lon) * Math.sin(lat), -Math.cos(lat), -Math.sin(lon) * Math.sin(lat)];

// ---------- ground ----------
const Z = gnd.zoom;
const lmPerRow = Math.ceil(Math.sqrt(gnd.lmCount));
const lmRows = Math.ceil(gnd.lmCount / lmPerRow);
{
  const W = lmPerRow * 8, H = lmRows * 8; const img = Buffer.alloc(W * H * 4);
  for (let i = 0; i < gnd.lmCount; i++) {
    const base = i * 256; const ox = (i % lmPerRow) * 8, oy = Math.floor(i / lmPerRow) * 8;
    for (let p = 0; p < 64; p++) {
      const x = ox + (p % 8), y = oy + Math.floor(p / 8), d = (y * W + x) * 4;
      img[d] = gnd.lightmaps[base + 64 + p * 3];
      img[d + 1] = gnd.lightmaps[base + 64 + p * 3 + 1];
      img[d + 2] = gnd.lightmaps[base + 64 + p * 3 + 2];
      img[d + 3] = gnd.lightmaps[base + p];
    }
  }
  fs.writeFileSync(path.join(OUT, 'lightmap.png'), encodePNG(W, H, img));
}
function lmUV(idx) {
  const x = idx % lmPerRow, y = Math.floor(idx / lmPerRow);
  const u1 = (x + 0.125) / lmPerRow, u2 = (x + 0.875) / lmPerRow, v1 = (y + 0.125) / lmRows, v2 = (y + 0.875) / lmRows;
  return [[u1, v1], [u2, v1], [u1, v2], [u2, v2]];
}
const groundTexIds = gnd.textures.map(t => exportTexture(t));
const groundByTex = new Map();
function gpush(tex, p, uv, lm, col) {
  if (!groundByTex.has(tex)) groundByTex.set(tex, []);
  const a = groundByTex.get(tex);
  a.push(p[0], p[1], p[2], uv[0], uv[1], lm[0], lm[1], col[0], col[1], col[2]);
}
function lightCol(n, tint) {
  const len = Math.hypot(n[0], n[1], n[2]) || 1;
  const w = Math.max(0, (n[0] * lightDir[0] + n[1] * lightDir[1] + n[2] * lightDir[2]) / len);
  const o = rsw.light.opacity;
  return [0, 1, 2].map(k => Math.min(1, rsw.light.ambient[k] * o + rsw.light.diffuse[k] * w) * tint[k]);
}
function quad(tex, ps, uvs, lms, col) {
  // triangles 0-1-3, 3-2-0
  for (const i of [0, 1, 3, 3, 2, 0]) gpush(tex, ps[i], uvs[i], lms[i], col);
}
for (let y = 0; y < gnd.height; y++) for (let x = 0; x < gnd.width; x++) {
  const c = gnd.cubes[x + y * gnd.width]; const h = c.h;
  if (c.up > -1) {
    const s = gnd.surfaces[c.up];
    if (s && s.tex > -1) {
      const n = [Z * (h[0] - h[1]), -Z * Z, Z * (h[0] - h[2])];
      // normal from cross((p1-p0),(p2-p0)) = (10(h1-h0)... ) y-down => use sign so y<0
      const nn = [-(Z * (h[1] - h[0])), -Z * Z, -(Z * (h[2] - h[0]))];
      const col = lightCol(nn, s.color);
      quad(groundTexIds[s.tex],
        [[x * Z, h[0], y * Z], [(x + 1) * Z, h[1], y * Z], [x * Z, h[2], (y + 1) * Z], [(x + 1) * Z, h[3], (y + 1) * Z]],
        [0, 1, 2, 3].map(i => [s.u[i], s.v[i]]), lmUV(s.lm), col);
    }
  }
  if (c.front > -1 && y + 1 < gnd.height) {
    const s = gnd.surfaces[c.front]; const hb = gnd.cubes[x + (y + 1) * gnd.width].h;
    if (s && s.tex > -1) {
      const col = lightCol([0, 0, h[2] > hb[0] ? 1 : -1], s.color).map(v => Math.max(v, 0.45));
      const ps = [[x * Z, h[2], (y + 1) * Z], [(x + 1) * Z, h[3], (y + 1) * Z], [x * Z, hb[0], (y + 1) * Z], [(x + 1) * Z, hb[1], (y + 1) * Z]];
      quad(groundTexIds[s.tex], ps, [0, 1, 2, 3].map(i => [s.u[i], s.v[i]]), lmUV(s.lm), col);
    }
  }
  if (c.right > -1 && x + 1 < gnd.width) {
    const s = gnd.surfaces[c.right]; const hb = gnd.cubes[(x + 1) + y * gnd.width].h;
    if (s && s.tex > -1) {
      const col = lightCol([h[1] > hb[0] ? -1 : 1, 0, 0], s.color).map(v => Math.max(v, 0.45));
      const ps = [[(x + 1) * Z, h[3], (y + 1) * Z], [(x + 1) * Z, h[1], y * Z], [(x + 1) * Z, hb[2], (y + 1) * Z], [(x + 1) * Z, hb[0], y * Z]];
      quad(groundTexIds[s.tex], ps, [0, 1, 2, 3].map(i => [s.u[i], s.v[i]]), lmUV(s.lm), col);
    }
  }
}
const groundGroups = []; const groundArrays = [];
let gOff = 0;
for (const [tex, arr] of groundByTex) {
  groundGroups.push({ tex, offset: gOff, count: arr.length / 10 });
  gOff += arr.length / 10; groundArrays.push(Float32Array.from(arr));
}
fs.writeFileSync(path.join(OUT, 'ground.bin'), Buffer.concat(groundArrays.map(a => Buffer.from(a.buffer))));
console.log('ground vertices', gOff);

// ---------- models ----------
const modelCache = new Map();
const modelList = [];
const modelArrays = [];
let mOff = 0;
function buildModel(file) {
  if (modelCache.has(file)) return modelCache.get(file);
  const buf = set.get('data\\model\\' + file);
  if (!buf) { console.warn('model missing', file); modelCache.set(file, -1); return -1; }
  let rsm;
  try { rsm = parseRSM(buf); } catch (e) { console.warn('rsm fail', file, e.message); modelCache.set(file, -1); return -1; }
  const texIds = rsm.textures.map(t => exportTexture(t));
  const only = rsm.nodes.length === 1;
  const byName = new Map(rsm.nodes.map(n => [n.name, n]));
  const locals = new Map();
  function walk(node, parentM, depth) {
    if (depth > 32) return;
    let m = mul(parentM, T(node.pos));
    m = node.rotKeys.length ? mul(m, Q(node.rotKeys[0].q)) : mul(m, R(node.rotAngle, node.rotAxis));
    m = mul(m, S(node.scale));
    let local = only ? m : mul(m, T(node.offset));
    local = mul(local, M3(node.mat3));
    locals.set(node, local);
    for (const ch of rsm.nodes) if (ch !== node && ch.parent === node.name) walk(ch, m, depth + 1);
  }
  const main = byName.get(rsm.mainNodes[0]) || rsm.nodes[0];
  walk(main, I(), 0);
  for (const n of rsm.nodes) if (!locals.has(n)) walk(n, I(), 0);
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  const tv = new Map();
  for (const n of rsm.nodes) {
    const L = locals.get(n); const vs = n.verts.map(v => apply(L, v)); tv.set(n, vs);
    for (const v of vs) for (let k = 0; k < 3; k++) { if (v[k] < min[k]) min[k] = v[k]; if (v[k] > max[k]) max[k] = v[k]; }
  }
  const center = [(min[0] + max[0]) / 2, max[1], (min[2] + max[2]) / 2];
  const groups = new Map();
  for (const n of rsm.nodes) {
    const vs = tv.get(n);
    for (const f of n.faces) {
      const t = texIds[n.texIds[f.tex]] ?? -1;
      if (t < 0) continue;
      if (!groups.has(t)) groups.set(t, []);
      const a = groups.get(t);
      for (let k = 0; k < 3; k++) {
        const v = vs[f.vi[k]]; const uv = n.tverts[f.ti[k]] || [0, 0];
        a.push(v[0] - center[0], v[1] - center[1], v[2] - center[2], uv[0], uv[1]);
      }
    }
  }
  const entry = { file, groups: [] };
  for (const [tex, arr] of groups) {
    entry.groups.push({ tex, offset: mOff, count: arr.length / 5 });
    mOff += arr.length / 5; modelArrays.push(Float32Array.from(arr));
  }
  const id = modelList.length; modelList.push(entry); modelCache.set(file, id);
  return id;
}
const instances = [];
const halfW = gnd.width * Z / 2, halfH = gnd.height * Z / 2;
for (const m of rsw.models) {
  const id = buildModel(m.filename);
  if (id < 0) continue;
  let M = T([m.pos[0] + halfW, m.pos[1], m.pos[2] + halfH]);
  M = mul(M, R(m.rot[2] * Math.PI / 180, [0, 0, 1]));
  M = mul(M, R(m.rot[0] * Math.PI / 180, [1, 0, 0]));
  M = mul(M, R(m.rot[1] * Math.PI / 180, [0, 1, 0]));
  M = mul(M, S(m.scale));
  instances.push({ m: id, mat: M.map(v => +v.toFixed(5)) });
}
fs.writeFileSync(path.join(OUT, 'models.bin'), Buffer.concat(modelArrays.map(a => Buffer.from(a.buffer))));
console.log('unique models', modelList.length, 'model vertices', mOff, 'instances', instances.length);

// ---------- gat ----------
fs.writeFileSync(path.join(OUT, 'gat.bin'), Buffer.concat([Buffer.from(gat.types.buffer), Buffer.from(gat.heights.buffer)]));

// ---------- water ----------
const waterTex = [];
for (let i = 0; i < 32; i++) {
  const n = String(i).padStart(2, '0');
  const id = exportTexture(`워터\\water${rsw.water.type}${n}.jpg`);
  waterTex.push(id);
}

const meta = {
  name: MAP,
  gnd: { width: gnd.width, height: gnd.height, zoom: Z },
  gat: { width: gat.width, height: gat.height },
  light: rsw.light, lightDir,
  water: rsw.water, waterTex,
  textures: texList,
  ground: { stride: 10, groups: groundGroups },
  models: { stride: 5, list: modelList },
  instances,
  effects: rsw.effects.map(e => ({ id: e.id, pos: [e.pos[0] + halfW, e.pos[1], e.pos[2] + halfH] }))
};
fs.writeFileSync(path.join(OUT, 'map.json'), JSON.stringify(meta));
console.log('textures', texList.length, 'missing', texList.filter(t => !t).length);
console.log('done ->', OUT);
