// Minimal GRF 0x200 reader (uncompressed table + zlib entries)
const fs = require('fs');
const zlib = require('zlib');

const dec = new TextDecoder('euc-kr');

class GRF {
  constructor(file) {
    this.file = file;
    this.fd = fs.openSync(file, 'r');
    const header = Buffer.alloc(46);
    fs.readSync(this.fd, header, 0, 46, 0);
    this.version = header.readUInt32LE(42);
    const v3 = this.version === 0x300;
    const tableOffset = (v3 ? Number(header.readBigUInt64LE(30)) : header.readUInt32LE(30)) + 46;
    const th = Buffer.alloc(12);
    fs.readSync(this.fd, th, 0, 12, tableOffset);
    const skip = v3 ? 4 : 0;
    const compSize = th.readUInt32LE(skip);
    const comp = Buffer.alloc(compSize);
    fs.readSync(this.fd, comp, 0, compSize, tableOffset + skip + 8);
    const table = zlib.inflateSync(comp);
    this.entries = new Map();
    const entLen = v3 ? 21 : 17;
    let o = 0;
    while (o < table.length) {
      let e = o;
      while (e < table.length && table[e] !== 0) e++;
      const raw = table.subarray(o, e);
      o = e + 1;
      if (o + entLen > table.length) break;
      const csize = table.readUInt32LE(o);
      const asize = table.readUInt32LE(o + 4);
      const size = table.readUInt32LE(o + 8);
      const flags = table[o + 12];
      const offset = v3 ? Number(table.readBigUInt64LE(o + 13)) : table.readUInt32LE(o + 13);
      o += entLen;
      const name = dec.decode(raw).toLowerCase().replace(/\//g, '\\');
      this.entries.set(name, { csize, asize, size, flags, offset });
    }
  }
  has(name) { return this.entries.has(name.toLowerCase().replace(/\//g, '\\')); }
  get(name) {
    const info = this.entries.get(name.toLowerCase().replace(/\//g, '\\'));
    if (!info) return null;
    if (!(info.flags & 1)) return null; // directory
    if (info.flags & 6) return null; // DES-encrypted, unsupported
    const buf = Buffer.alloc(info.asize);
    fs.readSync(this.fd, buf, 0, info.asize, info.offset + 46);
    if (info.csize === info.size) return buf.subarray(0, info.size);
    try { return zlib.inflateSync(buf.subarray(0, info.csize)); } catch (e) { return null; }
  }
}

// Loads GRFs in DATA.ini priority order (first = highest priority) + loose data folder
class GRFSet {
  constructor(root, names) {
    this.root = root;
    this.grfs = names.map(n => { try { return new GRF(root + '/' + n); } catch (e) { console.warn('skip', n, e.message); return null; } }).filter(Boolean);
  }
  get(name) {
    const norm = name.toLowerCase().replace(/\//g, '\\');
    const loose = this.root + '/' + norm.replace(/\\/g, '/');
    if (fs.existsSync(loose)) return fs.readFileSync(loose);
    for (const g of this.grfs) {
      const b = g.get(norm);
      if (b) return b;
    }
    return null;
  }
  find(re) {
    const out = [];
    for (const g of this.grfs) for (const k of g.entries.keys()) if (re.test(k)) out.push([g.file, k]);
    return out;
  }
}

module.exports = { GRF, GRFSet };
