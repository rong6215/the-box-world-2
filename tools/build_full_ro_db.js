const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const boxDir = path.join(__dirname, '../../THE BOX WORLD');
const dataOutDir = path.join(__dirname, '../assets/data');
if (!fs.existsSync(dataOutDir)) fs.mkdirSync(dataOutDir, { recursive: true });

function asciiLowerStr(buf) {
  let s = '';
  for (let i = 0; i < buf.length; i++) {
    let b = buf[i];
    if (b >= 0x41 && b <= 0x5A) b += 32;
    s += String.fromCharCode(b);
  }
  return s;
}

// 1. Load _textures.grf index to verify maps, cards, icons
function loadGrfSet(grfName) {
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
  const set = new Set();
  let pos = 0;
  while (pos < tbl.length) {
    let end = pos;
    while (end < tbl.length && tbl[end] !== 0) end++;
    if (end >= tbl.length) break;
    set.add(asciiLowerStr(tbl.slice(pos, end)));
    pos = end + 1 + entryLen;
  }
  fs.closeSync(fd);
  return set;
}

const texSet = loadGrfSet('_textures.grf');
const uiPrefix = Buffer.from([0x64,0x61,0x74,0x61,0x5c,0x74,0x65,0x78,0x74,0x75,0x72,0x65,0x5c,0xc0,0xaf,0xc0,0xfa,0xc0,0xce,0xc5,0xcd,0xc6,0xe4,0xc0,0xcc,0xbd,0xba,0x5c]).toString('latin1');

// 2. Parse num2cardillustnametable.txt
const cardIllustHexMap = {};
const cardBuf = fs.readFileSync(path.join(boxDir, 'data/num2cardillustnametable.txt'));
const cardRawStr = asciiLowerStr(cardBuf);
for (const line of cardRawStr.split(/\r?\n/)) {
  if (!line || line.startsWith('//')) continue;
  const parts = line.split('#');
  if (parts.length >= 2) {
    const id = parseInt(parts[0], 10);
    const illust = parts[1];
    if (id && illust) {
      cardIllustHexMap[id] = Buffer.from(illust, 'latin1').toString('hex');
    }
  }
}

// 3. Parse resnametable.txt for map BMP aliases
const mapBmpAlias = {};
const resBuf = fs.readFileSync(path.join(boxDir, 'data/resnametable.txt'));
const resStr = asciiLowerStr(resBuf);
for (const line of resStr.split(/\r?\n/)) {
  if (!line || line.startsWith('//')) continue;
  const parts = line.split('#');
  if (parts.length >= 2 && parts[0].includes('\\map\\') && parts[0].endsWith('.bmp')) {
    const srcMap = parts[0].split('\\').pop().replace(/\.bmp$/, '');
    const dstMap = parts[1].split('\\').pop().replace(/\.bmp$/, '');
    if (srcMap && dstMap) mapBmpAlias[srcMap] = dstMap;
  }
}

// 4. Parse mp3nametable.txt
const mp3Map = {};
const mp3Text = fs.readFileSync(path.join(boxDir, 'data/mp3nametable.txt'), 'utf8');
for (const line of mp3Text.split(/\r?\n/)) {
  if (!line || line.startsWith('//')) continue;
  const parts = line.split('#');
  if (parts.length >= 2) {
    const code = parts[0].replace(/\.rsw$/i, '').toLowerCase();
    const bgm = parts[1].replace(/^bgm[\\/]+/i, '').trim();
    if (code && bgm) mp3Map[code] = bgm;
  }
}

// 5. Parse ALL Maps from System/mapInfo_true.lub + any extra .bmp maps in _textures.grf
const mapText = fs.readFileSync(path.join(boxDir, 'System/mapInfo_true.lub'), 'utf8');
const mapEntryRegex = /\["([^"]+)\.rsw"\]\s*=\s*\{([\s\S]*?)\n\t\}/g;
const allMaps = [];
const seenMapCodes = new Set();
let m;
while ((m = mapEntryRegex.exec(mapText)) !== null) {
  const code = m[1].toLowerCase();
  const body = m[2];
  const dispM = body.match(/displayName\s*=\s*"([^"]+)"/);
  const subM = body.match(/subTitle\s*=\s*"([^"]+)"/);
  const mainM = body.match(/mainTitle\s*=\s*"([^"]+)"/);
  const name = (mainM && mainM[1]) || (dispM && dispM[1]) || code;
  const region = (subM && subM[1]) || 'Rune-Midgarts';
  const bmpTarget = mapBmpAlias[code] || code;
  const hasBmp = texSet.has(uiPrefix + 'map\\' + bmpTarget + '.bmp');
  const bgm = mp3Map[code] || '08.mp3';
  seenMapCodes.add(code);
  allMaps.push({
    code,
    bmpCode: hasBmp ? bmpTarget : 'prt_fild08',
    hasBmp,
    name,
    fullName: (dispM && dispM[1]) || name,
    region,
    bgm
  });
}

// Also add any map BMP in _textures.grf that wasn't in mapInfo_true.lub
for (const k of texSet) {
  if (k.startsWith(uiPrefix + 'map\\') && k.endsWith('.bmp')) {
    const code = k.slice((uiPrefix + 'map\\').length, -4);
    if (code && !seenMapCodes.has(code)) {
      seenMapCodes.add(code);
      allMaps.push({
        code,
        bmpCode: code,
        hasBmp: true,
        name: code.toUpperCase(),
        fullName: code.toUpperCase(),
        region: 'Ragnarok World',
        bgm: mp3Map[code] || '12.mp3'
      });
    }
  }
}

console.log('Total Maps compiled:', allMaps.length, '| with exact BMP:', allMaps.filter(x => x.hasBmp).length);

// 6. Parse ALL 29,368 items from System/itemInfo_true.lub
const itemBuf = fs.readFileSync(path.join(boxDir, 'System/itemInfo_true.lub'));
const itemLatin1 = itemBuf.toString('latin1');
const tdThai = new TextDecoder('windows-874');

function decodeThaiFromLatin1(str) {
  const b = Buffer.from(str, 'latin1');
  return tdThai.decode(b);
}

function stripColorCodes(s) {
  return s.replace(/\^[0-9A-Fa-f]{6}/g, '').replace(/<ITEM>([^<]*?)<INFO>\d+<\/INFO><\/ITEM>/g, '$1').trim();
}

const itemRegex = /\t\[(\d+)\]\s*=\s*\{([\s\S]*?)\n\t\},?/g;
const itemResMap = {}; // id -> resHex
const weapons = [];
const armors = [];
const costumes = [];
const cards = [];
const usables = [];
const etcs = [];

let itemCount = 0;
while ((m = itemRegex.exec(itemLatin1)) !== null) {
  const id = parseInt(m[1], 10);
  const blockLatin1 = m[2];
  itemCount++;

  // Extract raw identifiedResourceName
  const resM = blockLatin1.match(/identifiedResourceName\s*=\s*"([^"]*)"/);
  const rawRes = resM ? resM[1] : '';
  const resHex = Buffer.from( asciiLowerStr(Buffer.from(rawRes, 'latin1')), 'latin1' ).toString('hex');
  itemResMap[id] = resHex;

  // Decode block in Thai (windows-874)
  const blockThai = decodeThaiFromLatin1(blockLatin1);
  const nameM = blockThai.match(/identifiedDisplayName\s*=\s*"([^"]*)"/);
  const name = nameM ? nameM[1].trim() : `Item #${id}`;
  const slotM = blockThai.match(/slotCount\s*=\s*(\d+)/);
  const slots = slotM ? parseInt(slotM[1], 10) : 0;
  const classNumM = blockThai.match(/ClassNum\s*=\s*(\d+)/);
  const viewId = classNumM ? parseInt(classNumM[1], 10) : 0;
  const isCostume = /costume\s*=\s*true/.test(blockThai);

  // Extract description lines
  const descBlockM = blockThai.match(/identifiedDescriptionName\s*=\s*\{([\s\S]*?)\n\t\t\}/);
  const rawDesc = descBlockM ? descBlockM[1] : '';
  const descLines = [];
  const lineReg = /"([^"]*)"/g;
  let lm;
  while ((lm = lineReg.exec(rawDesc)) !== null) {
    const clean = stripColorCodes(lm[1]);
    if (clean && !clean.startsWith('———') && !clean.startsWith('ID:')) {
      descLines.push(clean);
    }
  }

  const typeM = blockThai.match(/\^3F28FFประเภท:\^000000\s*([^\r\n"]+)/);
  const rawType = typeM ? typeM[1].trim() : '';
  const subTypeM = blockThai.match(/\^3F28FFประเภทรอง:\^000000\s*([^\r\n"]+)/);
  const subType = subTypeM ? subTypeM[1].trim() : '';
  const posM = blockThai.match(/\^3F28FFตำแหน่ง:\^000000\s*([^\r\n"]+)/);
  const rawPos = posM ? posM[1].trim() : '';

  const atkM = blockThai.match(/\^3F28FFโจมตี:\^000000\s*(\d+)/);
  const matkM = blockThai.match(/MAtk\s*\+(\d+)/i);
  const defM = blockThai.match(/\^3F28FFป้องกัน:\^000000\s*(\d+)/);
  const reqLvM = blockThai.match(/\^3F28FFLv\.\s*ขั้นต่ำ:\^000000\s*(\d+)/);
  const wLvM = blockThai.match(/\^3F28FFLv\.\s*(?:อาวุธ|ชุด):\^000000\s*(\d+)/);
  const weightM = blockThai.match(/\^3F28FFน้ำหนัก:\^000000\s*([\d,]+)/);
  const priceM = blockThai.match(/\^3F28FFราคา:\^000000\s*([\d,]+)/);

  const atk = atkM ? parseInt(atkM[1], 10) : 0;
  const matk = matkM ? parseInt(matkM[1], 10) : 0;
  const def = defM ? parseInt(defM[1], 10) : 0;
  const reqLv = reqLvM ? parseInt(reqLvM[1], 10) : 1;
  const wLv = wLvM ? parseInt(wLvM[1], 10) : 1;
  const weight = weightM ? parseInt(weightM[1].replace(/,/g, ''), 10) : 10;
  const price = priceM ? parseInt(priceM[1].replace(/,/g, ''), 10) : 100;

  // Parse stat bonuses from description
  const stats = {};
  const fullDescText = descLines.join('\n');
  const strB = fullDescText.match(/\bStr\s*\+(\d+)/i); if (strB) stats.str = parseInt(strB[1], 10);
  const agiB = fullDescText.match(/\bAgi\s*\+(\d+)/i); if (agiB) stats.agi = parseInt(agiB[1], 10);
  const vitB = fullDescText.match(/\bVit\s*\+(\d+)/i); if (vitB) stats.vit = parseInt(vitB[1], 10);
  const intB = fullDescText.match(/\bInt\s*\+(\d+)/i); if (intB) stats.int = parseInt(intB[1], 10);
  const dexB = fullDescText.match(/\bDex\s*\+(\d+)/i); if (dexB) stats.dex = parseInt(dexB[1], 10);
  const lukB = fullDescText.match(/\bLuk\s*\+(\d+)/i); if (lukB) stats.luk = parseInt(lukB[1], 10);
  const atkB = fullDescText.match(/\bAtk\s*\+(\d+)(?!%)/i); if (atkB) stats.atk = parseInt(atkB[1], 10);
  const atkPctB = fullDescText.match(/\bAtk\s*\+(\d+)%/i); if (atkPctB) stats.atkPct = parseInt(atkPctB[1], 10);
  const matkPctB = fullDescText.match(/\bMAtk\s*\+(\d+)%/i); if (matkPctB) stats.matkPct = parseInt(matkPctB[1], 10);
  const critB = fullDescText.match(/\bCritical\s*\+(\d+)/i); if (critB) stats.crit = parseInt(critB[1], 10);
  const aspdB = fullDescText.match(/\bASPD\s*\+(\d+)/i); if (aspdB) stats.aspd = parseInt(aspdB[1], 10);
  const hpB = fullDescText.match(/\bMaxHP\s*\+(\d+)(?!%)/i); if (hpB) stats.maxHp = parseInt(hpB[1], 10);
  const spB = fullDescText.match(/\bMaxSP\s*\+(\d+)(?!%)/i); if (spB) stats.maxSp = parseInt(spB[1], 10);
  const fleeB = fullDescText.match(/\bFlee\s*\+(\d+)/i); if (fleeB) stats.flee = parseInt(fleeB[1], 10);
  const hitB = fullDescText.match(/\bHit\s*\+(\d+)/i); if (hitB) stats.hit = parseInt(hitB[1], 10);

  const shortDesc = descLines.slice(0, 6).join('\n');

  if (rawType === 'Weapon') {
    weapons.push({
      id, name, slot: 'weapon', subType: subType || 'Weapon',
      atk: atk || (wLv * 35), matk: matk || 0, def, slots, reqLv, wLv, weight, price, viewId, stats, desc: shortDesc
    });
  } else if (rawType === 'Card') {
    let targetSlot = 'weapon';
    if (rawPos.includes('ชุด')) targetSlot = 'armor';
    else if (rawPos.includes('มือซ้าย') || rawPos.includes('โล่')) targetSlot = 'shield';
    else if (rawPos.includes('ผ้าคลุม')) targetSlot = 'garment';
    else if (rawPos.includes('รองเท้า')) targetSlot = 'shoes';
    else if (rawPos.includes('หมวก')) targetSlot = 'head_top';
    else if (rawPos.includes('ประดับ')) targetSlot = 'accessory';
    // Ensure every card has meaningful combat stats in survivors mode
    if (Object.keys(stats).length === 0) {
      stats.atk = 12 + (id % 15);
      stats.str = 2 + (id % 5);
    }
    cards.push({
      id, name, targetSlot, posTh: rawPos || 'อาวุธ',
      hasIllust: !!cardIllustHexMap[id],
      stats, desc: shortDesc || `การ์ดมอนสเตอร์แท้จาก RO (ใส่กับ: ${rawPos || 'อาวุธ'})`
    });
  } else if (isCostume || rawType.toLowerCase() === 'shadowgear' || rawPos.includes('Cos') || rawPos.includes('S.')) {
    let cSlot = 'cos_top';
    if (rawPos.includes('Cos Mid')) cSlot = 'cos_mid';
    else if (rawPos.includes('Cos Low')) cSlot = 'cos_low';
    else if (rawPos.includes('ผ้าคลุม Cos')) cSlot = 'cos_garment';
    else if (rawPos.includes('ชุด S.')) cSlot = 'shadow_armor';
    else if (rawPos.includes('อาวุธ S.')) cSlot = 'shadow_weapon';
    else if (rawPos.includes('โล่ S.')) cSlot = 'shadow_shield';
    else if (rawPos.includes('รองเท้า S.')) cSlot = 'shadow_shoes';
    else if (rawPos.includes('ประดับขวา S.')) cSlot = 'shadow_earring';
    else if (rawPos.includes('ประดับซ้าย S.')) cSlot = 'shadow_pendant';
    costumes.push({
      id, name, slot: cSlot, posTh: rawPos || 'หมวก Cos Top',
      def: def || 5, slots, reqLv, viewId, stats, desc: shortDesc
    });
  } else if (rawType === 'Armor') {
    let eqSlot = 'armor';
    if (rawPos.includes('หมวก Top') || rawPos.includes('หมวกบน')) eqSlot = 'head_top';
    else if (rawPos.includes('หมวก Mid') || rawPos.includes('หมวกกลาง')) eqSlot = 'head_mid';
    else if (rawPos.includes('หมวก Low') || rawPos.includes('หมวกล่าง')) eqSlot = 'head_low';
    else if (rawPos.includes('มือซ้าย') || rawPos.includes('โล่')) eqSlot = 'shield';
    else if (rawPos.includes('ผ้าคลุม')) eqSlot = 'garment';
    else if (rawPos.includes('รองเท้า')) eqSlot = 'shoes';
    else if (rawPos.includes('ประดับซ้าย')) eqSlot = 'acc2';
    else if (rawPos.includes('ประดับ')) eqSlot = 'acc1';
    armors.push({
      id, name, slot: eqSlot, posTh: rawPos || 'ชุด',
      atk, matk, def: def || 10, slots, reqLv, wLv, weight, price, viewId, stats, desc: shortDesc
    });
  } else if (rawType === 'Healing' || rawType === 'Usable' || rawType.toLowerCase() === 'delayconsume') {
    usables.push({
      id, name, rawType, weight, price: price || 100, desc: shortDesc
    });
  } else {
    etcs.push({
      id, name, weight, price: price || 20, desc: shortDesc
    });
  }
}

console.log('Parsed items:', {
  total: itemCount,
  weapons: weapons.length,
  armors: armors.length,
  costumes: costumes.length,
  cards: cards.length,
  usables: usables.length,
  etcs: etcs.length
});

// Save server lookup table (itemResMap + cardIllustHexMap + full categorized lists)
const serverDb = {
  counts: {
    maps: allMaps.length,
    totalItems: itemCount,
    weapons: weapons.length,
    armors: armors.length,
    costumes: costumes.length,
    cards: cards.length,
    usables: usables.length,
    etcs: etcs.length
  },
  itemResMap,
  cardIllustHexMap,
  maps: allMaps,
  weapons,
  armors,
  costumes,
  cards,
  usables,
  etcs
};

const outPath = path.join(dataOutDir, 'ro_full_db.json');
fs.writeFileSync(outPath, JSON.stringify(serverDb));
console.log('Saved ro_full_db.json, size:', (fs.statSync(outPath).size / 1024 / 1024).toFixed(2), 'MB');
