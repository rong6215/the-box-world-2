// RO map format parsers: GND, GAT, RSW, RSM (v1.x and v2.x)
const dec = new TextDecoder('euc-kr');

class Reader {
  constructor(buf) { this.b = buf; this.o = 0; }
  u8() { return this.b[this.o++]; }
  u16() { const v = this.b.readUInt16LE(this.o); this.o += 2; return v; }
  i16() { const v = this.b.readInt16LE(this.o); this.o += 2; return v; }
  u32() { const v = this.b.readUInt32LE(this.o); this.o += 4; return v; }
  i32() { const v = this.b.readInt32LE(this.o); this.o += 4; return v; }
  f32() { const v = this.b.readFloatLE(this.o); this.o += 4; return v; }
  vec(n) { const a = []; for (let i = 0; i < n; i++) a.push(this.f32()); return a; }
  str(n) {
    const s = this.b.subarray(this.o, this.o + n); this.o += n;
    let e = s.indexOf(0); if (e < 0) e = n;
    return dec.decode(s.subarray(0, e));
  }
  lstr() { const n = this.i32(); return this.str(n); }
  skip(n) { this.o += n; }
}

function parseGND(buf) {
  const r = new Reader(buf);
  if (r.str(4) !== 'GRGN') throw new Error('bad gnd');
  const major = r.u8(), minor = r.u8();
  const ver = major + minor / 10;
  const width = r.u32(), height = r.u32(), zoom = r.f32();
  const texCount = r.u32(), texLen = r.u32();
  const textures = [];
  for (let i = 0; i < texCount; i++) textures.push(r.str(texLen));
  const lmCount = r.u32(); const lmW = r.u32(), lmH = r.u32(), lmC = r.u32();
  const lmSize = lmW * lmH;
  const lightmaps = buf.subarray(r.o, r.o + lmCount * lmSize * 4); r.skip(lmCount * lmSize * 4);
  const surfCount = r.u32();
  const surfaces = [];
  for (let i = 0; i < surfCount; i++) {
    const u = r.vec(4), v = r.vec(4);
    const tex = r.i16(), lm = r.u16();
    const b = r.u8(), g = r.u8(), rr = r.u8(), a = r.u8();
    surfaces.push({ u, v, tex, lm, color: [rr / 255, g / 255, b / 255] });
  }
  const cubes = [];
  for (let i = 0; i < width * height; i++) {
    const h = r.vec(4);
    let up, front, right;
    if (ver >= 1.6) { up = r.i32(); front = r.i32(); right = r.i32(); }
    else { up = r.i16(); front = r.i16(); right = r.i16(); r.skip(2); }
    cubes.push({ h, up, front, right });
  }
  return { ver, width, height, zoom, textures, lmCount, lmW, lmH, lightmaps, surfaces, cubes };
}

function parseGAT(buf) {
  const r = new Reader(buf);
  if (r.str(4) !== 'GRAT') throw new Error('bad gat');
  r.u8(); r.u8();
  const width = r.u32(), height = r.u32();
  const types = new Uint8Array(width * height);
  const heights = new Float32Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    for (let k = 0; k < 4; k++) heights[i * 4 + k] = r.f32();
    types[i] = r.u32() & 0xff;
  }
  return { width, height, types, heights };
}

function parseRSW(buf) {
  const r = new Reader(buf);
  if (r.str(4) !== 'GRSW') throw new Error('bad rsw');
  const major = r.u8(), minor = r.u8();
  const ver = major + minor / 10;
  if (ver >= 2.5) { r.u32(); r.u8(); } else if (ver >= 2.2) { r.u8(); }
  const ini = r.str(40), gnd = r.str(40), gat = ver >= 1.4 ? r.str(40) : '', src = r.str(40);
  const water = { level: 0, type: 0, waveHeight: 0.2, waveSpeed: 2, wavePitch: 50, animSpeed: 3 };
  if (ver < 2.6) {
    if (ver >= 1.3) { water.level = r.f32(); }
    if (ver >= 1.8) { water.type = r.i32(); water.waveHeight = r.f32(); water.waveSpeed = r.f32(); water.wavePitch = r.f32(); }
    if (ver >= 1.9) { water.animSpeed = r.i32(); }
  }
  const light = { longitude: 45, latitude: 45, diffuse: [1, 1, 1], ambient: [0.3, 0.3, 0.3], opacity: 1 };
  if (ver >= 1.5) {
    light.longitude = r.i32(); light.latitude = r.i32();
    light.diffuse = r.vec(3); light.ambient = r.vec(3);
    if (ver >= 1.7) light.opacity = r.f32();
  }
  if (ver >= 1.6) { r.i32(); r.i32(); r.i32(); r.i32(); }
  const count = r.i32();
  const models = [], lights = [], sounds = [], effects = [];
  for (let i = 0; i < count; i++) {
    const type = r.i32();
    if (type === 1) {
      const m = {};
      if (ver >= 1.3) { m.name = r.str(40); m.animType = r.i32(); m.animSpeed = r.f32(); m.blockType = r.i32(); }
      if (ver >= 2.6 && buf.length - r.o > 0) { /* 2.6.162+ has extra byte */ }
      m.filename = r.str(80); m.node = r.str(80);
      m.pos = r.vec(3); m.rot = r.vec(3); m.scale = r.vec(3);
      models.push(m);
    } else if (type === 2) {
      const l = { name: r.str(80), pos: r.vec(3), color: r.vec(3), range: r.f32() };
      lights.push(l);
    } else if (type === 3) {
      const s = { name: r.str(80), file: r.str(80), pos: r.vec(3), vol: r.f32(), w: r.i32(), h: r.i32(), range: r.f32() };
      if (ver >= 2.0) s.cycle = r.f32();
      sounds.push(s);
    } else if (type === 4) {
      const e = { name: r.str(80), pos: r.vec(3), id: r.i32(), delay: r.f32(), param: r.vec(4) };
      effects.push(e);
    } else {
      throw new Error('unknown rsw object type ' + type + ' at ' + i);
    }
  }
  return { ver, ini, gnd, gat, water, light, models, lights, sounds, effects };
}

function parseRSM(buf) {
  try { return parseRSMv(buf, 0); } catch (e) { return parseRSMv(buf, 1); }
}

function parseRSMv(buf, variant) {
  const r = new Reader(buf);
  if (r.str(4) !== 'GRSM') throw new Error('bad rsm');
  const major = r.u8(), minor = r.u8();
  const ver = major + minor / 10;
  const model = { ver, textures: [], nodes: [], mainNodes: [] };
  model.animLen = r.i32();
  model.shadeType = r.i32();
  model.alpha = ver >= 1.4 ? r.u8() / 255 : 1;
  if (ver >= 2.2) { model.fps = r.f32(); }
  if (ver < 2.0) {
    r.skip(16);
    const tc = r.i32();
    for (let i = 0; i < tc; i++) model.textures.push(r.str(40));
    model.mainNodes.push(r.str(40));
  } else if (ver < 2.2) {
    r.skip(16);
    model.mainNodes.push(r.lstr());
  } else {
    const rc = r.i32();
    for (let i = 0; i < rc; i++) model.mainNodes.push(r.lstr());
  }
  const nc = r.i32();
  for (let n = 0; n < nc; n++) {
    const node = {};
    if (ver < 2.0) { node.name = r.str(40); node.parent = r.str(40); }
    else { node.name = r.lstr(); node.parent = r.lstr(); }
    const tc = r.i32();
    node.texIds = [];
    if (ver < 2.2) {
      for (let i = 0; i < tc; i++) node.texIds.push(r.i32());
    } else {
      for (let i = 0; i < tc; i++) {
        const name = r.lstr();
        let idx = model.textures.indexOf(name);
        if (idx < 0) { idx = model.textures.length; model.textures.push(name); }
        node.texIds.push(idx);
      }
    }
    node.mat3 = r.vec(9);
    if (ver < 2.2) {
      node.offset = r.vec(3);
      node.pos = r.vec(3);
      node.rotAngle = r.f32();
      node.rotAxis = r.vec(3);
      node.scale = r.vec(3);
    } else {
      node.offset = r.vec(3);
      node.pos = [0, 0, 0];
      node.rotAngle = 0; node.rotAxis = [0, 0, 0]; node.scale = [1, 1, 1];
    }
    const vc = r.i32();
    node.verts = [];
    for (let i = 0; i < vc; i++) node.verts.push(r.vec(3));
    const tvc = r.i32();
    node.tverts = [];
    for (let i = 0; i < tvc; i++) {
      if (ver >= 1.2) r.u32();
      node.tverts.push([r.f32(), r.f32()]);
    }
    const fc = r.i32();
    node.faces = [];
    for (let i = 0; i < fc; i++) {
      let len = -1;
      if (ver >= 2.2) len = r.i32();
      const vi = [r.u16(), r.u16(), r.u16()];
      const ti = [r.u16(), r.u16(), r.u16()];
      const tex = r.u16(); r.u16();
      const twoSide = r.i32();
      let smooth = 0;
      if (ver >= 1.2) {
        smooth = r.i32();
        if (len > 24) r.skip(len - 24);
      }
      node.faces.push({ vi, ti, tex, twoSide });
    }
    node.rotKeys = [];
    node.posKeys = [];
    if (variant === 1 && ver >= 1.5 && ver < 2.0) {
      const pc = r.i32();
      for (let i = 0; i < pc; i++) { const f = r.i32(); node.posKeys.push({ f, p: r.vec(3) }); }
    }
    if (ver >= 1.6) {
      const sc = r.i32(); r.skip(sc * 20); // scale keyframes
    }
    if (ver < 2.2) {
      const rc = r.i32();
      for (let i = 0; i < rc; i++) { const f = r.i32(); node.rotKeys.push({ f, q: r.vec(4) }); }
    } else {
      const rc = r.i32();
      for (let i = 0; i < rc; i++) { const f = r.i32(); node.rotKeys.push({ f, q: r.vec(4) }); }
      const pc = r.i32();
      for (let i = 0; i < pc; i++) { const f = r.i32(); node.posKeys.push({ f, p: r.vec(3) }); r.skip(4); }
      if (ver >= 2.3) {
        // texture animations
        const ta = r.i32();
        for (let i = 0; i < ta; i++) {
          r.i32(); const tc2 = r.i32();
          for (let j = 0; j < tc2; j++) { r.i32(); const kc = r.i32(); r.skip(kc * 8); }
        }
      }
    }
    // sanity checks to detect wrong variant
    if (vc > 200000 || fc > 200000 || tc > 1000) throw new Error('bad counts');
    for (const f of node.faces) {
      if (f.vi.some(i => i >= vc) || f.ti.some(i => i >= tvc)) throw new Error('bad face index');
    }
    model.nodes.push(node);
  }
  if (r.o > buf.length) throw new Error('overrun');
  return model;
}

module.exports = { parseGND, parseGAT, parseRSW, parseRSM };
