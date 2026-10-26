// RO Survivors x D2 Survivors - Authentic Full RO Client Database Integration
// Pulls 100% of data extracted from THE BOX WORLD (System/itemInfo_true.lub, mapInfo_true.lub, _textures.grf, data.grf):
// - 1,272 Maps (rendered via real 3D .gnd groundmaps & .bmp textures)
// - 2,806 Weapons (อาวุธ)
// - 5,713 Armors/Equipment (ของสวมใส่)
// - 4,269 Costumes & Shadow Gear (คอสสวมใส่)
// - 5,593 Monster Cards (การ์ด)
// - 4,005 Usable/Healing Items (ไอเทมกดใช้)
// - 6,982 Etc Items (ขยะมอนสเตอร์/ของทั่วไป)
// Total: 29,368 Items + 1,272 Maps

export const EQUIP_SLOTS_10 = [
  // Left Column (5 slots matching equipwin_bg.png)
  { key: 'head_top', side: 'left',  row: 0, label: 'Upper Head (หมวกบน)', th: 'หมวกบน' },
  { key: 'head_mid', side: 'left',  row: 1, label: 'Mid Head (หมวกกลาง)', th: 'หมวกกลาง' },
  { key: 'armor',    side: 'left',  row: 2, label: 'Armor (เสื้อเกราะ)',   th: 'เสื้อเกราะ' },
  { key: 'weapon',   side: 'left',  row: 3, label: 'Right Hand (อาวุธ)',   th: 'มือขวา (อาวุธ)' },
  { key: 'garment',  side: 'left',  row: 4, label: 'Garment (ผ้าคลุม)',    th: 'ผ้าคลุม' },
  // Right Column (5 slots matching equipwin_bg.png)
  { key: 'head_low', side: 'right', row: 0, label: 'Lower Head (หมวกล่าง)', th: 'หมวกล่าง' },
  { key: 'shield',   side: 'right', row: 1, label: 'Left Hand (โล่)',       th: 'มือซ้าย (โล่)' },
  { key: 'shoes',    side: 'right', row: 2, label: 'Shoes (รองเท้า)',       th: 'รองเท้า' },
  { key: 'acc1',     side: 'right', row: 3, label: 'Accessory R (ประดับ 1)', th: 'ประดับ 1' },
  { key: 'acc2',     side: 'right', row: 4, label: 'Accessory L (ประดับ 2)', th: 'ประดับ 2' }
];

export const COSTUME_SLOTS_10 = [
  // Left Column (Costume Headgears, Costume Garment, Shadow Armor)
  { key: 'cos_top',        side: 'left',  row: 0, label: 'Costume Upper (คอสหมวกบน)',   th: 'คอสหมวกบน' },
  { key: 'cos_mid',        side: 'left',  row: 1, label: 'Costume Mid (คอสหมวกกลาง)',   th: 'คอสหมวกกลาง' },
  { key: 'cos_low',        side: 'left',  row: 2, label: 'Costume Lower (คอสหมวกล่าง)', th: 'คอสหมวกล่าง' },
  { key: 'cos_garment',    side: 'left',  row: 3, label: 'Costume Garment (คอสผ้าคลุม)',th: 'คอสผ้าคลุม' },
  { key: 'shadow_armor',   side: 'left',  row: 4, label: 'Shadow Armor (ชุดชาโดว์)',     th: 'ชุด Shadow' },
  // Right Column (Shadow Weapon, Shield, Shoes, Earring, Pendant)
  { key: 'shadow_weapon',  side: 'right', row: 0, label: 'Shadow Weapon (อาวุธชาโดว์)',  th: 'อาวุธ Shadow' },
  { key: 'shadow_shield',  side: 'right', row: 1, label: 'Shadow Shield (โล่ชาโดว์)',    th: 'โล่ Shadow' },
  { key: 'shadow_shoes',   side: 'right', row: 2, label: 'Shadow Shoes (รองเท้าชาโดว์)', th: 'รองเท้า Shadow' },
  { key: 'shadow_earring', side: 'right', row: 3, label: 'Shadow Earring (ตุ้มหูชาโดว์)',th: 'ประดับขวา S.' },
  { key: 'shadow_pendant', side: 'right', row: 4, label: 'Shadow Pendant (สร้อยชาโดว์)', th: 'ประดับซ้าย S.' }
];

// Full RO Database container (loaded from assets/data/ro_full_db.json)
export const RO_DB = {
  loaded: false,
  counts: { maps: 1272, totalItems: 29368, weapons: 2806, armors: 5713, costumes: 4269, cards: 5593, usables: 4005, etcs: 6982 },
  maps: [],
  weapons: [],
  armors: [],
  costumes: [],
  cards: [],
  usables: [],
  etcs: [],
  cardById: new Map(),
  itemById: new Map(),
  mapByCode: new Map()
};

function classifyMapToZoneId(mapCode = '') {
  const c = mapCode.toLowerCase();
  if (c.startsWith('prt_sewb')) return 2;
  if (c.startsWith('prt_') || c.startsWith('prontera')) return 1;
  if (c.startsWith('pay_dun')) return 6;
  if (c.startsWith('pay_') || c.startsWith('payon') || c.startsWith('alb')) return 3;
  if (c.startsWith('moc_pryd')) return 8;
  if (c.startsWith('in_sphinx')) return 10;
  if (c.startsWith('moc_') || c.startsWith('morocc') || c.startsWith('cmd_')) return 4;
  if (c.startsWith('iz_') || c.startsWith('izlude')) return 5;
  if (c.startsWith('gef_fild10') || c.startsWith('orcs')) return 7;
  if (c.startsWith('gef_dun') || c.startsWith('geffen') || c.startsWith('gef_') || c.startsWith('mjo_')) return 9;
  if (c.startsWith('c_tower') || c.startsWith('alde')) return 11;
  if (c.startsWith('gl_church') || c.startsWith('gl_chyard') || c.startsWith('gl_cas01') || c.startsWith('gl_prison')) return 12;
  if (c.startsWith('gl_')) return 13;
  if (c.startsWith('tur_')) return 14;
  if (c.startsWith('mag_') || c.startsWith('yuno') || c.startsWith('ein_') || c.startsWith('thor_')) return 15;
  if (c.startsWith('ama_') || c.startsWith('gon_') || c.startsWith('lou_') || c.startsWith('ayo_')) return 16;
  if (c.startsWith('nif_') || c.startsWith('umb_')) return 17;
  if (c.startsWith('abyss_') || c.startsWith('hu_') || c.startsWith('odin_')) return 18;
  if (c.startsWith('tha_') || c.startsWith('ra_') || c.startsWith('ve_') || c.startsWith('ice_')) return 19;
  if (c.startsWith('lhz_') || c.startsWith('spl_') || c.startsWith('man_') || c.startsWith('dic_') || c.startsWith('bif_')) return 20;
  // Deterministic fallback across 20 zones
  let hash = 0;
  for (let i = 0; i < c.length; i++) hash = (hash * 31 + c.charCodeAt(i)) >>> 0;
  return (hash % 20) + 1;
}

export async function loadFullRoDatabase() {
  if (RO_DB.loaded) return RO_DB;
  try {
    const res = await fetch('assets/data/ro_full_db.json');
    const data = await res.json();
    RO_DB.counts = data.counts || RO_DB.counts;
    RO_DB.maps = data.maps || [];
    RO_DB.weapons = data.weapons || [];
    RO_DB.armors = data.armors || [];
    RO_DB.costumes = data.costumes || [];
    RO_DB.cards = data.cards || [];
    RO_DB.usables = data.usables || [];
    RO_DB.etcs = data.etcs || [];

    ZONES_20.forEach(z => { z.roMaps = []; });

    RO_DB.maps.forEach(m => {
      RO_DB.mapByCode.set(m.code, m);
      const zId = classifyMapToZoneId(m.code);
      const zone = ZONES_20[zId - 1];
      if (zone) zone.roMaps.push(m);
    });

    RO_DB.cards.forEach(c => {
      const stats = { ...(c.stats || {}) };
      // Give ~25% of cards a Skill Cooldown Reduction (cdrPct) bonus if they don't already have one
      if (!stats.cdrPct && (c.id % 4 === 0)) {
        stats.cdrPct = 4 + (c.id % 7);
      }
      let desc = c.desc || '';
      if (stats.cdrPct && !desc.includes('คูลดาวน์')) {
        desc += `\n• ลดคูลดาวน์สกิล (Skill Cooldown) -${stats.cdrPct}%`;
      }
      const cardObj = {
        ...c,
        stats,
        desc,
        id: `card_${c.id}`,
        numId: c.id,
        prefix: c.prefix || 'Enchanted',
        art: c.hasIllust ? `/grf/card/${c.id}.png` : `/grf/collection/${c.id}.png`,
        icon: `/grf/icon/${c.id}.png`,
        collection: `/grf/collection/${c.id}.png`
      };
      RO_DB.cardById.set(cardObj.id, cardObj);
      RO_DB.cardById.set(String(c.id), cardObj);
      CARD_DB[cardObj.id] = cardObj;
    });

    RO_DB.loaded = true;
    console.log(`[RO_DB] Loaded 100% RO Database: ${RO_DB.counts.totalItems} items, ${RO_DB.maps.length} maps grouped into 20 Zones.`);
  } catch (err) {
    console.error('[RO_DB] Failed to load ro_full_db.json:', err);
  }
  return RO_DB;
}

export function getCardDef(cardId) {
  if (!cardId) return null;
  if (CARD_DB[cardId]) return CARD_DB[cardId];
  if (RO_DB.cardById.has(String(cardId))) return RO_DB.cardById.get(String(cardId));
  return null;
}

// ============================================================================
// All 40 Authentic RO Job Classes with Real Sprites & Progressive Job Conditions
// Novice (Job Lv.10) -> Class 1 (Job Lv.40) -> Class 2 (Base Lv.99 / Job Lv.50) -> High Class / Class 3
// ============================================================================
export const JOB_TREES = {
  novice: {
    id: 'novice',
    name: 'Novice (โนวิซ)',
    tier: 0,
    branch: 'novice',
    parentJob: null,
    reqBaseLv: 1,
    reqJobLv: 1,
    sprite: 'novice',
    attackType: 'melee_slash',
    hpMod: 1.0,
    spMod: 1.0,
    bonus: { str: 2, agi: 2, vit: 2, int: 2, dex: 2, luk: 2 },
    offensiveSkills: ['sm_bash'],
    supportSkills: ['nv_firstaid']
  },

  // === SWORDSMAN LINE ===
  swordsman: {
    id: 'swordsman',
    name: 'Swordsman (นักดาบ - คลาส 1)',
    tier: 1,
    branch: 'swordsman',
    parentJob: 'novice',
    reqBaseLv: 10,
    reqJobLv: 10,
    sprite: 'swordsman',
    attackType: 'melee_slash',
    hpMod: 1.35,
    spMod: 1.0,
    bonus: { str: 8, agi: 4, vit: 8, int: 2, dex: 5, luk: 2 },
    offensiveSkills: ['sm_bash', 'sm_magnum'],
    supportSkills: ['sm_endure']
  },
  knight: {
    id: 'knight',
    name: 'Knight (ไนท์ - คลาส 2-1)',
    tier: 2,
    branch: 'swordsman',
    parentJob: 'swordsman',
    reqBaseLv: 40,
    reqJobLv: 40,
    sprite: 'knight',
    attackType: 'melee_slash',
    hpMod: 1.65,
    spMod: 1.15,
    bonus: { str: 15, agi: 8, vit: 14, int: 4, dex: 10, luk: 4 },
    offensiveSkills: ['sm_bash', 'sm_magnum', 'kn_bowlingbash'],
    supportSkills: ['sm_endure', 'kn_twohandquicken']
  },
  crusader: {
    id: 'crusader',
    name: 'Crusader (ครูเซเดอร์ - คลาส 2-2)',
    tier: 2,
    branch: 'swordsman',
    parentJob: 'swordsman',
    reqBaseLv: 40,
    reqJobLv: 40,
    sprite: 'crusader',
    attackType: 'melee_slash',
    hpMod: 1.75,
    spMod: 1.25,
    bonus: { str: 13, agi: 7, vit: 16, int: 8, dex: 10, luk: 4 },
    offensiveSkills: ['sm_bash', 'sm_magnum', 'kn_bowlingbash', 'al_holylight'],
    supportSkills: ['sm_endure', 'pr_kyrie']
  },
  lord_knight: {
    id: 'lord_knight',
    name: 'Lord Knight (ลอร์ดไนท์ - ไฮคลาส)',
    tier: 2,
    isHighClass: true,
    branch: 'swordsman',
    parentJob: 'knight',
    reqBaseLv: 70,
    reqJobLv: 45,
    sprite: 'lord_knight',
    attackType: 'melee_slash',
    hpMod: 1.95,
    spMod: 1.35,
    bonus: { str: 22, agi: 12, vit: 18, int: 6, dex: 14, luk: 6 },
    offensiveSkills: ['sm_bash', 'sm_magnum', 'kn_bowlingbash', 'lk_spiralpierce'],
    supportSkills: ['sm_endure', 'kn_twohandquicken', 'lk_aurablade']
  },
  paladin: {
    id: 'paladin',
    name: 'Paladin (พาลาดิน - ไฮคลาส)',
    tier: 2,
    isHighClass: true,
    branch: 'swordsman',
    parentJob: 'crusader',
    reqBaseLv: 70,
    reqJobLv: 45,
    sprite: 'paladin',
    attackType: 'melee_slash',
    hpMod: 2.05,
    spMod: 1.45,
    bonus: { str: 18, agi: 10, vit: 24, int: 12, dex: 14, luk: 6 },
    offensiveSkills: ['sm_bash', 'kn_bowlingbash', 'lk_spiralpierce'],
    supportSkills: ['sm_endure', 'pr_kyrie', 'lk_aurablade']
  },
  rune_knight: {
    id: 'rune_knight',
    name: 'Rune Knight (รูนไนท์ - คลาส 3)',
    tier: 3,
    branch: 'swordsman',
    parentJob: 'lord_knight',
    reqBaseLv: 99,
    reqJobLv: 50,
    sprite: 'rune_knight',
    attackType: 'melee_slash',
    hpMod: 2.4,
    spMod: 1.65,
    bonus: { str: 32, agi: 18, vit: 28, int: 12, dex: 20, luk: 10 },
    offensiveSkills: ['sm_bash', 'sm_magnum', 'kn_bowlingbash', 'lk_spiralpierce', 'rk_ignitionbreak', 'rk_dragonbreath'],
    supportSkills: ['sm_endure', 'kn_twohandquicken', 'lk_aurablade', 'lk_berserk']
  },
  royal_guard: {
    id: 'royal_guard',
    name: 'Royal Guard (รอยัลการ์ด - คลาส 3)',
    tier: 3,
    branch: 'swordsman',
    parentJob: 'paladin',
    reqBaseLv: 99,
    reqJobLv: 50,
    sprite: 'royal_guard',
    attackType: 'melee_slash',
    hpMod: 2.55,
    spMod: 1.75,
    bonus: { str: 28, agi: 16, vit: 34, int: 16, dex: 20, luk: 10 },
    offensiveSkills: ['kn_bowlingbash', 'lk_spiralpierce', 'rk_ignitionbreak', 'rk_dragonbreath'],
    supportSkills: ['sm_endure', 'pr_kyrie', 'lk_aurablade']
  },

  // === MAGE LINE ===
  mage: {
    id: 'mage',
    name: 'Mage (เมจ - คลาส 1)',
    tier: 1,
    branch: 'mage',
    parentJob: 'novice',
    reqBaseLv: 10,
    reqJobLv: 10,
    sprite: 'mage',
    attackType: 'magic_bolt',
    hpMod: 0.95,
    spMod: 1.6,
    bonus: { str: 1, agi: 4, vit: 3, int: 12, dex: 8, luk: 3 },
    offensiveSkills: ['mg_firebolt', 'mg_coldbolt', 'mg_lightningbolt'],
    supportSkills: ['mg_energycoat']
  },
  wizard: {
    id: 'wizard',
    name: 'Wizard (วิซาร์ด - คลาส 2-1)',
    tier: 2,
    branch: 'mage',
    parentJob: 'mage',
    reqBaseLv: 40,
    reqJobLv: 40,
    sprite: 'wizard',
    attackType: 'magic_bolt',
    hpMod: 1.15,
    spMod: 2.0,
    bonus: { str: 2, agi: 8, vit: 6, int: 24, dex: 16, luk: 6 },
    offensiveSkills: ['mg_firebolt', 'mg_coldbolt', 'mg_lightningbolt', 'wz_stormgust', 'wz_meteor'],
    supportSkills: ['mg_energycoat', 'hw_magicpower']
  },
  sage: {
    id: 'sage',
    name: 'Sage (เสจ - คลาส 2-2)',
    tier: 2,
    branch: 'mage',
    parentJob: 'mage',
    reqBaseLv: 40,
    reqJobLv: 40,
    sprite: 'sage',
    attackType: 'magic_bolt',
    hpMod: 1.25,
    spMod: 1.9,
    bonus: { str: 4, agi: 12, vit: 8, int: 22, dex: 16, luk: 6 },
    offensiveSkills: ['mg_firebolt', 'mg_coldbolt', 'mg_lightningbolt', 'wz_stormgust'],
    supportSkills: ['mg_energycoat', 'hw_magicpower']
  },
  high_wizard: {
    id: 'high_wizard',
    name: 'High Wizard (ไฮวิซาร์ด - ไฮคลาส)',
    tier: 2,
    isHighClass: true,
    branch: 'mage',
    parentJob: 'wizard',
    reqBaseLv: 70,
    reqJobLv: 45,
    sprite: 'high_wizard',
    attackType: 'magic_bolt',
    hpMod: 1.35,
    spMod: 2.3,
    bonus: { str: 3, agi: 10, vit: 10, int: 32, dex: 22, luk: 8 },
    offensiveSkills: ['mg_firebolt', 'mg_coldbolt', 'wz_stormgust', 'wz_meteor'],
    supportSkills: ['mg_energycoat', 'hw_magicpower']
  },
  professor: {
    id: 'professor',
    name: 'Professor (โปรเฟสเซอร์ - ไฮคลาส)',
    tier: 2,
    isHighClass: true,
    branch: 'mage',
    parentJob: 'sage',
    reqBaseLv: 70,
    reqJobLv: 45,
    sprite: 'professor',
    attackType: 'magic_bolt',
    hpMod: 1.45,
    spMod: 2.2,
    bonus: { str: 6, agi: 14, vit: 12, int: 28, dex: 22, luk: 8 },
    offensiveSkills: ['mg_firebolt', 'mg_coldbolt', 'wz_stormgust', 'wz_meteor'],
    supportSkills: ['mg_energycoat', 'hw_magicpower']
  },
  warlock: {
    id: 'warlock',
    name: 'Warlock (วอร์ล็อค - คลาส 3)',
    tier: 3,
    branch: 'mage',
    parentJob: 'high_wizard',
    reqBaseLv: 99,
    reqJobLv: 50,
    sprite: 'warlock',
    attackType: 'magic_bolt',
    hpMod: 1.6,
    spMod: 2.7,
    bonus: { str: 4, agi: 14, vit: 14, int: 42, dex: 28, luk: 12 },
    offensiveSkills: ['mg_firebolt', 'mg_coldbolt', 'wz_stormgust', 'wz_meteor', 'wl_crimsonrock', 'wl_chainlightning'],
    supportSkills: ['mg_energycoat', 'hw_magicpower', 'wl_recognizedspell']
  },
  sorcerer: {
    id: 'sorcerer',
    name: 'Sorcerer (ซอร์เซอเรอร์ - คลาส 3)',
    tier: 3,
    branch: 'mage',
    parentJob: 'professor',
    reqBaseLv: 99,
    reqJobLv: 50,
    sprite: 'sorcerer',
    attackType: 'magic_bolt',
    hpMod: 1.7,
    spMod: 2.6,
    bonus: { str: 8, agi: 20, vit: 18, int: 38, dex: 28, luk: 12 },
    offensiveSkills: ['mg_coldbolt', 'wz_stormgust', 'wl_crimsonrock', 'wl_chainlightning'],
    supportSkills: ['mg_energycoat', 'hw_magicpower', 'wl_recognizedspell']
  },

  // === ARCHER LINE ===
  archer: {
    id: 'archer',
    name: 'Archer (นักธนู - คลาส 1)',
    tier: 1,
    branch: 'archer',
    parentJob: 'novice',
    reqBaseLv: 10,
    reqJobLv: 10,
    sprite: 'archer',
    attackType: 'bow_arrow',
    hpMod: 1.1,
    spMod: 1.15,
    bonus: { str: 4, agi: 9, vit: 4, int: 3, dex: 12, luk: 5 },
    offensiveSkills: ['ac_double', 'ac_shower'],
    supportSkills: ['ac_concentration']
  },
  hunter: {
    id: 'hunter',
    name: 'Hunter (ฮันเตอร์ - คลาส 2)',
    tier: 2,
    branch: 'archer',
    parentJob: 'archer',
    reqBaseLv: 40,
    reqJobLv: 40,
    sprite: 'hunter',
    attackType: 'bow_arrow',
    hpMod: 1.4,
    spMod: 1.4,
    bonus: { str: 8, agi: 18, vit: 8, int: 6, dex: 24, luk: 12 },
    offensiveSkills: ['ac_double', 'ac_shower', 'ht_blitzbeat'],
    supportSkills: ['ac_concentration', 'sn_windwalk']
  },
  sniper: {
    id: 'sniper',
    name: 'Sniper (สไนเปอร์ - ไฮคลาส)',
    tier: 2,
    isHighClass: true,
    branch: 'archer',
    parentJob: 'hunter',
    reqBaseLv: 70,
    reqJobLv: 45,
    sprite: 'sniper',
    attackType: 'bow_arrow',
    hpMod: 1.6,
    spMod: 1.55,
    bonus: { str: 10, agi: 24, vit: 12, int: 8, dex: 30, luk: 16 },
    offensiveSkills: ['ac_double', 'ac_shower', 'ht_blitzbeat', 'sn_sharpshooting'],
    supportSkills: ['ac_concentration', 'sn_windwalk']
  },
  ranger: {
    id: 'ranger',
    name: 'Ranger (เรนเจอร์ - คลาส 3)',
    tier: 3,
    branch: 'archer',
    parentJob: 'sniper',
    reqBaseLv: 99,
    reqJobLv: 50,
    sprite: 'ranger',
    attackType: 'bow_arrow',
    hpMod: 1.9,
    spMod: 1.8,
    bonus: { str: 12, agi: 32, vit: 16, int: 10, dex: 40, luk: 20 },
    offensiveSkills: ['ac_double', 'ac_shower', 'ht_blitzbeat', 'sn_sharpshooting', 'ra_arrowstorm', 'ra_wugstrike'],
    supportSkills: ['ac_concentration', 'sn_windwalk', 'ra_fearbreeze']
  },

  // === THIEF LINE ===
  thief: {
    id: 'thief',
    name: 'Thief (โจร - คลาส 1)',
    tier: 1,
    branch: 'thief',
    parentJob: 'novice',
    reqBaseLv: 10,
    reqJobLv: 10,
    sprite: 'thief',
    attackType: 'melee_slash',
    hpMod: 1.15,
    spMod: 1.1,
    bonus: { str: 7, agi: 12, vit: 4, int: 2, dex: 7, luk: 6 },
    offensiveSkills: ['tf_double', 'tf_poison'],
    supportSkills: ['as_enchantpoison']
  },
  assassin: {
    id: 'assassin',
    name: 'Assassin (แอสซาซิน - คลาส 2-1)',
    tier: 2,
    branch: 'thief',
    parentJob: 'thief',
    reqBaseLv: 40,
    reqJobLv: 40,
    sprite: 'assassin',
    attackType: 'melee_slash',
    hpMod: 1.45,
    spMod: 1.35,
    bonus: { str: 16, agi: 24, vit: 8, int: 4, dex: 14, luk: 14 },
    offensiveSkills: ['tf_double', 'tf_poison', 'as_sonicblow'],
    supportSkills: ['as_enchantpoison']
  },
  rogue: {
    id: 'rogue',
    name: 'Rogue (โร๊ก - คลาส 2-2)',
    tier: 2,
    branch: 'thief',
    parentJob: 'thief',
    reqBaseLv: 40,
    reqJobLv: 40,
    sprite: 'rogue',
    attackType: 'melee_slash',
    hpMod: 1.5,
    spMod: 1.4,
    bonus: { str: 14, agi: 22, vit: 10, int: 6, dex: 18, luk: 12 },
    offensiveSkills: ['tf_double', 'tf_poison', 'ac_double'],
    supportSkills: ['as_enchantpoison']
  },
  assassin_cross: {
    id: 'assassin_cross',
    name: 'Assassin Cross (แอสซาซินครอส - ไฮคลาส)',
    tier: 2,
    isHighClass: true,
    branch: 'thief',
    parentJob: 'assassin',
    reqBaseLv: 70,
    reqJobLv: 45,
    sprite: 'assassin_cross',
    attackType: 'melee_slash',
    hpMod: 1.65,
    spMod: 1.5,
    bonus: { str: 22, agi: 30, vit: 12, int: 6, dex: 18, luk: 18 },
    offensiveSkills: ['tf_double', 'as_sonicblow', 'asc_meteorassault'],
    supportSkills: ['as_enchantpoison', 'asc_edp']
  },
  stalker: {
    id: 'stalker',
    name: 'Stalker (สตอล์กเกอร์ - ไฮคลาส)',
    tier: 2,
    isHighClass: true,
    branch: 'thief',
    parentJob: 'rogue',
    reqBaseLv: 70,
    reqJobLv: 45,
    sprite: 'stalker',
    attackType: 'melee_slash',
    hpMod: 1.7,
    spMod: 1.55,
    bonus: { str: 18, agi: 28, vit: 14, int: 10, dex: 24, luk: 16 },
    offensiveSkills: ['tf_double', 'ac_double', 'asc_meteorassault'],
    supportSkills: ['as_enchantpoison', 'sn_windwalk']
  },
  guillotine_cross: {
    id: 'guillotine_cross',
    name: 'Guillotine Cross (กิโยตินครอส - คลาส 3)',
    tier: 3,
    branch: 'thief',
    parentJob: 'assassin_cross',
    reqBaseLv: 99,
    reqJobLv: 50,
    sprite: 'guillotine_cross',
    attackType: 'melee_slash',
    hpMod: 1.95,
    spMod: 1.7,
    bonus: { str: 28, agi: 38, vit: 16, int: 8, dex: 24, luk: 24 },
    offensiveSkills: ['tf_double', 'as_sonicblow', 'asc_meteorassault', 'gc_rollingcutter', 'gc_crossimpact'],
    supportSkills: ['as_enchantpoison', 'asc_edp']
  },
  shadow_chaser: {
    id: 'shadow_chaser',
    name: 'Shadow Chaser (ชาโดว์เชสเซอร์ - คลาส 3)',
    tier: 3,
    branch: 'thief',
    parentJob: 'stalker',
    reqBaseLv: 99,
    reqJobLv: 50,
    sprite: 'shadow_chaser',
    attackType: 'melee_slash',
    hpMod: 2.0,
    spMod: 1.8,
    bonus: { str: 24, agi: 34, vit: 18, int: 16, dex: 30, luk: 20 },
    offensiveSkills: ['tf_double', 'asc_meteorassault', 'gc_rollingcutter', 'ra_arrowstorm'],
    supportSkills: ['as_enchantpoison', 'sn_windwalk']
  },

  // === ACOLYTE LINE ===
  acolyte: {
    id: 'acolyte',
    name: 'Acolyte (อโคไลท์ - คลาส 1)',
    tier: 1,
    branch: 'acolyte',
    parentJob: 'novice',
    reqBaseLv: 10,
    reqJobLv: 10,
    sprite: 'acolyte',
    attackType: 'melee_mace',
    hpMod: 1.15,
    spMod: 1.5,
    bonus: { str: 4, agi: 4, vit: 6, int: 10, dex: 6, luk: 4 },
    offensiveSkills: ['al_holylight'],
    supportSkills: ['al_heal', 'al_blessing', 'al_incagi']
  },
  priest: {
    id: 'priest',
    name: 'Priest (พรีสต์ - คลาส 2-1)',
    tier: 2,
    branch: 'acolyte',
    parentJob: 'acolyte',
    reqBaseLv: 40,
    reqJobLv: 40,
    sprite: 'priest',
    attackType: 'melee_mace',
    hpMod: 1.45,
    spMod: 1.95,
    bonus: { str: 6, agi: 8, vit: 14, int: 22, dex: 14, luk: 8 },
    offensiveSkills: ['al_holylight', 'pr_magnus'],
    supportSkills: ['al_heal', 'al_blessing', 'al_incagi', 'pr_kyrie']
  },
  monk: {
    id: 'monk',
    name: 'Monk (มังค์ - คลาส 2-2)',
    tier: 2,
    branch: 'acolyte',
    parentJob: 'acolyte',
    reqBaseLv: 40,
    reqJobLv: 40,
    sprite: 'monk',
    attackType: 'melee_mace',
    hpMod: 1.6,
    spMod: 1.65,
    bonus: { str: 18, agi: 16, vit: 14, int: 10, dex: 14, luk: 6 },
    offensiveSkills: ['al_holylight', 'sm_bash', 'kn_bowlingbash'],
    supportSkills: ['al_heal', 'al_blessing', 'al_incagi']
  },
  high_priest: {
    id: 'high_priest',
    name: 'High Priest (ไฮพรีสต์ - ไฮคลาส)',
    tier: 2,
    isHighClass: true,
    branch: 'acolyte',
    parentJob: 'priest',
    reqBaseLv: 70,
    reqJobLv: 45,
    sprite: 'high_priest',
    attackType: 'melee_mace',
    hpMod: 1.65,
    spMod: 2.25,
    bonus: { str: 8, agi: 12, vit: 18, int: 30, dex: 18, luk: 12 },
    offensiveSkills: ['al_holylight', 'pr_magnus'],
    supportSkills: ['al_heal', 'al_blessing', 'al_incagi', 'pr_kyrie']
  },
  champion: {
    id: 'champion',
    name: 'Champion (แชมเปี้ยน - ไฮคลาส)',
    tier: 2,
    isHighClass: true,
    branch: 'acolyte',
    parentJob: 'monk',
    reqBaseLv: 70,
    reqJobLv: 45,
    sprite: 'champion',
    attackType: 'melee_mace',
    hpMod: 1.85,
    spMod: 1.9,
    bonus: { str: 24, agi: 20, vit: 18, int: 14, dex: 18, luk: 8 },
    offensiveSkills: ['al_holylight', 'lk_spiralpierce', 'ws_carttermination'],
    supportSkills: ['al_heal', 'al_blessing', 'al_incagi']
  },
  arch_bishop: {
    id: 'arch_bishop',
    name: 'Arch Bishop (อาร์คบิชอป - คลาส 3)',
    tier: 3,
    branch: 'acolyte',
    parentJob: 'high_priest',
    reqBaseLv: 99,
    reqJobLv: 50,
    sprite: 'arch_bishop',
    attackType: 'melee_mace',
    hpMod: 1.9,
    spMod: 2.55,
    bonus: { str: 14, agi: 16, vit: 24, int: 40, dex: 24, luk: 16 },
    offensiveSkills: ['al_holylight', 'pr_magnus', 'ab_judex', 'ab_adoramus'],
    supportSkills: ['al_heal', 'al_blessing', 'al_incagi', 'pr_kyrie']
  },
  sura: {
    id: 'sura',
    name: 'Sura (ชูร่า - คลาส 3)',
    tier: 3,
    branch: 'acolyte',
    parentJob: 'champion',
    reqBaseLv: 99,
    reqJobLv: 50,
    sprite: 'sura',
    attackType: 'melee_mace',
    hpMod: 2.35,
    spMod: 2.15,
    bonus: { str: 34, agi: 26, vit: 28, int: 18, dex: 24, luk: 12 },
    offensiveSkills: ['rk_ignitionbreak', 'gc_crossimpact', 'nc_armscannon'],
    supportSkills: ['al_heal', 'al_blessing', 'al_incagi', 'pr_kyrie']
  },

  // === MERCHANT LINE ===
  merchant: {
    id: 'merchant',
    name: 'Merchant (พ่อค้า - คลาส 1)',
    tier: 1,
    branch: 'merchant',
    parentJob: 'novice',
    reqBaseLv: 10,
    reqJobLv: 10,
    sprite: 'merchant',
    attackType: 'melee_mace',
    hpMod: 1.25,
    spMod: 1.1,
    bonus: { str: 9, agi: 5, vit: 8, int: 2, dex: 7, luk: 5 },
    offensiveSkills: ['mc_mammonite', 'mc_cartrevolution'],
    supportSkills: ['mc_loud']
  },
  blacksmith: {
    id: 'blacksmith',
    name: 'Blacksmith (แบล็คสมิธ - คลาส 2-1)',
    tier: 2,
    branch: 'merchant',
    parentJob: 'merchant',
    reqBaseLv: 40,
    reqJobLv: 40,
    sprite: 'blacksmith',
    attackType: 'melee_mace',
    hpMod: 1.6,
    spMod: 1.35,
    bonus: { str: 18, agi: 12, vit: 16, int: 4, dex: 14, luk: 10 },
    offensiveSkills: ['mc_mammonite', 'mc_cartrevolution', 'ws_carttermination'],
    supportSkills: ['mc_loud', 'bs_adrenaline', 'bs_overthrust']
  },
  alchemist: {
    id: 'alchemist',
    name: 'Alchemist (อัลเคมิสต์ - คลาส 2-2)',
    tier: 2,
    branch: 'merchant',
    parentJob: 'merchant',
    reqBaseLv: 40,
    reqJobLv: 40,
    sprite: 'alchemist',
    attackType: 'melee_mace',
    hpMod: 1.5,
    spMod: 1.5,
    bonus: { str: 14, agi: 10, vit: 14, int: 14, dex: 16, luk: 10 },
    offensiveSkills: ['mc_mammonite', 'mc_cartrevolution', 'mg_firebolt'],
    supportSkills: ['mc_loud', 'al_heal']
  },
  whitesmith: {
    id: 'whitesmith',
    name: 'Whitesmith (ไวท์สมิธ - ไฮคลาส)',
    tier: 2,
    isHighClass: true,
    branch: 'merchant',
    parentJob: 'blacksmith',
    reqBaseLv: 70,
    reqJobLv: 45,
    sprite: 'whitesmith',
    attackType: 'melee_mace',
    hpMod: 1.85,
    spMod: 1.5,
    bonus: { str: 24, agi: 16, vit: 20, int: 6, dex: 18, luk: 14 },
    offensiveSkills: ['mc_mammonite', 'mc_cartrevolution', 'ws_carttermination'],
    supportSkills: ['mc_loud', 'bs_adrenaline', 'bs_overthrust']
  },
  creator: {
    id: 'creator',
    name: 'Creator (ครีเอเตอร์ - ไฮคลาส)',
    tier: 2,
    isHighClass: true,
    branch: 'merchant',
    parentJob: 'alchemist',
    reqBaseLv: 70,
    reqJobLv: 45,
    sprite: 'creator',
    attackType: 'melee_mace',
    hpMod: 1.75,
    spMod: 1.7,
    bonus: { str: 20, agi: 14, vit: 18, int: 22, dex: 20, luk: 14 },
    offensiveSkills: ['mc_mammonite', 'mc_cartrevolution', 'ws_carttermination'],
    supportSkills: ['mc_loud', 'bs_overthrust']
  },
  mechanic: {
    id: 'mechanic',
    name: 'Mechanic (เมคานิค - คลาส 3)',
    tier: 3,
    branch: 'merchant',
    parentJob: 'whitesmith',
    reqBaseLv: 99,
    reqJobLv: 50,
    sprite: 'mechanic',
    attackType: 'melee_mace',
    hpMod: 2.2,
    spMod: 1.75,
    bonus: { str: 32, agi: 18, vit: 28, int: 10, dex: 24, luk: 16 },
    offensiveSkills: ['mc_mammonite', 'mc_cartrevolution', 'ws_carttermination', 'nc_axetornado', 'nc_armscannon'],
    supportSkills: ['mc_loud', 'bs_adrenaline', 'bs_overthrust']
  },
  genetic: {
    id: 'genetic',
    name: 'Genetic (เจเนติก - คลาส 3)',
    tier: 3,
    branch: 'merchant',
    parentJob: 'creator',
    reqBaseLv: 99,
    reqJobLv: 50,
    sprite: 'genetic',
    attackType: 'melee_mace',
    hpMod: 2.05,
    spMod: 1.95,
    bonus: { str: 26, agi: 20, vit: 24, int: 30, dex: 26, luk: 18 },
    offensiveSkills: ['mc_cartrevolution', 'ws_carttermination', 'nc_axetornado', 'nc_armscannon'],
    supportSkills: ['mc_loud', 'bs_overthrust']
  }
};

// ============================================================================
// 20 Regional Zones (grouping all 1,272 RO Maps by Lv & Authentic Map Monsters)
// ============================================================================
export const ZONES_20 = [
  {
    zoneId: 1,
    name: 'Prontera Field (ทุ่งหญ้าพรอนเทร่า)',
    mapCode: 'prt_fild08',
    stageMaps: ['prt_fild08', 'prt_fild01', 'prt_fild05', 'prt_fild06', 'prt_fild07', 'prt_fild02', 'prt_fild03', 'prt_fild04', 'prt_fild09', 'prt_fild10'],
    lvRange: '1-10',
    bgm: '/bgm/08.mp3',
    tex: 'assets/zones/zone_01.png',
    monsters: ['poring', 'lunatic', 'fabre', 'pupa', 'drops', 'roda_frog', 'chondor'],
    miniBoss: 'mastering',
    mvpBoss: 'angeling'
  },
  {
    zoneId: 2,
    name: 'Prontera Culvert (ท่อระบายน้ำพรอนเทร่า)',
    mapCode: 'prt_sewb2',
    stageMaps: ['prt_sewb1', 'prt_sewb2', 'prt_sewb3', 'prt_sewb4', 'prt_maze01', 'prt_maze02', 'prt_maze03', 'prt_sewb2', 'prt_sewb3', 'prt_sewb4'],
    lvRange: '11-20',
    bgm: '/bgm/19.mp3',
    tex: 'assets/zones/zone_08.png',
    monsters: ['thief_bug', 'familiar', 'tarou', 'spore', 'plankton', 'poporing'],
    miniBoss: 'mastering',
    mvpBoss: 'golden_bug'
  },
  {
    zoneId: 3,
    name: 'Payon Forest (ป่าพายอน)',
    mapCode: 'pay_fild08',
    stageMaps: ['pay_fild01', 'pay_fild02', 'pay_fild03', 'pay_fild04', 'pay_fild06', 'pay_fild07', 'pay_fild08', 'pay_fild09', 'pay_fild10', 'pay_fild11'],
    lvRange: '21-30',
    bgm: '/bgm/14.mp3',
    tex: 'assets/zones/zone_02.png',
    monsters: ['willow', 'spore', 'boa', 'wolf', 'elder_willow', 'bigfoot', 'smokie'],
    miniBoss: 'angeling',
    mvpBoss: 'eddga'
  },
  {
    zoneId: 4,
    name: 'Morocc Sograt Desert (ทะเลทรายมอร็อก)',
    mapCode: 'moc_fild12',
    stageMaps: ['moc_fild01', 'moc_fild02', 'moc_fild03', 'moc_fild07', 'moc_fild11', 'moc_fild12', 'moc_fild16', 'moc_fild17', 'moc_fild18', 'moc_fild19'],
    lvRange: '31-40',
    bgm: '/bgm/24.mp3',
    tex: 'assets/zones/zone_03.png',
    monsters: ['peco_peco', 'muka', 'drops', 'scorpion', 'hode', 'sandman', 'frilldora'],
    miniBoss: 'deviling',
    mvpBoss: 'phreeoni'
  },
  {
    zoneId: 5,
    name: 'Byalan Undersea Tunnel (ดันเจี้ยนบยาแลน)',
    mapCode: 'iz_dun03',
    stageMaps: ['iz_dun00', 'iz_dun01', 'iz_dun02', 'iz_dun03', 'iz_dun04', 'iz_dun00', 'iz_dun01', 'iz_dun02', 'iz_dun03', 'iz_dun04'],
    lvRange: '41-50',
    bgm: '/bgm/26.mp3',
    tex: 'assets/zones/zone_06.png',
    monsters: ['vadon', 'cornutus', 'marin', 'marina', 'marc', 'swordfish', 'strove'],
    miniBoss: 'angeling',
    mvpBoss: 'drake'
  },
  {
    zoneId: 6,
    name: 'Payon Cave (ถ้ำผีดิบพายอน)',
    mapCode: 'pay_dun03',
    stageMaps: ['pay_dun00', 'pay_dun01', 'pay_dun02', 'pay_dun03', 'pay_dun04', 'pay_dun00', 'pay_dun01', 'pay_dun02', 'pay_dun03', 'pay_dun04'],
    lvRange: '51-60',
    bgm: '/bgm/20.mp3',
    tex: 'assets/zones/zone_07.png',
    monsters: ['zombie', 'skeleton', 'munak', 'bongun', 'sohee', 'nine_tail'],
    miniBoss: 'deviling',
    mvpBoss: 'moonlight'
  },
  {
    zoneId: 7,
    name: 'Orc Village & Dungeon (หมู่บ้านออร์ค)',
    mapCode: 'gef_fild10',
    stageMaps: ['gef_fild10', 'orcsdun01', 'orcsdun02', 'gef_fild03', 'gef_fild14', 'gef_fild10', 'orcsdun01', 'orcsdun02', 'gef_fild03', 'gef_fild14'],
    lvRange: '61-70',
    bgm: '/bgm/25.mp3',
    tex: 'assets/zones/zone_05.png',
    monsters: ['orc_warrior', 'orc_lady', 'orc_zombie', 'orc_skeleton', 'high_orc', 'orc_archer'],
    miniBoss: 'deviling',
    mvpBoss: 'orc_hero'
  },
  {
    zoneId: 8,
    name: 'Morocc Pyramids (พีระมิดมอร็อก)',
    mapCode: 'moc_pryd04',
    stageMaps: ['moc_pryd01', 'moc_pryd02', 'moc_pryd03', 'moc_pryd04', 'moc_pryd05', 'moc_pryd06', 'moc_prydb1', 'moc_pryd02', 'moc_pryd04', 'moc_pryd06'],
    lvRange: '71-80',
    bgm: '/bgm/22.mp3',
    tex: 'assets/zones/zone_04.png',
    monsters: ['mummy', 'verit', 'isis', 'matyr', 'minorous', 'ancient_mummy'],
    miniBoss: 'deviling',
    mvpBoss: 'osiris'
  },
  {
    zoneId: 9,
    name: 'Geffen Underground (ดันเจี้ยนเกฟเฟน)',
    mapCode: 'gef_dun02',
    stageMaps: ['gef_dun00', 'gef_dun01', 'gef_dun02', 'gef_dun03', 'mjo_dun01', 'mjo_dun02', 'mjo_dun03', 'gef_dun01', 'gef_dun02', 'gef_dun03'],
    lvRange: '81-90',
    bgm: '/bgm/21.mp3',
    tex: 'assets/zones/zone_07.png',
    monsters: ['poison_spore', 'ghoul', 'whisper', 'marionette', 'nightmare', 'deviruchi'],
    miniBoss: 'deviling',
    mvpBoss: 'doppelganger'
  },
  {
    zoneId: 10,
    name: 'Sphinx Crypt (สุสานสฟิงซ์)',
    mapCode: 'in_sphinx4',
    stageMaps: ['in_sphinx1', 'in_sphinx2', 'in_sphinx3', 'in_sphinx4', 'in_sphinx5', 'in_sphinx1', 'in_sphinx2', 'in_sphinx3', 'in_sphinx4', 'in_sphinx5'],
    lvRange: '91-100',
    bgm: '/bgm/38.mp3',
    tex: 'assets/zones/zone_04.png',
    monsters: ['requiem', 'marduk', 'pasana', 'minorous', 'anubis'],
    miniBoss: 'moonlight',
    mvpBoss: 'pharaoh'
  },
  {
    zoneId: 11,
    name: 'Aldebaran Clock Tower (หอนาฬิกา)',
    mapCode: 'c_tower3',
    stageMaps: ['c_tower1', 'c_tower2', 'c_tower3', 'c_tower4', 'alde_dun01', 'alde_dun02', 'alde_dun03', 'alde_dun04', 'c_tower3', 'c_tower4'],
    lvRange: '101-110',
    bgm: '/bgm/50.mp3',
    tex: 'assets/zones/zone_09.png',
    monsters: ['punk', 'rideword', 'alarm', 'clock', 'bathory', 'high_orc'],
    miniBoss: 'deviling',
    mvpBoss: 'baphomet'
  },
  {
    zoneId: 12,
    name: 'Glast Heim St. Abbey (โบสถ์กลาสเฮม)',
    mapCode: 'gl_church',
    stageMaps: ['gl_church', 'gl_chyard', 'gl_in01', 'gl_prison', 'gl_prison1', 'gl_sew01', 'gl_sew02', 'gl_sew03', 'gl_church', 'gl_chyard'],
    lvRange: '111-120',
    bgm: '/bgm/42.mp3',
    tex: 'assets/zones/zone_08.png',
    monsters: ['ghoul', 'wraith', 'evil_druid', 'mimic', 'dark_priest'],
    miniBoss: 'deviling',
    mvpBoss: 'dark_lord'
  },
  {
    zoneId: 13,
    name: 'Glast Heim Chivalry (ปราสาทอัศวินกลาสเฮม)',
    mapCode: 'gl_knt02',
    stageMaps: ['gl_knt01', 'gl_knt02', 'gl_cas01', 'gl_cas02', 'gl_step', 'gl_dun01', 'gl_dun02', 'gl_knt01', 'gl_knt02', 'gl_cas02'],
    lvRange: '121-130',
    bgm: '/bgm/44.mp3',
    tex: 'assets/zones/zone_09.png',
    monsters: ['raydric', 'raydric_archer', 'khalitzburg', 'alice', 'wanderer', 'abysmal_knight'],
    miniBoss: 'abysmal_knight',
    mvpBoss: 'baphomet'
  },
  {
    zoneId: 14,
    name: 'Turtle Island (เกาะเต่าโบราณ)',
    mapCode: 'tur_dun03',
    stageMaps: ['tur_dun01', 'tur_dun02', 'tur_dun03', 'tur_dun04', 'tur_dun01', 'tur_dun02', 'tur_dun03', 'tur_dun04', 'tur_dun03', 'tur_dun04'],
    lvRange: '131-140',
    bgm: '/bgm/64.mp3',
    tex: 'assets/zones/zone_10.png',
    monsters: ['spring_rabbit', 'dragon_tail', 'permuter', 'solider', 'freezer', 'heater', 'assulter'],
    miniBoss: 'assulter',
    mvpBoss: 'turtle_general'
  },
  {
    zoneId: 15,
    name: 'Magma Dungeon Nogg Road (ถ้ำลาวา)',
    mapCode: 'mag_dun02',
    stageMaps: ['mag_dun01', 'mag_dun02', 'ein_dun01', 'ein_dun02', 'yuno_fild03', 'yuno_fild04', 'mag_dun01', 'mag_dun02', 'thor_v01', 'thor_v03'],
    lvRange: '141-150',
    bgm: '/bgm/65.mp3',
    tex: 'assets/zones/zone_04.png',
    monsters: ['kaho', 'explosion', 'blazer', 'grizzly', 'lava_golem', 'nightmare_terror'],
    miniBoss: 'lava_golem',
    mvpBoss: 'ifrit'
  },
  {
    zoneId: 16,
    name: 'Amatsu & Gonryun Shrine (ปราสาทอามัตสึ)',
    mapCode: 'ama_dun03',
    stageMaps: ['ama_dun01', 'ama_dun02', 'ama_dun03', 'gon_dun01', 'gon_dun02', 'gon_dun03', 'lou_dun01', 'lou_dun02', 'lou_dun03', 'ama_dun03'],
    lvRange: '151-160',
    bgm: '/bgm/68.mp3',
    tex: 'assets/zones/zone_06.png',
    monsters: ['miyabi_ningyo', 'karakas', 'firelock_soldier', 'tengu', 'shinobi', 'cloud_hermit'],
    miniBoss: 'shinobi',
    mvpBoss: 'incantation_samurai'
  },
  {
    zoneId: 17,
    name: 'Niflheim Realm of Dead (เมืองคนตาย)',
    mapCode: 'nif_fild02',
    stageMaps: ['nif_fild01', 'nif_fild02', 'niflheim', 'um_dun01', 'um_dun02', 'nif_fild01', 'nif_fild02', 'niflheim', 'nif_fild01', 'nif_fild02'],
    lvRange: '161-170',
    bgm: '/bgm/74.mp3',
    tex: 'assets/zones/zone_07.png',
    monsters: ['quve', 'lude', 'gibbet', 'dullahan', 'lori_ruri', 'bloody_murderer'],
    miniBoss: 'bloody_murderer',
    mvpBoss: 'lord_of_death'
  },
  {
    zoneId: 18,
    name: 'Abyss Lake Dragon Cave (ทะเลสาบมังกร)',
    mapCode: 'abyss_03',
    stageMaps: ['hu_fild05', 'abyss_01', 'abyss_02', 'abyss_03', 'odin_tem01', 'odin_tem02', 'odin_tem03', 'abyss_01', 'abyss_02', 'abyss_03'],
    lvRange: '171-180',
    bgm: '/bgm/85.mp3',
    tex: 'assets/zones/zone_05.png',
    monsters: ['petite', 'sky_petite', 'ferus', 'acidus', 'hydrolancer'],
    miniBoss: 'hydrolancer',
    mvpBoss: 'detale'
  },
  {
    zoneId: 19,
    name: 'Thanatos Tower (ยอดหอคอยทานาทอส)',
    mapCode: 'tha_t12',
    stageMaps: ['tha_t01', 'tha_t02', 'tha_t03', 'tha_t04', 'tha_t05', 'tha_t06', 'tha_t07', 'tha_t08', 'tha_t09', 'tha_t12'],
    lvRange: '181-190',
    bgm: '/bgm/86.mp3',
    tex: 'assets/zones/zone_09.png',
    monsters: ['ancient_mimic', 'deathword', 'plasma', 'executer', 'mysteltainn', 'tirfing'],
    miniBoss: 'mysteltainn',
    mvpBoss: 'thanatos'
  },
  {
    zoneId: 20,
    name: 'Bio Lab Somatology (ห้องทดลองชีวภาพ)',
    mapCode: 'lhz_dun03',
    stageMaps: ['lhz_dun01', 'lhz_dun02', 'lhz_dun03', 'lhz_dun01', 'lhz_dun02', 'lhz_dun03', 'lhz_dun02', 'lhz_dun03', 'lhz_dun02', 'lhz_dun03'],
    lvRange: '191-230',
    bgm: '/bgm/90.mp3',
    tex: 'assets/zones/zone_08.png',
    monsters: ['eremes', 'harword', 'cecil', 'margaretha', 'kathryne', 'seyrn'],
    miniBoss: 'kathryne',
    mvpBoss: 'seyrn_mvp'
  }
];

export function getMaxStages() {
  return RO_DB.loaded && RO_DB.maps.length > 0 ? RO_DB.maps.length : 1272;
}

export function getStageInfo(stageNum, customMapCode = null) {
  const maxStg = getMaxStages();
  const clamped = Math.max(1, Math.min(maxStg, stageNum || 1));
  const zoneIdx = Math.floor(((clamped - 1) % 200) / 10);
  const subStage = ((clamped - 1) % 10) + 1;
  const zone = ZONES_20[zoneIdx] || ZONES_20[0];
  const isMiniBossStage = subStage === 5;
  const isMvpStage = subStage === 10;

  // Pick mapCode from stageMaps or zone.roMaps so every stage has a real RO .gnd map
  let stageMapCode = (zone.stageMaps && zone.stageMaps[subStage - 1]) || zone.mapCode;
  if (zone.roMaps && zone.roMaps.length > 0 && clamped > 200) {
    stageMapCode = zone.roMaps[(clamped - 1) % zone.roMaps.length].code;
  }

  let dbMap = null;
  if (customMapCode && RO_DB.mapByCode.has(customMapCode)) {
    dbMap = RO_DB.mapByCode.get(customMapCode);
    stageMapCode = dbMap.code;
  } else if (clamped > 200 && RO_DB.maps.length > 0) {
    dbMap = RO_DB.maps[(clamped - 1) % RO_DB.maps.length];
    stageMapCode = dbMap.code;
    const matchedZoneId = classifyMapToZoneId(stageMapCode);
    const matchedZone = ZONES_20[matchedZoneId - 1];
    if (matchedZone) {
      // Use monsters appropriate for this map's region
      return buildStageResult(clamped, maxStg, matchedZone, subStage, stageMapCode, dbMap, isMiniBossStage, isMvpStage);
    }
  } else if (RO_DB.mapByCode.has(stageMapCode)) {
    dbMap = RO_DB.mapByCode.get(stageMapCode);
  }

  return buildStageResult(clamped, maxStg, zone, subStage, stageMapCode, dbMap, isMiniBossStage, isMvpStage);
}

function buildStageResult(clamped, maxStg, zone, subStage, mapCode, dbMap, isMiniBossStage, isMvpStage) {
  const zoneIdx = zone.zoneId - 1;
  const mapName = dbMap ? `${dbMap.name} (${mapCode})` : `${zone.name} (${mapCode})`;
  const bgm = (dbMap && dbMap.bgm) ? `/bgm/${dbMap.bgm}` : zone.bgm;
  const mapImg = `/grf/map/${(dbMap && dbMap.bmpCode) || mapCode}.png`;
  const groundMapImg = `/grf/groundmap/${mapCode}.png`;

  // Authentic server scaling on top of monster base stats
  const hpScale = 1 + (clamped - 1) * 0.08 + zoneIdx * 0.15;
  const dmgScale = 1 + (clamped - 1) * 0.04 + zoneIdx * 0.1;
  const expScale = 1 + (clamped - 1) * 0.06 + zoneIdx * 0.12;
  // Monster Kill Quota: Starts at 100 kills for Stage 1, increasing gradually by stage difficulty!
  const killQuota = Math.round(100 * (1 + (clamped - 1) * 0.25));

  // Every stage has a Stage Leader/Boss so killing the Boss unlocks the next stage!
  const stageBoss = isMvpStage
    ? zone.mvpBoss
    : (isMiniBossStage ? zone.miniBoss : zone.monsters[(subStage - 1) % zone.monsters.length]);

  return {
    stageNum: clamped,
    zoneId: zone.zoneId,
    subStage,
    title: `ด่านที่ ${clamped}/${maxStg} : ${mapName}`,
    name: mapName,
    mapCode,
    mapImg,
    groundMapImg,
    bgm,
    tex: zone.tex,
    monsters: zone.monsters,
    bossType: stageBoss,
    isMiniBossStage,
    isMvpStage,
    hpScale,
    dmgScale,
    expScale,
    killQuota
  };
}

// ============================================================================
// Starter / Featured RO Monster Cards (augmented at runtime by all 5,593 cards in RO_DB)
// ============================================================================
export const CARD_DB = {
  card_poring: {
    id: 'card_poring',
    name: 'Poring Card (การ์ดโปริ่ง)',
    prefix: 'Lucky',
    targetSlot: 'armor',
    art: 'assets/cards/card_0.png',
    stats: { luk: 4, flee: 10, maxHp: 120 },
    desc: '• LUK +4, FLEE +10, MaxHP +120\n• ตำแหน่งที่ใส่ได้: เสื้อเกราะ (Armor)'
  },
  card_fabre: {
    id: 'card_fabre',
    name: 'Fabre Card (การ์ดฟาเบร)',
    prefix: 'Vital',
    targetSlot: 'weapon',
    art: 'assets/cards/card_1.png',
    stats: { vit: 3, maxHp: 250, atk: 12 },
    desc: '• VIT +3, MaxHP +250, ATK +12\n• ตำแหน่งที่ใส่ได้: อาวุธ (Weapon)'
  },
  card_pupa: {
    id: 'card_pupa',
    name: 'Pupa Card (การ์ดพูปา)',
    prefix: 'Hard',
    targetSlot: 'armor',
    art: 'assets/cards/card_2.png',
    stats: { maxHp: 700, def: 12 },
    desc: '• MaxHP +700, DEF +12\n• ตำแหน่งที่ใส่ได้: เสื้อเกราะ (Armor)'
  },
  card_lunatic: {
    id: 'card_lunatic',
    name: 'Lunatic Card (การ์ดลูนาติก)',
    prefix: 'Critical',
    targetSlot: 'weapon',
    art: 'assets/cards/card_3.png',
    stats: { luk: 3, crit: 8, atk: 10, cdrPct: 4 },
    desc: '• CRIT +8%, LUK +3, ATK +10, ลดคูลดาวน์สกิล -4%\n• ตำแหน่งที่ใส่ได้: อาวุธ (Weapon)'
  },
  card_spore: {
    id: 'card_spore',
    name: 'Spore Card (การ์ดสปอร์)',
    prefix: 'Robust',
    targetSlot: 'accessory',
    art: 'assets/cards/card_4.png',
    stats: { vit: 5, maxHp: 350, cdrPct: 5 },
    desc: '• VIT +5, MaxHP +350, ลดคูลดาวน์สกิล -5%\n• ตำแหน่งที่ใส่ได้: เครื่องประดับ (Accessory)'
  },
  card_hydra: {
    id: 'card_hydra',
    name: 'Hydra Card (การ์ดไฮดรา)',
    prefix: 'Bloody',
    targetSlot: 'weapon',
    art: 'assets/cards/card_5.png',
    stats: { atkPct: 20 },
    desc: '• เพิ่มพลังโจมตีกายภาพ +20%\n• ตำแหน่งที่ใส่ได้: อาวุธ (Weapon)'
  },
  card_skel_worker: {
    id: 'card_skel_worker',
    name: 'Skeleton Worker Card (การ์ดเหมือง)',
    prefix: 'Boned',
    targetSlot: 'weapon',
    art: 'assets/cards/card_6.png',
    stats: { atkPct: 15, atk: 20 },
    desc: '• เพิ่มพลังโจมตี +15% และ ATK +20\n• ตำแหน่งที่ใส่ได้: อาวุธ (Weapon)'
  },
  card_hunter_fly: {
    id: 'card_hunter_fly',
    name: 'Hunter Fly Card (การ์ดแมลงแดง)',
    prefix: 'Malicious',
    targetSlot: 'weapon',
    art: 'assets/cards/card_7.png',
    stats: { lifestealPct: 8, atk: 15 },
    desc: '• ดูดเลือด 8% ของความเสียหายเมื่อโจมตี และ ATK +15\n• ตำแหน่งที่ใส่ได้: อาวุธ (Weapon)'
  },
  card_thara_frog: {
    id: 'card_thara_frog',
    name: 'Thara Frog Card (การ์ดกบแดง)',
    prefix: 'Cranial',
    targetSlot: 'shield',
    art: 'assets/cards/card_8.png',
    stats: { def: 28, maxHp: 450 },
    desc: '• ลดดาเมจจากมอนสเตอร์ DEF +28, MaxHP +450\n• ตำแหน่งที่ใส่ได้: โล่ (Shield)'
  },
  card_raydric: {
    id: 'card_raydric',
    name: 'Raydric Card (การ์ดเรดริก)',
    prefix: 'Immune',
    targetSlot: 'garment',
    art: 'assets/cards/card_9.png',
    stats: { def: 25, flee: 15 },
    desc: '• ลดความเสียหายไร้ธาตุ 20% (DEF +25, FLEE +15)\n• ตำแหน่งที่ใส่ได้: ผ้าคลุม (Garment)'
  },
  card_verit: {
    id: 'card_verit',
    name: 'Verit Card (การ์ดหมาเน่า)',
    prefix: 'Fledged',
    targetSlot: 'shoes',
    art: 'assets/cards/card_10.png',
    stats: { maxHp: 500, maxSp: 150 },
    desc: '• MaxHP +500 และ MaxSP +150\n• ตำแหน่งที่ใส่ได้: รองเท้า (Shoes)'
  },
  card_marduk: {
    id: 'card_marduk',
    name: 'Marduk Card (การ์ดมาร์ดุก)',
    prefix: 'Peerless',
    targetSlot: 'head_top',
    art: 'assets/cards/card_11.png',
    stats: { int: 5, matkPct: 12, cdrPct: 8 },
    desc: '• ป้องกันใบ้, INT +5, MATK +12%, ลดคูลดาวน์สกิล -8%\n• ตำแหน่งที่ใส่ได้: หมวก (Headgear)'
  },
  card_kobold: {
    id: 'card_kobold',
    name: 'Kobold Card (การ์ดโคโบลด์)',
    prefix: 'of Counter',
    targetSlot: 'accessory',
    art: 'assets/cards/card_12.png',
    stats: { str: 4, crit: 12 },
    desc: '• STR +4, CRITICAL +12%\n• ตำแหน่งที่ใส่ได้: เครื่องประดับ (Accessory)'
  },
  card_sohee: {
    id: 'card_sohee',
    name: 'Sohee Card (การ์ดโซฮี)',
    prefix: 'Soul-Enchanted',
    targetSlot: 'shoes',
    art: 'assets/cards/card_13.png',
    stats: { int: 4, maxSp: 220, matk: 25, cdrPct: 6 },
    desc: '• MaxSP +220, INT +4, MATK +25, ลดคูลดาวน์สกิล -6%\n• ตำแหน่งที่ใส่ได้: รองเท้า (Shoes)'
  },
  card_petite: {
    id: 'card_petite',
    name: 'Earth Petite Card (การ์ดมังกรดิน)',
    prefix: 'Dragonic',
    targetSlot: 'armor',
    art: 'assets/cards/card_14.png',
    stats: { def: 22, vit: 5, maxHp: 600 },
    desc: '• DEF +22, VIT +5, MaxHP +600\n• ตำแหน่งที่ใส่ได้: เสื้อเกราะ (Armor)'
  },
  card_wraith: {
    id: 'card_wraith',
    name: 'Ghoul Card (การ์ดกูล)',
    prefix: 'Demonic',
    targetSlot: 'head_top',
    art: 'assets/cards/card_15.png',
    stats: { str: 4, int: 4, atk: 18, matk: 18, cdrPct: 6 },
    desc: '• STR +4, INT +4, ATK +18, MATK +18, ลดคูลดาวน์สกิล -6%\n• ตำแหน่งที่ใส่ได้: หมวก (Headgear)'
  },
  card_moonlight: {
    id: 'card_moonlight',
    name: 'Moonlight Flower Card (MVP มูนไลท์)',
    prefix: 'Hasty',
    targetSlot: 'shoes',
    art: 'assets/cards/card_16.png',
    stats: { agi: 10, aspd: 15, flee: 30, cdrPct: 12 },
    desc: '• [MVP Card] เดินเร็วขึ้นถาวร +25%, AGI +10, ASPD +15, ลดคูลดาวน์สกิล -12%\n• ตำแหน่งที่ใส่ได้: รองเท้า (Shoes)'
  },
  card_baphomet: {
    id: 'card_baphomet',
    name: 'Baphomet Card (MVP บาโฟเมต)',
    prefix: 'Scythe-like',
    targetSlot: 'weapon',
    art: 'assets/cards/card_17.png',
    stats: { atkPct: 25, splashAttack: true, hit: 15 },
    desc: '• [MVP Card] โจมตีธรรมดากระจายเป็นวงกว้าง 9 ช่อง และ ATK +25%\n• ตำแหน่งที่ใส่ได้: อาวุธ (Weapon)'
  },
  card_doppelganger: {
    id: 'card_doppelganger',
    name: 'Doppelganger Card (MVP ดอปเปล)',
    prefix: 'of Berserk',
    targetSlot: 'weapon',
    art: 'assets/cards/card_18.png',
    stats: { aspd: 25, atkPct: 15, cdrPct: 10 },
    desc: '• [MVP Card] เร่งความเร็วโจมตีสูงสุด ASPD +25, ATK +15%, ลดคูลดาวน์สกิล -10%\n• ตำแหน่งที่ใส่ได้: อาวุธ (Weapon)'
  },
  card_drake: {
    id: 'card_drake',
    name: 'Drake Card (MVP กัปตันเดรค)',
    prefix: 'Infinity',
    targetSlot: 'weapon',
    art: 'assets/cards/card_19.png',
    stats: { atkPct: 22, crit: 15, expPct: 20 },
    desc: '• [MVP Card] โจมตีมอนสเตอร์ทุกขนาด 100%, ATK +22%, CRIT +15%, EXP +20%\n• ตำแหน่งที่ใส่ได้: อาวุธ (Weapon)'
  }
};

// Fallback templates if RO_DB hasn't finished loading yet
export const EQUIP_TEMPLATES = [
  { slot: 'weapon', tier: 1, name: 'Katana',        baseAtk: 42,  baseMatk: 15, baseDef: 0, maxSlots: 3, icon: 'assets/items/knife.png',    collection: 'assets/collection/knife.png' },
  { slot: 'shield', tier: 1, name: 'Guard',         baseAtk: 0,   baseMatk: 0,  baseDef: 15, maxSlots: 1, icon: 'assets/items/guard.png',   collection: 'assets/collection/guard.png' },
  { slot: 'armor',  tier: 1, name: 'Cotton Shirt',  baseAtk: 0,   baseMatk: 0,  baseDef: 18, maxSlots: 1, icon: 'assets/items/coat.png',    collection: 'assets/collection/coat.png' },
  { slot: 'garment',tier: 1, name: 'Hood',          baseAtk: 0,   baseMatk: 0,  baseDef: 8,  maxSlots: 1, icon: 'assets/items/garment.png', collection: 'assets/collection/garment.png' },
  { slot: 'shoes',  tier: 1, name: 'Sandals',       baseAtk: 0,   baseMatk: 0,  baseDef: 8,  maxSlots: 1, icon: 'assets/items/sandals.png', collection: 'assets/collection/sandals.png' }
];

const RANDOM_STAT_POOL = [
  { stat: 'str', label: 'STR' },
  { stat: 'agi', label: 'AGI' },
  { stat: 'vit', label: 'VIT' },
  { stat: 'int', label: 'INT' },
  { stat: 'dex', label: 'DEX' },
  { stat: 'luk', label: 'LUK' },
  { stat: 'atk', label: 'ATK' },
  { stat: 'matk', label: 'MATK' },
  { stat: 'crit', label: 'CRIT' },
  { stat: 'aspd', label: 'ASPD' },
  { stat: 'maxHp', label: 'MaxHP' },
  { stat: 'cdrPct', label: 'ลดคูลดาวน์สกิล (%)' }
];

let equipUidCounter = 5000;

// ============================================================================
// Official RO Refine System (NPC Hollgrehenn)
// All dropped equipment starts at +0! Players refine using Phracon, Emveretarcon, Oridecon, Elunium.
// ============================================================================
export const REFINE_RATES = {
  // Target refine level:  1    2    3    4    5   6   7   8   9  10
  weapon1: [0, 100, 100, 100, 100, 100, 100, 100, 60, 40, 19],
  weapon2: [0, 100, 100, 100, 100, 100, 100,  60, 40, 20, 19],
  weapon3: [0, 100, 100, 100, 100, 100,  60,  50, 20, 20, 19],
  weapon4: [0, 100, 100, 100, 100,  60,  40,  40, 20, 20,  9],
  armor:   [0, 100, 100, 100, 100,  60,  40,  40, 20, 20,  9]
};

export function getRefineRequirements(item) {
  if (!item) return null;
  const nextRefine = (item.refine || 0) + 1;
  if (nextRefine > 10) return null;

  const isWeapon = item.slot === 'weapon' || item.slot === 'shadow_weapon';
  const wLv = Math.max(1, Math.min(4, item.tier || 1));

  let oreId = 'mat_elunium';
  let oreName = 'Elunium (แร่ตีบวกเกราะ)';
  let zenyCost = 2000 * nextRefine;
  let rateTable = REFINE_RATES.armor;

  if (isWeapon) {
    if (wLv === 1) {
      oreId = 'mat_phracon';
      oreName = 'Phracon (แร่ตีบวกอาวุธ Lv.1)';
      zenyCost = 200 * nextRefine;
      rateTable = REFINE_RATES.weapon1;
    } else if (wLv === 2) {
      oreId = 'mat_emveretarcon';
      oreName = 'Emveretarcon (แร่ตีบวกอาวุธ Lv.2)';
      zenyCost = 1000 * nextRefine;
      rateTable = REFINE_RATES.weapon2;
    } else if (wLv === 3) {
      oreId = 'mat_oridecon';
      oreName = 'Oridecon (แร่ตีบวกอาวุธ Lv.3)';
      zenyCost = 5000 * nextRefine;
      rateTable = REFINE_RATES.weapon3;
    } else {
      oreId = 'mat_oridecon';
      oreName = 'Oridecon (แร่ตีบวกอาวุธ Lv.4)';
      zenyCost = 10000 * nextRefine;
      rateTable = REFINE_RATES.weapon4;
    }
  }

  const successRate = rateTable[nextRefine] || 9;
  return {
    nextRefine,
    isWeapon,
    wLv,
    oreId,
    oreName,
    zenyCost,
    successRate,
    canBreak: successRate < 100
  };
}

// Convert any raw RO_DB weapon/armor/costume entry into an equippable item instance (+0 ONLY!)
export function createItemInstanceFromDb(dbEntry, category = 'equip', stageNum = 1, isBossDrop = false) {
  // User rule: Dropped items NEVER have refine (+0 always); players must refine at the Refine NPC!
  const refine = 0;
  const wLv = Math.max(1, Math.min(4, dbEntry.wLv || (stageNum > 120 ? 4 : stageNum > 70 ? 3 : stageNum > 30 ? 2 : 1)));
  const scale = 1 + (wLv - 1) * 0.25 + Math.min(200, stageNum - 1) * 0.018;

  const rawAtk = dbEntry.atk || (category === 'weapon' ? 35 + wLv * 22 : 0);
  const rawMatk = dbEntry.matk || 0;
  const rawDef = dbEntry.def || (category !== 'weapon' ? 10 + wLv * 6 : 0);

  const baseAtk = rawAtk > 0 ? Math.round(rawAtk * scale) : 0;
  const baseMatk = rawMatk > 0 ? Math.round(rawMatk * scale) : 0;
  const baseDef = rawDef > 0 ? Math.round(rawDef * scale) : (category === 'costume' ? 8 + wLv * 3 : 0);
  const slots = dbEntry.slots !== undefined ? dbEntry.slots : (category === 'costume' ? 1 : (Math.random() < 0.6 ? 1 : 2));

  // Random Options scale by Weapon/Equipment Level (wLv) and Stage
  const optCount = isBossDrop ? (2 + (Math.random() < 0.5 ? 1 : 0)) : (1 + (Math.random() < 0.35 ? 1 : 0));
  const randomStats = [];
  if (dbEntry.stats) {
    for (const [k, v] of Object.entries(dbEntry.stats)) {
      if (v > 0) randomStats.push({ stat: k, label: `${k.toUpperCase()} +${v}`, val: v });
    }
  }
  for (let i = 0; i < optCount; i++) {
    const pick = RANDOM_STAT_POOL[Math.floor(Math.random() * RANDOM_STAT_POOL.length)];
    let val = Math.max(1, Math.round((1 + wLv * 1.5 + Math.random() * 3) * (1 + Math.min(150, stageNum) * 0.015)));
    if (pick.stat === 'maxHp') val *= 35;
    if (pick.stat === 'atk' || pick.stat === 'matk') val *= 3;
    if (pick.stat === 'cdrPct') val = Math.min(12, Math.max(2, wLv * 2 + Math.floor(Math.random() * 4)));
    const labelStr = pick.stat === 'cdrPct' ? `ลดคูลดาวน์สกิล -${val}%` : `${pick.label} +${val}`;
    randomStats.push({ stat: pick.stat, label: labelStr, val });
  }

  const suffixSlot = slots > 0 && !dbEntry.name.includes('[') ? ` [${slots}]` : '';
  const fullName = `${dbEntry.name}${suffixSlot}`;
  const isCostume = category === 'costume' || (dbEntry.slot && (dbEntry.slot.startsWith('cos_') || dbEntry.slot.startsWith('shadow_')));

  return {
    uid: `eq_${++equipUidCounter}_${Date.now()}`,
    id: `ro_item_${dbEntry.id}`,
    numId: dbEntry.id,
    name: fullName,
    baseName: dbEntry.name,
    type: isCostume ? 'costume' : 'equip',
    slot: dbEntry.slot || 'weapon',
    tier: wLv,
    reqLv: dbEntry.reqLv || Math.max(1, stageNum),
    refine: 0,
    baseAtk,
    baseMatk,
    baseDef,
    atk: baseAtk,
    matk: baseMatk,
    def: baseDef,
    slots,
    cards: [],
    randomStats,
    rarityColor: isBossDrop ? '#f39c12' : (isCostume ? '#8e44ad' : (optCount >= 2 ? '#a29bfe' : '#2563eb')),
    icon: `/grf/icon/${dbEntry.id}.png`,
    collection: `/grf/collection/${dbEntry.id}.png`,
    weight: dbEntry.weight || (isCostume ? 10 : 35),
    sellPrice: Math.max(150, Math.round((dbEntry.price || 500) * 0.35)),
    desc: dbEntry.desc || `อุปกรณ์แท้จาก Ragnarok Online (Lv.${wLv} | ID: ${dbEntry.id})`,
    equipped: false
  };
}

// Pulls from all 2,806 Weapons + 5,713 Armors in RO_DB filtered by Stage/Weapon Level!
export function generateLootEquipment(stageNum = 1, isBossDrop = false) {
  if (RO_DB.loaded && (RO_DB.weapons.length > 0 || RO_DB.armors.length > 0)) {
    const isWeapon = Math.random() < 0.45;
    const sourceList = isWeapon ? RO_DB.weapons : RO_DB.armors;
    const targetLv = Math.min(200, Math.max(1, stageNum + (isBossDrop ? 15 : 0)));
    const targetWLv = stageNum > 120 ? 4 : (stageNum > 70 ? 3 : (stageNum > 25 ? 2 : 1));
    const filtered = sourceList.filter(it => {
      const rLv = it.reqLv || 1;
      const wLv = it.wLv || 1;
      return rLv <= targetLv + 20 && wLv <= targetWLv + (isBossDrop ? 1 : 0);
    });
    const pool = filtered.length > 0 ? filtered : sourceList;
    const picked = pool[Math.floor(Math.random() * pool.length)];
    return createItemInstanceFromDb(picked, isWeapon ? 'weapon' : 'armor', stageNum, isBossDrop);
  }

  const tpl = EQUIP_TEMPLATES[Math.floor(Math.random() * EQUIP_TEMPLATES.length)];
  return {
    uid: `eq_${++equipUidCounter}_${Date.now()}`,
    id: tpl.name.toLowerCase(),
    name: `${tpl.name} [${tpl.maxSlots}]`,
    baseName: tpl.name,
    type: 'equip',
    slot: tpl.slot,
    tier: tpl.tier,
    refine: 0,
    baseAtk: tpl.baseAtk,
    baseMatk: tpl.baseMatk,
    baseDef: tpl.baseDef,
    atk: tpl.baseAtk,
    matk: tpl.baseMatk,
    def: tpl.baseDef,
    slots: tpl.maxSlots,
    cards: [],
    randomStats: [],
    rarityColor: '#2563eb',
    icon: tpl.icon,
    collection: tpl.collection,
    weight: 30,
    sellPrice: 300,
    equipped: false
  };
}

// Pulls from all 4,269 Costumes & Shadow Gear (คอสสวมใส่) in RO_DB!
export function generateLootCostume(stageNum = 1, isBossDrop = false) {
  if (RO_DB.loaded && RO_DB.costumes.length > 0) {
    const picked = RO_DB.costumes[Math.floor(Math.random() * RO_DB.costumes.length)];
    return createItemInstanceFromDb(picked, 'costume', stageNum, isBossDrop);
  }
  return null;
}

// Pulls from all 5,593 Monster Cards in RO_DB!
export function generateLootCard(stageNum = 1, monsterTypeKey = '') {
  if (RO_DB.loaded && RO_DB.cards.length > 0) {
    const cleanKey = (monsterTypeKey || '').replace(/_/g, ' ').toLowerCase();
    let pool = RO_DB.cards;
    if (cleanKey) {
      const matched = RO_DB.cards.filter(c => c.name.toLowerCase().includes(cleanKey));
      if (matched.length > 0 && Math.random() < 0.65) {
        pool = matched;
      } else {
        const withIllust = RO_DB.cards.filter(c => c.hasIllust);
        if (withIllust.length > 0 && Math.random() < 0.8) pool = withIllust;
      }
    }
    const picked = pool[Math.floor(Math.random() * pool.length)];
    const cardDef = RO_DB.cardById.get(`card_${picked.id}`) || {
      ...picked,
      id: `card_${picked.id}`,
      numId: picked.id,
      prefix: 'Enchanted',
      art: picked.hasIllust ? `/grf/card/${picked.id}.png` : `/grf/collection/${picked.id}.png`,
      icon: `/grf/icon/${picked.id}.png`,
      collection: `/grf/collection/${picked.id}.png`,
      weight: 5
    };
    return { ...cardDef, type: 'card', count: 1, weight: 5 };
  }

  const keys = Object.keys(CARD_DB);
  const k = keys[Math.floor(Math.random() * keys.length)];
  return { ...CARD_DB[k], type: 'card', count: 1, weight: 5 };
}

// Pulls from all 6,982 Etc Items in RO_DB!
export function generateLootEtc(stageNum = 1) {
  if (RO_DB.loaded && RO_DB.etcs.length > 0) {
    const picked = RO_DB.etcs[Math.floor(Math.random() * RO_DB.etcs.length)];
    return {
      id: `ro_etc_${picked.id}`,
      numId: picked.id,
      name: picked.name,
      type: 'etc',
      count: 1,
      weight: picked.weight || 8,
      sellPrice: Math.max(15, Math.min(5000, picked.price || (20 + stageNum * 4))),
      icon: `/grf/icon/${picked.id}.png`,
      collection: `/grf/collection/${picked.id}.png`,
      desc: picked.desc || `ขยะดรอปจากมอนสเตอร์ใน RO (ID: ${picked.id})`
    };
  }
  return {
    id: 'etc_jellopy',
    name: 'Jellopy (เจโลปี้)',
    type: 'etc',
    count: 1,
    weight: 6,
    sellPrice: 18 + stageNum * 3,
    icon: 'assets/items/jellopy.png',
    collection: 'assets/collection/jellopy.png',
    desc: 'ผลึกเมือกใสจากมอนสเตอร์ นำไปขายที่ร้านค้าในเมืองได้'
  };
}

// ============================================================================
// Tool Dealer Shop Catalog (Refine Materials, Anvils & Blessing Protection Stones)
// Note: Potions are NOT sold in shop per game rules - players must loot potions from maps!
// ============================================================================
export const SHOP_CATALOG = [
  // Refine Materials & Protection Ore
  { id: 'mat_phracon',        name: 'Phracon (แร่ตีบวกอาวุธ Lv.1)',    type: 'etc', buyPrice: 200,   sellPrice: 100,   weight: 20, icon: '/grf/icon/1010.png', collection: '/grf/collection/1010.png', desc: '• โลหะแร่สำหรับตีบวกอาวุธเลเวล 1 ที่ NPC ช่างตีบวก' },
  { id: 'mat_emveretarcon',   name: 'Emveretarcon (แร่ตีบวกอาวุธ Lv.2)',type: 'etc', buyPrice: 1000,  sellPrice: 500,   weight: 20, icon: '/grf/icon/1011.png', collection: '/grf/collection/1011.png', desc: '• โลหะแร่สำหรับตีบวกอาวุธเลเวล 2 ที่ NPC ช่างตีบวก' },
  { id: 'mat_oridecon',       name: 'Oridecon (แร่ตีบวกอาวุธ Lv.3-4)',  type: 'etc', buyPrice: 5000,  sellPrice: 2500,  weight: 20, icon: '/grf/icon/984.png',  collection: '/grf/collection/984.png',  desc: '• แร่บริสุทธิ์สำหรับตีบวกอาวุธเลเวล 3 และ 4 ที่ NPC ช่างตีบวก' },
  { id: 'mat_elunium',        name: 'Elunium (แร่ตีบวกชุดเกราะ)',       type: 'etc', buyPrice: 5000,  sellPrice: 2500,  weight: 20, icon: '/grf/icon/985.png',  collection: '/grf/collection/985.png',  desc: '• แร่ป้องกันสำหรับตีบวกเสื้อเกราะ หมวก โล่ ผ้าคลุม รองเท้า ที่ NPC ช่างตีบวก' },
  { id: 'mat_anvil',          name: 'Anvil (ทั่งตีบวกเหล็ก)',           type: 'etc', buyPrice: 30000, sellPrice: 15000, weight: 80, icon: '/grf/icon/986.png',  collection: '/grf/collection/986.png',  desc: '• ทั่งเหล็กสำหรับช่างตีเหล็ก เสริมความแข็งแกร่ง' },
  { id: 'mat_hd_stone',       name: 'Blessing Ore (หินกันแตก)',         type: 'etc', buyPrice: 50000, sellPrice: 25000, weight: 10, icon: '/grf/icon/6226.png', collection: '/grf/collection/6226.png', desc: '• หินศักดิ์สิทธิ์ป้องกันไอเทมสูญหายเมื่อตีบวกล้มเหลว (+5 ถึง +10)' }
];
