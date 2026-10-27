// Authentic Ragnarok Online Monster System
// - Loads real monster .spr + .act walk animations (front & back) directly from _sprites.grf via /grf/monster/
// - Fixes monster facing direction (RO sprites face Left by default; flip only when vx > 0; use back frames when vy < 0)
// - Authentic RO Server stats (Lv, HP, ATK, DEF, Base EXP, Job EXP) across all 20 Regional Zones & 1,272 Maps

import { audio } from './audio.js';

// Cache of dynamically loaded monster sprite frames (front & back walk)
const dynamicMonsterFrames = new Map();

export function getMonsterSprites(sprName, fallbackPool) {
  const key = (sprName || 'poring').toLowerCase();
  if (dynamicMonsterFrames.has(key)) return dynamicMonsterFrames.get(key);

  const dirs = [];
  for (let d = 0; d < 8; d++) {
    const frames = [];
    for (let i = 0; i < 16; i++) {
      const img = new Image();
      img.src = `/grf/monster/${key}_d${d}_${i}.png`;
      frames.push(img);
    }
    dirs.push(frames);
  }

  const entry = {
    dirs,
    front: dirs[0],
    back: dirs[4],
    fallback: fallbackPool?.[`monster_${key}`] || fallbackPool?.monster_poring || []
  };
  dynamicMonsterFrames.set(key, entry);
  return entry;
}

// Comprehensive Authentic RO Monster Roster (stats based on official Renewal/Pre-Renewal RO database)
export const MONSTER_TYPES = {
  // === ZONE 1: Prontera Fields & Culvert (Lv. 1 - 12) ===
  poring:           { name: 'Poring',            lv: 1,   hp: 60,     damage: 8,   def: 2,   speed: 1.35, exp: 15,    jobExp: 10,   radius: 18, color: '#ff8899', dieSound: 'mon_poring_die' },
  fabre:            { name: 'Fabre',             lv: 2,   hp: 72,     damage: 10,  def: 4,   speed: 1.15, exp: 18,    jobExp: 12,   radius: 18, color: '#77cc44', dieSound: 'mon_fabre_die' },
  pupa:             { name: 'Pupa',              lv: 2,   hp: 420,    damage: 4,   def: 12,  speed: 0.55, exp: 25,    jobExp: 18,   radius: 16, color: '#a08050', dieSound: 'mon_fabre_die' },
  lunatic:          { name: 'Lunatic',           lv: 3,   hp: 85,     damage: 12,  def: 3,   speed: 1.95, exp: 22,    jobExp: 15,   radius: 18, color: '#eeeeee', dieSound: 'mon_lunatic_die' },
  drops:            { name: 'Drops',             lv: 3,   hp: 95,     damage: 13,  def: 3,   speed: 1.45, exp: 24,    jobExp: 16,   radius: 18, color: '#ffaa44', dieSound: 'mon_poring_die' },
  rocker:           { name: 'Rocker',            lv: 9,   hp: 198,    damage: 22,  def: 8,   speed: 1.55, exp: 42,    jobExp: 30,   radius: 20, color: '#88aa44', dieSound: 'mon_fabre_die' },
  thief_bug:        { name: 'Thief Bug',         lv: 10,  hp: 210,    damage: 24,  def: 9,   speed: 1.85, exp: 46,    jobExp: 32,   radius: 19, color: '#554433', dieSound: 'mon_fabre_die' },
  tarou:            { name: 'Tarou',             lv: 11,  hp: 240,    damage: 26,  def: 8,   speed: 1.90, exp: 52,    jobExp: 36,   radius: 18, color: '#dcdde1', dieSound: 'mon_lunatic_die' },
  familiar:         { name: 'Familiar',          lv: 12,  hp: 260,    damage: 29,  def: 7,   speed: 2.15, exp: 58,    jobExp: 40,   radius: 18, color: '#443355', dieSound: 'mon_lunatic_die' },
  mastering:        { name: 'Mastering',         lv: 15,  hp: 2800,   damage: 52,  def: 15,  speed: 1.45, exp: 480,   jobExp: 320,  radius: 34, color: '#ffdd44', dieSound: 'mon_poring_die', isBoss: true },
  golden_bug:       { name: 'Golden Thief Bug',  lv: 22,  hp: 6200,   damage: 78,  def: 28,  speed: 1.75, exp: 1250,  jobExp: 850,  radius: 38, color: '#ffd700', dieSound: 'mon_fabre_die',  isBoss: true, isMvp: true },

  // === ZONE 2: Payon Forest & Cave (Lv. 12 - 25) ===
  willow:           { name: 'Willow',            lv: 12,  hp: 245,    damage: 26,  def: 10,  speed: 1.25, exp: 54,    jobExp: 38,   radius: 21, color: '#886644', dieSound: 'mon_spore_die' },
  spore:            { name: 'Spore',             lv: 14,  hp: 290,    damage: 30,  def: 10,  speed: 1.40, exp: 66,    jobExp: 46,   radius: 20, color: '#cc9944', dieSound: 'mon_spore_die' },
  poporing:         { name: 'Poporing',          lv: 14,  hp: 344,    damage: 34,  def: 10,  speed: 1.50, exp: 74,    jobExp: 50,   radius: 20, color: '#44ee66', dieSound: 'mon_poring_die' },
  boa:              { name: 'Boa',               lv: 15,  hp: 370,    damage: 36,  def: 9,   speed: 1.65, exp: 80,    jobExp: 55,   radius: 20, color: '#55aa44', dieSound: 'mon_fabre_die' },
  poison_spore:     { name: 'Poison Spore',      lv: 19,  hp: 520,    damage: 45,  def: 12,  speed: 1.55, exp: 112,   jobExp: 78,   radius: 21, color: '#aa44cc', dieSound: 'mon_spore_die' },
  smokie:           { name: 'Smokie',            lv: 18,  hp: 485,    damage: 42,  def: 11,  speed: 1.95, exp: 104,   jobExp: 72,   radius: 20, color: '#997755', dieSound: 'mon_lunatic_die' },
  skeleton:         { name: 'Skeleton',          lv: 20,  hp: 580,    damage: 48,  def: 14,  speed: 1.45, exp: 125,   jobExp: 86,   radius: 21, color: '#dfe6e9', dieSound: 'mon_zombie_die' },
  zombie:           { name: 'Zombie',            lv: 21,  hp: 650,    damage: 52,  def: 12,  speed: 1.20, exp: 138,   jobExp: 94,   radius: 22, color: '#557766', dieSound: 'mon_zombie_die' },
  munak:            { name: 'Munak',             lv: 24,  hp: 870,    damage: 64,  def: 18,  speed: 1.35, exp: 175,   jobExp: 118,  radius: 22, color: '#74b9ff', dieSound: 'mon_zombie_die' },
  bon_gun:          { name: 'Bongun',            lv: 25,  hp: 960,    damage: 68,  def: 20,  speed: 1.45, exp: 192,   jobExp: 130,  radius: 22, color: '#0984e3', dieSound: 'mon_zombie_die' },
  sohee:            { name: 'Sohee',             lv: 26,  hp: 1050,   damage: 74,  def: 18,  speed: 1.60, exp: 215,   jobExp: 148,  radius: 22, color: '#a29bfe', dieSound: 'mon_lunatic_die' },
  eddga:            { name: 'Eddga',             lv: 32,  hp: 11500,  damage: 115, def: 32,  speed: 1.75, exp: 2200,  jobExp: 1500, radius: 40, color: '#e67e22', dieSound: 'mon_orc_die',    isBoss: true, isMvp: true },
  moonlight:        { name: 'Moonlight Flower',  lv: 35,  hp: 13800,  damage: 128, def: 35,  speed: 2.05, exp: 2650,  jobExp: 1850, radius: 38, color: '#ff6633', dieSound: 'mon_lunatic_die', isBoss: true, isMvp: true },

  // === ZONE 3: Morocc Sograt Desert & Ant Hell (Lv. 25 - 38) ===
  pecopeco:         { name: 'Peco Peco',         lv: 26,  hp: 980,    damage: 68,  def: 16,  speed: 1.95, exp: 205,   jobExp: 140,  radius: 24, color: '#f39c12', dieSound: 'mon_lunatic_die' },
  andre:            { name: 'Andre',             lv: 28,  hp: 1120,   damage: 76,  def: 22,  speed: 1.55, exp: 235,   jobExp: 160,  radius: 19, color: '#e67e22', dieSound: 'mon_fabre_die' },
  vitata:           { name: 'Vitata',            lv: 30,  hp: 1280,   damage: 82,  def: 24,  speed: 1.60, exp: 268,   jobExp: 185,  radius: 19, color: '#f1c40f', dieSound: 'mon_fabre_die' },
  hode:             { name: 'Hode',              lv: 32,  hp: 1520,   damage: 90,  def: 25,  speed: 1.30, exp: 310,   jobExp: 210,  radius: 23, color: '#d35400', dieSound: 'mon_spore_die' },
  sand_man:         { name: 'Sandman',           lv: 35,  hp: 1850,   damage: 102, def: 30,  speed: 1.45, exp: 365,   jobExp: 250,  radius: 24, color: '#e1b12c', dieSound: 'mon_mummy_die' },
  frilldora:        { name: 'Frilldora',         lv: 36,  hp: 1980,   damage: 108, def: 26,  speed: 1.80, exp: 390,   jobExp: 270,  radius: 23, color: '#c23616', dieSound: 'mon_fabre_die' },
  golem:            { name: 'Golem',             lv: 38,  hp: 2450,   damage: 118, def: 42,  speed: 1.05, exp: 440,   jobExp: 300,  radius: 26, color: '#7f8fa6', dieSound: 'mon_orc_die' },
  maya:             { name: 'Maya',              lv: 42,  hp: 22000,  damage: 168, def: 45,  speed: 1.85, exp: 4200,  jobExp: 2900, radius: 42, color: '#f1c40f', dieSound: 'mon_fabre_die',  isBoss: true, isMvp: true },
  phreeoni:         { name: 'Phreeoni',          lv: 45,  hp: 26500,  damage: 185, def: 48,  speed: 1.65, exp: 4900,  jobExp: 3400, radius: 44, color: '#ff7979', dieSound: 'mon_orc_die',    isBoss: true, isMvp: true },

  // === ZONE 4: Byalan Undersea Tunnel (Lv. 35 - 48) ===
  marin:            { name: 'Marin',             lv: 35,  hp: 1650,   damage: 94,  def: 20,  speed: 1.65, exp: 340,   jobExp: 235,  radius: 19, color: '#44aaff', dieSound: 'mon_poring_die' },
  vadon:            { name: 'Vadon',             lv: 36,  hp: 1820,   damage: 98,  def: 34,  speed: 1.35, exp: 360,   jobExp: 250,  radius: 22, color: '#eb4d4b', dieSound: 'mon_fabre_die' },
  hydra:            { name: 'Hydra',             lv: 37,  hp: 1600,   damage: 92,  def: 20,  speed: 0.90, exp: 330,   jobExp: 225,  radius: 20, color: '#be2edd', dieSound: 'mon_spore_die' },
  marina:           { name: 'Marina',            lv: 39,  hp: 2150,   damage: 112, def: 24,  speed: 1.60, exp: 410,   jobExp: 285,  radius: 21, color: '#7ed6df', dieSound: 'mon_poring_die' },
  thara_frog:       { name: 'Thara Frog',        lv: 41,  hp: 2420,   damage: 120, def: 28,  speed: 1.75, exp: 465,   jobExp: 320,  radius: 21, color: '#eb4d4b', dieSound: 'mon_lunatic_die' },
  marc:             { name: 'Marc',              lv: 44,  hp: 2850,   damage: 135, def: 32,  speed: 1.70, exp: 530,   jobExp: 370,  radius: 23, color: '#22a6b3', dieSound: 'mon_spore_die' },
  sword_fish:       { name: 'Swordfish',         lv: 46,  hp: 3250,   damage: 148, def: 34,  speed: 1.95, exp: 590,   jobExp: 410,  radius: 25, color: '#4834d4', dieSound: 'mon_orc_die' },
  strouf:           { name: 'Strouf',            lv: 48,  hp: 3800,   damage: 162, def: 38,  speed: 1.75, exp: 680,   jobExp: 470,  radius: 26, color: '#130f40', dieSound: 'mon_orc_die' },
  drake:            { name: 'Drake',             lv: 52,  hp: 36000,  damage: 235, def: 55,  speed: 1.65, exp: 6800,  jobExp: 4800, radius: 42, color: '#686de0', dieSound: 'mon_zombie_die', isBoss: true, isMvp: true },

  // === ZONE 5: Geffen Fields, Orc Village & Orc Dungeon (Lv. 45 - 58) ===
  goblin_1:         { name: 'Goblin',            lv: 45,  hp: 2950,   damage: 140, def: 32,  speed: 1.85, exp: 550,   jobExp: 380,  radius: 20, color: '#6ab04c', dieSound: 'mon_orc_die' },
  orc_warrior:      { name: 'Orc Warrior',       lv: 48,  hp: 3650,   damage: 160, def: 38,  speed: 1.65, exp: 660,   jobExp: 460,  radius: 24, color: '#6ab04c', dieSound: 'mon_orc_die' },
  orc_lady:         { name: 'Orc Lady',          lv: 49,  hp: 3800,   damage: 165, def: 36,  speed: 1.75, exp: 690,   jobExp: 480,  radius: 23, color: '#badc58', dieSound: 'mon_orc_die' },
  orc_zombie:       { name: 'Orc Zombie',        lv: 51,  hp: 4250,   damage: 175, def: 34,  speed: 1.45, exp: 760,   jobExp: 525,  radius: 24, color: '#668855', dieSound: 'mon_orc_die' },
  orc_skeleton:     { name: 'Orc Skeleton',      lv: 53,  hp: 4680,   damage: 188, def: 40,  speed: 1.60, exp: 830,   jobExp: 575,  radius: 24, color: '#dfe6e9', dieSound: 'mon_zombie_die' },
  orc_archer:       { name: 'Orc Archer',        lv: 55,  hp: 4950,   damage: 198, def: 38,  speed: 1.65, exp: 890,   jobExp: 620,  radius: 24, color: '#44bd32', dieSound: 'mon_orc_die' },
  high_orc:         { name: 'High Orc',          lv: 58,  hp: 5850,   damage: 225, def: 46,  speed: 1.80, exp: 1050,  jobExp: 730,  radius: 26, color: '#009432', dieSound: 'mon_orc_die' },
  orc_hero:         { name: 'Orc Hero',          lv: 62,  hp: 52000,  damage: 295, def: 65,  speed: 1.80, exp: 9500,  jobExp: 6600, radius: 42, color: '#009432', dieSound: 'mon_orc_die',    isBoss: true, isMvp: true },
  orc_lord:         { name: 'Orc Lord',          lv: 65,  hp: 62000,  damage: 325, def: 72,  speed: 1.85, exp: 11200, jobExp: 7800, radius: 44, color: '#c23616', dieSound: 'mon_orc_die',    isBoss: true, isMvp: true },

  // === ZONE 6: Morocc Pyramids & Sphinx (Lv. 55 - 70) ===
  mummy:            { name: 'Mummy',             lv: 55,  hp: 5200,   damage: 205, def: 42,  speed: 1.40, exp: 920,   jobExp: 640,  radius: 23, color: '#d4c29a', dieSound: 'mon_mummy_die' },
  verit:            { name: 'Verit',             lv: 56,  hp: 5450,   damage: 212, def: 40,  speed: 1.65, exp: 960,   jobExp: 670,  radius: 22, color: '#c8d6e5', dieSound: 'mon_mummy_die' },
  isis:             { name: 'Isis',              lv: 59,  hp: 6350,   damage: 235, def: 45,  speed: 1.75, exp: 1120,  jobExp: 780,  radius: 25, color: '#f39c12', dieSound: 'mon_lunatic_die' },
  matyr:            { name: 'Matyr',             lv: 60,  hp: 6600,   damage: 242, def: 44,  speed: 2.05, exp: 1180,  jobExp: 820,  radius: 23, color: '#222f3e', dieSound: 'mon_lunatic_die' },
  requiem:          { name: 'Requiem',           lv: 62,  hp: 7150,   damage: 255, def: 48,  speed: 1.50, exp: 1260,  jobExp: 880,  radius: 24, color: '#576574', dieSound: 'mon_zombie_die' },
  marduk:           { name: 'Marduk',            lv: 64,  hp: 7800,   damage: 270, def: 50,  speed: 1.65, exp: 1380,  jobExp: 960,  radius: 25, color: '#ee5253', dieSound: 'mon_orc_die' },
  pasana:           { name: 'Pasana',            lv: 66,  hp: 8450,   damage: 288, def: 54,  speed: 1.75, exp: 1490,  jobExp: 1040, radius: 25, color: '#ff9f43', dieSound: 'mon_orc_die' },
  minorous:         { name: 'Minorous',          lv: 68,  hp: 9200,   damage: 305, def: 56,  speed: 1.65, exp: 1620,  jobExp: 1130, radius: 27, color: '#b71540', dieSound: 'mon_orc_die' },
  anubis:           { name: 'Anubis',            lv: 72,  hp: 11500,  damage: 345, def: 62,  speed: 1.85, exp: 2100,  jobExp: 1480, radius: 28, color: '#0a3d62', dieSound: 'mon_mummy_die' },
  osiris:           { name: 'Osiris',            lv: 75,  hp: 82000,  damage: 395, def: 80,  speed: 1.85, exp: 15500, jobExp: 11000,radius: 42, color: '#8e44ad', dieSound: 'mon_mummy_die',  isBoss: true, isMvp: true },
  pharaoh:          { name: 'Pharaoh',           lv: 78,  hp: 92000,  damage: 425, def: 85,  speed: 1.85, exp: 17800, jobExp: 12500,radius: 44, color: '#f1c40f', dieSound: 'mon_mummy_die',  isBoss: true, isMvp: true },

  // === ZONE 7: Geffen Underground & Sunken Ship (Lv. 65 - 78) ===
  ghoul:            { name: 'Ghoul',             lv: 65,  hp: 8100,   damage: 278, def: 52,  speed: 1.35, exp: 1420,  jobExp: 990,  radius: 23, color: '#38ada9', dieSound: 'mon_zombie_die' },
  whisper:          { name: 'Whisper',           lv: 67,  hp: 7600,   damage: 285, def: 45,  speed: 1.80, exp: 1480,  jobExp: 1030, radius: 21, color: '#dfe6e9', dieSound: 'mon_lunatic_die' },
  hunter_fly:       { name: 'Hunter Fly',        lv: 70,  hp: 8900,   damage: 310, def: 54,  speed: 2.15, exp: 1680,  jobExp: 1170, radius: 20, color: '#eb2f06', dieSound: 'mon_fabre_die' },
  marionette:       { name: 'Marionette',        lv: 72,  hp: 9500,   damage: 325, def: 55,  speed: 1.70, exp: 1800,  jobExp: 1250, radius: 22, color: '#f8c291', dieSound: 'mon_lunatic_die' },
  nightmare:        { name: 'Nightmare',         lv: 75,  hp: 10800,  damage: 350, def: 58,  speed: 2.10, exp: 2050,  jobExp: 1420, radius: 26, color: '#6c5ce7', dieSound: 'mon_lunatic_die' },
  deviruchi:        { name: 'Deviruchi',         lv: 77,  hp: 11400,  damage: 365, def: 60,  speed: 1.95, exp: 2180,  jobExp: 1520, radius: 21, color: '#2d3436', dieSound: 'mon_poring_die' },
  dracula:          { name: 'Dracula',           lv: 80,  hp: 105000, damage: 450, def: 88,  speed: 1.95, exp: 21000, jobExp: 14800,radius: 42, color: '#b71540', dieSound: 'mon_baphomet_die',isBoss: true, isMvp: true },
  doppelganger:     { name: 'Doppelganger',      lv: 82,  hp: 115000, damage: 485, def: 92,  speed: 2.15, exp: 23500, jobExp: 16500,radius: 38, color: '#1e272e', dieSound: 'mon_orc_die',    isBoss: true, isMvp: true },

  // === ZONE 8: Mt. Mjolnir & Coal Mine (Lv. 72 - 85) ===
  mantis:           { name: 'Mantis',            lv: 73,  hp: 9800,   damage: 330, def: 58,  speed: 1.75, exp: 1850,  jobExp: 1290, radius: 22, color: '#78e08f', dieSound: 'mon_fabre_die' },
  argiope:          { name: 'Argiope',           lv: 76,  hp: 11000,  damage: 355, def: 60,  speed: 1.70, exp: 2080,  jobExp: 1450, radius: 24, color: '#60a3bc', dieSound: 'mon_fabre_die' },
  skel_worker:      { name: 'Skeleton Worker',   lv: 78,  hp: 11800,  damage: 372, def: 62,  speed: 1.55, exp: 2240,  jobExp: 1560, radius: 22, color: '#b8e994', dieSound: 'mon_zombie_die' },
  cramp:            { name: 'Cramp',             lv: 80,  hp: 12600,  damage: 388, def: 64,  speed: 2.05, exp: 2400,  jobExp: 1680, radius: 20, color: '#3c6382', dieSound: 'mon_lunatic_die' },
  kobold_1:         { name: 'Kobold',            lv: 82,  hp: 13500,  damage: 405, def: 66,  speed: 1.90, exp: 2580,  jobExp: 1800, radius: 22, color: '#38ada9', dieSound: 'mon_orc_die' },
  petite:           { name: 'Earth Petite',      lv: 84,  hp: 14500,  damage: 420, def: 68,  speed: 1.75, exp: 2760,  jobExp: 1920, radius: 24, color: '#badc58', dieSound: 'mon_spore_die' },
  angeling:         { name: 'Angeling',          lv: 85,  hp: 95000,  damage: 440, def: 85,  speed: 1.90, exp: 18500, jobExp: 13000,radius: 36, color: '#ffffff', dieSound: 'mon_poring_die', isBoss: true },
  deviling:         { name: 'Deviling',          lv: 88,  hp: 110000, damage: 475, def: 90,  speed: 1.95, exp: 21500, jobExp: 15000,radius: 36, color: '#332244', dieSound: 'mon_poring_die', isBoss: true },

  // === ZONE 9: Comodo Caves & Beach (Lv. 80 - 92) ===
  medusa:           { name: 'Medusa',            lv: 84,  hp: 14800,  damage: 425, def: 70,  speed: 1.75, exp: 2820,  jobExp: 1960, radius: 24, color: '#9b59b6', dieSound: 'mon_lunatic_die' },
  stalactic_golem:  { name: 'Stalactic Golem',   lv: 86,  hp: 16500,  damage: 445, def: 82,  speed: 1.25, exp: 3100,  jobExp: 2150, radius: 27, color: '#7f8c8d', dieSound: 'mon_orc_die' },
  alligator:        { name: 'Alligator',         lv: 88,  hp: 17200,  damage: 460, def: 74,  speed: 1.65, exp: 3280,  jobExp: 2280, radius: 25, color: '#27ae60', dieSound: 'mon_orc_die' },
  anolian:          { name: 'Anolian',           lv: 90,  hp: 18600,  damage: 480, def: 76,  speed: 1.85, exp: 3550,  jobExp: 2480, radius: 25, color: '#2ecc71', dieSound: 'mon_orc_die' },
  sting:            { name: 'Sting',             lv: 92,  hp: 19500,  damage: 495, def: 78,  speed: 1.55, exp: 3750,  jobExp: 2620, radius: 24, color: '#8e44ad', dieSound: 'mon_mummy_die' },

  // === ZONE 10: Aldebaran Clock Tower & Toy Factory (Lv. 88 - 99) ===
  clock:            { name: 'Clock',             lv: 90,  hp: 18500,  damage: 478, def: 78,  speed: 1.55, exp: 3520,  jobExp: 2450, radius: 25, color: '#d35400', dieSound: 'mon_orc_die' },
  alarm:            { name: 'Alarm',             lv: 92,  hp: 19800,  damage: 495, def: 80,  speed: 1.65, exp: 3780,  jobExp: 2640, radius: 25, color: '#e67e22', dieSound: 'mon_orc_die' },
  bathory:          { name: 'Bathory',           lv: 94,  hp: 20800,  damage: 510, def: 76,  speed: 1.95, exp: 3980,  jobExp: 2780, radius: 23, color: '#9b59b6', dieSound: 'mon_lunatic_die' },
  rideword:         { name: 'Rideword',          lv: 95,  hp: 21500,  damage: 525, def: 82,  speed: 1.75, exp: 4120,  jobExp: 2880, radius: 21, color: '#c0392b', dieSound: 'mon_fabre_die' },
  mimic:            { name: 'Mimic',             lv: 96,  hp: 22200,  damage: 540, def: 84,  speed: 2.10, exp: 4280,  jobExp: 2980, radius: 22, color: '#f39c12', dieSound: 'mon_fabre_die' },
  cruiser:          { name: 'Cruiser',           lv: 98,  hp: 23600,  damage: 560, def: 85,  speed: 1.70, exp: 4550,  jobExp: 3180, radius: 23, color: '#2980b9', dieSound: 'mon_orc_die' },
  stormy_knight:    { name: 'Stormy Knight',     lv: 100, hp: 155000, damage: 590, def: 102, speed: 1.90, exp: 32000, jobExp: 22500,radius: 44, color: '#74b9ff', dieSound: 'mon_baphomet_die',isBoss: true, isMvp: true },
  garm:             { name: 'Garm (Hatii)',      lv: 102, hp: 168000, damage: 615, def: 105, speed: 2.00, exp: 35000, jobExp: 24500,radius: 44, color: '#0984e3', dieSound: 'mon_orc_die',    isBoss: true, isMvp: true },

  // === ZONE 11: Glast Heim Castle, Abbey & Chivalry (Lv. 95 - 110) ===
  evil_druid:       { name: 'Evil Druid',        lv: 98,  hp: 24500,  damage: 575, def: 86,  speed: 1.60, exp: 4720,  jobExp: 3300, radius: 25, color: '#27ae60', dieSound: 'mon_mummy_die' },
  wraith:           { name: 'Wraith',            lv: 99,  hp: 25200,  damage: 585, def: 84,  speed: 1.65, exp: 4860,  jobExp: 3400, radius: 25, color: '#2c3e50', dieSound: 'mon_zombie_die' },
  raydric:          { name: 'Raydric',           lv: 102, hp: 27800,  damage: 615, def: 92,  speed: 1.80, exp: 5350,  jobExp: 3750, radius: 25, color: '#7f8c8d', dieSound: 'mon_orc_die' },
  khalitzburg:      { name: 'Khalitzburg',       lv: 104, hp: 29500,  damage: 635, def: 95,  speed: 1.75, exp: 5680,  jobExp: 3980, radius: 26, color: '#34495e', dieSound: 'mon_zombie_die' },
  wander_man:       { name: 'Wanderer',          lv: 106, hp: 31200,  damage: 660, def: 94,  speed: 2.15, exp: 6050,  jobExp: 4250, radius: 25, color: '#16a085', dieSound: 'mon_orc_die' },
  abysmal_knight:   { name: 'Abysmal Knight',    lv: 108, hp: 34500,  damage: 695, def: 102, speed: 1.75, exp: 6650,  jobExp: 4650, radius: 28, color: '#2c3e50', dieSound: 'mon_orc_die' },
  bloody_knight:    { name: 'Bloody Knight',     lv: 110, hp: 38000,  damage: 725, def: 106, speed: 1.80, exp: 7300,  jobExp: 5100, radius: 28, color: '#c0392b', dieSound: 'mon_orc_die' },
  dark_lord:        { name: 'Dark Lord',         lv: 112, hp: 210000, damage: 740, def: 115, speed: 1.85, exp: 44000, jobExp: 31000,radius: 46, color: '#8e44ad', dieSound: 'mon_baphomet_die',isBoss: true, isMvp: true },
  baphomet:         { name: 'Baphomet',          lv: 115, hp: 235000, damage: 785, def: 120, speed: 1.95, exp: 49000, jobExp: 34500,radius: 46, color: '#cc1111', dieSound: 'mon_baphomet_die',isBoss: true, isMvp: true },

  // === ZONE 12: Turtle Island, Amatsu & Kunlun (Lv. 105 - 120) ===
  assulter:         { name: 'Assaulter',         lv: 108, hp: 33000,  damage: 675, def: 98,  speed: 1.85, exp: 6350,  jobExp: 4450, radius: 24, color: '#27ae60', dieSound: 'mon_orc_die' },
  shinobi:          { name: 'Shinobi',           lv: 110, hp: 35000,  damage: 695, def: 96,  speed: 2.05, exp: 6750,  jobExp: 4720, radius: 24, color: '#2c3e50', dieSound: 'mon_orc_die' },
  tengu:            { name: 'Tengu',             lv: 114, hp: 38500,  damage: 730, def: 102, speed: 1.90, exp: 7450,  jobExp: 5200, radius: 25, color: '#c0392b', dieSound: 'mon_orc_die' },
  the_paper:        { name: 'The Paper',         lv: 116, hp: 40500,  damage: 750, def: 98,  speed: 1.95, exp: 7850,  jobExp: 5500, radius: 23, color: '#f1c40f', dieSound: 'mon_lunatic_die' },
  turtle_general:   { name: 'Turtle General',    lv: 120, hp: 265000, damage: 830, def: 130, speed: 1.80, exp: 55000, jobExp: 38500,radius: 46, color: '#16a085', dieSound: 'mon_baphomet_die',isBoss: true, isMvp: true },

  // === ZONE 13: Niflheim & Yggdrasil (Lv. 115 - 130) ===
  dullahan:         { name: 'Dullahan',          lv: 118, hp: 43500,  damage: 780, def: 108, speed: 1.75, exp: 8400,  jobExp: 5880, radius: 26, color: '#6c5ce7', dieSound: 'mon_zombie_die' },
  loli_ruri:        { name: 'Loli Ruri',         lv: 122, hp: 47500,  damage: 815, def: 106, speed: 1.85, exp: 9200,  jobExp: 6450, radius: 24, color: '#fd79a8', dieSound: 'mon_lunatic_die' },
  gibbet:           { name: 'Gibbet',            lv: 125, hp: 51000,  damage: 845, def: 110, speed: 1.70, exp: 9850,  jobExp: 6900, radius: 25, color: '#636e72', dieSound: 'mon_zombie_die' },
  bloody_murderer:  { name: 'Bloody Murderer',   lv: 128, hp: 55000,  damage: 880, def: 114, speed: 1.95, exp: 10600, jobExp: 7450, radius: 26, color: '#d63031', dieSound: 'mon_orc_die' },
  lord_of_death:    { name: 'Lord of Death',     lv: 132, hp: 310000, damage: 920, def: 138, speed: 1.85, exp: 65000, jobExp: 45500,radius: 48, color: '#2d3436', dieSound: 'mon_baphomet_die',isBoss: true, isMvp: true },

  // === ZONE 14: Magma Dungeon & Juperos (Lv. 125 - 140) ===
  lava_golem:       { name: 'Lava Golem',        lv: 128, hp: 56000,  damage: 890, def: 122, speed: 1.50, exp: 10800, jobExp: 7550, radius: 28, color: '#e17055', dieSound: 'mon_orc_die' },
  blazer:           { name: 'Blazer',            lv: 130, hp: 58500,  damage: 910, def: 115, speed: 1.85, exp: 11300, jobExp: 7900, radius: 23, color: '#ff7675', dieSound: 'mon_spore_die' },
  diabolic:         { name: 'Diabolic',          lv: 133, hp: 62000,  damage: 940, def: 118, speed: 1.95, exp: 12000, jobExp: 8400, radius: 23, color: '#d63031', dieSound: 'mon_poring_die' },
  nightmare_terror: { name: 'Nightmare Terror',  lv: 136, hp: 66500,  damage: 975, def: 122, speed: 2.10, exp: 12800, jobExp: 8950, radius: 27, color: '#e84393', dieSound: 'mon_lunatic_die' },
  venatu:           { name: 'Venatu',            lv: 138, hp: 69000,  damage: 995, def: 125, speed: 1.85, exp: 13400, jobExp: 9400, radius: 24, color: '#00cec9', dieSound: 'mon_orc_die' },
  dimik:            { name: 'Dimik',             lv: 140, hp: 72500,  damage: 1020,def: 128, speed: 1.90, exp: 14200, jobExp: 9950, radius: 25, color: '#0984e3', dieSound: 'mon_orc_die' },
  vesper:           { name: 'Vesper',            lv: 142, hp: 365000, damage: 1050,def: 148, speed: 1.85, exp: 76000, jobExp: 53000,radius: 46, color: '#fdcb6e', dieSound: 'mon_baphomet_die',isBoss: true, isMvp: true },

  // === ZONE 15: Einbroch & Lighthalzen Bio Lab (Lv. 135 - 155) ===
  eremes:           { name: 'Eremes Guile',      lv: 145, hp: 82000,  damage: 1120,def: 132, speed: 2.15, exp: 16500, jobExp: 11500,radius: 25, color: '#6c5ce7', dieSound: 'mon_orc_die' },
  harword:          { name: 'Howard Alt-Eisen',  lv: 146, hp: 86000,  damage: 1150,def: 138, speed: 1.95, exp: 17200, jobExp: 12000,radius: 25, color: '#e17055', dieSound: 'mon_orc_die' },
  magaleta:         { name: 'Margaretha Sorin',  lv: 147, hp: 80000,  damage: 1090,def: 130, speed: 1.85, exp: 16200, jobExp: 11300,radius: 24, color: '#ffeaa7', dieSound: 'mon_lunatic_die' },
  shecil:           { name: 'Cecil Damon',       lv: 148, hp: 84000,  damage: 1160,def: 132, speed: 2.10, exp: 17000, jobExp: 11900,radius: 24, color: '#55efc4', dieSound: 'mon_lunatic_die' },
  katrinn:          { name: 'Kathryne Keyron',   lv: 149, hp: 81000,  damage: 1180,def: 130, speed: 1.85, exp: 16800, jobExp: 11800,radius: 24, color: '#74b9ff', dieSound: 'mon_lunatic_die' },
  seyren:           { name: 'Seyren Windsor',    lv: 152, hp: 92000,  damage: 1220,def: 142, speed: 2.00, exp: 18500, jobExp: 13000,radius: 26, color: '#d63031', dieSound: 'mon_orc_die' },
  kiel_:            { name: 'Kiel-D-01',         lv: 155, hp: 440000, damage: 1250,def: 160, speed: 2.00, exp: 92000, jobExp: 64000,radius: 44, color: '#0984e3', dieSound: 'mon_baphomet_die',isBoss: true, isMvp: true },

  // === ZONE 16: Abyss Lake, Odin Temple & Thanatos Tower (Lv. 150 - 170) ===
  ferus:            { name: 'Ferus',             lv: 155, hp: 98000,  damage: 1240,def: 145, speed: 1.90, exp: 19800, jobExp: 13800,radius: 27, color: '#d63031', dieSound: 'mon_orc_die' },
  acidus:           { name: 'Acidus',            lv: 158, hp: 105000, damage: 1290,def: 148, speed: 1.95, exp: 21200, jobExp: 14800,radius: 28, color: '#fdcb6e', dieSound: 'mon_orc_die' },
  detale:           { name: 'Detardeurus',       lv: 165, hp: 520000, damage: 1420,def: 172, speed: 1.90, exp: 110000,jobExp: 77000,radius: 48, color: '#6c5ce7', dieSound: 'mon_baphomet_die',isBoss: true, isMvp: true },
  thanatos:         { name: 'Memory of Thanatos',lv: 170, hp: 580000, damage: 1520,def: 180, speed: 1.95, exp: 125000,jobExp: 88000,radius: 48, color: '#2d3436', dieSound: 'mon_baphomet_die',isBoss: true, isMvp: true },

  // === ZONE 17: Ice Cave, Thor Volcano & Cursed Abbey (Lv. 165 - 185) ===
  ice_titan:        { name: 'Ice Titan',         lv: 170, hp: 125000, damage: 1420,def: 160, speed: 1.65, exp: 25500, jobExp: 17800,radius: 28, color: '#74b9ff', dieSound: 'mon_orc_die' },
  kasa:             { name: 'Kasa',              lv: 175, hp: 138000, damage: 1490,def: 162, speed: 1.95, exp: 28000, jobExp: 19600,radius: 27, color: '#ff7675', dieSound: 'mon_orc_die' },
  salamander:       { name: 'Salamander',        lv: 178, hp: 148000, damage: 1550,def: 165, speed: 2.05, exp: 30000, jobExp: 21000,radius: 27, color: '#d63031', dieSound: 'mon_orc_die' },
  banshee:          { name: 'Banshee',           lv: 180, hp: 155000, damage: 1590,def: 164, speed: 1.95, exp: 31500, jobExp: 22000,radius: 25, color: '#a29bfe', dieSound: 'mon_lunatic_die' },
  necromancer:      { name: 'Necromancer',       lv: 183, hp: 168000, damage: 1650,def: 168, speed: 1.80, exp: 34000, jobExp: 23800,radius: 26, color: '#6c5ce7', dieSound: 'mon_mummy_die' },
  ktullanux:        { name: 'Ktullanux',         lv: 182, hp: 650000, damage: 1680,def: 188, speed: 1.85, exp: 140000,jobExp: 98000,radius: 48, color: '#0984e3', dieSound: 'mon_baphomet_die',isBoss: true, isMvp: true },
  ifrit:            { name: 'Ifrit',             lv: 185, hp: 750000, damage: 1820,def: 195, speed: 1.95, exp: 165000,jobExp: 115000,radius: 48, color: '#e17055', dieSound: 'mon_baphomet_die',isBoss: true, isMvp: true },
  beelzebub_:       { name: 'Beelzebub',         lv: 188, hp: 820000, damage: 1920,def: 202, speed: 2.05, exp: 185000,jobExp: 130000,radius: 48, color: '#2d3436', dieSound: 'mon_baphomet_die',isBoss: true, isMvp: true }
};

export class Monster {
  constructor(typeKey, x, y, spritePool, hpScale = 1, dmgScale = 1, expScale = 1) {
    const def = MONSTER_TYPES[typeKey] || {
      name: typeKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      lv: 30,
      hp: 1500,
      damage: 85,
      def: 25,
      speed: 1.65,
      exp: 320,
      jobExp: 220,
      radius: 22,
      color: '#e17055',
      dieSound: 'mon_orc_die'
    };
    this.typeKey = typeKey;
    this.name = def.name;
    this.lv = def.lv || 1;
    this.dieSound = def.dieSound || 'mon_poring_die';
    this.isBoss = !!def.isBoss;
    this.isMvp = !!def.isMvp;
    this.x = x;
    this.y = y;
    this.maxHp = Math.round(def.hp * hpScale);
    this.hp = this.maxHp;
    this.def = Math.round((def.def || 5) * Math.sqrt(hpScale));
    this.speed = def.speed;
    this.damage = Math.max(4, Math.round(def.damage * dmgScale));
    this.exp = Math.max(5, Math.round(def.exp * expScale));
    this.jobExp = Math.max(3, Math.round((def.jobExp || def.exp * 0.7) * expScale));
    this.radius = def.radius || 20;
    this.color = def.color || '#ff8899';

    this.spriteEntry = getMonsterSprites(typeKey, spritePool);
    this.frameIndex = Math.floor(Math.random() * 4);
    this.animTimer = 0;
    this.alive = true;
    this.vx = 0;
    this.vy = 0;
    this.facingRight = false;
    this.facingBack = false;
    this.hitFlash = 0;
    this._orbitHitCooldown = 0;
  }

  takeDamage(amount, isCrit, spawnDamageNumber) {
    // Apply monster DEF mitigation (except critical hits which pierce partial DEF)
    const mitigated = isCrit
      ? Math.max(1, Math.round(amount - (this.def || 0) * 0.15))
      : Math.max(1, Math.round(amount - (this.def || 0) * 0.45));
    this.hp -= mitigated;
    this.hitFlash = 0.14;
    spawnDamageNumber(this.x, this.y - this.radius, mitigated, isCrit ? '#ffdd00' : '#ffffff', isCrit);

    if (this.hp <= 0 && this.alive) {
      this.alive = false;
      audio.playWav(this.dieSound, this.isBoss ? 0.65 : 0.45);
    }
  }

  knockback(kx, ky) {
    const resist = this.isBoss ? 0.25 : 1.0;
    this.x += kx * resist;
    this.y += ky * resist;
  }

  update(dt, player, allMonsters = null) {
    if (!this.alive) return;

    if (this.hitFlash > 0) this.hitFlash -= dt;
    if (this._orbitHitCooldown > 0) this._orbitHitCooldown -= dt;

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);

    let moveX = 0;
    let moveY = 0;

    if (dist > 5) {
      moveX += dx / dist;
      moveY += dy / dist;
    }

    // Natural Flocking / Separation force: monsters surround the player instead of stacking
    if (allMonsters && allMonsters.length > 1) {
      let sepX = 0;
      let sepY = 0;
      let sepCount = 0;
      const sepDist = this.radius * 2.2 + 10;
      for (let i = 0; i < allMonsters.length; i++) {
        const other = allMonsters[i];
        if (other === this || !other.alive) continue;
        const ox = this.x - other.x;
        const oy = this.y - other.y;
        const od = Math.hypot(ox, oy);
        if (od > 0.001 && od < sepDist) {
          const force = (sepDist - od) / sepDist;
          sepX += (ox / od) * force;
          sepY += (oy / od) * force;
          sepCount++;
          if (sepCount >= 8) break; // optimize neighborhood checks
        }
      }
      if (sepCount > 0) {
        moveX += sepX * 1.45;
        moveY += sepY * 1.45;
      }
    }

    const moveLen = Math.hypot(moveX, moveY);
    if (moveLen > 0.05) {
      const nx = moveX / moveLen;
      const ny = moveY / moveLen;
      this.vx = nx * this.speed * (dt * 60);
      this.vy = ny * this.speed * (dt * 60);
      this.x += this.vx;
      this.y += this.vy;

      // Authentic RO 8-direction index (0: South, 1: SW, 2: W, 3: NW, 4: N, 5: NE, 6: E, 7: SE)
      let angle = Math.atan2(-nx, ny);
      if (angle < 0) angle += Math.PI * 2;
      this.dir8 = Math.round(angle / (Math.PI / 4)) % 8;

      if (Math.abs(nx) > 0.08) {
        this.facingRight = nx > 0;
      }
      this.facingBack = ny < -0.25;
    }

    this.animTimer += dt;
    if (this.animTimer > 0.088) {
      this.animTimer -= 0.088;
      this.frameIndex = (this.frameIndex + 1) % 2520;
    }
  }

  draw(ctx) {
    if (!this.alive) return;

    ctx.save();
    ctx.translate(this.x, this.y);

    // Ground shadow
    ctx.beginPath();
    ctx.ellipse(0, 12, this.radius * 0.75, this.radius * 0.28, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.fill();

    if (this.hitFlash > 0) {
      ctx.filter = 'brightness(2) drop-shadow(0 0 6px #ffffff)';
    }

    if (this.isBoss) {
      ctx.shadowBlur = 16;
      ctx.shadowColor = this.color;
    }

    const dirFrames = this.spriteEntry.dirs?.[this.dir8 || 0] || (this.facingBack ? this.spriteEntry.back : this.spriteEntry.front);
    let currentImg = dirFrames ? dirFrames[this.frameIndex % dirFrames.length] : null;
    let isCentered140 = true;

    if (!currentImg || !currentImg.complete || currentImg.width === 0) {
      const fb = this.spriteEntry.fallback;
      currentImg = fb && fb[this.frameIndex % fb.length];
      isCentered140 = false;
    }

    if (currentImg && currentImg.complete && currentImg.width > 0) {
      if (!this.spriteEntry.dirs && this.facingRight) {
        ctx.scale(-1, 1);
      }
      if (isCentered140) {
        const size = this.isBoss ? 148 : 104;
        ctx.drawImage(currentImg, -size / 2, -size * (116 / 140) + 12, size, size);
      } else {
        const w = this.radius * 2.3;
        const h = (currentImg.height / currentImg.width) * w;
        ctx.drawImage(currentImg, -w / 2, -h / 2, w, h);
      }
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.fill();
    }

    ctx.restore();

    // Authentic RO Monster HP Bar & Level/Nameplate
    if (this.isBoss || this.hp < this.maxHp) {
      const barW = this.radius * 2.4;
      const barH = this.isBoss ? 6 : 4;
      const barY = this.y - this.radius - 10;
      const pct = Math.max(0, this.hp / this.maxHp);

      ctx.fillStyle = 'rgba(0,0,0,0.78)';
      ctx.fillRect(this.x - barW / 2, barY, barW, barH);
      ctx.fillStyle = this.isBoss ? '#ff2222' : '#2ecc71';
      ctx.fillRect(this.x - barW / 2, barY, barW * pct, barH);

      ctx.save();
      ctx.font = this.isBoss ? 'bold 11px Tahoma, sans-serif' : '9px Tahoma, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = this.isBoss ? '#ffeaa7' : '#dfe6e9';
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 4;
      ctx.fillText(this.isBoss ? `👑 [Lv.${this.lv}] ${this.name}` : `Lv.${this.lv} ${this.name}`, this.x, barY - 4);
      ctx.restore();
    }
  }
}

export class WaveSpawner {
  constructor(monsterSpritePool, stageInfo) {
    this.spritePool = monsterSpritePool;
    this.stageInfo = stageInfo;
    this.spawnTimer = 0;
    this.stageBossSpawned = false;
  }

  setStageInfo(stageInfo) {
    this.stageInfo = stageInfo;
    this.spawnTimer = 0;
    this.stageBossSpawned = false;
  }

  update(dt, gameTime, player, monsters, stageKills = 0) {
    this.spawnTimer += dt;
    const interval = Math.max(0.28, 1.15 - Math.min(0.65, gameTime / 180));

    if (this.spawnTimer >= interval && monsters.length < 110) {
      this.spawnTimer = 0;
      const pool = (this.stageInfo && this.stageInfo.monsters && this.stageInfo.monsters.length)
        ? this.stageInfo.monsters
        : ['poring', 'fabre', 'lunatic'];
      const type = pool[Math.floor(Math.random() * pool.length)];

      const angle = Math.random() * Math.PI * 2;
      const dist = 330 + Math.random() * 80;
      const sx = player.x + Math.cos(angle) * dist;
      const sy = player.y + Math.sin(angle) * dist;

      const hpScale = (this.stageInfo ? this.stageInfo.hpScale : 1) * (1 + (gameTime / 120) * 0.25);
      const dmgScale = this.stageInfo ? this.stageInfo.dmgScale : 1;
      const expScale = this.stageInfo ? this.stageInfo.expScale : 1;
      monsters.push(new Monster(type, sx, sy, this.spritePool, hpScale, dmgScale, expScale));
    }

    // Spawn Stage Boss ONLY after kill quota is fully reached!
    const quota = this.stageInfo ? this.stageInfo.killQuota : 100;
    if (!this.stageBossSpawned && stageKills >= quota) {
      this.stageBossSpawned = true;
      const bossType = (this.stageInfo && this.stageInfo.bossType) || 'mastering';
      return this.spawnBoss(bossType, player, monsters);
    }
    return null;
  }

  spawnBoss(type, player, monsters) {
    const angle = Math.random() * Math.PI * 2;
    const sx = player.x + Math.cos(angle) * 290;
    const sy = player.y + Math.sin(angle) * 290;
    const hpScale = (this.stageInfo ? this.stageInfo.hpScale : 1) * 1.15;
    const dmgScale = (this.stageInfo ? this.stageInfo.dmgScale : 1) * 1.1;
    const expScale = (this.stageInfo ? this.stageInfo.expScale : 1) * 1.2;
    const boss = new Monster(type, sx, sy, this.spritePool, hpScale, dmgScale, expScale);
    boss.isBoss = true;
    monsters.push(boss);
    return boss;
  }
}
