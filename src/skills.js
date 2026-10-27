// Authentic Ragnarok Online Skill System:
// - Strictly Class & Tier Gated Skills (Class 1 -> Class 2 -> Class 3)
// - Offensive (max 4 active slots) & Support/Buff (max 4 active slots) with Smart Level-Up Pool
// - Authentic RO Skill Effect Sprites (ef_*.png from _sprites.grf) & Textures (tex_*.png from _textures.grf)
import { audio } from './audio.js';

export const MAX_OFFENSIVE_SLOTS = 4;
export const MAX_SUPPORT_SLOTS = 4;

export function getMaxSlots(tier = 1) {
  // Tier 0-1 (Novice & Class 1): 4 Offensive + 4 Support slots
  // Tier 2+ (Class 2, Trans & Class 3): +4 slots -> 8 Offensive + 8 Support slots!
  return (tier >= 2) ? 8 : 4;
}

export const SKILL_DEFS = {
  // ============================================================================
  // 1. SWORDSMAN -> KNIGHT -> LORD KNIGHT -> RUNE KNIGHT
  // ============================================================================
  sm_bash: {
    id: 'sm_bash',
    name: 'Bash (แบช)',
    shout: 'Bash !!',
    branch: 'swordsman',
    tier: 1,
    category: 'offensive',
    type: 'slash',
    iconImg: '/grf/skill/sm_bash.png',
    desc: '[โจมตี คลาส 1] ฟันดาบอย่างรุนแรง 220% ATK และผลักศัตรูกระเด็น',
    baseCooldown: 1300,
    baseDamage: 40,
    range: 82
  },
  sm_magnum: {
    id: 'sm_magnum',
    name: 'Magnum Break (แม็กนั่มเบรค)',
    shout: 'Magnum Break !!',
    branch: 'swordsman',
    tier: 1,
    category: 'offensive',
    type: 'fire_blast',
    iconImg: '/grf/skill/sm_magnum.png',
    desc: '[โจมตี คลาส 1] ระเบิดคลื่นเพลิงรอบตัว 360° เผาผลาญศัตรูทั้งฝูง',
    baseCooldown: 2500,
    baseDamage: 52,
    radius: 105
  },
  kn_bowlingbash: {
    id: 'kn_bowlingbash',
    name: 'Bowling Bash (โบว์ลิ่งแบช)',
    shout: 'Bowling Bash !!',
    branch: 'swordsman',
    tier: 2,
    category: 'offensive',
    type: 'bowling',
    iconImg: '/grf/skill/kn_bowlingbash.png',
    desc: '[โจมตี คลาส 2] ฟาดดาบคู่กระแทกมอนสเตอร์ลอยชนกัน 2 ฮิตซ้อนเป็นลูกโซ่',
    baseCooldown: 2300,
    baseDamage: 66,
    range: 98
  },
  lk_spiralpierce: {
    id: 'lk_spiralpierce',
    name: 'Spiral Pierce (หอกสว่านทะลวง)',
    shout: 'Spiral Pierce !!',
    branch: 'swordsman',
    tier: 2,
    category: 'offensive',
    type: 'spiral_pierce',
    iconImg: '/grf/skill/lk_spiralpierce.png',
    desc: '[โจมตี ไฮคลาส] แทงหอกเกลียวสว่าน 5 ฮิตซ้อนทะลวงศัตรูเป็นเส้นตรง',
    baseCooldown: 2100,
    baseDamage: 38,
    speed: 10.5
  },
  rk_ignitionbreak: {
    id: 'rk_ignitionbreak',
    name: 'Ignition Break (อิกนิชั่นเบรค)',
    shout: 'Ignition Break !!',
    branch: 'swordsman',
    tier: 3,
    category: 'offensive',
    type: 'ignition_break',
    iconImg: '/grf/skill/rk_ignitionbreak.png',
    desc: '[โจมตี คลาส 3] ระเบิดคลื่นดาบเพลิงขนาดมหึมารอบตัว ดาเมจ 450% ATK',
    baseCooldown: 3200,
    baseDamage: 120,
    radius: 150
  },
  rk_dragonbreath: {
    id: 'rk_dragonbreath',
    name: 'Dragon Breath (พ่นไฟมังกร)',
    shout: 'Dragon Breath !!',
    branch: 'swordsman',
    tier: 3,
    category: 'offensive',
    type: 'dragon_breath',
    iconImg: '/grf/skill/rk_dragonbreath.png',
    desc: '[โจมตี คลาส 3] พ่นลมหายใจมังกรเพลิงเผาผลาญพื้นที่ด้านหน้าเป็นวงกว้าง',
    baseCooldown: 2600,
    baseDamage: 98,
    radius: 120
  },
  // Swordsman Support / Buffs
  sm_endure: {
    id: 'sm_endure',
    name: 'Endure (เอนดูร์)',
    shout: 'Endure !!',
    branch: 'swordsman',
    tier: 1,
    category: 'support',
    type: 'buff',
    buffEffect: 'ef_shield',
    buffDuration: 25,
    buffStats: { defPct: 0.25, dmgReduce: 0.15 },
    iconImg: '/grf/skill/sm_endure.png',
    desc: '[ซัพพอร์ต คลาส 1] บัพไม่ชะงัก เพิ่ม DEF +25% และลดดาเมจที่ได้รับ 15%',
    baseCooldown: 12000
  },
  kn_twohandquicken: {
    id: 'kn_twohandquicken',
    name: 'Two-Hand Quicken (ทูแฮนด์ควิกเคน)',
    shout: 'Two-Hand Quicken !!',
    branch: 'swordsman',
    tier: 2,
    category: 'support',
    type: 'buff',
    buffEffect: 'ef_quicken',
    buffDuration: 30,
    buffStats: { aspdBonus: 20, critBonus: 15 },
    iconImg: '/grf/skill/kn_twohandquicken.png',
    desc: '[ซัพพอร์ต คลาส 2] เร่งความเร็วฟันดาบ ASPD +20 และ CRIT +15%',
    baseCooldown: 14000
  },
  lk_aurablade: {
    id: 'lk_aurablade',
    name: 'Aura Blade (ออร่าเบลด)',
    shout: 'Aura Blade !!',
    branch: 'swordsman',
    tier: 2,
    category: 'support',
    type: 'buff',
    buffEffect: 'ef_blessing',
    buffDuration: 30,
    buffStats: { atkPct: 0.30 },
    iconImg: '/grf/skill/lk_aurablade.png',
    desc: '[ซัพพอร์ต ไฮคลาส] อัดคลื่นออร่าลงในดาบ เพิ่มพลังโจมตี +30% ทะลุเกราะ',
    baseCooldown: 14000
  },
  lk_berserk: {
    id: 'lk_berserk',
    name: 'Frenzy / Berserk (คลั่งดาบ)',
    shout: 'Berserk !!',
    branch: 'swordsman',
    tier: 3,
    category: 'support',
    type: 'buff',
    buffEffect: 'ef_angelus',
    buffDuration: 20,
    buffStats: { atkPct: 0.50, aspdBonus: 25, spdPct: 0.20 },
    iconImg: '/grf/skill/lk_berserk.png',
    desc: '[ซัพพอร์ต คลาส 3] โหมดคลั่ง เพิ่ม ATK +50%, ASPD +25 และเดินเร็วขึ้น 20%',
    baseCooldown: 16000
  },

  // ============================================================================
  // 2. MAGE -> WIZARD -> HIGH WIZARD -> WARLOCK
  // ============================================================================
  mg_firebolt: {
    id: 'mg_firebolt',
    name: 'Fire Bolt (ไฟร์โบลต์)',
    shout: 'Fire Bolt !!',
    branch: 'mage',
    tier: 1,
    category: 'offensive',
    type: 'multi_bolt',
    element: 'fire',
    iconImg: '/grf/skill/mg_firebolt.png',
    desc: '[โจมตี คลาส 1] ร่ายชุดลูกไฟตกจากฟ้าใส่ศัตรูต่อเนื่องสูงสุด 6 ดอก',
    baseCooldown: 1350,
    baseDamage: 26
  },
  mg_coldbolt: {
    id: 'mg_coldbolt',
    name: 'Cold Bolt (โคลด์โบลต์)',
    shout: 'Cold Bolt !!',
    branch: 'mage',
    tier: 1,
    category: 'offensive',
    type: 'falling_ice',
    iconImg: '/grf/skill/mg_coldbolt.png',
    desc: '[โจมตี คลาส 1] เสกแท่งผลึกน้ำแข็งพุ่งทะลวงศัตรูและแช่แข็ง',
    baseCooldown: 1750,
    baseDamage: 38,
    radius: 70
  },
  mg_lightningbolt: {
    id: 'mg_lightningbolt',
    name: 'Lightning Bolt (ไลท์นิ่งโบลต์)',
    shout: 'Lightning Bolt !!',
    branch: 'mage',
    tier: 1,
    category: 'offensive',
    type: 'lightning',
    iconImg: '/grf/skill/mg_lightningbolt.png',
    desc: '[โจมตี คลาส 1] เรียกสายฟ้าฟาดลงใส่เป้าหมายอย่างรุนแรง',
    baseCooldown: 1850,
    baseDamage: 44
  },
  wz_stormgust: {
    id: 'wz_stormgust',
    name: 'Storm Gust (สตอร์มกัสต์)',
    shout: 'Storm Gust !!',
    branch: 'mage',
    tier: 2,
    category: 'offensive',
    type: 'storm_gust',
    iconImg: '/grf/skill/wz_stormgust.png',
    desc: '[โจมตี คลาส 2] กางวงเวทเรียกพายุหิมะและแท่งน้ำแข็งยักษ์ แช่แข็งและทำดาเมจต่อเนื่อง',
    baseCooldown: 3500,
    baseDamage: 76,
    radius: 135
  },
  wz_meteor: {
    id: 'wz_meteor',
    name: 'Meteor Storm (เมเทโอสตอร์ม)',
    shout: 'Meteor Storm !!',
    branch: 'mage',
    tier: 2,
    category: 'offensive',
    type: 'meteor_storm',
    iconImg: '/grf/skill/wz_meteor.png',
    desc: '[โจมตี คลาส 2] เรียกอุกกาบาตยักษ์ตกกระแทกพื้นระเบิดเสาเพลิงหลายลูก',
    baseCooldown: 3600,
    baseDamage: 84,
    radius: 125
  },
  wz_vermilion: {
    id: 'wz_vermilion',
    name: 'Lord of Vermilion (ลอร์ดออฟเวอร์มิเลียน)',
    shout: 'Lord of Vermilion !!',
    branch: 'mage',
    tier: 2,
    category: 'offensive',
    type: 'vermilion',
    iconImg: '/grf/skill/wz_vermilion.png',
    desc: '[โจมตี คลาส 2] ผ่ามหาสายฟ้ากัมปนาท 4 ระลอกซ้อนทั่วบริเวณ',
    baseCooldown: 3400,
    baseDamage: 78,
    radius: 135
  },
  wl_crimsonrock: {
    id: 'wl_crimsonrock',
    name: 'Crimson Rock (คริมสันร็อค)',
    shout: 'Crimson Rock !!',
    branch: 'mage',
    tier: 3,
    category: 'offensive',
    type: 'crimson_rock',
    iconImg: '/grf/skill/wl_crimsonrock.png',
    desc: '[โจมตี คลาส 3] เสกหินอุกกาบาตเพลิงยักษ์ถล่มกลางฝูงมอนสเตอร์ ดาเมจมหาศาล',
    baseCooldown: 3800,
    baseDamage: 140,
    radius: 155
  },
  wl_chainlightning: {
    id: 'wl_chainlightning',
    name: 'Chain Lightning (เชนไลท์นิ่ง)',
    shout: 'Chain Lightning !!',
    branch: 'mage',
    tier: 3,
    category: 'offensive',
    type: 'chain_lightning',
    iconImg: '/grf/skill/wl_chainlightning.png',
    desc: '[โจมตี คลาส 3] สายฟ้าลูกโซ่ช็อตกระโดดใส่ศัตรูต่อเนื่อง 6 ตัวซ้อน',
    baseCooldown: 2400,
    baseDamage: 74
  },
  // Mage Support / Buffs
  mg_energycoat: {
    id: 'mg_energycoat',
    name: 'Energy Coat (เอเนอร์จี้โค้ท)',
    shout: 'Energy Coat !!',
    branch: 'mage',
    tier: 1,
    category: 'support',
    type: 'buff',
    buffEffect: 'ef_shield',
    buffDuration: 30,
    buffStats: { dmgReduce: 0.30, defPct: 0.20 },
    iconImg: '/grf/skill/mg_energycoat.png',
    desc: '[ซัพพอร์ต คลาส 1] กางม่านพลังเวทคลุมกาย ลดความเสียหายที่ได้รับลง 30%',
    baseCooldown: 14000
  },
  hw_magicpower: {
    id: 'hw_magicpower',
    name: 'Mystical Amplification (เร่งพลังเวท)',
    shout: 'Amplify Magic Power !!',
    branch: 'mage',
    tier: 2,
    category: 'support',
    type: 'buff',
    buffEffect: 'ef_sight',
    buffDuration: 25,
    buffStats: { matkPct: 0.50, atkPct: 0.35 },
    iconImg: '/grf/skill/hw_magicpower.png',
    desc: '[ซัพพอร์ต ไฮคลาส] เร่งขีดจำกัดพลังเวท MATK +50% นาน 25 วิ',
    baseCooldown: 13000
  },
  wl_recognizedspell: {
    id: 'wl_recognizedspell',
    name: 'Recognized Spell (เข้าใจแก่นเวท)',
    shout: 'Recognized Spell !!',
    branch: 'mage',
    tier: 3,
    category: 'support',
    type: 'buff',
    buffEffect: 'ef_angelus',
    buffDuration: 30,
    buffStats: { matkPct: 0.45, critBonus: 25 },
    iconImg: '/grf/skill/wl_recognizedspell.png',
    desc: '[ซัพพอร์ต คลาส 3] ร่ายเวทด้วยความแรงสูงสุดเสมอ MATK +45% และคริเวท +25%',
    baseCooldown: 15000
  },

  // ============================================================================
  // 3. ARCHER -> HUNTER -> SNIPER -> RANGER
  // ============================================================================
  ac_double: {
    id: 'ac_double',
    name: 'Double Strafe (ดับเบิ้ลสเตรฟ)',
    shout: 'Double Strafe !!',
    branch: 'archer',
    tier: 1,
    category: 'offensive',
    type: 'arrow_shot',
    iconImg: '/grf/skill/ac_double.png',
    desc: '[โจมตี คลาส 1] ยิงธนูคู่ 2 ดอกซ้อนด้วยความเร็วสูงใส่เป้าหมาย',
    baseCooldown: 1050,
    baseDamage: 30,
    speed: 11
  },
  ac_shower: {
    id: 'ac_shower',
    name: 'Arrow Shower (แอร์โรว์ชาวเวอร์)',
    shout: 'Arrow Shower !!',
    branch: 'archer',
    tier: 1,
    category: 'offensive',
    type: 'arrow_rain',
    iconImg: '/grf/skill/ac_shower.png',
    desc: '[โจมตี คลาส 1] ยิงห่าฝนธนูโปรยปรายลงมาทำลายศัตรูเป็นวงกว้าง',
    baseCooldown: 2300,
    baseDamage: 40,
    radius: 100
  },
  ht_blitzbeat: {
    id: 'ht_blitzbeat',
    name: 'Blitz Beat (นกฟอลคอนโฉบ)',
    shout: 'Blitz Beat !!',
    branch: 'archer',
    tier: 2,
    category: 'offensive',
    type: 'falcon',
    iconImg: '/grf/skill/ht_blitzbeat.png',
    desc: '[โจมตี คลาส 2] สั่งนกเหยี่ยว Falcon แท้โฉบจิกศัตรู 5 ฮิตทะลุพลังป้องกัน',
    baseCooldown: 2100,
    baseDamage: 58,
    radius: 85
  },
  sn_sharpshooting: {
    id: 'sn_sharpshooting',
    name: 'Sharp Shooting (ชาร์ปชูตติ้ง)',
    shout: 'Sharp Shooting !!',
    branch: 'archer',
    tier: 2,
    category: 'offensive',
    type: 'sharpshooting',
    iconImg: '/grf/skill/sn_sharpshooting.png',
    desc: '[โจมตี ไฮคลาส] ยิงศรทะลวงแนวเส้นตรงระยะไกล ติดคริติคอลรุนแรงทุกตัวที่ผ่าน',
    baseCooldown: 2200,
    baseDamage: 72,
    speed: 13.5
  },
  ra_arrowstorm: {
    id: 'ra_arrowstorm',
    name: 'Arrow Storm (พายุฝนธนู)',
    shout: 'Arrow Storm !!',
    branch: 'archer',
    tier: 3,
    category: 'offensive',
    type: 'arrow_storm',
    iconImg: '/grf/skill/ra_arrowstorm.png',
    desc: '[โจมตี คลาส 3] ถล่มพายุลูกธนู 6 ฮิตซ้อนในรัศมีขนาดใหญ่',
    baseCooldown: 2900,
    baseDamage: 110,
    radius: 145
  },
  ra_wugstrike: {
    id: 'ra_wugstrike',
    name: 'Warg Strike (หมาป่าขย้ำ)',
    shout: 'Warg Strike !!',
    branch: 'archer',
    tier: 3,
    category: 'offensive',
    type: 'warg_strike',
    iconImg: '/grf/skill/ra_wugstrike.png',
    desc: '[โจมตี คลาส 3] สั่งหมาป่ายักษ์ Warg แท้พุ่งขย้ำเป้าหมายอย่างดุดัน',
    baseCooldown: 1950,
    baseDamage: 92
  },
  // Archer Support / Buffs
  ac_concentration: {
    id: 'ac_concentration',
    name: 'Improve Concentration (อิมพรูฟ)',
    shout: 'Improve Concentration !!',
    branch: 'archer',
    tier: 1,
    category: 'support',
    type: 'buff',
    buffEffect: 'ef_sight',
    buffDuration: 30,
    buffStats: { atkPct: 0.25, aspdBonus: 12 },
    iconImg: '/grf/skill/ac_concentration.png',
    desc: '[ซัพพอร์ต คลาส 1] เพิ่มสมาธิ DEX/AGI เพิ่ม ATK +25% และ ASPD +12',
    baseCooldown: 14000
  },
  sn_windwalk: {
    id: 'sn_windwalk',
    name: 'Wind Walk (วินด์วอล์ค)',
    shout: 'Wind Walk !!',
    branch: 'archer',
    tier: 2,
    category: 'support',
    type: 'buff',
    buffEffect: 'ef_quicken',
    buffDuration: 30,
    buffStats: { spdPct: 0.30, critBonus: 15 },
    iconImg: '/grf/skill/sn_windwalk.png',
    desc: '[ซัพพอร์ต ไฮคลาส] ก้าวเดินดั่งสายลม เพิ่มความเร็วเดิน +30% และคริ +15%',
    baseCooldown: 14000
  },
  ra_fearbreeze: {
    id: 'ra_fearbreeze',
    name: 'Fear Breeze (เฟียร์บรีซ)',
    shout: 'Fear Breeze !!',
    branch: 'archer',
    tier: 3,
    category: 'support',
    type: 'buff',
    buffEffect: 'ef_angelus',
    buffDuration: 25,
    buffStats: { atkPct: 0.45, aspdBonus: 25 },
    iconImg: '/grf/skill/ra_fearbreeze.png',
    desc: '[ซัพพอร์ต คลาส 3] ยิงธนูซ้อนหลายดอกตามสายลม ATK +45% และ ASPD +25',
    baseCooldown: 15000
  },

  // ============================================================================
  // 4. THIEF -> ASSASSIN -> ASSASSIN CROSS -> GUILLOTINE CROSS
  // ============================================================================
  tf_double: {
    id: 'tf_double',
    name: 'Double Attack (มีดคู่ความเร็วสูง)',
    shout: 'Double Attack !!',
    branch: 'thief',
    tier: 1,
    category: 'offensive',
    type: 'daggers_orbit',
    iconImg: '/grf/skill/tf_double.png',
    desc: '[โจมตี คลาส 1] คมมีดสั้นหมุนฟาดฟันศัตรูรอบตัวด้วยความเร็วสูง',
    baseCooldown: 1000,
    baseDamage: 26
  },
  tf_poison: {
    id: 'tf_poison',
    name: 'Envenom (สาดพิษสังหาร)',
    shout: 'Envenom !!',
    branch: 'thief',
    tier: 1,
    category: 'offensive',
    type: 'poison_cloud',
    iconImg: '/grf/skill/tf_poison.png',
    desc: '[โจมตี คลาส 1] ซัดมีดอาบพิษแพร่กระจายหมอกพิษใส่ศัตรูรอบข้าง',
    baseCooldown: 1950,
    baseDamage: 38,
    radius: 88
  },
  as_sonicblow: {
    id: 'as_sonicblow',
    name: 'Sonic Blow (โซนิคโบลว์ 8 ฮิต)',
    shout: 'Sonic Blow !!',
    branch: 'thief',
    tier: 2,
    category: 'offensive',
    type: 'sonic_blow',
    iconImg: '/grf/skill/as_sonicblow.png',
    desc: '[โจมตี คลาส 2] พุ่งสับกาตาร์ความเร็วเหนือเสียง 8 ฮิตซ้อนใส่เป้าหมาย',
    baseCooldown: 2300,
    baseDamage: 82
  },
  as_grimtooth: {
    id: 'as_grimtooth',
    name: 'Grimtooth / Meteor Assault (ตวัดเขี้ยวสังหาร)',
    shout: 'Meteor Assault !!',
    branch: 'thief',
    tier: 2,
    category: 'offensive',
    type: 'meteor_assault',
    iconImg: '/grf/skill/as_grimtooth.png',
    desc: '[โจมตี คลาส 2] ตวัดคลื่นคมเขี้ยวรอบทิศทาง ทำให้ศัตรูติดเลือดไหลและมึนงง',
    baseCooldown: 2100,
    baseDamage: 68,
    radius: 108
  },
  gc_rollingcutter: {
    id: 'gc_rollingcutter',
    name: 'Rolling Cutter (โรลลิ่งคัตเตอร์)',
    shout: 'Rolling Cutter !!',
    branch: 'thief',
    tier: 3,
    category: 'offensive',
    type: 'rolling_cutter',
    iconImg: '/grf/skill/gc_rollingcutter.png',
    desc: '[โจมตี คลาส 3] หมุนตัวเหวี่ยงกาตาร์เป็นพายุใบมีดฟันศัตรูรอบตัวต่อเนื่อง',
    baseCooldown: 1750,
    baseDamage: 88,
    radius: 118
  },
  gc_crossimpact: {
    id: 'gc_crossimpact',
    name: 'Cross Impact (ครอสอิมแพค)',
    shout: 'Cross Impact !!',
    branch: 'thief',
    tier: 3,
    category: 'offensive',
    type: 'cross_impact',
    iconImg: '/grf/skill/gc_crossimpact.png',
    desc: '[โจมตี คลาส 3] พุ่งฟันกากบาท 7 ฮิตซ้อนด้วยความเร็วแสง ดาเมจสังหารบอส',
    baseCooldown: 2500,
    baseDamage: 125
  },
  // Thief Support / Buffs
  tf_hiding: {
    id: 'tf_hiding',
    name: 'Hiding / Dodge Mastery (พรางตัวหลบหลีก)',
    shout: 'Hiding !!',
    branch: 'thief',
    tier: 1,
    category: 'support',
    type: 'buff',
    buffEffect: 'ef_quicken',
    buffDuration: 25,
    buffStats: { spdPct: 0.25, critBonus: 12, dmgReduce: 0.15 },
    iconImg: '/grf/skill/tf_hiding.png',
    desc: '[ซัพพอร์ต คลาส 1] เร่งความเร็วเคลื่อนที่ +25%, CRIT +12% และลดดาเมจ 15%',
    baseCooldown: 13000
  },
  as_cloaking: {
    id: 'as_cloaking',
    name: 'Cloaking / Enchant Poison (เคลือบพิษ)',
    shout: 'Enchant Poison !!',
    branch: 'thief',
    tier: 2,
    category: 'support',
    type: 'buff',
    buffEffect: 'ef_poisonhit',
    buffDuration: 30,
    buffStats: { atkPct: 0.28, critBonus: 18 },
    iconImg: '/grf/skill/as_cloaking.png',
    desc: '[ซัพพอร์ต คลาส 2] เคลือบยาพิษลงบนอาวุธ เพิ่ม ATK +28% และ CRIT +18%',
    baseCooldown: 14000
  },
  asc_edp: {
    id: 'asc_edp',
    name: 'Enchant Deadly Poison (EDP ยาพิษมรณะ)',
    shout: 'Enchant Deadly Poison !!',
    branch: 'thief',
    tier: 2,
    category: 'support',
    type: 'buff',
    buffEffect: 'ef_poison',
    buffDuration: 25,
    buffStats: { atkPct: 0.65, critBonus: 25 },
    iconImg: '/grf/skill/asc_edp.png',
    desc: '[ซัพพอร์ต ไฮคลาส] เคลือบพิษมรณะ EDP เพิ่มพลังโจมตี +65% และ CRIT +25%',
    baseCooldown: 16000
  },
  gc_weaponblocking: {
    id: 'gc_weaponblocking',
    name: 'Weapon Blocking (บล็อกอาวุธสวนกลับ)',
    shout: 'Weapon Blocking !!',
    branch: 'thief',
    tier: 3,
    category: 'support',
    type: 'buff',
    buffEffect: 'ef_shield',
    buffDuration: 30,
    buffStats: { dmgReduce: 0.35, aspdBonus: 20, critBonus: 20 },
    iconImg: '/grf/skill/gc_weaponblocking.png',
    desc: '[ซัพพอร์ต คลาส 3] ปัดป้องการโจมตี ลดดาเมจ 35% และเพิ่ม ASPD/CRIT +20',
    baseCooldown: 15000
  },

  // ============================================================================
  // 5. ACOLYTE -> PRIEST -> HIGH PRIEST -> ARCH BISHOP
  // ============================================================================
  al_holylight: {
    id: 'al_holylight',
    name: 'Holy Light (โฮลีไลท์)',
    shout: 'Holy Light !!',
    branch: 'acolyte',
    tier: 1,
    category: 'offensive',
    type: 'holy_beam',
    iconImg: '/grf/skill/al_holywater.png',
    desc: '[โจมตี คลาส 1] กางเขนแสงศักดิ์สิทธิ์ผ่าลงใส่เป้าหมาย รุนแรงต่อผีดิบและปีศาจ',
    baseCooldown: 1450,
    baseDamage: 45
  },
  pr_magnus: {
    id: 'pr_magnus',
    name: 'Magnus Exorcismus (แม็กนัสเอ็กโซซิมัส)',
    shout: 'Magnus Exorcismus !!',
    branch: 'acolyte',
    tier: 2,
    category: 'offensive',
    type: 'magnus',
    iconImg: '/grf/skill/pr_magnus.png',
    desc: '[โจมตี คลาส 2] กางวงเวทกางเขนยักษ์บนพื้น ชำระล้างศัตรูทุกตัวในอาณาเขต',
    baseCooldown: 3600,
    baseDamage: 86,
    radius: 140
  },
  pr_sanctuary: {
    id: 'pr_sanctuary',
    name: 'Sanctuary (วิหารแสงศักดิ์สิทธิ์)',
    shout: 'Sanctuary !!',
    branch: 'acolyte',
    tier: 2,
    category: 'offensive',
    type: 'sanctuary',
    iconImg: '/grf/skill/pr_sanctuary.png',
    desc: '[โจมตี/ฟื้นฟู คลาส 2] กางวงแหวนวิหารศักดิ์สิทธิ์ ฟื้นฟู HP และผลักมอนสเตอร์กระเด็น',
    baseCooldown: 3500,
    baseDamage: 68,
    healAmount: 50,
    radius: 115
  },
  ab_judex: {
    id: 'ab_judex',
    name: 'Judex (จูเด็กซ์)',
    shout: 'Judex !!',
    branch: 'acolyte',
    tier: 3,
    category: 'offensive',
    type: 'judex',
    iconImg: '/grf/skill/ab_judex.png',
    desc: '[โจมตี คลาส 3] ลำแสงพิพากษาศักดิ์สิทธิ์ 3 ฮิตซ้อนระเบิดเป็นวงกว้าง',
    baseCooldown: 1950,
    baseDamage: 92,
    radius: 100
  },
  ab_adoramus: {
    id: 'ab_adoramus',
    name: 'Adoramus (อะโดรามุส)',
    shout: 'Adoramus !!',
    branch: 'acolyte',
    tier: 3,
    category: 'offensive',
    type: 'adoramus',
    iconImg: '/grf/skill/ab_adoramus.png',
    desc: '[โจมตี คลาส 3] มหาเวทลำแสงศักดิ์สิทธิ์ 10 ฮิตซ้อนเผาผลาญเป้าหมายและรอบข้าง',
    baseCooldown: 3100,
    baseDamage: 132,
    radius: 125
  },
  // Acolyte Support / Buffs
  al_heal: {
    id: 'al_heal',
    name: 'Heal (ฮีลศักดิ์สิทธิ์)',
    shout: 'Heal !!',
    branch: 'acolyte',
    tier: 1,
    category: 'support',
    type: 'heal',
    iconImg: '/grf/skill/al_heal.png',
    desc: '[ซัพพอร์ต คลาส 1] ฟื้นฟูพลังชีวิต HP ทันทีและสร้างความเสียหายศักดิ์สิทธิ์รอบตัว',
    baseCooldown: 4200,
    healAmount: 70,
    baseDamage: 38,
    radius: 90
  },
  al_blessing: {
    id: 'al_blessing',
    name: 'Blessing (เบลสซิ่ง)',
    shout: 'Blessing !!',
    branch: 'acolyte',
    tier: 1,
    category: 'support',
    type: 'buff',
    buffEffect: 'ef_blessing',
    buffDuration: 35,
    buffStats: { atkPct: 0.25, matkPct: 0.25 },
    iconImg: '/grf/skill/al_blessing.png',
    desc: '[ซัพพอร์ต คลาส 1] นางฟ้าอวยพรเพิ่ม STR/INT/DEX ดาเมจกายภาพและเวท +25%',
    baseCooldown: 14000
  },
  al_incagi: {
    id: 'al_incagi',
    name: 'Increase AGI (เพิ่มเอจี)',
    shout: 'Increase AGI !!',
    branch: 'acolyte',
    tier: 1,
    category: 'support',
    type: 'buff',
    buffEffect: 'ef_quicken',
    buffDuration: 35,
    buffStats: { spdPct: 0.28, aspdBonus: 15 },
    iconImg: '/grf/skill/al_incagi.png',
    desc: '[ซัพพอร์ต คลาส 1] เพิ่มความเร็วเคลื่อนที่ +28% และความเร็วโจมตี ASPD +15',
    baseCooldown: 14000
  },
  al_angelus: {
    id: 'al_angelus',
    name: 'Angelus (แองเจลัส)',
    shout: 'Angelus !!',
    branch: 'acolyte',
    tier: 1,
    category: 'support',
    type: 'buff',
    buffEffect: 'ef_angelus',
    buffDuration: 35,
    buffStats: { defPct: 0.40, dmgReduce: 0.20 },
    iconImg: '/grf/skill/al_angelus.png',
    desc: '[ซัพพอร์ต คลาส 1] อัญเชิญวาลคีรีเพิ่มพลังป้องกัน DEF +40% และลดดาเมจ 20%',
    baseCooldown: 14000
  },
  pr_kyrie: {
    id: 'pr_kyrie',
    name: 'Kyrie Eleison (เกราะคีรีเอเลซัน)',
    shout: 'Kyrie Eleison !!',
    branch: 'acolyte',
    tier: 2,
    category: 'support',
    type: 'buff',
    buffEffect: 'ef_shield',
    buffDuration: 30,
    buffStats: { kyrieHits: 6, dmgReduce: 0.25 },
    iconImg: '/grf/skill/pr_kyrie.png',
    desc: '[ซัพพอร์ต คลาส 2] กางบาเรียศักดิ์สิทธิ์บล็อกการโจมตีได้ 6 ครั้ง และลดดาเมจ 25%',
    baseCooldown: 12000
  },
  hp_assumptio: {
    id: 'hp_assumptio',
    name: 'Assumptio (อัสสัมชัญ)',
    shout: 'Assumptio !!',
    branch: 'acolyte',
    tier: 2,
    category: 'support',
    type: 'buff',
    buffEffect: 'ef_angelus',
    buffDuration: 35,
    buffStats: { defPct: 0.80, dmgReduce: 0.35 },
    iconImg: '/grf/skill/hp_assumptio.png',
    desc: '[ซัพพอร์ต ไฮคลาส] พรศักดิ์สิทธิ์ขั้นสูง เพิ่ม DEF +80% และลดดาเมจที่ได้รับ 35%',
    baseCooldown: 15000
  },
  ab_highnessheal: {
    id: 'ab_highnessheal',
    name: 'Highness Heal (ไฮเนสฮีล)',
    shout: 'Highness Heal !!',
    branch: 'acolyte',
    tier: 3,
    category: 'support',
    type: 'heal',
    iconImg: '/grf/skill/ab_highnessheal.png',
    desc: '[ซัพพอร์ต คลาส 3] มหาเวทฟื้นฟู HP จำนวนมหาศาลและระเบิดแสงศักดิ์สิทธิ์รอบตัว',
    baseCooldown: 4500,
    healAmount: 180,
    baseDamage: 95,
    radius: 125
  },

  // ============================================================================
  // 6. MERCHANT -> BLACKSMITH -> WHITESMITH -> MECHANIC
  // ============================================================================
  mc_mammonite: {
    id: 'mc_mammonite',
    name: 'Mammonite (แมมโมไนท์ ฟาดด้วยเงิน)',
    shout: 'Mammonite !!',
    branch: 'merchant',
    tier: 1,
    category: 'offensive',
    type: 'mammonite',
    iconImg: '/grf/skill/mc_mammonite.png',
    desc: '[โจมตี คลาส 1] โปรยเหรียญทองฟาดศัตรูด้วยพลังแห่งเงินตรา 300% ATK',
    baseCooldown: 1350,
    baseDamage: 54
  },
  mc_cartrevolution: {
    id: 'mc_cartrevolution',
    name: 'Cart Revolution (รถเข็นพุ่งชน)',
    shout: 'Cart Revolution !!',
    branch: 'merchant',
    tier: 1,
    category: 'offensive',
    type: 'cart_spin',
    iconImg: '/grf/skill/mc_cartrevolution.png',
    desc: '[โจมตี คลาส 1] เหวี่ยงรถเข็นกระแทกฝูงมอนสเตอร์กระเด็นถอยหลังเป็นวงกว้าง',
    baseCooldown: 2100,
    baseDamage: 48,
    radius: 95
  },
  bs_hammerfall: {
    id: 'bs_hammerfall',
    name: 'Hammer Fall (ค้อนทุบธรณี)',
    shout: 'Hammer Fall !!',
    branch: 'merchant',
    tier: 2,
    category: 'offensive',
    type: 'cart_termination',
    iconImg: '/grf/skill/bs_hammerfall.png',
    desc: '[โจมตี คลาส 2] ทุบค้อนลงพื้นดินจนแผ่นดินไหว สร้างดาเมจวงกว้างและติดมึนงง',
    baseCooldown: 2300,
    baseDamage: 74,
    radius: 105
  },
  ws_carttermination: {
    id: 'ws_carttermination',
    name: 'Cart Termination (คาร์ทเทอร์มิเนชั่น)',
    shout: 'Cart Termination !!',
    branch: 'merchant',
    tier: 2,
    category: 'offensive',
    type: 'cart_termination',
    iconImg: '/grf/skill/bs_overthrust.png',
    desc: '[โจมตี ไฮคลาส] กระโดดทุ่มรถเข็นเต็มกำลัง ทุบพื้นแตกกระจายรุนแรง',
    baseCooldown: 2300,
    baseDamage: 84,
    radius: 105
  },
  nc_axetornado: {
    id: 'nc_axetornado',
    name: 'Axe Tornado (พายุขวานหมุน)',
    shout: 'Axe Tornado !!',
    branch: 'merchant',
    tier: 3,
    category: 'offensive',
    type: 'axe_tornado',
    iconImg: '/grf/skill/nc_axetornado.png',
    desc: '[โจมตี คลาส 3] ปั่นพายุขวานยักษ์หมุนฟาดศัตรูรอบทิศทาง 6 ฮิตซ้อน',
    baseCooldown: 2600,
    baseDamage: 110,
    radius: 135
  },
  nc_armscannon: {
    id: 'nc_armscannon',
    name: 'Arms Cannon / Axe Boomerang (ปืนใหญ่หุ่นรบ)',
    shout: 'Arms Cannon !!',
    branch: 'merchant',
    tier: 3,
    category: 'offensive',
    type: 'arms_cannon',
    iconImg: '/grf/skill/nc_axeboomerang.png',
    desc: '[โจมตี คลาส 3] ยิงกระสุนปืนใหญ่พลังงานถล่มเป้าหมายระเบิดเป็นวงกว้าง',
    baseCooldown: 3000,
    baseDamage: 130,
    radius: 140
  },
  // Merchant Support / Buffs
  mc_loud: {
    id: 'mc_loud',
    name: 'Crazy Uproar (ตะโกนปลุกใจ)',
    shout: 'Crazy Uproar !!',
    branch: 'merchant',
    tier: 1,
    category: 'support',
    type: 'buff',
    buffEffect: 'ef_blessing',
    buffDuration: 30,
    buffStats: { atkPct: 0.22, zenyBonus: 0.35 },
    iconImg: '/grf/skill/mc_loud.png',
    desc: '[ซัพพอร์ต คลาส 1] ตะโกนเพิ่มพลัง STR ATK +22% และดรอป Zeny เพิ่มขึ้น +35%',
    baseCooldown: 13000
  },
  bs_adrenaline: {
    id: 'bs_adrenaline',
    name: 'Adrenaline Rush (อะดรีนาลีนรัช)',
    shout: 'Adrenaline Rush !!',
    branch: 'merchant',
    tier: 2,
    category: 'support',
    type: 'buff',
    buffEffect: 'ef_quicken',
    buffDuration: 30,
    buffStats: { aspdBonus: 25, critBonus: 15 },
    iconImg: '/grf/skill/bs_adrenaline.png',
    desc: '[ซัพพอร์ต คลาส 2] เร่งความเร็วการโจมตีสูงสุด ASPD +25 และ CRIT +15%',
    baseCooldown: 14000
  },
  bs_overthrust: {
    id: 'bs_overthrust',
    name: 'Maximum Overthrust (โอเวอร์ทรัสต์)',
    shout: 'Maximum Overthrust !!',
    branch: 'merchant',
    tier: 2,
    category: 'support',
    type: 'buff',
    buffEffect: 'ef_angelus',
    buffDuration: 30,
    buffStats: { atkPct: 0.45 },
    iconImg: '/grf/skill/bs_overthrust.png',
    desc: '[ซัพพอร์ต ไฮคลาส] อัดพลังทำลายล้างขั้นสุด เพิ่มพลังโจมตีอาวุธ +45%',
    baseCooldown: 15000
  },
  nc_boostknuckle: {
    id: 'nc_boostknuckle',
    name: 'Mecha Overdrive (เดินเครื่องหุ่นรบเต็มพิกัด)',
    shout: 'Mecha Overdrive !!',
    branch: 'merchant',
    tier: 3,
    category: 'support',
    type: 'buff',
    buffEffect: 'ef_shield',
    buffDuration: 30,
    buffStats: { atkPct: 0.50, defPct: 0.40, spdPct: 0.25 },
    iconImg: '/grf/skill/nc_boostknuckle.png',
    desc: '[ซัพพอร์ต คลาส 3] เดินเครื่องหุ่นรบเต็มพิกัด ATK +50%, DEF +40% และเดินเร็ว +25%',
    baseCooldown: 15000
  },

  // ============================================================================
  // 7. NOVICE SKILLS
  // ============================================================================
  nv_firstaid: {
    id: 'nv_firstaid',
    name: 'First Aid (ปฐมพยาบาล)',
    shout: 'First Aid !!',
    branch: 'novice',
    tier: 0,
    category: 'support',
    type: 'firstaid',
    iconImg: '/grf/skill/nv_firstaid.png',
    desc: '[ซัพพอร์ต โนวิซ] ปฐมพยาบาลฟื้นฟู HP ตนเองอัตโนมัติทุก 5 วินาที',
    baseCooldown: 5000,
    healAmount: 40
  }
};

// Preload Authentic RO Effect Sprites & Textures
const EFFECT_SPRITE_COUNTS = {
  ef_fireball: 6,
  ef_firewall: 6,
  ef_waterball: 3,
  ef_thunderstorm: 5,
  ef_earthquake: 5,
  ef_blessing: 2,
  ef_angelus: 4,
  ef_hundredspear: 6,
  ef_spear: 1,
  ef_slash1: 6,
  ef_slash2: 4,
  ef_flashslash: 6,
  ef_falcon: 6,
  ef_warg: 6,
  ef_coin: 6,
  ef_dragonbreath: 6,
  ef_holy: 1,
  ef_sanctuary: 2,
  ef_poison: 6,
  ef_poisonhit: 6,
  ef_mvp: 6,
  ef_stun: 1,
  ef_quicken: 6,
  ef_shield: 4,
  ef_sight: 5
};

const EFFECT_TEXTURE_FILES = {
  magic_circle: 'assets/effects/tex_magic_circle.png',
  freezing_circle: 'assets/effects/tex_freezing_circle.png',
  freeze_ice: 'assets/effects/tex_freeze_ice.png',
  ice_block: 'assets/effects/tex_ice_block.png',
  fire_ring: 'assets/effects/tex_fire_ring.png',
  fire_blast: 'assets/effects/tex_fire_blast.png',
  meteor_exp: 'assets/effects/tex_meteor_exp.png',
  thunder_blast: 'assets/effects/tex_thunder_blast.png',
  lightning_bolt: 'assets/effects/tex_lightning_bolt.png',
  storm_god: 'assets/effects/tex_storm_god.png',
  holy_cross: 'assets/effects/tex_holy_cross.png',
  holy_ring: 'assets/effects/tex_holy_ring.png',
  angel_ring: 'assets/effects/tex_angel_ring.png',
  poison_ring: 'assets/effects/tex_poison_ring.png',
  arrow: 'assets/effects/effect_arrow.png',
  slash: 'assets/effects/effect_slash.png',
  fire: 'assets/effects/effect_fire.png',
  ice: 'assets/effects/effect_ice.png',
  light: 'assets/effects/effect_light.png'
};

export class SkillManager {
  constructor(player, characterRef) {
    this.player = player;
    this.character = characterRef;
    this.skills = new Map(); // skillId -> level (1..10)
    this.cooldowns = new Map(); // skillId -> remaining ms
    this.maxCooldowns = new Map(); // skillId -> total cooldown ms
    this.activeBuffs = new Map(); // skillId -> { id, name, iconImg, remaining, maxDuration, stats }
    this.projectiles = [];
    this.aoeEffects = [];
    this.spriteAnims = []; // Authentic RO .spr frame sequences
    this.lightningArcs = [];
    this.orbitAngle = 0;
    this.normalAttackCooldown = 0;

    this.effects = {};
    this.sprFrames = {};
    this.loadEffectTextures();
  }

  loadEffectTextures() {
    for (const [key, src] of Object.entries(EFFECT_TEXTURE_FILES)) {
      const img = new Image();
      img.src = src;
      this.effects[key] = img;
    }
    for (const [prefix, count] of Object.entries(EFFECT_SPRITE_COUNTS)) {
      this.sprFrames[prefix] = [];
      for (let i = 0; i < count; i++) {
        const img = new Image();
        img.src = `assets/effects/${prefix}_${i}.png`;
        this.sprFrames[prefix].push(img);
      }
    }
  }

  spawnSprAnim(prefix, x, y, duration = 0.45, scale = 1.35, opts = {}) {
    const frames = this.sprFrames[prefix];
    if (!frames || !frames.length) return;
    this.spriteAnims.push({
      prefix,
      frames,
      x,
      y,
      life: duration,
      maxLife: duration,
      scale,
      followPlayer: !!opts.followPlayer,
      offsetY: opts.offsetY || 0,
      vx: opts.vx || 0,
      vy: opts.vy || 0,
      rotation: opts.rotation || 0
    });
  }

  getMaxOffensiveSlots() {
    return getMaxSlots(this.player?.tier ?? 1);
  }

  getMaxSupportSlots() {
    return getMaxSlots(this.player?.tier ?? 1);
  }

  addSkill(skillId, lvDelta = 1) {
    // Handle Special Stat Upgrade Cards
    if (skillId === 'stat_upgrade_atk' || skillId === 'stat_str_novice') {
      if (this.character) {
        this.character.stats.str = (this.character.stats.str || 10) + 4;
        this.character.stats.int = (this.character.stats.int || 10) + 4;
      }
      this.player.hp = this.player.maxHp;
      this.player.sp = this.player.maxSp;
      return;
    }
    if (skillId === 'stat_upgrade_aspd' || skillId === 'stat_agi_novice') {
      if (this.character) {
        this.character.stats.agi = (this.character.stats.agi || 10) + 4;
        this.character.stats.luk = (this.character.stats.luk || 10) + 4;
      }
      this.player.hp = this.player.maxHp;
      return;
    }
    if (skillId === 'stat_upgrade_vit' || skillId === 'stat_vit_novice') {
      if (this.character) {
        this.character.stats.vit = (this.character.stats.vit || 10) + 5;
        this.character.stats.dex = (this.character.stats.dex || 10) + 3;
      }
      this.player.hp = this.player.maxHp;
      return;
    }
    if (skillId === 'stat_dex_novice') {
      if (this.character) {
        this.character.stats.dex = (this.character.stats.dex || 10) + 5;
        this.character.stats.str = (this.character.stats.str || 10) + 2;
      }
      this.player.hp = this.player.maxHp;
      return;
    }
    if (skillId === 'stat_luk_novice') {
      if (this.character) {
        this.character.stats.luk = (this.character.stats.luk || 10) + 5;
        this.character.stats.agi = (this.character.stats.agi || 10) + 2;
      }
      this.player.hp = this.player.maxHp;
      return;
    }

    const def = SKILL_DEFS[skillId];
    if (!def) return;
    if (!this.skills.has(skillId)) {
      const offCount = this.getSkillsByCategory('offensive').length;
      const supCount = this.getSkillsByCategory('support').length;
      if (def.category === 'offensive' && offCount >= this.getMaxOffensiveSlots()) return;
      if (def.category === 'support' && supCount >= this.getMaxSupportSlots()) return;
    }
    const cur = this.skills.get(skillId) || 0;
    this.skills.set(skillId, Math.min(10, cur + lvDelta));
    if (!this.cooldowns.has(skillId)) {
      this.cooldowns.set(skillId, 0);
    }
  }

  getSkillLevel(skillId) {
    if (!this.skills.has(skillId)) return 0;
    const baseRank = this.skills.get(skillId) || 1;
    // Auto skill scaling with Job Level: skill automatically levels up with Job Level
    const jobBonus = Math.floor(((this.player?.jobLevel || 1) - 1) / 5);
    return Math.min(10, Math.max(1, baseRank + jobBonus));
  }

  getSkillsByCategory(cat) {
    const out = [];
    for (const [id, lv] of this.skills.entries()) {
      const def = SKILL_DEFS[id];
      if (def && def.category === cat) out.push([id, this.getSkillLevel(id), def]);
    }
    return out;
  }

  // Class-Tier-Wide & Slot-Aware Level-Up Skill Choices:
  // 1. Dynamic slots: Tier 1 = 4 Off + 4 Sup; Tier 2+ (Job Change) = 8 Off + 8 Sup (+4 slots)!
  // 2. If Support slots are full, ONLY offer offensive skills or level-ups!
  // 3. If Offensive slots are also full, ONLY offer level-ups (Lv.X -> Lv.X+1) for learned skills!
  getLevelUpChoices(branch = 'swordsman', playerTier = 1, count = 3) {
    const isNovice = (branch === 'novice' || this.player?.branch === 'novice' || this.character?.jobId === 'novice' || playerTier === 0);

    // Rule: Novice starts with NO active skills. They must farm Job Lv.10 and change job first!
    if (isNovice) {
      const noviceCards = [
        {
          id: 'nv_firstaid',
          name: 'First Aid (ปฐมพยาบาล)',
          branch: 'novice',
          tier: 0,
          category: 'support',
          isLevelUp: this.getSkillLevel('nv_firstaid') > 0,
          slotStatusText: '🔰 สกิลพื้นฐานโนวิซ (ฟื้นฟู HP ต่อเนื่อง)',
          iconImg: '/grf/skill/nv_firstaid.png',
          desc: 'ฟื้นฟู HP อัตโนมัติทุก 5 วินาที ช่วยให้รอดชีวิตในการฟาร์มเลเวล'
        },
        {
          id: 'stat_str_novice',
          name: 'Novice Muscle (กล้ามเนื้อโนวิซ)',
          branch: 'novice',
          tier: 0,
          category: 'offensive',
          isLevelUp: true,
          slotStatusText: '🔰 อัพเกรดสเตตัสโนวิซ [STR +4, INT +4]',
          iconImg: '/grf/skill/sm_sword.png',
          desc: 'เพิ่ม STR +4 และ INT +4 ถาวร เพื่อโจมตีมอนสเตอร์แรงขึ้น'
        },
        {
          id: 'stat_agi_novice',
          name: 'Novice Agility (ความว่องไวโนวิซ)',
          branch: 'novice',
          tier: 0,
          category: 'support',
          isLevelUp: true,
          slotStatusText: '🔰 อัพเกรดสเตตัสโนวิซ [AGI +4, LUK +4]',
          iconImg: '/grf/skill/tf_double.png',
          desc: 'เพิ่ม AGI +4 และ LUK +4 ถาวร เพิ่มความเร็วโจมตีและหลบหลีก'
        },
        {
          id: 'stat_vit_novice',
          name: 'Novice Endurance (ความอึดโนวิซ)',
          branch: 'novice',
          tier: 0,
          category: 'support',
          isLevelUp: true,
          slotStatusText: '🔰 อัพเกรดสเตตัสโนวิซ [VIT +5, DEX +3]',
          iconImg: '/grf/skill/al_heal.png',
          desc: 'เพิ่ม VIT +5, DEX +3 ถาวร และฟื้นฟู HP 100% เต็มทันที'
        },
        {
          id: 'stat_dex_novice',
          name: 'Novice Accuracy (ความแม่นยำโนวิซ)',
          branch: 'novice',
          tier: 0,
          category: 'offensive',
          isLevelUp: true,
          slotStatusText: '🔰 อัพเกรดสเตตัสโนวิซ [DEX +5, STR +2]',
          iconImg: '/grf/skill/ac_owl.png',
          desc: 'เพิ่ม DEX +5 และ STR +2 ถาวร โจมตีโดนแน่นอนไม่พลาดเป้า'
        },
        {
          id: 'stat_luk_novice',
          name: 'Novice Fortune (โชคลาภโนวิซ)',
          branch: 'novice',
          tier: 0,
          category: 'support',
          isLevelUp: true,
          slotStatusText: '🔰 อัพเกรดสเตตัสโนวิซ [LUK +5, AGI +2]',
          iconImg: '/grf/skill/mc_discount.png',
          desc: 'เพิ่ม LUK +5 และ AGI +2 ถาวร เพิ่มโอกาสติดคริติคอลและอัตราดรอป'
        }
      ];
      return noviceCards.sort(() => 0.5 - Math.random()).slice(0, count);
    }

    const maxOff = this.getMaxOffensiveSlots();
    const maxSup = this.getMaxSupportSlots();
    const offLearned = this.getSkillsByCategory('offensive');
    const supLearned = this.getSkillsByCategory('support');
    const offFull = offLearned.length >= maxOff;
    const supFull = supLearned.length >= maxSup;

    const effectiveTier = Math.max(1, playerTier || 0);
    const allClassSkills = Object.values(SKILL_DEFS).filter(sk => {
      return (sk.tier || 0) <= effectiveTier;
    });

    const candidates = [];
    for (const sk of allClassSkills) {
      const curLv = this.getSkillLevel(sk.id);
      if (curLv >= 10) continue; // Already maxed at Lv.10

      if (curLv > 0) {
        // Already learned -> offer Level Up (Lv.X -> Lv.X+1)
        candidates.push({
          ...sk,
          currentLv: curLv,
          nextLv: curLv + 1,
          isLevelUp: true,
          slotStatusText: `⬆️ อัพเลเวลสกิล (Lv.${curLv} ➔ Lv.${curLv + 1}/10)`
        });
      } else {
        // New unlearned skill -> check if category slot is full!
        if (sk.category === 'support' && supFull) continue;
        if (sk.category === 'offensive' && offFull) continue;
        candidates.push({
          ...sk,
          currentLv: 0,
          nextLv: 1,
          isLevelUp: false,
          slotStatusText: sk.category === 'offensive'
            ? `🆕 สกิลโจมตีใหม่ (ช่องโจมตี ${offLearned.length + 1}/${maxOff})`
            : `🆕 สกิลซัพพอร์ตใหม่ (ช่องบัพ ${supLearned.length + 1}/${maxSup})`
        });
      }
    }

    // Prioritize new offensive skills if support is full, or level-up if both are full
    const shuffled = candidates.sort(() => 0.5 - Math.random());
    const picked = shuffled.slice(0, count);

    // Fallback stat upgrade cards if all learned skills are already Lv.10
    const statFallbacks = [
      {
        id: 'stat_upgrade_atk',
        name: 'Power Limit Break (อัพเกรดพลังโจมตี + ฟื้นฟูเต็ม)',
        branch,
        tier: playerTier,
        category: 'offensive',
        isLevelUp: true,
        slotStatusText: '⭐ สกิลครบแล้ว: อัพเลเวลพลังโจมตีถาวร',
        iconImg: '/grf/skill/bs_overthrust.png',
        desc: 'STR +4, INT +4 ถาวร และฟื้นฟู HP/SP 100% ทันที'
      },
      {
        id: 'stat_upgrade_aspd',
        name: 'Speed Limit Break (อัพเกรดความเร็วโจมตี & คริ)',
        branch,
        tier: playerTier,
        category: 'support',
        isLevelUp: true,
        slotStatusText: '⭐ สกิลครบแล้ว: อัพเลเวลความเร็วโจมตีถาวร',
        iconImg: '/grf/skill/kn_twohandquicken.png',
        desc: 'AGI +4, LUK +4 ถาวร และฟื้นฟู HP 100% ทันที'
      },
      {
        id: 'stat_upgrade_vit',
        name: 'Vitality Limit Break (อัพเกรดเกราะ & เลือดสูงสุด)',
        branch,
        tier: playerTier,
        category: 'support',
        isLevelUp: true,
        slotStatusText: '⭐ สกิลครบแล้ว: อัพเลเวลพลังป้องกันถาวร',
        iconImg: '/grf/skill/al_angelus.png',
        desc: 'VIT +5, DEX +3 ถาวร และฟื้นฟู HP 100% ทันที'
      }
    ];

    let fbIdx = 0;
    while (picked.length < count && fbIdx < statFallbacks.length) {
      picked.push(statFallbacks[fbIdx++]);
    }
    return picked;
  }

  getBuffTotals() {
    const totals = {
      atkPct: 0,
      matkPct: 0,
      defPct: 0,
      spdPct: 0,
      aspdBonus: 0,
      critBonus: 0,
      dmgReduce: 0,
      zenyBonus: 0
    };
    for (const b of this.activeBuffs.values()) {
      const s = b.stats || {};
      if (s.atkPct) totals.atkPct += s.atkPct;
      if (s.matkPct) totals.matkPct += s.matkPct;
      if (s.defPct) totals.defPct += s.defPct;
      if (s.spdPct) totals.spdPct += s.spdPct;
      if (s.aspdBonus) totals.aspdBonus += s.aspdBonus;
      if (s.critBonus) totals.critBonus += s.critBonus;
      if (s.dmgReduce) totals.dmgReduce += s.dmgReduce;
      if (s.zenyBonus) totals.zenyBonus += s.zenyBonus;
    }
    return totals;
  }

  update(dt, monsters, spawnDamageNumber, spawnParticle) {
    this.orbitAngle += dt * 4.2;

    if (this.player.skillShoutTimer > 0) {
      this.player.skillShoutTimer -= dt;
    }

    // 1. Update Active Timed Buffs
    for (const [id, buff] of this.activeBuffs.entries()) {
      buff.remaining -= dt;
      if (buff.remaining <= 0) {
        this.activeBuffs.delete(id);
      }
    }

    const buffs = this.getBuffTotals();
    const charAtk = this.character ? (this.character.atk || 35) : 35;
    const charMatk = this.character ? (this.character.matk || 30) : 30;
    const charAspd = (this.character ? (this.character.aspd || 155) : 155) + buffs.aspdBonus;
    const charCrit = (this.character ? (this.character.crit || 10) : 10) + buffs.critBonus;
    const jobLv = this.character ? (this.character.jobLv || 1) : 1;
    const tier = this.character ? (this.character.tier || 0) : 0;
    const cdrPct = Math.min(68, this.character ? (this.character.cdrPct || 0) : 0);

    // Continuous multiplier by Job Level & Class Tier
    const jobMultiplier = (1 + (jobLv - 1) * 0.045) * (1 + tier * 0.35);
    const strMultiplier = (1 + buffs.atkPct) * (1 + charAtk / 85) * jobMultiplier;
    const matkMultiplier = (1 + buffs.matkPct) * (1 + charMatk / 80) * jobMultiplier;
    this.player.speed = this.player.baseSpeed * (1 + buffs.spdPct);
    this.player.dmgReduce = Math.min(0.7, buffs.dmgReduce);
    this.player.zenyBonus = buffs.zenyBonus;

    // 2. Normal Attack (โจมตีธรรมดา)
    this.normalAttackCooldown -= dt;
    if (this.normalAttackCooldown <= 0) {
      const fired = this.performNormalAttack(monsters, charAtk * (1 + buffs.atkPct), charCrit, spawnDamageNumber, spawnParticle);
      if (fired) {
        const interval = Math.max(0.22, (205 - Math.min(193, charAspd)) / 78);
        this.normalAttackCooldown = interval;
      } else {
        this.normalAttackCooldown = 0.12;
      }
    }

    // 3. Cooldown & Auto-Cast Skills (Cooldown reduced ONLY by Cards / Equipment cdrPct!)
    for (const [skillId, level] of this.skills.entries()) {
      const def = SKILL_DEFS[skillId];
      if (!def || def.type === 'passive') continue;

      let cd = this.cooldowns.get(skillId) || 0;
      cd -= dt * 1000;

      if (cd <= 0) {
        const mult = (def.branch === 'mage' || def.branch === 'acolyte') ? Math.max(strMultiplier, matkMultiplier) : strMultiplier;
        this.castSkill(def, level, monsters, mult, charCrit, spawnDamageNumber, spawnParticle);
        const nextCd = Math.round(def.baseCooldown * (1 - cdrPct / 100));
        this.cooldowns.set(skillId, nextCd);
        this.maxCooldowns.set(skillId, nextCd);
      } else {
        this.cooldowns.set(skillId, cd);
      }
    }

    // 4. Update Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.x += p.vx * (dt * 60);
      p.y += p.vy * (dt * 60);
      p.life -= dt;

      for (const m of monsters) {
        if (!m.alive) continue;
        const dist = Math.hypot(m.x - p.x, m.y - p.y);
        if (dist < m.radius + p.radius) {
          const isCrit = Math.random() * 100 < (p.critRate || charCrit);
          const dmg = Math.round(p.damage * (isCrit ? 1.6 : 1));
          m.takeDamage(dmg, isCrit, spawnDamageNumber);
          this.applyOnHitPassives(dmg, m, monsters, spawnDamageNumber);
          audio.playHitSound();
          if (p.hitSpr) this.spawnSprAnim(p.hitSpr, m.x, m.y, 0.3, 1.15);

          for (let k = 0; k < 3; k++) spawnParticle(m.x, m.y, p.color || '#ffd700');

          p.pierce--;
          if (p.pierce <= 0) {
            this.projectiles.splice(i, 1);
            break;
          }
        }
      }

      if (p.life <= 0 && this.projectiles[i] === p) {
        this.projectiles.splice(i, 1);
      }
    }

    // 5. Update AoE Effects
    for (let i = this.aoeEffects.length - 1; i >= 0; i--) {
      const aoe = this.aoeEffects[i];
      aoe.life -= dt;
      if (aoe.tickInterval) {
        aoe.tickTimer = (aoe.tickTimer || 0) - dt;
        if (aoe.tickTimer <= 0) {
          aoe.tickTimer = aoe.tickInterval;
          for (const m of monsters) {
            if (!m.alive) continue;
            if (Math.hypot(m.x - aoe.x, m.y - aoe.y) <= aoe.radius + m.radius) {
              m.takeDamage(aoe.tickDamage, false, spawnDamageNumber);
              if (aoe.tickSpr) this.spawnSprAnim(aoe.tickSpr, m.x, m.y, 0.32, 1.1);
              if (aoe.knockback) {
                const a = Math.atan2(m.y - aoe.y, m.x - aoe.x);
                m.knockback(Math.cos(a) * 18, Math.sin(a) * 18);
              }
            }
          }
        }
      }
      if (aoe.life <= 0) this.aoeEffects.splice(i, 1);
    }

    // 6. Update Authentic RO Sprite Animations
    for (let i = this.spriteAnims.length - 1; i >= 0; i--) {
      const anim = this.spriteAnims[i];
      anim.life -= dt;
      if (anim.followPlayer) {
        anim.x = this.player.x;
        anim.y = this.player.y + (anim.offsetY || 0);
      } else {
        anim.x += (anim.vx || 0) * (dt * 60);
        anim.y += (anim.vy || 0) * (dt * 60);
      }
      if (anim.life <= 0) this.spriteAnims.splice(i, 1);
    }

    // 7. Update Lightning Arcs
    for (let i = this.lightningArcs.length - 1; i >= 0; i--) {
      this.lightningArcs[i].life -= dt;
      if (this.lightningArcs[i].life <= 0) this.lightningArcs.splice(i, 1);
    }

    // 8. Orbit Daggers (Thief Double Attack)
    const dblAtk = this.getSkillLevel('tf_double');
    if (dblAtk > 0) {
      const count = 2 + Math.floor(dblAtk / 2);
      const orbitR = 54 + dblAtk * 4;
      for (let i = 0; i < count; i++) {
        const a = this.orbitAngle + (i * 2 * Math.PI) / count;
        const dx = this.player.x + Math.cos(a) * orbitR;
        const dy = this.player.y + Math.sin(a) * orbitR;

        for (const m of monsters) {
          if (!m.alive) continue;
          if (Math.hypot(m.x - dx, m.y - dy) < m.radius + 15) {
            if (!m._orbitHitCooldown || m._orbitHitCooldown <= 0) {
              const dmg = Math.round((22 + dblAtk * 8) * strMultiplier);
              m.takeDamage(dmg, true, spawnDamageNumber);
              this.spawnSprAnim('ef_slash2', m.x, m.y, 0.22, 0.9);
              audio.playHitSound();
              m._orbitHitCooldown = 0.25;
            }
          }
        }
      }
    }
  }

  performNormalAttack(monsters, effAtk, critRate, spawnDamageNumber, spawnParticle) {
    const px = this.player.x;
    const py = this.player.y;
    const atkType = this.player.attackType || 'melee_slash';
    const maxRange = (atkType === 'bow_arrow' || atkType === 'magic_bolt') ? 260 : 95;

    let target = null;
    let bestDist = maxRange;
    for (const m of monsters) {
      if (!m.alive) continue;
      const d = Math.hypot(m.x - px, m.y - py);
      if (d <= bestDist) {
        bestDist = d;
        target = m;
      }
    }
    if (!target) return false;

    const angle = Math.atan2(target.y - py, target.x - px);
    this.player.facingAngle = angle;
    this.player.facingLeft = Math.cos(angle) < 0;
    if (Math.abs(Math.sin(angle)) > 0.35) {
      this.player.facingBack = Math.sin(angle) < 0;
    }
    this.player.attackTimer = 0.28;
    this.player.attackAnimDuration = 0.28;

    const baseDmg = Math.max(12, Math.round(effAtk * 0.98));

    if (atkType === 'bow_arrow') {
      audio.playBowAttack();
      this.projectiles.push({
        type: 'arrow',
        x: px,
        y: py,
        vx: Math.cos(angle) * 11,
        vy: Math.sin(angle) * 11,
        angle,
        radius: 6,
        life: 1.2,
        damage: baseDmg,
        critRate,
        hitSpr: 'ef_slash1',
        pierce: 1
      });
    } else if (atkType === 'magic_bolt') {
      audio.playCastSound('fire');
      this.projectiles.push({
        type: 'magic_orb',
        x: px,
        y: py,
        vx: Math.cos(angle) * 9.5,
        vy: Math.sin(angle) * 9.5,
        angle,
        radius: 7,
        life: 1.2,
        damage: baseDmg,
        critRate,
        color: '#74b9ff',
        hitSpr: 'ef_fireball',
        pierce: 1
      });
    } else {
      audio.playSwordAttack();
      this.spawnSprAnim('ef_slash1', target.x, target.y, 0.22, 1.15);
      const isCrit = Math.random() * 100 < critRate;
      const dmg = Math.round(baseDmg * (isCrit ? 1.6 : 1));
      target.takeDamage(dmg, isCrit, spawnDamageNumber);
      for (let k = 0; k < 3; k++) spawnParticle(target.x, target.y, isCrit ? '#ffea00' : '#ffffff');
      this.applyOnHitPassives(dmg, target, monsters, spawnDamageNumber);
    }
    return true;
  }

  applyOnHitPassives(dmg, primaryTarget, monsters, spawnDamageNumber) {
    const bonuses = this.character?.cardBonuses;
    if (!bonuses) return;
    if (bonuses.lifestealPct > 0 && Math.random() < 0.25) {
      const heal = Math.max(1, Math.round(dmg * (bonuses.lifestealPct / 100)));
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + heal);
    }
    if (bonuses.splashAttack && primaryTarget) {
      for (const m of monsters) {
        if (!m.alive || m === primaryTarget) continue;
        if (Math.hypot(m.x - primaryTarget.x, m.y - primaryTarget.y) <= 75) {
          m.takeDamage(Math.round(dmg * 0.65), false, spawnDamageNumber);
        }
      }
    }
  }

  spawnComboHits(target, hits, dmgPerHit, intervalMs, isCrit, spawnDamageNumber, sprEffect = null) {
    for (let h = 0; h < hits; h++) {
      setTimeout(() => {
        if (!target || !target.alive) return;
        target.takeDamage(dmgPerHit, isCrit, spawnDamageNumber);
        if (sprEffect) {
          this.spawnSprAnim(
            sprEffect,
            target.x + (Math.random() - 0.5) * 18,
            target.y + (Math.random() - 0.5) * 18,
            0.26,
            1.15
          );
        }
        audio.playHitSound();
      }, h * intervalMs);
    }
  }

  triggerSkillShout(def) {
    this.player.skillShoutText = def.shout || `${def.name.split(' (')[0]} !!`;
    this.player.skillShoutTimer = 1.05;
  }

  castSkill(def, level, monsters, mult, critRate, spawnDamageNumber, _spawnParticle) {
    const px = this.player.x;
    const py = this.player.y;

    // 1. Support Timed Buffs with Authentic RO Buff Sprites (Angelus Valkyrie / Blessing Cherub / Quicken / Shield)
    if (def.type === 'buff') {
      const dur = (def.buffDuration || 25) + (level - 1) * 2;
      const scaledStats = {};
      for (const [k, v] of Object.entries(def.buffStats || {})) {
        scaledStats[k] = typeof v === 'number' ? v * (1 + (level - 1) * 0.08) : v;
      }
      this.activeBuffs.set(def.id, {
        id: def.id,
        name: def.name.split(' (')[0],
        iconImg: def.iconImg,
        remaining: dur,
        maxDuration: dur,
        stats: scaledStats
      });
      if (scaledStats.kyrieHits) {
        this.player.kyrieHits = Math.round(scaledStats.kyrieHits);
      }
      this.triggerSkillShout(def);
      const buffSpr = def.buffEffect || 'ef_blessing';
      this.spawnSprAnim(buffSpr, px, py - 42, 0.85, buffSpr === 'ef_angelus' ? 1.15 : 1.45, {
        followPlayer: true,
        offsetY: -42
      });
      this.aoeEffects.push({
        type: 'holy_ring_tex',
        x: px,
        y: py,
        radius: 56,
        life: 0.55,
        maxLife: 0.55
      });
      audio.playCastSound('holy');
      return;
    }

    // 2. Support Heal / Highness Heal / First Aid
    if (def.type === 'heal' || def.type === 'firstaid' || def.type === 'sanctuary') {
      const healAmt = Math.round(((def.healAmount || 45) + level * 15) * mult);
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + healAmt);
      this.triggerSkillShout(def);
      spawnDamageNumber(px, py - 28, `+${healAmt}`, '#2ecc71', true);
      this.spawnSprAnim('ef_sanctuary', px, py - 20, 0.65, 1.8, { followPlayer: true, offsetY: -20 });
      this.aoeEffects.push({
        type: 'sanctuary_ground',
        x: px,
        y: py,
        radius: def.radius || 95,
        life: def.type === 'sanctuary' ? 1.6 : 0.55,
        maxLife: def.type === 'sanctuary' ? 1.6 : 0.55
      });
      audio.playCastSound('holy');
      if (def.baseDamage) {
        const dmg = Math.round((def.baseDamage + level * 9) * mult);
        for (const m of monsters) {
          if (m.alive && Math.hypot(m.x - px, m.y - py) <= (def.radius || 95) + m.radius) {
            m.takeDamage(dmg, true, spawnDamageNumber);
            this.spawnSprAnim('ef_holy', m.x, m.y, 0.35, 0.55);
          }
        }
      }
      return;
    }

    // Find closest monster for offensive skills
    let closest = null;
    let closestDist = 9999;
    for (const m of monsters) {
      if (!m.alive) continue;
      const d = Math.hypot(m.x - px, m.y - py);
      if (d < closestDist && d < 390) {
        closest = m;
        closestDist = d;
      }
    }
    if (!closest) return;

    this.player.attackTimer = 0.28;
    this.player.attackAnimDuration = 0.28;
    this.triggerSkillShout(def);
    const lvScale = 1 + (level - 1) * 0.34;
    const baseDmg = Math.round(def.baseDamage * lvScale * mult);
    const angle = Math.atan2(closest.y - py, closest.x - px);

    // Authentic RO 12-Pointed Magic Cast Circle beneath caster for Mage / Acolyte skills!
    if (def.branch === 'mage' || def.branch === 'acolyte') {
      this.aoeEffects.push({
        type: 'ro_magic_circle',
        x: px,
        y: py,
        radius: 64,
        life: 0.55,
        maxLife: 0.55
      });
    }

    switch (def.type) {
      case 'slash':
      case 'mammonite': {
        const range = (def.range || 82) + level * 6;
        if (def.type === 'mammonite') {
          for (let c = 0; c < 5; c++) {
            this.spawnSprAnim('ef_coin', closest.x + (Math.random() - 0.5) * 40, closest.y - 10, 0.45, 2.2, {
              vx: (Math.random() - 0.5) * 2.5,
              vy: -2.2 + Math.random() * 1.5
            });
          }
          audio.playCoinSound();
        } else if (def.id === 'sm_bash') {
          audio.playCastSound('bash');
        } else {
          audio.playCastSound('slash');
        }
        this.spawnSprAnim('ef_slash1', closest.x, closest.y, 0.3, 1.45);
        for (const m of monsters) {
          if (!m.alive) continue;
          if (Math.hypot(m.x - px, m.y - py) <= range + m.radius) {
            m.takeDamage(baseDmg, true, spawnDamageNumber);
            const ma = Math.atan2(m.y - py, m.x - px);
            m.knockback(Math.cos(ma) * 42, Math.sin(ma) * 42);
          }
        }
        break;
      }

      case 'bowling': {
        const range = (def.range || 98) + level * 6;
        this.spawnSprAnim('ef_flashslash', closest.x, closest.y, 0.36, 1.5);
        audio.playCastSound('bowling');
        for (const m of monsters) {
          if (!m.alive) continue;
          if (Math.hypot(m.x - px, m.y - py) <= range + m.radius) {
            this.spawnComboHits(m, 2, Math.round(baseDmg * 0.78), 90, true, spawnDamageNumber, 'ef_slash1');
            const ma = Math.atan2(m.y - py, m.x - px);
            m.knockback(Math.cos(ma) * 65, Math.sin(ma) * 65);
          }
        }
        break;
      }

      case 'fire_blast':
      case 'ignition_break':
      case 'dragon_breath':
      case 'cart_spin':
      case 'cart_termination':
      case 'meteor_assault':
      case 'rolling_cutter':
      case 'axe_tornado': {
        const radius = (def.radius || 100) + level * 8;
        const isSpin = def.type === 'rolling_cutter' || def.type === 'axe_tornado' || def.type === 'meteor_assault';
        const isQuake = def.type === 'cart_termination' || def.type === 'cart_spin';
        const isDragon = def.type === 'dragon_breath';

        if (isQuake) {
          this.spawnSprAnim('ef_earthquake', closest.x, closest.y, 0.45, 2.2);
          this.spawnSprAnim('ef_stun', closest.x, closest.y - 26, 0.65, 1.8);
        } else if (isDragon) {
          for (let k = 0; k < 7; k++) {
            const ang = angle + (Math.random() - 0.5) * 0.6;
            const d = 35 + k * 16;
            this.spawnSprAnim('ef_dragonbreath', px + Math.cos(ang) * d, py + Math.sin(ang) * d, 0.48, 2.4);
            this.spawnSprAnim('ef_firewall', px + Math.cos(ang) * d, py + Math.sin(ang) * d, 0.52, 1.3);
          }
        } else if (!isSpin) {
          // Authentic RO Magnum Break / Ignition Break ring of Fire Wall pillars
          for (let k = 0; k < 8; k++) {
            const a = (k * Math.PI) / 4;
            this.spawnSprAnim('ef_firewall', px + Math.cos(a) * (radius * 0.65), py + Math.sin(a) * (radius * 0.65), 0.5, 1.35);
          }
        } else {
          for (let k = 0; k < 4; k++) {
            const a = (k * Math.PI) / 2 + this.orbitAngle;
            this.spawnSprAnim('ef_flashslash', px + Math.cos(a) * (radius * 0.5), py + Math.sin(a) * (radius * 0.5), 0.35, 1.35);
          }
        }

        this.aoeEffects.push({
          type: isSpin ? 'spin_blades' : 'fire_blast',
          x: isDragon ? closest.x : px,
          y: isDragon ? closest.y : py,
          radius,
          life: isSpin ? 0.45 : 0.42,
          maxLife: isSpin ? 0.45 : 0.42
        });
        audio.playCastSound(isSpin ? 'bowling' : (def.id === 'sm_magnum' ? 'magnum' : 'fire'));
        const hits = isSpin ? 3 : (def.type === 'ignition_break' ? 2 : 1);
        const cx = isDragon ? closest.x : px;
        const cy = isDragon ? closest.y : py;
        for (const m of monsters) {
          if (!m.alive) continue;
          if (Math.hypot(m.x - cx, m.y - cy) <= radius + m.radius) {
            this.spawnComboHits(m, hits, Math.round(baseDmg / hits), 80, hits > 1, spawnDamageNumber, isSpin ? 'ef_slash2' : 'ef_fireball');
            const a = Math.atan2(m.y - cy, m.x - cx);
            m.knockback(Math.cos(a) * 36, Math.sin(a) * 36);
          }
        }
        break;
      }

      case 'sonic_blow':
      case 'cross_impact': {
        const hits = def.type === 'sonic_blow' ? 8 : 7;
        const hitDmg = Math.max(10, Math.round((baseDmg * 1.4) / hits));
        this.spawnSprAnim('ef_flashslash', closest.x, closest.y, 0.45, 1.65);
        audio.playCastSound(def.type === 'sonic_blow' ? 'sonicblow' : 'slash');
        this.spawnComboHits(closest, hits, hitDmg, 55, true, spawnDamageNumber, 'ef_slash1');
        break;
      }

      case 'warg_strike': {
        // Authentic RO Ranger Warg Wolf leaps across target!
        this.spawnSprAnim('ef_warg', closest.x, closest.y, 0.55, 1.35);
        audio.playCastSound('slash');
        this.spawnComboHits(closest, 3, Math.round(baseDmg * 0.48), 70, true, spawnDamageNumber, 'ef_slash2');
        break;
      }

      case 'multi_bolt': {
        const bolts = Math.min(6, 3 + Math.floor(level / 2));
        audio.playCastSound('fire');
        for (let b = 0; b < bolts; b++) {
          setTimeout(() => {
            if (!closest.alive) return;
            this.spawnSprAnim('ef_fireball', closest.x + (Math.random() - 0.5) * 26, closest.y - 45, 0.32, 1.4, {
              vy: 4.5
            });
            this.spawnSprAnim('ef_firewall', closest.x + (Math.random() - 0.5) * 20, closest.y, 0.35, 1.15);
          }, b * 85);
        }
        this.spawnComboHits(closest, bolts, Math.round(baseDmg * 0.58), 85, false, spawnDamageNumber);
        break;
      }

      case 'falling_ice':
      case 'storm_gust': {
        const radius = (def.radius || 95) + level * 8;
        const isStorm = def.type === 'storm_gust';
        this.aoeEffects.push({
          type: 'ro_storm_gust',
          x: closest.x,
          y: closest.y,
          radius,
          life: isStorm ? 2.1 : 0.65,
          maxLife: isStorm ? 2.1 : 0.65,
          tickInterval: isStorm ? 0.35 : 0,
          tickTimer: 0.1,
          tickDamage: Math.round(baseDmg * 0.58),
          tickSpr: 'ef_waterball',
          knockback: isStorm
        });
        this.spawnSprAnim('ef_waterball', closest.x, closest.y, 0.45, 1.6);
        audio.playCastSound(isStorm ? 'stormgust' : 'wind');
        for (const m of monsters) {
          if (m.alive && Math.hypot(m.x - closest.x, m.y - closest.y) <= radius + m.radius) {
            m.takeDamage(baseDmg, false, spawnDamageNumber);
          }
        }
        break;
      }

      case 'meteor_storm':
      case 'crimson_rock':
      case 'arms_cannon': {
        const radius = (def.radius || 125) + level * 8;
        // Spawn falling meteors from top-right sky onto target area!
        for (let k = 0; k < 5; k++) {
          setTimeout(() => {
            const tx = closest.x + (Math.random() - 0.5) * radius * 0.9;
            const ty = closest.y + (Math.random() - 0.5) * radius * 0.9;
            this.spawnSprAnim('ef_fireball', tx + 60, ty - 110, 0.28, 1.85, { vx: -4.2, vy: 7.5 });
            setTimeout(() => {
              this.spawnSprAnim('ef_firewall', tx, ty, 0.55, 1.45);
              this.aoeEffects.push({
                type: 'ro_meteor_impact',
                x: tx,
                y: ty,
                radius: radius * 0.65,
                life: 0.45,
                maxLife: 0.45
              });
            }, 180);
          }, k * 90);
        }
        audio.playCastSound('meteor');
        for (const m of monsters) {
          if (m.alive && Math.hypot(m.x - closest.x, m.y - closest.y) <= radius + m.radius) {
            this.spawnComboHits(m, 3, Math.round(baseDmg * 0.5), 110, true, spawnDamageNumber);
          }
        }
        break;
      }

      case 'vermilion':
      case 'lightning':
      case 'chain_lightning': {
        audio.playCastSound('lightning');
        if (def.type === 'vermilion') {
          const radius = (def.radius || 135) + level * 8;
          this.aoeEffects.push({
            type: 'ro_vermilion',
            x: closest.x,
            y: closest.y,
            radius,
            life: 1.5,
            maxLife: 1.5,
            tickInterval: 0.35,
            tickTimer: 0.05,
            tickDamage: Math.round(baseDmg * 0.55),
            tickSpr: 'ef_thunderstorm'
          });
          for (let k = 0; k < 5; k++) {
            const a = (k * Math.PI * 2) / 5;
            this.spawnSprAnim('ef_thunderstorm', closest.x + Math.cos(a) * (radius * 0.45), closest.y + Math.sin(a) * (radius * 0.45), 0.55, 1.45);
          }
          break;
        }

        const maxTargets = def.type === 'chain_lightning' ? 6 + Math.floor(level / 3) : 1;
        let curr = closest;
        const hitSet = new Set();
        let prevX = px, prevY = py;
        for (let b = 0; b < maxTargets && curr; b++) {
          hitSet.add(curr);
          curr.takeDamage(Math.round(baseDmg * (1 - b * 0.07)), true, spawnDamageNumber);
          this.spawnSprAnim('ef_thunderstorm', curr.x, curr.y - 24, 0.42, 1.35);
          this.lightningArcs.push({ x1: prevX, y1: prevY, x2: curr.x, y2: curr.y, life: 0.28, maxLife: 0.28 });
          prevX = curr.x;
          prevY = curr.y;
          let nextM = null;
          let nextD = 165;
          for (const m of monsters) {
            if (!m.alive || hitSet.has(m)) continue;
            const d = Math.hypot(m.x - prevX, m.y - prevY);
            if (d < nextD) { nextD = d; nextM = m; }
          }
          curr = nextM;
        }
        break;
      }

      case 'arrow_shot':
      case 'sharpshooting':
      case 'spiral_pierce': {
        const isSpiral = def.type === 'spiral_pierce';
        const count = def.type === 'arrow_shot' ? 2 : (isSpiral ? 3 : 1);
        const pierce = def.type === 'sharpshooting' ? 6 : (isSpiral ? 4 : 2);
        for (let i = 0; i < count; i++) {
          setTimeout(() => {
            if (isSpiral) {
              this.spawnSprAnim('ef_hundredspear', closest.x, closest.y, 0.42, 1.65);
            }
            this.projectiles.push({
              type: isSpiral ? 'spear_proj' : 'arrow',
              x: this.player.x,
              y: this.player.y,
              vx: Math.cos(angle) * (def.speed || 11.5),
              vy: Math.sin(angle) * (def.speed || 11.5),
              angle,
              radius: def.type === 'sharpshooting' ? 14 : 8,
              life: 1.5,
              damage: baseDmg,
              critRate: def.type === 'sharpshooting' ? 90 : critRate,
              hitSpr: isSpiral ? 'ef_hundredspear' : 'ef_slash1',
              pierce
            });
            audio.playCastSound(isSpiral ? 'spiral' : 'arrow');
          }, i * 75);
        }
        break;
      }

      case 'arrow_rain':
      case 'arrow_storm':
      case 'falcon': {
        const radius = (def.radius || 105) + level * 8;
        const hits = def.type === 'arrow_storm' ? 4 : (def.type === 'falcon' ? 5 : 2);
        if (def.type === 'falcon') {
          // Authentic RO Falcon swoops down onto target!
          this.spawnSprAnim('ef_falcon', closest.x, closest.y - 36, 0.55, 1.75, { vy: 1.2 });
        }
        this.aoeEffects.push({
          type: 'arrow_storm_aoe',
          x: closest.x,
          y: closest.y,
          radius,
          life: 0.5,
          maxLife: 0.5
        });
        audio.playCastSound('arrow');
        for (const m of monsters) {
          if (m.alive && Math.hypot(m.x - closest.x, m.y - closest.y) <= radius + m.radius) {
            this.spawnComboHits(m, hits, Math.round(baseDmg / hits), 68, true, spawnDamageNumber, 'ef_slash1');
          }
        }
        break;
      }

      case 'holy_beam':
      case 'judex':
      case 'adoramus':
      case 'magnus': {
        const radius = (def.radius || 80) + level * 8;
        const isMagnus = def.type === 'magnus';
        this.aoeEffects.push({
          type: 'ro_holy_cross',
          x: closest.x,
          y: closest.y,
          radius,
          life: isMagnus ? 2.2 : 0.55,
          maxLife: isMagnus ? 2.2 : 0.55,
          tickInterval: isMagnus ? 0.38 : 0,
          tickTimer: 0.1,
          tickDamage: Math.round(baseDmg * 0.65),
          tickSpr: 'ef_holy'
        });
        this.spawnSprAnim('ef_holy', closest.x, closest.y, 0.45, 0.85);
        audio.playCastSound(isMagnus ? 'magnus' : (def.type === 'adoramus' ? 'adoramus' : (def.type === 'judex' ? 'judex' : 'holy')));
        const hits = def.type === 'adoramus' ? 5 : (def.type === 'judex' ? 3 : 1);
        for (const m of monsters) {
          if (m.alive && Math.hypot(m.x - closest.x, m.y - closest.y) <= radius + m.radius) {
            this.spawnComboHits(m, hits, Math.round((baseDmg * 1.25) / hits), 65, true, spawnDamageNumber);
          }
        }
        break;
      }

      case 'poison_cloud': {
        const radius = (def.radius || 88) + level * 6;
        this.aoeEffects.push({
          type: 'poison_aoe',
          x: closest.x,
          y: closest.y,
          radius,
          life: 1.6,
          maxLife: 1.6,
          tickInterval: 0.35,
          tickTimer: 0.1,
          tickDamage: Math.round(baseDmg * 0.55),
          tickSpr: 'ef_poisonhit'
        });
        this.spawnSprAnim('ef_poison', closest.x, closest.y, 0.55, 1.45);
        audio.playCastSound('poison');
        closest.takeDamage(baseDmg, false, spawnDamageNumber);
        break;
      }
    }
  }

  draw(ctx) {
    // 1. Draw Ground & Area Effects using Authentic RO Effect Textures (tex_*.png)
    for (const aoe of this.aoeEffects) {
      const prog = Math.max(0, aoe.life / aoe.maxLife);
      ctx.save();
      ctx.translate(aoe.x, aoe.y);

      if (aoe.type === 'ro_magic_circle') {
        const mc = this.effects.magic_circle;
        ctx.rotate((1 - prog) * Math.PI * 1.5);
        ctx.globalAlpha = Math.min(1, prog * 1.25);
        if (mc && mc.complete && mc.width > 0) {
          const sz = aoe.radius * 2.2;
          ctx.drawImage(mc, -sz / 2, -sz / 2, sz, sz);
        }
      } else if (aoe.type === 'holy_ring_tex' || aoe.type === 'sanctuary_ground') {
        const hr = this.effects.holy_ring;
        ctx.rotate(this.orbitAngle * 0.6);
        ctx.globalAlpha = Math.min(0.95, prog * 1.2);
        if (hr && hr.complete && hr.width > 0) {
          const sz = aoe.radius * 2.1;
          ctx.drawImage(hr, -sz / 2, -sz / 2, sz, sz);
        }
      } else if (aoe.type === 'ro_storm_gust') {
        const fc = this.effects.freezing_circle;
        const fi = this.effects.freeze_ice;
        const ib = this.effects.ice_block;
        ctx.save();
        ctx.rotate(this.orbitAngle * 0.8);
        ctx.globalAlpha = Math.min(0.92, prog * 1.2);
        if (fc && fc.complete && fc.width > 0) {
          ctx.drawImage(fc, -aoe.radius, -aoe.radius, aoe.radius * 2, aoe.radius * 2);
        }
        ctx.restore();
        if (fi && fi.complete && fi.width > 0) {
          ctx.globalAlpha = Math.min(0.95, prog * 1.3);
          for (let k = 0; k < 5; k++) {
            const a = (k * Math.PI * 2) / 5 + prog * 1.2;
            const r = aoe.radius * 0.48;
            ctx.drawImage(fi, Math.cos(a) * r - 48, Math.sin(a) * r - 64, 96, 96);
          }
        }
        if (ib && ib.complete && ib.width > 0) {
          ctx.drawImage(ib, -42, -56, 84, 96);
        }
      } else if (aoe.type === 'ro_meteor_impact' || aoe.type === 'fire_blast') {
        const fr = this.effects.fire_ring;
        const me = this.effects.meteor_exp;
        const fb = this.effects.fire_blast;
        ctx.globalAlpha = Math.min(0.95, prog * 1.25);
        const sz = aoe.radius * 2;
        if (fr && fr.complete && fr.width > 0) {
          ctx.drawImage(fr, -sz / 2, -sz / 2, sz, sz);
        }
        if (me && me.complete && me.width > 0) {
          ctx.drawImage(me, -sz * 0.45, -sz * 0.55, sz * 0.9, sz);
        } else if (fb && fb.complete && fb.width > 0) {
          ctx.drawImage(fb, -sz / 2, -sz / 2, sz, sz);
        }
      } else if (aoe.type === 'ro_vermilion') {
        const sg = this.effects.storm_god;
        const tb = this.effects.thunder_blast;
        ctx.rotate(-this.orbitAngle * 1.2);
        ctx.globalAlpha = Math.min(0.95, prog * 1.2);
        const sz = aoe.radius * 2.1;
        if (sg && sg.complete && sg.width > 0) {
          ctx.drawImage(sg, -sz / 2, -sz / 2, sz, sz);
        } else if (tb && tb.complete && tb.width > 0) {
          ctx.drawImage(tb, -sz / 2, -sz / 2, sz, sz);
        }
      } else if (aoe.type === 'ro_holy_cross') {
        const hc = this.effects.holy_cross;
        const hr = this.effects.holy_ring;
        ctx.globalAlpha = Math.min(0.95, prog * 1.25);
        const sz = aoe.radius * 2;
        if (hr && hr.complete && hr.width > 0) {
          ctx.drawImage(hr, -sz / 2, -sz / 2, sz, sz);
        }
        if (hc && hc.complete && hc.width > 0) {
          ctx.drawImage(hc, -sz * 0.48, -sz * 0.48, sz * 0.96, sz * 0.96);
        }
      } else if (aoe.type === 'spin_blades') {
        ctx.rotate(this.orbitAngle * 2.8);
        ctx.globalAlpha = prog * 0.92;
        const sl = this.effects.slash;
        if (sl && sl.complete && sl.width > 0) {
          for (let k = 0; k < 4; k++) {
            ctx.rotate(Math.PI / 2);
            ctx.drawImage(sl, -aoe.radius, -aoe.radius * 0.4, aoe.radius * 2, aoe.radius * 0.8);
          }
        }
      } else if (aoe.type === 'arrow_storm_aoe') {
        const arrowImg = this.effects.arrow;
        ctx.globalAlpha = Math.min(0.95, prog * 1.2);
        if (arrowImg && arrowImg.complete && arrowImg.width > 0) {
          for (let k = 0; k < 9; k++) {
            const rx = Math.cos(k * 1.7 + prog * 7) * aoe.radius * 0.65;
            const ry = Math.sin(k * 2.3 + prog * 7) * aoe.radius * 0.65;
            ctx.drawImage(arrowImg, rx - 14, ry - 14, 28, 28);
          }
        }
      } else if (aoe.type === 'poison_aoe') {
        const pr = this.effects.poison_ring;
        ctx.rotate(this.orbitAngle * 0.5);
        ctx.globalAlpha = Math.min(0.9, prog * 1.2);
        if (pr && pr.complete && pr.width > 0) {
          const sz = aoe.radius * 2;
          ctx.drawImage(pr, -sz / 2, -sz / 2, sz, sz);
        }
      }

      ctx.restore();
    }

    // 2. Draw Chain Lightning Arcs with RO Lightning Texture
    for (const arc of this.lightningArcs) {
      ctx.save();
      ctx.strokeStyle = '#74b9ff';
      ctx.shadowColor = '#0984e3';
      ctx.shadowBlur = 12;
      ctx.lineWidth = 3.5;
      ctx.globalAlpha = arc.life / arc.maxLife;
      ctx.beginPath();
      ctx.moveTo(arc.x1, arc.y1);
      const midX = (arc.x1 + arc.x2) / 2 + (Math.random() - 0.5) * 18;
      const midY = (arc.y1 + arc.y2) / 2 + (Math.random() - 0.5) * 18;
      ctx.lineTo(midX, midY);
      ctx.lineTo(arc.x2, arc.y2);
      ctx.stroke();
      ctx.restore();
    }

    // 3. Draw Projectiles (Arrows, Spears, Magic Orbs)
    for (const p of this.projectiles) {
      ctx.save();
      ctx.translate(p.x, p.y);

      if (p.type === 'spear_proj') {
        const sp = this.sprFrames.ef_spear && this.sprFrames.ef_spear[0];
        ctx.rotate(p.angle + Math.PI / 2);
        if (sp && sp.complete && sp.width > 0) {
          ctx.drawImage(sp, -8, -42, 16, 84);
        }
      } else if (p.type === 'arrow') {
        const arrowImg = this.effects.arrow;
        if (arrowImg && arrowImg.complete && arrowImg.width > 0) {
          ctx.rotate(p.angle + Math.PI / 4);
          ctx.drawImage(arrowImg, -16, -16, 32, 32);
        } else {
          ctx.rotate(p.angle);
          ctx.fillStyle = '#f1c40f';
          ctx.fillRect(-10, -2, 20, 4);
        }
      } else {
        const fb = this.sprFrames.ef_fireball && this.sprFrames.ef_fireball[0];
        if (fb && fb.complete && fb.width > 0) {
          ctx.drawImage(fb, -18, -18, 36, 36);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
          ctx.fillStyle = p.color || '#74b9ff';
          ctx.fill();
        }
      }
      ctx.restore();
    }

    // 4. Draw Animated Authentic RO .spr Skill Effects (ef_*.png)
    for (const anim of this.spriteAnims) {
      const elapsed = 1 - Math.max(0, anim.life / anim.maxLife);
      const idx = Math.min(anim.frames.length - 1, Math.floor(elapsed * anim.frames.length));
      const img = anim.frames[idx];
      if (img && img.complete && img.width > 0) {
        ctx.save();
        ctx.translate(anim.x, anim.y);
        if (anim.rotation) ctx.rotate(anim.rotation);
        ctx.globalAlpha = Math.min(1, (anim.life / anim.maxLife) * 1.45);
        const w = img.width * (anim.scale || 1.2);
        const h = img.height * (anim.scale || 1.2);
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
        ctx.restore();
      }
    }

    // 5. Draw Orbit Daggers (Thief Double Attack)
    const dblAtk = this.getSkillLevel('tf_double');
    if (dblAtk > 0) {
      const count = 2 + Math.floor(dblAtk / 2);
      const orbitR = 54 + dblAtk * 4;
      for (let i = 0; i < count; i++) {
        const a = this.orbitAngle + (i * 2 * Math.PI) / count;
        const dx = this.player.x + Math.cos(a) * orbitR;
        const dy = this.player.y + Math.sin(a) * orbitR;

        ctx.save();
        ctx.translate(dx, dy);
        ctx.rotate(a + Math.PI / 2);
        ctx.fillStyle = '#a29bfe';
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#6c5ce7';
        ctx.fillRect(-3, -12, 6, 24);
        ctx.restore();
      }
    }

    // 6. Draw Authentic RO Yellow Skill Shout Banner above Player ("Storm Gust !!")
    if (this.player.skillShoutTimer > 0 && this.player.skillShoutText) {
      ctx.save();
      const text = this.player.skillShoutText;
      ctx.font = 'bold 12px Tahoma, sans-serif';
      const tw = ctx.measureText(text).width + 14;
      const sx = this.player.x;
      const sy = this.player.y - 54;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
      ctx.strokeStyle = '#ffd32a';
      ctx.lineWidth = 1.5;
      ctx.fillRect(sx - tw / 2, sy - 16, tw, 20);
      ctx.strokeRect(sx - tw / 2, sy - 16, tw, 20);
      ctx.fillStyle = '#fff200';
      ctx.textAlign = 'center';
      ctx.fillText(text, sx, sy - 2);
      ctx.restore();
    }
  }
}
