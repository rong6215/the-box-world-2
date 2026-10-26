// RO Survivors - Real Prontera (prontera.rsw / prontera.gnd / prontera.gat) rendered in 3D
// Map geometry, buildings (RSM models), textures and lightmaps are exported from the user's
// original client GRF files by tools/export_map.js — nothing here is hand-drawn.

import * as THREE from '../assets/lib/three.module.js';
import { audio } from './audio.js';
import { HAIR_COLOR_TINTS } from './charselect.js';

const CELL = 5; // one GAT cell = 5 RO units

const GROUND_VS = `
precision highp float;
uniform mat4 modelViewMatrix; uniform mat4 projectionMatrix;
attribute vec3 position; attribute vec2 uv; attribute vec2 lmuv; attribute vec3 color;
varying vec2 vUv; varying vec2 vLm; varying vec3 vColor; varying float vDepth;
void main() {
  vUv = uv; vLm = lmuv; vColor = color;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const GROUND_FS = `
precision highp float;
uniform sampler2D map; uniform sampler2D lightmap; uniform vec3 fogColor; uniform vec2 fogRange;
varying vec2 vUv; varying vec2 vLm; varying vec3 vColor; varying float vDepth;
void main() {
  vec4 t = texture2D(map, vUv);
  if (t.a < 0.5) discard;
  vec4 lm = texture2D(lightmap, vLm);
  vec3 c = t.rgb * clamp(vColor * lm.a, 0.0, 1.0) + lm.rgb;
  float f = smoothstep(fogRange.x, fogRange.y, vDepth);
  gl_FragColor = vec4(mix(c, fogColor, f), 1.0);
}`;
const MODEL_VS = `
precision highp float;
uniform mat4 modelViewMatrix; uniform mat4 projectionMatrix;
attribute vec3 position; attribute vec2 uv; attribute vec3 color;
varying vec2 vUv; varying vec3 vColor; varying float vDepth;
void main() {
  vUv = uv; vColor = color;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const MODEL_FS = `
precision highp float;
uniform sampler2D map; uniform vec3 fogColor; uniform vec2 fogRange; uniform float alpha;
varying vec2 vUv; varying vec3 vColor; varying float vDepth;
void main() {
  vec4 t = texture2D(map, vUv);
  if (t.a < 0.5) discard;
  vec3 c = t.rgb * vColor;
  float f = smoothstep(fogRange.x, fogRange.y, vDepth);
  gl_FragColor = vec4(mix(c, fogColor, f), alpha);
}`;

export class PronteraWorld {
  constructor(canvas, player, onWarpZone) {
    this.canvas = canvas; // 2D overlay canvas (bubbles, minimap, names)
    this.ctx = canvas.getContext('2d');
    this.player = player;
    this.onWarpZone = onWarpZone;
    this.ready = false;
    this.animTime = 0;
    this.spritePool = {};
    this.texCache = new Map();

    // Player position in GAT cells (Prontera fountain center south side)
    this.player.gx = 156.5;
    this.player.gy = 192.5;
    this.player.speed = 6.5; // cells per second (RO default walk ≈ 150ms/cell)
    this.player.frameIndex = 0;
    this.player.animTimer = 0;
    this.player.facingLeft = false;
    this.path = [];

    // Camera like the RO client: narrow perspective, looking down at ~50°
    this.camYaw = 0;
    this.camPitch = 50 * Math.PI / 180;
    this.camDist = 520;

    this.keys = {};
    this.joystick = { active: false, baseX: 0, baseY: 0, dx: 0, dy: 0, moved: false };

    // 4 Town NPCs around Prontera fountain:
    // User requirement: Refine Master moved to TOP (North gy: 185), Warp moved to BOTTOM (South gy: 197)
    this.npcs = [
      { id: 'refine', label: '🔨 ช่างตีบวกอุปกรณ์ [Hollgrehenn]',       gx: 156, gy: 185, sprite: 'npc_blacksmith', type: 'refine' },
      { id: 'job',    label: '⚔️ เปลี่ยนอาชีพ & รีสเตตัส',              gx: 150, gy: 191, sprite: 'npc_jobguider',  type: 'job' },
      { id: 'shop',   label: '🛒 ร้านของใช้ทั่วไป [ซื้อยา/แร่/ขายของ]',    gx: 162, gy: 191, sprite: 'npc_kafra',      type: 'shop' },
      { id: 'warp',   label: '🌀 วาร์ปเลือกด่าน [20 โซน / 1,272 แผนที่]', gx: 156, gy: 197, sprite: 'npc_jobguider',  type: 'warp' }
    ];

    this.minimapImg = new Image();
    this.minimapImg.src = 'assets/ui/map_prontera.png';

    this.initRenderer();
    this.setupInput();
    this.loadPromise = this.loadMap('prontera');
  }

  // ---------------------------------------------------------------- setup
  initRenderer() {
    const container = document.getElementById('game-container');
    let glCanvas = document.getElementById('world-canvas');
    if (!glCanvas) {
      glCanvas = document.createElement('canvas');
      glCanvas.id = 'world-canvas';
      container.insertBefore(glCanvas, this.canvas);
    }
    this.glCanvas = glCanvas;
    this.renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true });
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(20, 480 / 854, 10, 6000);
    // RO space is y-down; rotating 180° around X gives y-up without mirroring (north = -Z)
    this.mapRoot = new THREE.Group();
    this.mapRoot.rotation.x = Math.PI;
    this.scene.add(this.mapRoot);
    this.fog = { color: new THREE.Color(0x000000), range: new THREE.Vector2(1400, 2600) };
    this.raycaster = new THREE.Raycaster();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const rect = this.glCanvas.parentElement.getBoundingClientRect();
    const w = Math.max(1, rect.width), h = Math.max(1, rect.height);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  setActive(on) {
    this.glCanvas.style.display = on ? 'block' : 'none';
    this.active = on;
    if (on) this.resize();
  }

  loadTexture(url, repeat) {
    if (!url) return null;
    if (this.texCache.has(url)) return this.texCache.get(url);
    const tex = new THREE.TextureLoader().load(url);
    tex.flipY = false;
    tex.colorSpace = THREE.NoColorSpace;
    tex.wrapS = tex.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    tex.anisotropy = 4;
    this.texCache.set(url, tex);
    return tex;
  }

  async loadMap(name) {
    const base = `assets/maps/${name}/`;
    const [meta, groundBuf, modelBuf, gatBuf] = await Promise.all([
      fetch(base + 'map.json').then(r => r.json()),
      fetch(base + 'ground.bin').then(r => r.arrayBuffer()),
      fetch(base + 'models.bin').then(r => r.arrayBuffer()),
      fetch(base + 'gat.bin').then(r => r.arrayBuffer())
    ]);
    this.meta = meta;
    const texUrl = (id) => (meta.textures[id] ? base + meta.textures[id] : null);

    // --- GAT (walkability + heights)
    const gw = meta.gat.width, gh = meta.gat.height;
    this.gat = { w: gw, h: gh, types: new Uint8Array(gatBuf, 0, gw * gh), heights: new Float32Array(gatBuf, gw * gh, gw * gh * 4) };

    // --- Ground
    const lightmap = this.loadTexture(base + 'lightmap.png');
    lightmap.magFilter = THREE.LinearFilter;
    lightmap.minFilter = THREE.LinearFilter;
    lightmap.generateMipmaps = false;
    const gdata = new Float32Array(groundBuf);
    const gstride = meta.ground.stride;
    this.groundMeshes = [];
    for (const g of meta.ground.groups) {
      const n = g.count;
      const pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), lm = new Float32Array(n * 2), col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const s = (g.offset + i) * gstride;
        pos[i * 3] = gdata[s]; pos[i * 3 + 1] = gdata[s + 1]; pos[i * 3 + 2] = gdata[s + 2];
        uv[i * 2] = gdata[s + 3]; uv[i * 2 + 1] = gdata[s + 4];
        lm[i * 2] = gdata[s + 5]; lm[i * 2 + 1] = gdata[s + 6];
        col[i * 3] = gdata[s + 7]; col[i * 3 + 1] = gdata[s + 8]; col[i * 3 + 2] = gdata[s + 9];
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      geo.setAttribute('lmuv', new THREE.BufferAttribute(lm, 2));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const mat = new THREE.RawShaderMaterial({
        vertexShader: GROUND_VS, fragmentShader: GROUND_FS, side: THREE.DoubleSide,
        uniforms: { map: { value: this.loadTexture(texUrl(g.tex), true) }, lightmap: { value: lightmap }, fogColor: { value: this.fog.color }, fogRange: { value: this.fog.range } }
      });
      const mesh = new THREE.Mesh(geo, mat);
      this.mapRoot.add(mesh);
      this.groundMeshes.push(mesh);
    }

    // --- Models (RSM buildings, walls, trees, fountain) merged per texture
    const mdata = new Float32Array(modelBuf);
    const L = meta.lightDir, light = meta.light;
    const amb = light.ambient.map(v => v * light.opacity);
    const byTex = new Map();
    for (const inst of meta.instances) {
      const model = meta.models.list[inst.m];
      const m = inst.mat;
      for (const g of model.groups) {
        if (!byTex.has(g.tex)) byTex.set(g.tex, { pos: [], uv: [], col: [] });
        const out = byTex.get(g.tex);
        for (let f = 0; f < g.count; f += 3) {
          const p = [];
          for (let k = 0; k < 3; k++) {
            const s = (g.offset + f + k) * 5;
            const x = mdata[s], y = mdata[s + 1], z = mdata[s + 2];
            p.push([m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]]);
            out.uv.push(mdata[s + 3], mdata[s + 4]);
          }
          const ax = p[1][0] - p[0][0], ay = p[1][1] - p[0][1], az = p[1][2] - p[0][2];
          const bx = p[2][0] - p[0][0], by = p[2][1] - p[0][1], bz = p[2][2] - p[0][2];
          let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
          const len = Math.hypot(nx, ny, nz) || 1;
          const w = Math.abs((nx * L[0] + ny * L[1] + nz * L[2]) / len);
          const c0 = Math.min(1, amb[0] + light.diffuse[0] * w), c1 = Math.min(1, amb[1] + light.diffuse[1] * w), c2 = Math.min(1, amb[2] + light.diffuse[2] * w);
          for (let k = 0; k < 3; k++) { out.pos.push(p[k][0], p[k][1], p[k][2]); out.col.push(c0, c1, c2); }
        }
      }
    }
    for (const [tex, d] of byTex) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(d.pos), 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(d.uv), 2));
      geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(d.col), 3));
      const mat = new THREE.RawShaderMaterial({
        vertexShader: MODEL_VS, fragmentShader: MODEL_FS, side: THREE.DoubleSide,
        uniforms: { map: { value: this.loadTexture(texUrl(tex), true) }, fogColor: { value: this.fog.color }, fogRange: { value: this.fog.range }, alpha: { value: 1 } }
      });
      this.mapRoot.add(new THREE.Mesh(geo, mat));
    }

    // --- Water plane (animated RO water textures)
    const W = meta.gnd.width * meta.gnd.zoom, H = meta.gnd.height * meta.gnd.zoom;
    this.waterTex = meta.waterTex.map(id => this.loadTexture(texUrl(id), true)).filter(Boolean);
    if (this.waterTex.length) {
      const wgeo = new THREE.PlaneGeometry(W, H);
      wgeo.rotateX(-Math.PI / 2);
      this.waterMat = new THREE.MeshBasicMaterial({ map: this.waterTex[0], transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide });
      this.waterTex.forEach(t => t.repeat.set(meta.gnd.width / 4, meta.gnd.height / 4));
      const water = new THREE.Mesh(wgeo, this.waterMat);
      water.position.set(W / 2, meta.water.level, H / 2);
      this.mapRoot.add(water);
    }

    // --- Characters
    this.npcs.forEach(n => {
      const c = this.nearestWalkable(n.gx, n.gy, false);
      n.gx = c[0] + 0.5; n.gy = c[1] + 0.5;
      n.sprite3d = this.makeSprite();
      this.scene.add(n.sprite3d);
    });
    this.playerSprite = this.makeSprite();
    this.scene.add(this.playerSprite);
    const start = this.nearestWalkable(Math.floor(this.player.gx), Math.floor(this.player.gy), true);
    this.player.gx = start[0] + 0.5; this.player.gy = start[1] + 0.5;

    this.ready = true;
  }

  makeSprite() {
    const mat = new THREE.SpriteMaterial({ transparent: true, alphaTest: 0.5, depthWrite: true });
    const s = new THREE.Sprite(mat);
    // Authentic RO anchor row 105 out of 120 (15/120 = 0.125 from bottom)
    s.center.set(0.5, 0.125);
    s.visible = false;
    return s;
  }

  imgTexture(img) {
    if (!img || !img.complete || !img.width) return null;
    let t = this.texCache.get(img);
    if (!t) {
      t = new THREE.Texture(img);
      t.colorSpace = THREE.NoColorSpace;
      t.minFilter = THREE.NearestFilter;
      t.magFilter = THREE.NearestFilter;
      t.generateMipmaps = false;
      t.needsUpdate = true;
      this.texCache.set(img, t);
    }
    return t;
  }

  setSpriteImage(sprite, img, heightUnits, flip = false, colorHex = 0xffffff) {
    const t = this.imgTexture(img);
    if (!t) { sprite.visible = false; return; }
    if (sprite.material.map !== t) {
      sprite.material.map = t;
    }
    if (colorHex !== undefined && sprite.material.color && sprite.material.color.getHex() !== colorHex) {
      sprite.material.color.setHex(colorHex);
    }
    const h = heightUnits, w = h * (img.width / img.height);
    sprite.scale.set(flip ? -w : w, h, 1);
    sprite.visible = true;
  }

  loadSprites(spritePool) { this.spritePool = spritePool; }

  // ---------------------------------------------------------------- map queries
  isWalkable(x, y) {
    if (!this.gat || x < 0 || y < 0 || x >= this.gat.w || y >= this.gat.h) return false;
    const t = this.gat.types[x + y * this.gat.w];
    return t === 0 || t === 3;
  }

  nearestWalkable(x, y, _strict) {
    x = Math.floor(x); y = Math.floor(y);
    for (let r = 0; r < 30; r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (this.isWalkable(x + dx, y + dy)) return [x + dx, y + dy];
      }
    }
    return [x, y];
  }

  // RO height (y-down) at fractional GAT position
  heightAt(gx, gy) {
    if (!this.gat) return 0;
    const x = Math.max(0, Math.min(this.gat.w - 1, Math.floor(gx)));
    const y = Math.max(0, Math.min(this.gat.h - 1, Math.floor(gy)));
    const i = (x + y * this.gat.w) * 4, h = this.gat.heights;
    const fx = gx - x, fy = gy - y;
    const bottom = h[i] + (h[i + 1] - h[i]) * fx;
    const top = h[i + 2] + (h[i + 3] - h[i + 2]) * fx;
    return bottom + (top - bottom) * fy;
  }

  // GAT cell -> three.js world position (after the map's 180° X rotation)
  toWorld(gx, gy, lift = 0) {
    return new THREE.Vector3(gx * CELL, -this.heightAt(gx, gy) + lift, -gy * CELL);
  }

  findPath(sx, sy, tx, ty) {
    if (!this.isWalkable(tx, ty)) return [];
    const W = this.gat.w, key = (x, y) => x + y * W;
    const open = [[sx, sy]], came = new Map(), g = new Map([[key(sx, sy), 0]]);
    const hfun = (x, y) => Math.max(Math.abs(x - tx), Math.abs(y - ty));
    const f = new Map([[key(sx, sy), hfun(sx, sy)]]);
    let iter = 0;
    while (open.length && iter++ < 20000) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (f.get(key(...open[i])) < f.get(key(...open[bi]))) bi = i;
      const [cx, cy] = open.splice(bi, 1)[0];
      if (cx === tx && cy === ty) {
        const out = [[cx, cy]]; let k = key(cx, cy);
        while (came.has(k)) { const p = came.get(k); out.unshift(p); k = key(...p); }
        out.shift();
        return out;
      }
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx, ny = cy + dy;
        if (!this.isWalkable(nx, ny)) continue;
        if (dx && dy && (!this.isWalkable(cx + dx, cy) || !this.isWalkable(cx, cy + dy))) continue;
        const ng = g.get(key(cx, cy)) + (dx && dy ? 1.414 : 1);
        const nk = key(nx, ny);
        if (ng < (g.has(nk) ? g.get(nk) : Infinity)) {
          came.set(nk, [cx, cy]); g.set(nk, ng); f.set(nk, ng + hfun(nx, ny));
          if (!open.some(o => o[0] === nx && o[1] === ny)) open.push([nx, ny]);
        }
      }
    }
    return [];
  }

  // ---------------------------------------------------------------- input
  screenToCanvas(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: (clientX - rect.left) * (this.canvas.width / rect.width), y: (clientY - rect.top) * (this.canvas.height / rect.height), nx: ((clientX - rect.left) / rect.width) * 2 - 1, ny: -((clientY - rect.top) / rect.height) * 2 + 1 };
  }

  pickGround(nx, ny) {
    if (!this.groundMeshes) return null;
    this.raycaster.setFromCamera(new THREE.Vector2(nx, ny), this.camera);
    const hit = this.raycaster.intersectObjects(this.groundMeshes, false)[0];
    if (!hit) return null;
    return [Math.floor(hit.point.x / CELL), Math.floor(-hit.point.z / CELL)];
  }

  handleTap(clientX, clientY) {
    if (!this.active || !this.ready) return;
    const p = this.screenToCanvas(clientX, clientY);
    // NPC hit-test (screen space, sprite body or name bubble)
    for (const npc of this.npcs) {
      const s = npc.screen;
      if (s && Math.abs(p.x - s.x) < 68 && p.y > s.y - 125 && p.y < s.y + 24) {
        const dist = Math.hypot(this.player.gx - npc.gx, this.player.gy - npc.gy);
        if (dist <= 4.5) {
          this.interactNPC(npc);
        } else {
          const c = this.nearestWalkable(Math.floor(npc.gx), Math.floor(npc.gy), false);
          this.path = this.findPath(Math.floor(this.player.gx), Math.floor(this.player.gy), c[0], c[1]);
          this.pendingNpc = npc;
        }
        return;
      }
    }
    const cell = this.pickGround(p.nx, p.ny);
    if (!cell) return;
    const target = this.isWalkable(cell[0], cell[1]) ? cell : null;
    if (!target) return;
    this.pendingNpc = null;
    this.path = this.findPath(Math.floor(this.player.gx), Math.floor(this.player.gy), target[0], target[1]);
    this.clickMarker = { gx: target[0] + 0.5, gy: target[1] + 0.5, t: 0.6 };
  }

  setupInput() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.key.toLowerCase()] = true;
      if (e.code) this.keys[e.code.toLowerCase()] = true;
      if (e.key === 'q' || e.code === 'KeyQ') this.camYaw -= 0.2;
      if (e.key === 'e' || e.code === 'KeyE') this.camYaw += 0.2;
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.key.toLowerCase()] = false;
      if (e.code) this.keys[e.code.toLowerCase()] = false;
    });

    const c = this.canvas;
    let pinch = null;
    c.addEventListener('touchstart', (e) => {
      if (!this.active) return;
      if (e.touches.length === 2) {
        const [a, b] = e.touches;
        pinch = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), ang: Math.atan2(b.clientY - a.clientY, b.clientX - a.clientX), dist: this.camDist, yaw: this.camYaw };
        this.joystick.active = false;
        return;
      }
      const t = e.touches[0];
      this.joystick = { active: true, baseX: t.clientX, baseY: t.clientY, dx: 0, dy: 0, moved: false, sx: t.clientX, sy: t.clientY };
    }, { passive: true });
    c.addEventListener('touchmove', (e) => {
      if (!this.active) return;
      if (pinch && e.touches.length === 2) {
        const [a, b] = e.touches;
        const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        const ang = Math.atan2(b.clientY - a.clientY, b.clientX - a.clientX);
        this.camDist = Math.max(250, Math.min(900, pinch.dist * (pinch.d / d)));
        this.camYaw = pinch.yaw + (ang - pinch.ang);
        return;
      }
      if (!this.joystick.active) return;
      const t = e.touches[0];
      const dx = t.clientX - this.joystick.baseX, dy = t.clientY - this.joystick.baseY;
      const dist = Math.hypot(dx, dy);
      if (dist > 12) { this.joystick.moved = true; this.path = []; }
      if (dist > 0) { const k = Math.min(1, dist / 50) / dist; this.joystick.dx = dx * k; this.joystick.dy = dy * k; }
    }, { passive: true });
    const end = (e) => {
      if (pinch) { if (e.touches.length < 2) pinch = null; return; }
      const js = this.joystick;
      if (js.active && !js.moved) this.handleTap(js.sx, js.sy);
      this.joystick = { active: false, dx: 0, dy: 0, moved: false };
    };
    c.addEventListener('touchend', end);
    c.addEventListener('touchcancel', end);

    // Mouse: left click = walk / talk, right drag = rotate camera, wheel = zoom (like the PC client)
    let rot = null;
    c.addEventListener('mousedown', (e) => { if (e.button === 2) rot = { x: e.clientX, yaw: this.camYaw }; });
    window.addEventListener('mousemove', (e) => { if (rot) this.camYaw = rot.yaw + (e.clientX - rot.x) * 0.01; });
    window.addEventListener('mouseup', () => { rot = null; });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('click', (e) => this.handleTap(e.clientX, e.clientY));
    c.addEventListener('wheel', (e) => { if (!this.active) return; e.preventDefault(); this.camDist = Math.max(250, Math.min(900, this.camDist * (e.deltaY > 0 ? 1.1 : 0.9))); }, { passive: false });
  }

  // ---------------------------------------------------------------- NPC actions
  interactNPC(npc) {
    audio.playCoinSound();
    if (npc.type === 'warp') {
      if (window.uiManager && window.uiManager.openWarpModal) window.uiManager.openWarpModal();
      else this.openWarpModal();
    } else if (npc.type === 'job') {
      if (window.uiManager && window.uiManager.openJobMasterModal) window.uiManager.openJobMasterModal();
    } else if (npc.type === 'shop') {
      if (window.uiManager && window.uiManager.openToolShopModal) window.uiManager.openToolShopModal();
    } else if (npc.type === 'refine') {
      if (window.uiManager && window.uiManager.openRefineModal) window.uiManager.openRefineModal();
    }
  }

  openWarpModal() { const m = document.getElementById('modal-warp-zones'); if (m) m.classList.remove('hidden'); }

  warpToFountain() {
    audio.playLevelUpSound();
    this.player.gx = 156.5; this.player.gy = 191.5; this.path = [];
    if (this.ready) { const c = this.nearestWalkable(156, 191, true); this.player.gx = c[0] + 0.5; this.player.gy = c[1] + 0.5; }
  }

  randomTeleport() {
    if (!this.ready) return;
    for (let i = 0; i < 500; i++) {
      const x = Math.floor(Math.random() * this.gat.w), y = Math.floor(Math.random() * this.gat.h);
      if (this.isWalkable(x, y)) { this.player.gx = x + 0.5; this.player.gy = y + 0.5; this.path = []; return; }
    }
  }

  // Convert screen movement (sx right+, sy up+) into RO 8-direction index (0..7)
  // 0=Down, 1=DownLeft, 2=Left, 3=UpLeft, 4=Up, 5=UpRight, 6=Right, 7=DownRight
  screenDirTo8(sx, sy) {
    // Angle from South (0,-1) clockwise:
    const ang = Math.atan2(-sx, -sy); // 0 = South(Down), +PI/2 = West(Left), +-PI = North(Up), -PI/2 = East(Right)
    const norm = (ang + Math.PI * 2) % (Math.PI * 2);
    return Math.round(norm / (Math.PI / 4)) % 8;
  }

  get8DirFrames(classKey, dir8 = 0) {
    const base = 'class_' + (classKey || 'novice');
    // d0..d4 are stored directly; d5 mirrors d3, d6 mirrors d2, d7 mirrors d1
    const mapDir = [0, 1, 2, 3, 4, 3, 2, 1][dir8 % 8] ?? 0;
    const flip = dir8 >= 5;
    const frames = this.spritePool[`${base}_d${mapDir}`] || this.spritePool[base] || [];
    return { frames, flip };
  }

  isAnyModalOpen() {
    for (const id of ['modal-warp-zones', 'modal-job-master', 'modal-tool-shop', 'modal-refine', 'modal-item-detail', 'modal-card-compound']) {
      const el = document.getElementById(id);
      if (el && !el.classList.contains('hidden')) return true;
    }
    return false;
  }

  // ---------------------------------------------------------------- update/draw
  update(dt) {
    this.animTime += dt;
    if (!this.ready) return;
    const p = this.player;
    if (this.npcTriggerCooldown > 0) this.npcTriggerCooldown -= dt;

    // Direction input (keyboard / joystick) is relative to the camera yaw
    let mx = 0, my = 0;
    if (this.keys['w'] || this.keys['keyw'] || this.keys['arrowup']) my -= 1;
    if (this.keys['s'] || this.keys['keys'] || this.keys['arrowdown']) my += 1;
    if (this.keys['a'] || this.keys['keya'] || this.keys['arrowleft']) mx -= 1;
    if (this.keys['d'] || this.keys['keyd'] || this.keys['arrowright']) mx += 1;
    if (this.joystick.active && this.joystick.moved) { mx += this.joystick.dx; my += this.joystick.dy; }

    let moving = false;
    const step = p.speed * dt;
    if (Math.hypot(mx, my) > 0.05) {
      this.path = [];
      this.pendingNpc = null;
      const len = Math.hypot(mx, my);
      const sx = mx / len, sy = -my / len; // screen up = north (+gy) at yaw 0
      const cs = Math.cos(this.camYaw), sn = Math.sin(this.camYaw);
      const dx = sx * cs + sy * sn, dy = -sx * sn + sy * cs;
      const nx = p.gx + dx * step, ny = p.gy + dy * step;
      if (this.isWalkable(Math.floor(nx), Math.floor(ny))) { p.gx = nx; p.gy = ny; }
      else if (this.isWalkable(Math.floor(nx), Math.floor(p.gy))) p.gx = nx;
      else if (this.isWalkable(Math.floor(p.gx), Math.floor(ny))) p.gy = ny;

      p.dir8 = this.screenDirTo8(sx, sy);
      p.walkHeading = Math.atan2(dx, dy); // 0 = North (+gy), PI/2 = East (+gx)
      moving = true;
    } else if (this.path.length) {
      const [tx, ty] = this.path[0];
      const dx = tx + 0.5 - p.gx, dy = ty + 0.5 - p.gy, d = Math.hypot(dx, dy);
      if (d <= step) { p.gx = tx + 0.5; p.gy = ty + 0.5; this.path.shift(); }
      else { p.gx += dx / d * step; p.gy += dy / d * step; }
      const screenDx = dx * Math.cos(this.camYaw) - dy * Math.sin(this.camYaw);
      const screenDy = dx * Math.sin(this.camYaw) + dy * Math.cos(this.camYaw);
      p.dir8 = this.screenDirTo8(screenDx, screenDy);
      p.walkHeading = Math.atan2(dx, dy);
      moving = true;
    }

    // Check proximity / collision with the 3 Town NPCs!
    if (!this.isAnyModalOpen()) {
      for (const npc of this.npcs) {
        const dist = Math.hypot(p.gx - npc.gx, p.gy - npc.gy);
        if (dist <= 2.35) {
          if (!npc._playerInside && (!this.npcTriggerCooldown || this.npcTriggerCooldown <= 0)) {
            npc._playerInside = true;
            this.npcTriggerCooldown = 1.2;
            this.path = [];
            this.pendingNpc = null;
            this.interactNPC(npc);
            break;
          }
        } else if (dist > 2.8) {
          npc._playerInside = false;
        }
      }
      if (this.pendingNpc && Math.hypot(p.gx - this.pendingNpc.gx, p.gy - this.pendingNpc.gy) <= 3.2) {
        const targetNpc = this.pendingNpc;
        this.pendingNpc = null;
        this.path = [];
        this.interactNPC(targetNpc);
      }
    }

    if (moving) {
      p.animTimer += dt;
      if (p.animTimer > 0.065) {
        p.animTimer -= 0.065;
        p.frameIndex = (p.frameIndex + 1) % 8;
      }
    } else {
      p.animTimer = 0;
      p.frameIndex = 0;
    }

    if (this.clickMarker) { this.clickMarker.t -= dt; if (this.clickMarker.t <= 0) this.clickMarker = null; }

    // Camera follow
    const target = this.toWorld(p.gx, p.gy, 6);
    const cp = Math.cos(this.camPitch);
    this.camera.position.set(
      target.x + Math.sin(this.camYaw) * cp * this.camDist,
      target.y + Math.sin(this.camPitch) * this.camDist,
      target.z + Math.cos(this.camYaw) * cp * this.camDist
    );
    this.camera.lookAt(target);

    // Animated water
    if (this.waterMat && this.waterTex.length) {
      const fi = Math.floor(this.animTime * 15 / Math.max(1, this.meta.water.animSpeed)) % this.waterTex.length;
      if (this.waterMat.map !== this.waterTex[fi]) { this.waterMat.map = this.waterTex[fi]; }
    }

    const coordEl = document.getElementById('hud-map-coords');
    if (coordEl) coordEl.textContent = `${Math.floor(p.gx)}, ${Math.floor(p.gy)}`;
  }

  draw() {
    const ctx = this.ctx, W = this.canvas.width, H = this.canvas.height;
    ctx.clearRect(0, 0, W, H);
    if (!this.ready) {
      ctx.fillStyle = '#fff'; ctx.font = 'bold 14px Tahoma'; ctx.textAlign = 'center';
      ctx.fillText('กำลังโหลดแผนที่ prontera.rsw ...', W / 2, H / 2);
      return;
    }

    // Sprites (depth-tested in 3D so buildings can hide characters like in the real client)
    const p = this.player;
    const dir8 = p.dir8 || 0;
    let currentImg = null;
    let flipHoriz = false;

    // Check if moving: player_walk_d0..d7 (8 frames)
    // If standing idle: player_stand_d0..d7 (3-frame gentle breathing stand pose)
    const isWalking = (p.animTimer > 0) || (this.path && this.path.length > 0);
    if (isWalking) {
      const walkFrames = this.spritePool?.[`player_walk_d${dir8}`];
      if (walkFrames && walkFrames.length) {
        currentImg = walkFrames[p.frameIndex % walkFrames.length];
        flipHoriz = false;
      } else {
        const { frames, flip } = this.get8DirFrames(p.classKey || 'novice', dir8);
        currentImg = frames[p.frameIndex % (frames.length || 8)] || frames[0];
        flipHoriz = flip;
      }
    } else {
      const standFrames = this.spritePool?.[`player_stand_d${dir8}`];
      if (standFrames && standFrames.length) {
        const idleIdx = Math.floor(this.animTime * 3) % standFrames.length;
        currentImg = standFrames[idleIdx] || standFrames[0];
        flipHoriz = false;
      } else {
        const { frames, flip } = this.get8DirFrames(p.classKey || 'novice', dir8);
        currentImg = frames[0];
        flipHoriz = flip;
      }
    }

    this.setSpriteImage(this.playerSprite, currentImg, 16, flipHoriz);
    // Lift player slightly (+0.4) so feet are 100% visible and never submerged in 3D ground geometry!
    this.playerSprite.position.copy(this.toWorld(p.gx, p.gy, 0.4));
    for (const n of this.npcs) {
      const imgs = this.spritePool[n.sprite] || [];
      this.setSpriteImage(n.sprite3d, imgs[0], 15, false);
      n.sprite3d.position.copy(this.toWorld(n.gx, n.gy));
    }

    this.renderer.render(this.scene, this.camera);

    // 2D overlay: NPC name bubbles, player name, click marker, minimap
    for (const n of this.npcs) {
      const s = this.project(this.toWorld(n.gx, n.gy));
      n.screen = s;
      if (!s.visible) continue;
      this.drawBubble(ctx, s.x, s.y - 78 * (520 / this.camDist), n.label);
    }
    const ps = this.project(this.toWorld(p.gx, p.gy));
    ctx.font = 'bold 11px Tahoma, sans-serif'; ctx.textAlign = 'center';
    ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.strokeText(p.name || '', ps.x, ps.y + 16);
    ctx.fillStyle = '#fff'; ctx.fillText(p.name || '', ps.x, ps.y + 16);
    // HP/SP bars under the character (RO style)
    const bw = 44, bx = ps.x - bw / 2, by = ps.y + 20;
    ctx.fillStyle = '#10189c'; ctx.fillRect(bx - 1, by - 1, bw + 2, 8);
    ctx.fillStyle = '#18ce10'; ctx.fillRect(bx, by, bw * Math.max(0, Math.min(1, p.hp / p.maxHp)), 3);
    ctx.fillStyle = '#1873ef'; ctx.fillRect(bx, by + 3, bw * Math.max(0, Math.min(1, p.sp / p.maxSp)), 3);

    if (this.clickMarker) {
      const m = this.project(this.toWorld(this.clickMarker.gx, this.clickMarker.gy));
      ctx.strokeStyle = `rgba(255,255,120,${this.clickMarker.t / 0.6})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(m.x, m.y, 12, 6, 0, 0, Math.PI * 2); ctx.stroke();
    }
    this.drawMinimap(ctx, W);
  }

  project(v) {
    const p = v.clone().project(this.camera);
    return { x: (p.x + 1) / 2 * this.canvas.width, y: (1 - p.y) / 2 * this.canvas.height, visible: p.z < 1 && p.x > -1.2 && p.x < 1.2 && p.y > -1.2 && p.y < 1.2 };
  }

  drawBubble(ctx, x, y, label) {
    ctx.font = '11px Tahoma, sans-serif';
    const tw = ctx.measureText(label).width;
    const w = tw + 30, h = 20, bx = Math.round(x - w / 2), by = Math.round(y - h);
    ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.strokeStyle = '#7b8aa0'; ctx.lineWidth = 1;
    this.roundRect(ctx, bx, by, w, h, 4, true, true);
    ctx.beginPath(); ctx.moveTo(x - 4, by + h); ctx.lineTo(x, by + h + 5); ctx.lineTo(x + 4, by + h); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#6a5acd'; ctx.fillRect(bx + 5, by + 4, 12, 12);
    ctx.fillStyle = '#fff'; ctx.fillRect(bx + 7, by + 6, 8, 6);
    ctx.fillStyle = '#000'; ctx.textAlign = 'left'; ctx.fillText(label, bx + 22, by + 14);
  }

  roundRect(ctx, x, y, w, h, r, fill, stroke) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    if (fill) ctx.fill(); if (stroke) ctx.stroke();
  }

  drawMinimap(ctx, screenW) {
    const size = 104, mx = screenW - size - 10, my = 10;
    ctx.fillStyle = 'rgba(15, 23, 36, 0.92)';
    ctx.fillRect(mx - 2, my - 2, size + 4, size + 4);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(mx - 2, my - 2, size + 4, size + 4);

    if (this.minimapImg.complete && this.minimapImg.width) {
      ctx.drawImage(this.minimapImg, mx, my, size, size);
    }

    const gw = this.gat.w, gh = this.gat.h, s = size / Math.max(gw, gh);
    const ox = mx + (size - gw * s) / 2, oy = my + (size - gh * s) / 2;

    // Draw 3 NPC dots on minimap
    for (const npc of this.npcs) {
      const nx = ox + npc.gx * s, ny = oy + (gh - npc.gy) * s;
      ctx.fillStyle = npc.type === 'warp' ? '#00d2d3' : '#feca57';
      ctx.beginPath();
      ctx.arc(nx, ny, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Player directional triangle rotating with walking direction!
    const px = ox + this.player.gx * s, py = oy + (gh - this.player.gy) * s;
    const heading = this.player.walkHeading !== undefined ? this.player.walkHeading : Math.PI;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(heading);
    ctx.fillStyle = '#ff3b3b';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4.5, 4.5);
    ctx.lineTo(0, 2.5);
    ctx.lineTo(-4.5, 4.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}
