// RO Survivors - In-Game Authentic UI Manager
// Features:
// 1. 10-Slot Authentic RO Equipment Window + 10-Slot Costume/Shadow Gear Window (คอสสวมใส่)
// 2. Inventory with Use / Eqp / Cos / Card / Etc tabs + Weight Limit Enforcement + Discard Item
// 3. 4-Slot Quick Usable / Potion Bar on HUD (usable in Battle & Town, no Fly/Butterfly Wing)
// 4. Skills Window with All-RO Class Tier Pool + Zeny Skill Reset
// 5. 4 Prontera Town NPC Modals:
//    - Warp NPC (20 Regional Zones / 1,272 RO Maps with strict Boss-Kill Stage Unlock!)
//    - Progressive Job Master NPC (Novice J.Lv10 -> Class 1 J.Lv40 -> Class 2 J.Lv45 -> High Class J.Lv50 -> Class 3)
//    - Tool Dealer NPC (Potions, Buffs, Refine Ores, Blessing Ore & Sell Drops)
//    - Refine Master Hollgrehenn (+1 to +10 with real RO rates, Ores by Weapon Lv, Item Break & Blessing Ore)

import { audio } from './audio.js';
import {
  EQUIP_SLOTS_10,
  COSTUME_SLOTS_10,
  JOB_TREES,
  ZONES_20,
  getStageInfo,
  CARD_DB,
  getCardDef,
  SHOP_CATALOG,
  RO_DB,
  createItemInstanceFromDb,
  getRefineRequirements
} from './gamedata.js';
import { SKILL_DEFS, MAX_OFFENSIVE_SLOTS, MAX_SUPPORT_SLOTS, getMaxSlots } from './skills.js';

export class InGameUIManager {
  constructor(player, world) {
    this.player = player;
    this.world = world;
    window.uiManager = this;

    this.activeWindows = {
      status: false,
      inventory: false,
      equipment: false,
      skills: false
    };

    this.inventoryTab = 'use'; // 'use' | 'eqp' | 'cos' | 'card' | 'etc'
    this.equipMode = 'main';   // 'main' (10 Equip slots) | 'costume' (10 Costume/Shadow slots)
    this.warpMode = 'zones';   // 'zones' (20 Zones) | 'allmaps' (1,272 Maps)
    this.warpSearchQuery = '';
    this.selectedWarpZoneIdx = 0;
    this.shopTab = 'buy';

    // Compendium state (29,368 items + 1,272 maps)
    this.compendiumCat = 'weapons';
    this.compendiumSearch = '';
    this.compendiumPage = 0;

    this.ensurePlayerInitialized();
    this.setupDOM();
    this.recalcStats();
    this.refreshAll();
  }

  showROAlert(message, title = 'ระบบ Ragnarok Online', icon = 'ℹ️') {
    return new Promise(resolve => {
      const modal = document.getElementById('modal-ro-msgbox');
      const tEl = document.getElementById('ro-msgbox-title');
      const iEl = document.getElementById('ro-msgbox-icon');
      const msgEl = document.getElementById('ro-msgbox-text');
      const actEl = document.getElementById('ro-msgbox-actions');
      const closeBtn = document.getElementById('btn-ro-msgbox-close');
      if (!modal) {
        window.alert(message);
        resolve(true);
        return;
      }
      if (tEl) tEl.textContent = title;
      if (iEl) iEl.textContent = icon;
      if (msgEl) msgEl.textContent = message;
      if (actEl) {
        actEl.innerHTML = `<button class="ro-msgbox-btn ro-msgbox-btn-ok" style="min-width:110px;">ตกลง (OK)</button>`;
        const okBtn = actEl.querySelector('button');
        const cleanup = () => {
          modal.classList.add('hidden');
          if (okBtn) okBtn.onclick = null;
          if (closeBtn) closeBtn.onclick = null;
          resolve(true);
        };
        if (okBtn) okBtn.onclick = cleanup;
        if (closeBtn) closeBtn.onclick = cleanup;
      }
      modal.classList.remove('hidden');
    });
  }

  showROConfirm(message, title = 'ยืนยันการทำรายการ', icon = '❓') {
    return new Promise(resolve => {
      const modal = document.getElementById('modal-ro-msgbox');
      const tEl = document.getElementById('ro-msgbox-title');
      const iEl = document.getElementById('ro-msgbox-icon');
      const msgEl = document.getElementById('ro-msgbox-text');
      const actEl = document.getElementById('ro-msgbox-actions');
      const closeBtn = document.getElementById('btn-ro-msgbox-close');
      if (!modal) {
        const res = window.confirm(message);
        resolve(res);
        return;
      }
      if (tEl) tEl.textContent = title;
      if (iEl) iEl.textContent = icon;
      if (msgEl) msgEl.textContent = message;
      if (actEl) {
        actEl.innerHTML = `
          <button id="ro-confirm-yes" class="ro-msgbox-btn ro-msgbox-btn-ok" style="min-width:96px;">ยืนยัน (Yes)</button>
          <button id="ro-confirm-no" class="ro-msgbox-btn ro-msgbox-btn-cancel" style="min-width:96px;">ยกเลิก (No)</button>
        `;
        const yesBtn = document.getElementById('ro-confirm-yes');
        const noBtn = document.getElementById('ro-confirm-no');
        const finish = (result) => {
          modal.classList.add('hidden');
          if (yesBtn) yesBtn.onclick = null;
          if (noBtn) noBtn.onclick = null;
          if (closeBtn) closeBtn.onclick = null;
          resolve(result);
        };
        if (yesBtn) yesBtn.onclick = () => finish(true);
        if (noBtn) noBtn.onclick = () => finish(false);
        if (closeBtn) closeBtn.onclick = () => finish(false);
      }
      modal.classList.remove('hidden');
    });
  }

  ensurePlayerInitialized() {
    const p = this.player;
    if (!p.baseLv) p.baseLv = p.level || 1;
    if (!p.jobLv) p.jobLv = p.jobLevel || 1;
    if (p.zeny === undefined) p.zeny = 0;
    if (p.statPoints === undefined) p.statPoints = p.statusPoints !== undefined ? p.statusPoints : 0;
    if (p.skillPoints === undefined) p.skillPoints = 0;
    if (!p.maxUnlockedStage) p.maxUnlockedStage = 1;

    // Normalize job info from JOB_TREES (default Novice!)
    const jobKey = p.jobId && JOB_TREES[p.jobId] ? p.jobId : (p.classKey && JOB_TREES[p.classKey] ? p.classKey : 'novice');
    const jDef = JOB_TREES[jobKey] || JOB_TREES.novice;
    p.jobId = jDef.id;
    p.job = jDef.name;
    p.jobName = jDef.name;
    p.classKey = jDef.sprite;
    p.branch = jDef.branch;
    p.tier = jDef.tier;

    if (!p.stats) {
      p.stats = {
        str: p.str || 1,
        agi: p.agi || 1,
        vit: p.vit || 1,
        int: p.int || 1,
        dex: p.dex || 1,
        luk: p.luk || 1
      };
    }

    if (!p.skills) {
      p.skills = {};
    }

    // Authentic Zero-Start: New characters start with NO items and NO skills at all!
    if (!p.items) {
      p.items = { use: [], eqp: [], cos: [], card: [], etc: [] };
    } else {
      if (!Array.isArray(p.items.use)) p.items.use = [];
      if (!Array.isArray(p.items.eqp)) p.items.eqp = [];
      if (!Array.isArray(p.items.cos)) p.items.cos = [];
      if (!Array.isArray(p.items.card)) p.items.card = [];
      if (!Array.isArray(p.items.etc)) p.items.etc = [];
      // Remove any legacy Fly Wing / Butterfly Wing
      p.items.use = p.items.use.filter(it => it && it.id !== 'use_fly_wing' && it.id !== 'use_b_wing');
    }
    this.items = p.items;
    this.consolidateEtcItems();
  }

  // Consolidate identical Etc loot/materials into stacked single slots with counts
  consolidateEtcItems() {
    if (!this.items || !Array.isArray(this.items.etc)) return;
    const map = new Map();
    for (const it of this.items.etc) {
      if (!it) continue;
      const key = (it.id || it.name || '').trim();
      if (!key) continue;
      if (map.has(key)) {
        const existing = map.get(key);
        existing.count = (existing.count || 1) + (it.count || 1);
      } else {
        map.set(key, { ...it, count: it.count || 1 });
      }
    }
    this.items.etc = Array.from(map.values());
  }

  setupDOM() {
    const bind = (id, fn) => {
      const el = document.getElementById(id);
      if (el) el.onclick = fn;
    };

    bind('menu-btn-status', () => this.toggleWindow('status'));
    bind('menu-btn-inven', () => this.toggleWindow('inventory'));
    bind('menu-btn-equip', () => this.toggleWindow('equipment'));
    bind('menu-btn-skills', () => this.toggleWindow('skills'));
    bind('menu-btn-compendium', () => this.openCompendiumModal());

    bind('win-status-close', () => this.toggleWindow('status', false));
    bind('win-inven-close', () => this.toggleWindow('inventory', false));
    bind('win-equip-close', () => this.toggleWindow('equipment', false));
    bind('win-skills-close', () => this.toggleWindow('skills', false));

    // Reset Skills with Zeny button
    bind('btn-reset-skills', () => this.resetSkillsWithZeny());

    // Keyboard hotkeys 1..4 for Quick Usable Bar
    window.addEventListener('keydown', (e) => {
      if (['1', '2', '3', '4'].includes(e.key) && document.activeElement?.tagName !== 'INPUT') {
        const idx = Number(e.key) - 1;
        const usables = (this.items.use || []).filter(u => u && u.count > 0);
        if (usables[idx]) {
          this.useItem(usables[idx], true);
        }
      }
    });

    // Equipment Mode Tabs (Main 10 Slots vs Costume/Shadow 10 Slots)
    bind('equip-mode-main', () => {
      this.equipMode = 'main';
      document.getElementById('equip-mode-main')?.classList.add('active');
      document.getElementById('equip-mode-costume')?.classList.remove('active');
      audio.playCoinSound();
      this.renderEquipment();
    });
    bind('equip-mode-costume', () => {
      this.equipMode = 'costume';
      document.getElementById('equip-mode-costume')?.classList.add('active');
      document.getElementById('equip-mode-main')?.classList.remove('active');
      audio.playCoinSound();
      this.renderEquipment();
    });

    // Inventory Tabs (Use | Eqp | Cos | Card | Etc)
    ['use', 'eqp', 'cos', 'card', 'etc'].forEach((tab) => {
      bind(`inven-tab-${tab}`, () => {
        this.inventoryTab = tab;
        document.querySelectorAll('#win-inventory .ro-inven-tab').forEach(t => t.classList.remove('active'));
        document.getElementById(`inven-tab-${tab}`)?.classList.add('active');
        this.renderInventory();
      });
    });

    // Status Attribute increase buttons
    ['str', 'agi', 'vit', 'int', 'dex', 'luk'].forEach((stat) => {
      bind(`stat-inc-${stat}`, () => this.increaseStat(stat));
    });

    // Item Detail Modal close & discard
    bind('item-detail-close', () => this.closeItemDetail());
    bind('item-detail-btn-close', () => this.closeItemDetail());
    bind('item-detail-btn-discard', () => {
      if (this.selectedItem) this.discardItem(this.selectedItem);
    });

    // Job Master Reset Stats
    bind('btn-reset-stats', () => this.resetStats());

    // Warp Modal Mode Tabs (20 Zones vs All 1,272 RO Maps)
    bind('warp-mode-zones', () => {
      this.warpMode = 'zones';
      document.getElementById('warp-mode-zones')?.classList.add('active');
      document.getElementById('warp-mode-allmaps')?.classList.remove('active');
      document.getElementById('warp-search-row')?.classList.add('hidden');
      document.getElementById('warp-zone-tabs')?.classList.remove('hidden');
      this.renderWarpModal();
    });
    bind('warp-mode-allmaps', () => {
      this.warpMode = 'allmaps';
      document.getElementById('warp-mode-allmaps')?.classList.add('active');
      document.getElementById('warp-mode-zones')?.classList.remove('active');
      document.getElementById('warp-search-row')?.classList.remove('hidden');
      document.getElementById('warp-zone-tabs')?.classList.add('hidden');
      this.renderWarpModal();
    });
    const warpSearchEl = document.getElementById('warp-map-search');
    if (warpSearchEl) {
      warpSearchEl.oninput = (e) => {
        this.warpSearchQuery = e.target.value || '';
        this.renderWarpModal();
      };
    }

    // Compendium Modal Controls
    const compTabs = document.getElementById('compendium-tabs');
    if (compTabs) {
      compTabs.querySelectorAll('button[data-cat]').forEach(btn => {
        btn.onclick = () => {
          this.compendiumCat = btn.getAttribute('data-cat') || 'weapons';
          this.compendiumPage = 0;
          compTabs.querySelectorAll('button').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          audio.playCoinSound();
          this.renderCompendiumModal();
        };
      });
    }
    const compSearchEl = document.getElementById('compendium-search-input');
    if (compSearchEl) {
      compSearchEl.oninput = (e) => {
        this.compendiumSearch = e.target.value || '';
        this.compendiumPage = 0;
        this.renderCompendiumModal();
      };
    }
    bind('compendium-prev-btn', () => {
      if (this.compendiumPage > 0) {
        this.compendiumPage--;
        this.renderCompendiumModal();
      }
    });
    bind('compendium-next-btn', () => {
      this.compendiumPage++;
      this.renderCompendiumModal();
    });

    // Tool Shop Tabs
    bind('shop-tab-buy', () => {
      this.shopTab = 'buy';
      document.getElementById('shop-tab-buy')?.classList.add('active');
      document.getElementById('shop-tab-sell')?.classList.remove('active');
      this.renderToolShop();
    });
    bind('shop-tab-sell', () => {
      this.shopTab = 'sell';
      document.getElementById('shop-tab-sell')?.classList.add('active');
      document.getElementById('shop-tab-buy')?.classList.remove('active');
      this.renderToolShop();
    });
    bind('btn-sell-all-etc', () => this.sellAllEtc());
  }

  refreshAll() {
    this.recalcStats();
    this.renderBasicInfo();
    this.renderQuickUsableBar();
    this.renderStatusWindow();
    this.renderInventory();
    this.renderEquipment();
    this.renderSkills();
  }

  toggleWindow(name, force) {
    audio.playCoinSound();
    const current = this.activeWindows[name];
    const next = force !== undefined ? force : !current;
    this.activeWindows[name] = next;

    const el = document.getElementById(`win-${name}`);
    if (el) {
      if (next) {
        el.classList.remove('hidden');
        this.refreshAll();
      } else {
        el.classList.add('hidden');
      }
    }
  }

  showROBroadcast(message, type = 'info') {
    const el = document.getElementById('ro-center-broadcast');
    const content = document.getElementById('ro-broadcast-content');
    if (!el || !content) return;

    content.innerHTML = message;
    if (type === 'success') {
      content.style.borderColor = '#2ecc71';
      content.style.color = '#2ecc71';
      content.style.boxShadow = '0 0 25px rgba(46, 204, 113, 0.7)';
    } else if (type === 'fail') {
      content.style.borderColor = '#e74c3c';
      content.style.color = '#ff6b6b';
      content.style.boxShadow = '0 0 25px rgba(231, 76, 60, 0.7)';
    } else {
      content.style.borderColor = '#f1c40f';
      content.style.color = '#fffa65';
      content.style.boxShadow = '0 0 25px rgba(241, 196, 15, 0.65)';
    }

    el.classList.remove('hidden');
    if (this._broadcastTimer) clearTimeout(this._broadcastTimer);
    this._broadcastTimer = setTimeout(() => {
      el.classList.add('hidden');
    }, 3200);
  }

  canCarryWeight(extraWeight = 5) {
    this.recalcStats();
    const curW = this.player.currentWeight || 0;
    const maxW = this.player.maxWeight || 2000;
    return (curW + extraWeight) <= maxW;
  }

  addLootItem(itemData) {
    if (!itemData) return false;
    const itemW = (itemData.weight || 5) * (itemData.count || 1);
    if (!this.canCarryWeight(itemW)) {
      return false;
    }

    if (itemData.type === 'etc') {
      const existing = this.items.etc.find(it => it.id === itemData.id || it.name === itemData.name);
      if (existing) existing.count = (existing.count || 1) + (itemData.count || 1);
      else this.items.etc.push({ ...itemData, count: itemData.count || 1 });
    } else if (itemData.type === 'card') {
      const existing = this.items.card.find(it => it.id === itemData.id);
      if (existing) existing.count = (existing.count || 1) + 1;
      else this.items.card.push({ ...itemData, count: 1 });
    } else if (itemData.type === 'costume' || (itemData.slot && (itemData.slot.startsWith('cos_') || itemData.slot.startsWith('shadow_')))) {
      if (!this.items.cos) this.items.cos = [];
      this.items.cos.push({ ...itemData, type: 'costume', equipped: false });
    } else if (itemData.type === 'equip') {
      this.items.eqp.push({ ...itemData, equipped: false });
    } else if (itemData.type === 'use') {
      const existing = this.items.use.find(it => it.id === itemData.id);
      if (existing) existing.count = (existing.count || 1) + (itemData.count || 1);
      else this.items.use.push({ ...itemData, count: itemData.count || 1 });
    }
    this.recalcStats();
    this.renderQuickUsableBar();
    if (this.activeWindows.inventory) this.renderInventory();
    return true;
  }

  async discardItem(item) {
    if (!item) return;
    if (item.equipped) {
      this.showROAlert('กรุณาถอดอุปกรณ์ก่อนทำการทิ้ง!', 'ทิ้งอุปกรณ์ไม่ได้', '⚠️');
      return;
    }
    const confirmed = await this.showROConfirm(
      `ยืนยันการทิ้ง [${item.name}] เพื่อลดน้ำหนักกระเป๋าหรือไม่?\n\n⚠️ คำเตือน: ไอเทมที่ถูกทิ้งจะไม่สามารถกู้คืนได้`,
      'ยืนยันการทิ้งไอเทม',
      '🗑️'
    );
    if (!confirmed) return;

    for (const key of ['use', 'eqp', 'cos', 'card', 'etc']) {
      const arr = this.items[key] || [];
      const idx = arr.indexOf(item);
      if (idx >= 0) {
        arr.splice(idx, 1);
        break;
      }
    }
    audio.playCoinSound();
    this.closeItemDetail();
    this.refreshAll();
  }

  // Recalculate all RO stats including Job Bonuses, 10-Slot Equipment, 10-Slot Costumes, Random Options, Slotted Cards, CDR & Weight!
  recalcStats() {
    const p = this.player;
    const jDef = JOB_TREES[p.jobId] || JOB_TREES.novice;
    const jb = jDef.bonus || {};
    const st = p.stats || { str: 10, agi: 10, vit: 10, int: 10, dex: 10, luk: 5 };

    let eqAtk = 0, eqMatk = 0, eqDef = 0, eqMdef = 0, eqHp = 0, eqSp = 0;
    let bonusStr = jb.str || 0, bonusAgi = jb.agi || 0, bonusVit = jb.vit || 0;
    let bonusInt = jb.int || 0, bonusDex = jb.dex || 0, bonusLuk = jb.luk || 0;
    let bonusCrit = 0, bonusAspd = 0, bonusHit = 0, bonusFlee = 0, atkPct = 0, matkPct = 0;
    let cdrPct = 0;

    const cardBonuses = { lifestealPct: 0, splashAttack: false, expPct: 0 };

    const allEquipped = [
      ...(this.items.eqp || []).filter(it => it && it.equipped),
      ...(this.items.cos || []).filter(it => it && it.equipped)
    ];

    allEquipped.forEach(it => {
      if (it.atk) eqAtk += it.atk;
      if (it.matk) eqMatk += it.matk;
      if (it.def) eqDef += it.def;
      if (it.mdef) eqMdef += it.mdef;

      // Random Options on equipment/costume
      (it.randomStats || []).forEach(rs => {
        if (rs.stat === 'str') bonusStr += rs.val;
        else if (rs.stat === 'agi') bonusAgi += rs.val;
        else if (rs.stat === 'vit') bonusVit += rs.val;
        else if (rs.stat === 'int') bonusInt += rs.val;
        else if (rs.stat === 'dex') bonusDex += rs.val;
        else if (rs.stat === 'luk') bonusLuk += rs.val;
        else if (rs.stat === 'atk') eqAtk += rs.val;
        else if (rs.stat === 'matk') eqMatk += rs.val;
        else if (rs.stat === 'crit') bonusCrit += rs.val;
        else if (rs.stat === 'aspd') bonusAspd += rs.val;
        else if (rs.stat === 'maxHp') eqHp += rs.val;
        else if (rs.stat === 'cdrPct') cdrPct += rs.val;
      });

      // Slotted Monster Cards inside this equipment
      (it.cards || []).forEach(cId => {
        const cDef = getCardDef(cId);
        if (!cDef || !cDef.stats) return;
        const cs = cDef.stats;
        if (cs.str) bonusStr += cs.str;
        if (cs.agi) bonusAgi += cs.agi;
        if (cs.vit) bonusVit += cs.vit;
        if (cs.int) bonusInt += cs.int;
        if (cs.dex) bonusDex += cs.dex;
        if (cs.luk) bonusLuk += cs.luk;
        if (cs.atk) eqAtk += cs.atk;
        if (cs.matk) eqMatk += cs.matk;
        if (cs.def) eqDef += cs.def;
        if (cs.maxHp) eqHp += cs.maxHp;
        if (cs.maxSp) eqSp += cs.maxSp;
        if (cs.crit) bonusCrit += cs.crit;
        if (cs.aspd) bonusAspd += cs.aspd;
        if (cs.hit) bonusHit += cs.hit;
        if (cs.flee) bonusFlee += cs.flee;
        if (cs.atkPct) atkPct += cs.atkPct;
        if (cs.matkPct) matkPct += cs.matkPct;
        if (cs.cdrPct) cdrPct += cs.cdrPct;
        if (cs.lifestealPct) cardBonuses.lifestealPct += cs.lifestealPct;
        if (cs.splashAttack) cardBonuses.splashAttack = true;
        if (cs.expPct) cardBonuses.expPct += cs.expPct;
      });
    });

    p.bonusStats = { str: bonusStr, agi: bonusAgi, vit: bonusVit, int: bonusInt, dex: bonusDex, luk: bonusLuk };
    p.cardBonuses = cardBonuses;
    p.cdrPct = Math.min(68, cdrPct);

    const totStr = st.str + bonusStr;
    const totAgi = st.agi + bonusAgi;
    const totVit = st.vit + bonusVit;
    const totInt = st.int + bonusInt;
    const totDex = st.dex + bonusDex;
    const totLuk = st.luk + bonusLuk;

    const lv = p.baseLv || 1;
    p.weaponAtk = Math.round(eqAtk * (1 + atkPct / 100));
    p.baseAtk = totStr + Math.floor(totDex / 5) + Math.floor(totLuk / 3) + Math.floor(lv * 1.5);
    p.atk = p.baseAtk + p.weaponAtk;

    p.weaponMatk = Math.round(eqMatk * (1 + matkPct / 100));
    p.baseMatk = Math.floor(totInt * 1.6) + Math.floor(totDex / 5) + Math.floor(lv * 1.2);
    p.matk = p.baseMatk + p.weaponMatk;

    p.armorDef = eqDef;
    p.baseDef = totVit + Math.floor(lv / 2);
    p.def = p.baseDef + p.armorDef;

    p.mdef = totInt + Math.floor(totVit / 4) + eqMdef;
    p.hit = 175 + lv + totDex + bonusHit;
    p.flee = 100 + lv + totAgi + bonusFlee;
    p.crit = 1 + Math.floor(totLuk / 3) + bonusCrit;
    p.critical = p.crit;
    p.aspd = Math.min(193, 152 + Math.floor(Math.sqrt(totAgi * 9 + totDex * 2)) + bonusAspd + (p.tempAspdBonus || 0));

    const prevMaxHp = p.maxHp;
    p.maxHp = Math.round((160 + lv * 35 + totVit * 22 + eqHp) * (jDef.hpMod || 1));
    const prevMaxSp = p.maxSp;
    p.maxSp = Math.round((60 + lv * 12 + totInt * 14 + eqSp) * (jDef.spMod || 1));

    // If player was at full HP previously, or hp is missing/invalid, keep full HP!
    if (p.hp === undefined || p.hp === null || !prevMaxHp || p.hp >= prevMaxHp || p.hp <= 0) {
      p.hp = p.maxHp;
    } else {
      p.hp = Math.min(p.maxHp, Math.max(1, p.hp));
    }

    if (p.sp === undefined || p.sp === null || !prevMaxSp || p.sp >= prevMaxSp) {
      p.sp = p.maxSp;
    } else {
      p.sp = Math.min(p.maxSp, Math.max(0, p.sp));
    }

    // Weight Limit Calculation (STR increases maxWeight by +30 per base STR!)
    let totalWeight = 0;
    Object.values(this.items || {}).forEach(arr => {
      (arr || []).forEach(it => {
        if (it) totalWeight += (it.weight || 5) * (it.count || 1);
      });
    });
    p.currentWeight = totalWeight;
    p.maxWeight = 1200 + (st.str || 1) * 30;
  }

  increaseStat(stat) {
    const p = this.player;
    const cur = p.stats[stat] || 1;
    const cost = Math.floor(cur / 10) + 2;
    if ((p.statPoints || 0) >= cost) {
      p.statPoints -= cost;
      p.stats[stat] = cur + 1;
      audio.playCoinSound();
      this.refreshAll();
    }
  }

  resetStats() {
    const p = this.player;
    let refunded = p.statPoints || 0;
    ['str', 'agi', 'vit', 'int', 'dex', 'luk'].forEach(st => {
      let val = p.stats[st] || 1;
      while (val > 1) {
        val--;
        refunded += Math.floor(val / 10) + 2;
      }
      p.stats[st] = 1;
    });
    p.statPoints = Math.max(40, refunded);
    audio.playLevelUpSound();
    this.refreshAll();
  }

  renderBasicInfo() {
    const p = this.player;
    if (!p) return;
    const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
    set('hud-player-name', p.name || 'Novice');
    set('hud-player-zeny', `💰 ${(p.zeny || 0).toLocaleString()} Z`);
    set('hud-player-joblv', `Lv.${p.baseLv || 1} / ${(p.jobName || p.job || 'Novice').split(' (')[0]} / J.Lv.${p.jobLv || 1}`);
    const curHp = (typeof p.hp === 'number') ? Math.max(0, Math.round(p.hp)) : (p.maxHp || 100);
    const maxHp = p.maxHp || 100;
    const curSp = (typeof p.sp === 'number') ? Math.max(0, Math.round(p.sp)) : (p.maxSp || 30);
    const maxSp = p.maxSp || 30;
    set('hud-hp-text', `${curHp} / ${maxHp}`);
    set('hud-sp-text', `${curSp} / ${maxSp}`);

    const hpBar = document.getElementById('hud-hp-bar');
    const spBar = document.getElementById('hud-sp-bar');
    if (hpBar) hpBar.style.width = `${Math.min(100, Math.max(0, Math.round((curHp / maxHp) * 100)))}%`;
    if (spBar) spBar.style.width = `${Math.min(100, Math.max(0, Math.round((curSp / maxSp) * 100)))}%`;
  }

  // Render 4-Slot Quick Usable / Potion Hotbar on screen (usable in Battle & Town!)
  renderQuickUsableBar() {
    const bar = document.getElementById('quick-usable-bar');
    if (!bar) return;
    bar.innerHTML = '';

    const usables = (this.items.use || []).filter(u => u && u.count > 0);
    for (let i = 0; i < 4; i++) {
      const item = usables[i];
      const slot = document.createElement('div');
      slot.className = 'ro-quick-usable-slot';
      if (item) {
        slot.innerHTML = `
          <span class="ro-quick-usable-key">[${i + 1}]</span>
          <img src="${item.icon || 'assets/items/red_potion.png'}" alt="${item.name}" onerror="this.src='assets/items/red_potion.png'" />
          <span class="ro-quick-usable-count">x${item.count}</span>
        `;
        slot.title = `กดใช้ ${item.name} (คีย์ลัด ${i + 1})`;
        slot.onclick = (e) => {
          e.stopPropagation();
          this.useItem(item, true);
        };
      } else {
        slot.innerHTML = `
          <span class="ro-quick-usable-key">[${i + 1}]</span>
          <span style="font-size:9px; color:#94a3b8;">ยา</span>
        `;
        slot.title = 'ช่องใส่ยากดใช้ด่วน (ซื้อยาเพิ่มได้ที่ NPC ร้านค้า)';
      }
      bar.appendChild(slot);
    }
  }

  renderStatusWindow() {
    const p = this.player;
    const st = p.stats;
    const bs = p.bonusStats || {};

    const baseLvEl = document.getElementById('status-base-lv');
    const jobLvEl = document.getElementById('status-job-lv');
    if (baseLvEl) baseLvEl.textContent = p.level || 1;
    if (jobLvEl) jobLvEl.textContent = p.jobLevel || 1;

    ['str', 'agi', 'vit', 'int', 'dex', 'luk'].forEach((stat) => {
      const valEl = document.getElementById(`val-${stat}`);
      const costEl = document.getElementById(`cost-${stat}`);
      if (valEl) valEl.textContent = `${st[stat]} +${bs[stat] || 0}`;
      if (costEl) costEl.textContent = `${Math.floor(st[stat] / 10) + 2}`;
    });

    const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
    set('val-atk', `${p.baseAtk} + ${p.weaponAtk}`);
    set('val-matk', `${p.baseMatk} + ${p.weaponMatk}`);
    set('val-def', `${p.baseDef} + ${p.armorDef}`);
    set('val-mdef', `${p.mdef} (CDR -${p.cdrPct || 0}%)`);
    set('val-hit', `${p.hit}`);
    set('val-flee', `${p.flee}`);
    set('val-crit', `${p.crit}%`);
    set('val-aspd', `${p.aspd}`);
    set('val-status-pts', `${p.statPoints || 0}`);
  }

  renderEquipment() {
    const leftCol = document.getElementById('equip-col-left');
    const rightCol = document.getElementById('equip-col-right');
    const dollImg = document.getElementById('equip-doll-sprite');
    const dollJob = document.getElementById('equip-doll-job');
    const avatarImg = document.getElementById('char-avatar-img');
    if (!leftCol || !rightCol) return;

    leftCol.innerHTML = '';
    rightCol.innerHTML = '';

    const g = (this.player.gender === 'female' || this.player.gender === 'f' || this.player.gender === 'F') ? 'f' : 'm';
    const job = this.player.jobId || this.player.classKey || 'novice';
    const hs = this.player.hairStyle || 1;
    const color = this.player.hairColor || 'blonde';
    const charSpriteUrl = `/grf/character/${job}_${g}_h${hs}_c${color}_stand_d0_0.png`;

    if (avatarImg) {
      avatarImg.src = charSpriteUrl;
      avatarImg.onerror = () => { avatarImg.src = `assets/sprites/class_${job}_0.png`; };
    }

    if (dollImg) {
      dollImg.src = charSpriteUrl;
      dollImg.onerror = () => {
        dollImg.src = `assets/sprites/class_${job}_0.png`;
      };
      dollImg.style.filter = 'none';
    }
    if (dollJob) dollJob.textContent = (this.player.jobName || this.player.job || 'Novice').split(' (')[0];

    const isCostumeMode = this.equipMode === 'costume';
    const slotsConfig = isCostumeMode ? COSTUME_SLOTS_10 : EQUIP_SLOTS_10;
    const sourceList = isCostumeMode ? (this.items.cos || []) : (this.items.eqp || []);

    const slotIconMap = {
      head_top: '👑', head_mid: '👓', head_low: '🧣',
      armor: '🥋', weapon: '⚔️', shield: '🛡️',
      garment: '🧥', shoes: '👢', acc1: '💍', acc2: '📿',
      cos_top: '👑', cos_mid: '🕶️', cos_low: '🌸', cos_garment: '🦋',
      shadow_armor: '🛡️', shadow_weapon: '🗡️', shadow_shield: '🛡️',
      shadow_shoes: '🥾', shadow_earring: '✨', shadow_pendant: '🔮'
    };

    slotsConfig.forEach(slotDef => {
      const equipped = sourceList.find(it => it && it.equipped && it.slot === slotDef.key);
      const box = document.createElement('div');
      box.className = `ro-char-slot-btn ${equipped ? 'has-item' : 'empty-slot'}`;
      box.title = equipped ? `${equipped.name} (${slotDef.th || slotDef.label})` : (slotDef.th || slotDef.label);

      if (equipped) {
        const refineTag = (equipped.refine > 0) ? `<span class="ro-slot-refine-tag">+${equipped.refine}</span>` : '';
        box.innerHTML = `
          <img src="${equipped.icon}" alt="${equipped.name}" onerror="this.src='assets/items/sword.png'" />
          ${refineTag}
        `;
        box.onclick = () => this.openItemDetail(equipped);
      } else {
        box.innerHTML = `<span class="ro-slot-empty-icon">${slotIconMap[slotDef.key] || '◇'}</span>`;
        box.onclick = () => {
          this.toggleWindow('inventory');
          this.switchInventoryTab(isCostumeMode ? 'cos' : 'eqp');
        };
      }

      if (slotDef.side === 'left') leftCol.appendChild(box);
      else rightCol.appendChild(box);
    });
  }

  renderInventory() {
    const grid = document.getElementById('inven-slots-grid');
    if (!grid) return;
    grid.innerHTML = '';

    if (this.inventoryTab === 'etc') {
      this.consolidateEtcItems();
    }

    const list = this.items[this.inventoryTab] || [];

    const slotCount = Math.max(35, Math.ceil((list.length + 5) / 7) * 7);
    for (let i = 0; i < slotCount; i++) {
      const rawItem = list[i];
      const cardLookup = rawItem && rawItem.type === 'card' ? getCardDef(rawItem.id) : null;
      const item = cardLookup ? Object.assign(rawItem, cardLookup) : rawItem;
      const slot = document.createElement('div');
      slot.className = 'ro-inven-slot';

      if (item) {
        const iconSrc = item.type === 'card' ? 'assets/ui/card_blank.png' : (item.icon || 'assets/ui/btn_ok.png');
        const countDisplay = (item.count && (item.count > 1 || item.type === 'etc' || item.type === 'use')) ? `<span class="inven-item-count">${item.count}</span>` : '';
        slot.innerHTML = `
          <div class="inven-item-icon">
            <img src="${iconSrc}" alt="${item.name}" onerror="this.src='assets/ui/btn_ok.png'" />
          </div>
          ${countDisplay}
          ${item.equipped ? `<span class="inven-item-eqp">E</span>` : ''}
        `;
        slot.title = item.name;
        slot.onclick = () => this.openItemDetail(item);
      } else {
        slot.innerHTML = `<div class="inven-empty-circle"></div>`;
      }
      grid.appendChild(slot);
    }

    const curW = this.player.currentWeight || 0;
    const maxW = this.player.maxWeight || 2000;
    const weightEl = document.getElementById('inven-weight-text');
    if (weightEl) {
      weightEl.textContent = `${curW}/${maxW}`;
      weightEl.style.color = curW >= maxW ? '#e74c3c' : '#2f3542';
    }
    const zenyEl = document.getElementById('inven-zeny-text');
    if (zenyEl) zenyEl.textContent = `${(this.player.zeny || 0).toLocaleString()} Z`;
  }

  openItemDetail(rawItem) {
    if (!rawItem) return;
    const cardLookup = rawItem.type === 'card' ? getCardDef(rawItem.id) : null;
    const item = cardLookup ? Object.assign(rawItem, cardLookup) : rawItem;
    this.selectedItem = item;
    audio.playCoinSound();

    const modal = document.getElementById('modal-item-detail');
    if (!modal) return;

    const titleEl = document.getElementById('item-detail-title');
    const headerEl = document.getElementById('item-detail-header-name');
    const imgEl = document.getElementById('item-detail-collection-img');
    const slotsEl = document.getElementById('item-detail-card-slots');
    const descEl = document.getElementById('item-detail-desc-content');
    const compoundBox = document.getElementById('item-compound-target-box');
    const actionBtn = document.getElementById('item-detail-btn-action');
    const discardBtn = document.getElementById('item-detail-btn-discard');

    if (compoundBox) {
      compoundBox.classList.add('hidden');
      compoundBox.innerHTML = '';
    }
    if (discardBtn) {
      discardBtn.style.display = item.equipped ? 'none' : 'inline-block';
    }

    if (titleEl) titleEl.textContent = item.name || 'รายละเอียดไอเทม';
    if (headerEl) headerEl.textContent = item.name || 'รายละเอียดไอเทม';
    if (imgEl) {
      imgEl.src = item.art || item.collection || item.icon || 'assets/ui/card_blank.png';
      imgEl.onerror = () => { imgEl.src = item.icon || 'assets/ui/card_blank.png'; };
      imgEl.alt = item.name || 'Item';
    }

    if (slotsEl) {
      const maxSlots = item.slots || item.slotCount || 0;
      const cards = item.cards || [];
      let slotsHtml = '';
      for (let i = 0; i < maxSlots; i++) {
        const hasCard = i < cards.length;
        const cDef = hasCard ? getCardDef(cards[i]) : null;
        const cName = cDef ? cDef.name : 'Empty Slot';
        slotsHtml += `<span class="card-slot ${hasCard ? 'slotted' : ''}" title="${cName}">◆</span>`;
      }
      slotsEl.innerHTML = slotsHtml;
    }

    const TARGET_SLOT_TH = {
      weapon: 'อาวุธ (Right Hand Weapon)',
      shield: 'โล่ (Left Hand Shield)',
      armor: 'เสื้อเกราะ (Armor)',
      garment: 'ผ้าคลุม (Garment)',
      shoes: 'รองเท้า (Footgear)',
      head_top: 'หมวก (Headgear บน/กลาง)',
      accessory: 'เครื่องประดับ (Accessory 1/2)'
    };

    if (descEl) {
      let html = '';
      if (item.desc || item.effectDesc) {
        html += `<div class="ro-item-effect-text" style="white-space:pre-line;">${item.desc || item.effectDesc}</div><hr class="ro-item-divider" />`;
      }
      if (item.slot) {
        const allSlots = [...EQUIP_SLOTS_10, ...COSTUME_SLOTS_10];
        const slotInfo = allSlots.find(s => s.key === item.slot);
        html += `<div class="ro-item-meta-line"><span class="ro-item-label">ตำแหน่งสวมใส่:</span><span class="ro-item-val">${slotInfo ? slotInfo.label : item.slot}</span></div>`;
        html += `<div class="ro-item-meta-line"><span class="ro-item-label">ระดับอุปกรณ์:</span><span class="ro-item-val">Lv.${item.tier || 1} | ตีบวก +${item.refine || 0}/10</span></div>`;
      }
      if (item.targetSlot) {
        const targetLabel = TARGET_SLOT_TH[item.targetSlot] || item.posTh || item.targetSlot.toUpperCase();
        html += `<div class="ro-item-meta-line"><span class="ro-item-label">สวมใส่กับอุปกรณ์:</span><span class="ro-item-val" style="font-weight:bold; color:#b45309;">${targetLabel}</span></div>`;
      }

      if (item.stats && typeof item.stats === 'object') {
        const cs = item.stats;
        const statLines = [];
        if (cs.atk) statLines.push(`ATK +${cs.atk}`);
        if (cs.atkPct) statLines.push(`พลังโจมตีกายภาพ (ATK) +${cs.atkPct}%`);
        if (cs.matk) statLines.push(`MATK +${cs.matk}`);
        if (cs.matkPct) statLines.push(`พลังโจมตีเวท (MATK) +${cs.matkPct}%`);
        if (cs.def) statLines.push(`DEF +${cs.def}`);
        if (cs.str) statLines.push(`STR +${cs.str}`);
        if (cs.agi) statLines.push(`AGI +${cs.agi}`);
        if (cs.vit) statLines.push(`VIT +${cs.vit}`);
        if (cs.int) statLines.push(`INT +${cs.int}`);
        if (cs.dex) statLines.push(`DEX +${cs.dex}`);
        if (cs.luk) statLines.push(`LUK +${cs.luk}`);
        if (cs.crit) statLines.push(`CRITICAL +${cs.crit}%`);
        if (cs.aspd) statLines.push(`ความเร็วโจมตี (ASPD) +${cs.aspd}`);
        if (cs.flee) statLines.push(`หลบหลีก (FLEE) +${cs.flee}`);
        if (cs.hit) statLines.push(`แม่นยำ (HIT) +${cs.hit}`);
        if (cs.maxHp) statLines.push(`MaxHP +${cs.maxHp}`);
        if (cs.maxSp) statLines.push(`MaxSP +${cs.maxSp}`);
        if (cs.cdrPct) statLines.push(`ลดคูลดาวน์สกิล (Skill Cooldown) -${cs.cdrPct}%`);
        if (cs.lifestealPct) statLines.push(`ดูดเลือด ${cs.lifestealPct}% ของดาเมจ`);
        if (cs.splashAttack) statLines.push(`โจมตีธรรมดากระจาย 9 ช่องรอบเป้าหมาย`);
        if (cs.expPct) statLines.push(`EXP ที่ได้รับ +${cs.expPct}%`);

        if (statLines.length) {
          html += `<div style="margin-top:5px; font-weight:bold; color:#15803d;">📊 ค่าสถานะของการ์ดใบนี้:</div>`;
          statLines.forEach(line => {
            html += `<div style="color:#166534; font-weight:bold; font-size:11px;">✦ ${line}</div>`;
          });
        }
      }

      if (item.atk) html += `<div class="ro-item-meta-line"><span class="ro-item-label">พลังโจมตี (ATK):</span><span class="ro-item-val">+${item.atk}</span></div>`;
      if (item.matk) html += `<div class="ro-item-meta-line"><span class="ro-item-label">พลังเวท (MATK):</span><span class="ro-item-val">+${item.matk}</span></div>`;
      if (item.def) html += `<div class="ro-item-meta-line"><span class="ro-item-label">ป้องกัน (DEF):</span><span class="ro-item-val">+${item.def}</span></div>`;
      html += `<div class="ro-item-meta-line"><span class="ro-item-label">น้ำหนัก (Weight):</span><span class="ro-item-val">${item.weight || 5} หน่วย</span></div>`;

      if (item.slots !== undefined && (item.type === 'equip' || item.type === 'costume')) {
        html += `<div class="ro-item-meta-line"><span class="ro-item-label">ช่องใส่การ์ด:</span><span class="ro-item-val">${(item.cards || []).length} / ${item.slots} ช่อง [◆]</span></div>`;
      }

      if (item.randomStats && item.randomStats.length) {
        html += `<div style="margin-top:5px; font-weight:bold; color:#0984e3;">✨ ออปชั่นเสริม (Bonus Stats):</div>`;
        item.randomStats.forEach(rs => {
          html += `<div style="color:#0984e3; font-size:10px; font-weight:bold;">• ${rs.label}</div>`;
        });
      }

      if (item.cards && item.cards.length) {
        html += `<div style="margin-top:6px; font-weight:bold; color:#d35400;">🃏 การ์ดที่ฝังในอุปกรณ์ (${item.cards.length}/${item.slots}):</div>`;
        item.cards.forEach(cId => {
          const cDef = getCardDef(cId);
          if (cDef) html += `<div style="color:#d35400; font-size:10px; font-weight:bold;">◆ ${cDef.name}</div>`;
        });
      }

      descEl.innerHTML = html;
    }

    if (actionBtn) {
      actionBtn.className = 'ro-btn-item-action';
      const isEquip = item.type === 'equip' || item.type === 'costume' || !!item.slot;
      if (isEquip) {
        if (item.equipped) {
          actionBtn.textContent = 'ถอดอุปกรณ์ (Unequip)';
          actionBtn.classList.add('unequip');
          actionBtn.onclick = () => this.unequipItem(item);
        } else {
          actionBtn.textContent = 'สวมใส่ (Equip)';
          actionBtn.onclick = () => this.equipItem(item);
        }
      } else if (item.type === 'card') {
        actionBtn.textContent = '🃏 นำการ์ดใส่ในอุปกรณ์ (Compound)';
        actionBtn.onclick = () => this.showCardCompoundTargets(item);
      } else if (item.type === 'use') {
        actionBtn.textContent = 'ใช้งาน (Use)';
        actionBtn.onclick = () => this.useItem(item);
      } else {
        actionBtn.textContent = 'ปิด (Close)';
        actionBtn.onclick = () => this.closeItemDetail();
      }
    }

    modal.classList.remove('hidden');
  }

  showCardCompoundTargets(cardItem) {
    const compoundBox = document.getElementById('item-compound-target-box');
    if (!compoundBox) return;
    compoundBox.classList.remove('hidden');

    const allGear = [...(this.items.eqp || []), ...(this.items.cos || [])];
    const compatible = allGear.filter(eq => {
      const openSlots = (eq.slots || 0) - ((eq.cards && eq.cards.length) || 0);
      if (openSlots <= 0) return false;
      if (cardItem.targetSlot === 'accessory') return eq.slot === 'acc1' || eq.slot === 'acc2' || eq.slot === 'shadow_earring' || eq.slot === 'shadow_pendant';
      if (cardItem.targetSlot === 'head_top') return eq.slot === 'head_top' || eq.slot === 'head_mid' || eq.slot === 'cos_top' || eq.slot === 'cos_mid';
      return eq.slot === cardItem.targetSlot;
    });

    if (!compatible.length) {
      compoundBox.innerHTML = `<div class="ro-compound-title">⚠️ ไม่มีอุปกรณ์ตำแหน่ง [${(cardItem.targetSlot || 'weapon').toUpperCase()}] ที่มีช่องการ์ด [◆] ว่างในช่องเก็บของ</div>`;
      return;
    }

    let html = `<div class="ro-compound-title">เลือกอุปกรณ์ที่ต้องการฝัง [${cardItem.name}]:</div>`;
    compatible.forEach((eq, idx) => {
      const used = (eq.cards && eq.cards.length) || 0;
      html += `<button class="ro-compound-item-btn" data-eqidx="${idx}">
        <span>${eq.equipped ? '🛡️ [สวมใส่] ' : '🎒 '}${eq.name}</span>
        <span>ช่องว่าง [${used}/${eq.slots}◆] ➔ กดใส่การ์ด</span>
      </button>`;
    });
    compoundBox.innerHTML = html;

    compoundBox.querySelectorAll('.ro-compound-item-btn').forEach((btn, idx) => {
      btn.onclick = () => this.compoundCardIntoEquipment(cardItem, compatible[idx]);
    });
  }

  async compoundCardIntoEquipment(cardItem, targetEquip) {
    if (!cardItem || !targetEquip) return;
    if (!targetEquip.cards) targetEquip.cards = [];
    if (targetEquip.cards.length >= (targetEquip.slots || 0)) return;

    const confirmed = await this.showROConfirm(
      `ยืนยันการนำการ์ด [${cardItem.name}]\nใส่ลงในอุปกรณ์ [${targetEquip.name}] หรือไม่?\n\n⚠️ เมื่อกดยืนยัน การ์ดใบนี้จะหายไปจากช่องเก็บของและฝังอยู่ในช่อง [◆] ของอุปกรณ์ถาวร!`,
      'ยืนยันการใส่การ์ดลงอุปกรณ์',
      '🃏'
    );
    if (!confirmed) return;

    targetEquip.cards.push(cardItem.id);
    if (cardItem.prefix && !targetEquip.name.includes(cardItem.prefix)) {
      targetEquip.name = `${cardItem.prefix} ${targetEquip.name}`;
    }

    if (cardItem.count > 1) {
      cardItem.count--;
    } else {
      const idx = this.items.card.indexOf(cardItem);
      if (idx >= 0) this.items.card.splice(idx, 1);
    }

    audio.playLevelUpSound();
    this.refreshAll();
    this.openItemDetail(targetEquip);
  }

  closeItemDetail() {
    document.getElementById('modal-item-detail')?.classList.add('hidden');
    this.selectedItem = null;
  }

  equipItem(item) {
    if (!item || !item.slot) return;
    const slotKey = item.slot;
    const isCostume = item.type === 'costume' || slotKey.startsWith('cos_') || slotKey.startsWith('shadow_');
    const targetList = isCostume ? (this.items.cos || []) : (this.items.eqp || []);

    targetList.forEach(other => {
      if (other.slot === slotKey && other.equipped) {
        other.equipped = false;
      }
    });
    item.equipped = true;
    audio.playLevelUpSound();
    this.refreshAll();
    this.openItemDetail(item);
  }

  unequipItem(item) {
    if (!item) return;
    item.equipped = false;
    audio.playCoinSound();
    this.refreshAll();
    this.openItemDetail(item);
  }

  useItem(item, fromQuickBar = false) {
    const p = this.player;
    const battle = window.gameApp?.battleArena || window.gameApp?.battle;
    if (item.effect === 'hp' || !item.effect) {
      const val = item.val || 120;
      p.hp = Math.min(p.maxHp, p.hp + val);
      if (battle && battle.player) {
        battle.player.hp = Math.min(battle.player.maxHp, battle.player.hp + val);
        p.hp = battle.player.hp;
        battle.spawnDamageNumber(battle.player.x, battle.player.y - 25, `+${val} HP`, '#2ecc71', true);
      }
      audio.playCastSound('holy');
    } else if (item.effect === 'sp') {
      const val = item.val || 80;
      p.sp = Math.min(p.maxSp, p.sp + val);
      if (battle && battle.player) {
        battle.player.sp = Math.min(battle.player.maxSp, battle.player.sp + val);
        p.sp = battle.player.sp;
        battle.spawnDamageNumber(battle.player.x, battle.player.y - 25, `+${val} SP`, '#74b9ff', true);
      }
      audio.playCoinSound();
    } else if (item.effect === 'buff_aspd') {
      p.tempAspdBonus = item.val || 15;
      if (battle && battle.player) {
        battle.spawnDamageNumber(battle.player.x, battle.player.y - 30, `⚡ ASPD +${item.val || 15}!`, '#ffeaa7', true);
      }
      audio.playLevelUpSound();
    }

    if (item.count > 1) {
      item.count--;
      if (!fromQuickBar && this.selectedItem === item) this.openItemDetail(item);
    } else {
      const idx = this.items.use.indexOf(item);
      if (idx >= 0) this.items.use.splice(idx, 1);
      if (!fromQuickBar) this.closeItemDetail();
    }
    this.refreshAll();
  }

  // ==========================================================================
  // Skills Window (All-RO Class Tier Pool + Reset Skills with Zeny)
  // ==========================================================================
  getSkillResetCost() {
    const myTier = this.player.tier || 0;
    return (myTier + 1) * 8000;
  }

  getSkillRerollCost() {
    const myTier = this.player.tier || 0;
    return (myTier + 1) * 2000;
  }

  async resetSkillsWithZeny() {
    const p = this.player;
    const cost = this.getSkillResetCost();
    if ((p.zeny || 0) < cost) {
      this.showROAlert(`เงิน Zeny ไม่พอสำหรับการรีเซ็ตสกิล!\n(ต้องใช้ ${cost.toLocaleString()} Z ตามคลาสของคุณ)`, 'เงิน Zeny ไม่พอ', '💰');
      return;
    }
    const confirmed = await this.showROConfirm(
      `ยืนยันการรีเซ็ตสกิลทั้งหมดโดยจ่าย ${cost.toLocaleString()} Zeny หรือไม่?\n(คืนแต้ม Skill Points ทั้งหมดให้เลือกอัพใหม่ได้ทันที)`,
      'รีเซ็ตแต้มสกิล',
      '🔄'
    );
    if (!confirmed) return;

    p.zeny -= cost;
    let totalSpentPts = 0;
    for (const lv of Object.values(p.skills || {})) {
      if (lv > 0) totalSpentPts += lv;
    }
    p.skills = {};
    p.skillPoints = (p.skillPoints || 0) + Math.max(2, totalSpentPts);

    const battle = window.gameApp?.battle;
    if (battle && battle.skillManager) {
      battle.player.zeny = p.zeny;
      battle.skillManager.skills.clear();
      battle.skillManager.cooldowns.clear();
    }

    audio.playLevelUpSound();
    this.refreshAll();
  }

  renderSkills() {
    const listEl = document.getElementById('skills-list-container');
    const branchLbl = document.getElementById('skills-branch-label');
    const resetBtn = document.getElementById('btn-reset-skills');
    if (!listEl) return;

    const p = this.player;
    const myTier = p.tier ?? 0;

    if (resetBtn) {
      resetBtn.textContent = `🔄 รีเซ็ตสกิล (${this.getSkillResetCost().toLocaleString()} Z)`;
    }

    let offCount = 0;
    let supCount = 0;
    const learnedSkills = [];

    Object.entries(p.skills || {}).forEach(([skId, lv]) => {
      if (lv > 0 && SKILL_DEFS[skId]) {
        const def = SKILL_DEFS[skId];
        if (def.category === 'offensive') offCount++;
        else supCount++;
        // Auto scale level with Job Level
        const autoLv = Math.min(10, Math.max(1, (lv || 1) + Math.floor(((p.jobLv || p.jobLevel || 1) - 1) / 5)));
        learnedSkills.push({ ...def, level: autoLv });
      }
    });

    const maxSlots = getMaxSlots(myTier);
    if (branchLbl) {
      branchLbl.textContent = `${(p.jobName || p.job).split(' (')[0]} (คลาส ${myTier}) | ⚔️ โจมตี ${offCount}/${maxSlots} | ✨ ซัพพอร์ต ${supCount}/${maxSlots}`;
    }

    listEl.innerHTML = '';

    // If player has not learned any skills yet, display clear guide!
    if (learnedSkills.length === 0) {
      listEl.innerHTML = `
        <div style="padding: 36px 16px; text-align: center; color: #94a3b8;">
          <div style="font-size: 32px; margin-bottom: 8px;">📜</div>
          <div style="font-weight: bold; font-size: 13px; color: #e2e8f0; margin-bottom: 4px;">ยังไม่มีสกิลที่เรียนรู้</div>
          <div style="font-size: 11px; color: #64748b; line-height: 1.5;">
            สกิลจะปรากฏที่นี่เมื่อคุณเลือกการ์ดสกิลจากการเลเวลอัพในการต่อสู้<br>
            (เลเวลและพลังของสกิลจะเพิ่มขึ้นอัตโนมัติตามระดับ Job Level)
          </div>
        </div>
      `;
      return;
    }

    // Render ONLY learned skills
    learnedSkills.forEach(sk => {
      const isOff = sk.category === 'offensive';
      const cdSec = ((sk.baseCooldown * (1 - (p.cdrPct || 0) / 100)) / 1000).toFixed(1);
      const row = document.createElement('div');
      row.className = 'ro-skill-row';
      row.innerHTML = `
        <div class="skill-row-icon">
          <img src="${sk.iconImg}" alt="${sk.name}" onerror="this.src='assets/ui/btn_ok.png'" />
        </div>
        <div class="skill-row-info" style="flex:1;">
          <div class="skill-row-title">
            <span class="skill-name">${sk.name}</span>
            <span class="skill-job" style="color:${isOff ? '#e74c3c' : '#74b9ff'}; font-weight:bold;">
              [${isOff ? '⚔️ โจมตี' : '✨ ซัพพอร์ต'} คลาส ${sk.tier} | Lv.${sk.level}/10]
            </span>
          </div>
          <div class="skill-row-desc">${sk.desc}</div>
          <div class="skill-row-meta">⏱️ คูลดาวน์: ${cdSec}s | พลังโจมตี/เอฟเฟกต์เพิ่มขึ้นตาม J.Lv.${p.jobLv || p.jobLevel || 1}</div>
        </div>
        <div class="skill-row-badge" style="padding:4px 8px; font-size:10px; font-weight:bold; background:#1e293b; color:#22c55e; border:1px solid #334155; border-radius:4px;">
          ✓ เรียนรู้แล้ว
        </div>
      `;
      listEl.appendChild(row);
    });
  }

  // ==========================================================================
  // NPC 1: Warp NPC - 20 Regional Zones + All 1,272 RO Maps (Strict Boss-Kill Lock!)
  // ==========================================================================
  openWarpModal() {
    const modal = document.getElementById('modal-warp-zones');
    if (!modal) return;
    this.renderWarpModal();
    modal.classList.remove('hidden');
  }

  renderWarpModal() {
    const tabsEl = document.getElementById('warp-zone-tabs');
    const headerEl = document.getElementById('warp-zone-header');
    const gridEl = document.getElementById('warp-stages-grid');
    if (!tabsEl || !headerEl || !gridEl) return;

    const maxUnlocked = this.player.maxUnlockedStage || 1;

    if (this.warpMode === 'allmaps') {
      const q = (this.warpSearchQuery || '').trim().toLowerCase();
      const allMaps = RO_DB.maps || [];
      const filtered = q
        ? allMaps.filter(m => m.code.toLowerCase().includes(q) || m.name.toLowerCase().includes(q) || (m.region && m.region.toLowerCase().includes(q)))
        : allMaps;

      headerEl.innerHTML = `
        <div><strong>🌍 แผนที่ RO ทั้งหมดในไฟล์เกม: ${filtered.length.toLocaleString()} / ${allMaps.length.toLocaleString()} แผนที่</strong></div>
        <div style="color:#ffeaa7;">🔓 ด่านที่ปลดล็อกแล้ว: ด่าน 1 ถึง ด่าน ${maxUnlocked} (ต้องฆ่าบอสเพื่อปลดล็อกด่านถัดไป!)</div>
      `;

      gridEl.innerHTML = '';
      filtered.slice(0, 60).forEach((m) => {
        const stageNum = allMaps.indexOf(m) + 1;
        const isLocked = stageNum > maxUnlocked;
        const card = document.createElement('button');
        card.className = 'ro-stage-card-btn';
        card.style.display = 'flex';
        card.style.alignItems = 'center';
        card.style.gap = '8px';
        if (isLocked) card.style.opacity = '0.58';
        card.innerHTML = `
          <img src="/grf/map/${m.bmpCode || m.code}.png" alt="${m.code}" style="width:42px;height:42px;object-fit:cover;border-radius:4px;border:1px solid #475569;background:#0f172a;" onerror="this.src='assets/zones/zone_01.png'" />
          <div style="flex:1; text-align:left;">
            <div class="stage-card-top">
              <span>🗺️ ด่าน #${stageNum} ${m.name} (${m.code})</span>
              <span style="color:${isLocked ? '#dc2626' : '#16a34a'};">${isLocked ? '🔒 ล็อก' : '⚔️ ลุยด่าน'}</span>
            </div>
            <div class="stage-card-sub">${isLocked ? `ต้องปราบบอสด่านที่ ${stageNum - 1} ก่อนจึงจะเปิด!` : `โซน: ${m.region || 'Rune-Midgarts'} | BGM: ${m.bgm || '08.mp3'}`}</div>
          </div>
        `;
        card.onclick = () => {
          if (isLocked) {
            this.showROAlert(`🔒 ด่านที่ ${stageNum} ยังไม่เปิด!\nคุณต้องสังหารบอสและเคลียร์ด่านที่ ${stageNum - 1} ให้สำเร็จก่อน (ปัจจุบันปลดล็อกถึงด่านที่ ${maxUnlocked})`, 'ด่านยังไม่เปิด', '🔒');
            return;
          }
          audio.playCoinSound();
          if (window.gameApp) {
            window.gameApp.warpToStage(stageNum, m.code);
          }
        };
        gridEl.appendChild(card);
      });
      return;
    }

    tabsEl.innerHTML = '';
    ZONES_20.forEach((z, idx) => {
      const firstStageInZone = idx * 10 + 1;
      const zoneLocked = firstStageInZone > maxUnlocked;
      const btn = document.createElement('button');
      btn.className = `ro-zone-tab-btn ${this.selectedWarpZoneIdx === idx ? 'active' : ''}`;
      btn.textContent = `${zoneLocked ? '🔒 ' : ''}Zone ${z.zoneId} (Lv.${z.lvRange})`;
      btn.onclick = () => {
        this.selectedWarpZoneIdx = idx;
        audio.playCoinSound();
        this.renderWarpModal();
      };
      tabsEl.appendChild(btn);
    });

    const zone = ZONES_20[this.selectedWarpZoneIdx] || ZONES_20[0];
    const zoneMapsCount = (zone.roMaps && zone.roMaps.length) || 10;
    headerEl.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;">
        <img src="/grf/map/${zone.mapCode}.png" style="width:36px;height:36px;border-radius:4px;border:1px solid #fbbf24;" onerror="this.style.display='none'" />
        <div>
          <div><strong>🗺️ โซนที่ ${zone.zoneId}: ${zone.name}</strong> (รวม ${zoneMapsCount} แผนที่ในเขตนี้)</div>
          <div style="color:#ffeaa7;">Lv. มอนสเตอร์: ${zone.lvRange} | 🔓 ปลดล็อกถึงด่านที่: ${maxUnlocked}</div>
        </div>
      </div>
    `;

    gridEl.innerHTML = '';
    for (let s = 1; s <= 10; s++) {
      const stageNum = this.selectedWarpZoneIdx * 10 + s;
      const info = getStageInfo(stageNum);
      const isMvp = s === 10;
      const isMini = s === 5;
      const isLocked = stageNum > maxUnlocked;
      const card = document.createElement('button');
      card.className = `ro-stage-card-btn ${isMvp ? 'mvp-stage' : (isMini ? 'boss-stage' : '')}`;
      if (isLocked) card.style.opacity = '0.58';
      card.innerHTML = `
        <div class="stage-card-top">
          <span>${isLocked ? '🔒' : '🚩'} ด่านที่ ${stageNum} (${info.mapCode})</span>
          <span style="color:${isLocked ? '#dc2626' : ''};">${isLocked ? '🔒 ต้องฆ่าบอสด่านก่อนหน้า' : (isMvp ? '👑 MVP BOSS' : (isMini ? '⭐ Mini-Boss' : '⚔️ ลุยด่าน'))}</span>
        </div>
        <div class="stage-card-sub">มอนสเตอร์: ${info.monsters.slice(0, 4).join(', ')} | บอสประจำด่าน: ${info.bossType}</div>
      `;
      card.onclick = () => {
        if (isLocked) {
          this.showROAlert(`🔒 ด่านที่ ${stageNum} (${info.mapCode}) ยังไม่เปิด!\nคุณต้องปราบบอสประจำด่านที่ ${stageNum - 1} ให้สำเร็จก่อนจึงจะปลดล็อกด่านนี้ได้`, 'ด่านยังไม่เปิด', '🔒');
          return;
        }
        audio.playCoinSound();
        if (window.gameApp) {
          window.gameApp.warpToStage(stageNum, info.mapCode);
        }
      };
      gridEl.appendChild(card);
    }
  }

  // ==========================================================================
  // Full RO Client Database Compendium Modal (29,368 Items + 1,272 Maps)
  // ==========================================================================
  openCompendiumModal() {
    const modal = document.getElementById('modal-ro-compendium');
    if (!modal) return;
    audio.playCoinSound();
    this.renderCompendiumModal();
    modal.classList.remove('hidden');
  }

  renderCompendiumModal() {
    const listEl = document.getElementById('compendium-list');
    const pageInfoEl = document.getElementById('compendium-page-info');
    if (!listEl) return;

    const cat = this.compendiumCat || 'weapons';
    const rawList = RO_DB[cat] || [];
    const q = (this.compendiumSearch || '').trim().toLowerCase();

    const filtered = q
      ? rawList.filter(it => {
          const name = (it.name || '').toLowerCase();
          const code = (it.code || String(it.id || '')).toLowerCase();
          const desc = (it.desc || it.posTh || it.region || '').toLowerCase();
          return name.includes(q) || code.includes(q) || desc.includes(q);
        })
      : rawList;

    const pageSize = 25;
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    if (this.compendiumPage >= totalPages) this.compendiumPage = totalPages - 1;
    if (this.compendiumPage < 0) this.compendiumPage = 0;

    if (pageInfoEl) {
      pageInfoEl.textContent = `หน้า ${this.compendiumPage + 1}/${totalPages} (${filtered.length.toLocaleString()})`;
    }

    const slice = filtered.slice(this.compendiumPage * pageSize, (this.compendiumPage + 1) * pageSize);
    listEl.innerHTML = '';

    if (!slice.length) {
      listEl.innerHTML = `<div style="padding:18px;text-align:center;color:#64748b;">ไม่พบข้อมูลที่ค้นหา</div>`;
      return;
    }

    slice.forEach(entry => {
      const row = document.createElement('div');
      row.className = 'ro-job-row';

      if (cat === 'maps') {
        const stageNum = RO_DB.maps.indexOf(entry) + 1;
        const isLocked = stageNum > (this.player.maxUnlockedStage || 1);
        row.innerHTML = `
          <div class="job-avatar">
            <img src="/grf/map/${entry.bmpCode || entry.code}.png" alt="${entry.code}" style="width:40px;height:40px;object-fit:cover;border-radius:4px;" onerror="this.src='assets/zones/zone_01.png'" />
          </div>
          <div class="job-info">
            <div class="job-name">🗺️ ด่าน #${stageNum} ${entry.name} (${entry.code}.gnd)</div>
            <div class="job-desc">ทวีป/เขต: ${entry.region || 'Rune-Midgarts'} | เพลง BGM: ${entry.bgm || '08.mp3'}</div>
          </div>
          <button class="btn-job-pick" style="${isLocked ? 'opacity:0.5;' : ''}">${isLocked ? '🔒 ยังไม่ปลดล็อก' : '🌀 วาร์ปไปแมพนี้'}</button>
        `;
        row.querySelector('button').onclick = () => {
          if (isLocked) {
            this.showROAlert(`🔒 ต้องปราบบอสด่านก่อนหน้าเพื่อปลดล็อกถึงด่าน #${stageNum} ก่อน!`, 'ด่านยังไม่ปลดล็อก', '🔒');
            return;
          }
          document.getElementById('modal-ro-compendium')?.classList.add('hidden');
          if (window.gameApp) window.gameApp.warpToStage(stageNum, entry.code);
        };
      } else {
        const iconUrl = cat === 'cards' && entry.hasIllust ? `/grf/card/${entry.id}.png` : `/grf/icon/${entry.id}.png`;
        const metaText = cat === 'weapons'
          ? `ATK +${entry.atk} | อาวุธ Lv.${entry.wLv || 1} | ช่องการ์ด [${entry.slots}] | ${entry.subType}`
          : cat === 'armors'
          ? `DEF +${entry.def} | ช่องการ์ด [${entry.slots}] | ตำแหน่ง: ${entry.posTh}`
          : cat === 'costumes'
          ? `คอสสวมใส่: ${entry.posTh} | DEF +${entry.def}`
          : cat === 'cards'
          ? `ใส่กับ: ${entry.posTh} | ${entry.hasIllust ? 'ภาพการ์ดแท้จาก GRF' : 'การ์ดมอนสเตอร์'}`
          : `น้ำหนัก: ${entry.weight || 5} | ราคา: ${(entry.price || 50).toLocaleString()} Z`;

        row.innerHTML = `
          <div class="job-avatar">
            <img src="${iconUrl}" alt="${entry.name}" style="width:32px;height:32px;object-fit:contain;" onerror="this.src='/grf/icon/${entry.id}.png'" />
          </div>
          <div class="job-info">
            <div class="job-name">[#${entry.id}] ${entry.name}</div>
            <div class="job-desc">${metaText}</div>
            <div class="job-perk" style="font-size:10px;color:#475569;">${(entry.desc || '').split('\n')[0] || ''}</div>
          </div>
        `;
      }
      listEl.appendChild(row);
    });
  }

  // ==========================================================================
  // NPC 2: Progressive Job Master NPC (Shows ONLY next valid step in tree & enforces Job Lv!)
  // ==========================================================================
  openJobMasterModal() {
    const modal = document.getElementById('modal-job-master');
    if (!modal) return;
    this.renderJobMasterModal();
    modal.classList.remove('hidden');
  }

  renderJobMasterModal() {
    const listEl = document.getElementById('job-master-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    const p = this.player;
    const curJobId = p.jobId || 'novice';
    const curJobDef = JOB_TREES[curJobId] || JOB_TREES.novice;
    const curBaseLv = p.baseLv || 1;
    const curJobLv = p.jobLv || 1;

    // Show current job card at the top
    const currentBanner = document.createElement('div');
    currentBanner.style.cssText = 'background:#eff6ff; border:1.5px solid #3b82f6; border-radius:6px; padding:8px 10px; margin-bottom:8px; display:flex; align-items:center; gap:10px;';
    currentBanner.innerHTML = `
      <img src="assets/sprites/class_${curJobDef.sprite}_0.png" style="width:42px;height:56px;object-fit:contain;" />
      <div>
        <div style="font-weight:bold; font-size:12px; color:#1e3a8a;">อาชีพปัจจุบันของคุณ: ${curJobDef.name}</div>
        <div style="font-size:11px; color:#1d4ed8;">Base Lv.${curBaseLv} | <strong>Job Lv.${curJobLv}</strong></div>
      </div>
    `;
    listEl.appendChild(currentBanner);

    // Filter ONLY direct next-step evolutions (parentJob === curJobId)
    const nextJobs = Object.values(JOB_TREES).filter(j => j.parentJob === curJobId);

    if (!nextJobs.length) {
      const doneMsg = document.createElement('div');
      doneMsg.style.cssText = 'padding:16px; text-align:center; color:#15803d; font-weight:bold; background:#f0fdf4; border:1px solid #86efac; border-radius:6px;';
      doneMsg.textContent = '👑 คุณบรรลุคลาสสูงสุด (Class 3) ของสายอาชีพนี้เรียบร้อยแล้ว!';
      listEl.appendChild(doneMsg);
      return;
    }

    nextJobs.forEach(jDef => {
      const reqJLv = jDef.reqJobLv || 10;
      const reqBLv = jDef.reqBaseLv || 1;
      const meetsReq = curJobLv >= reqJLv && curBaseLv >= reqBLv;

      const row = document.createElement('div');
      row.className = 'ro-job-row';
      row.innerHTML = `
        <div class="job-avatar">
          <img src="assets/sprites/class_${jDef.sprite}_0.png" alt="${jDef.name}" />
        </div>
        <div class="job-info">
          <div class="job-name">${jDef.name}</div>
          <div class="job-desc" style="color:${meetsReq ? '#15803d' : '#dc2626'}; font-weight:bold;">
            เงื่อนไขเปลี่ยนอาชีพ: Base Lv.${reqBLv} & Job Lv.${reqJLv} (ของคุณ: Lv.${curBaseLv} / J.Lv.${curJobLv})
          </div>
          <div class="job-perk">ชุดอาชีพ RO แท้ + ปลดล็อกสกิลระดับคลาส ${jDef.tier} ทั้งหมดในเกม!</div>
        </div>
        <button class="btn-job-pick" style="${meetsReq ? 'background:#16a34a; border-color:#15803d;' : 'background:#94a3b8; border-color:#64748b; cursor:not-allowed;'}">
          ${meetsReq ? '⚔️ เปลี่ยนอาชีพ' : `🔒 ต้อง J.Lv.${reqJLv}`}
        </button>
      `;
      row.querySelector('button').onclick = () => {
        if (!meetsReq) {
          this.showROAlert(`⚠️ ยังไม่สามารถเปลี่ยนเป็น [${jDef.name}] ได้!\nต้องเก็บเลเวลให้ถึง Base Lv.${reqBLv} และ Job Lv.${reqJLv} เสียก่อน (ปัจจุบัน Lv.${curBaseLv} / J.Lv.${curJobLv})`, 'เลเวลยังไม่ถึงเกณฑ์', '⚠️');
          return;
        }
        this.changeJob(jDef.id);
      };
      listEl.appendChild(row);
    });
  }

  changeJob(newJobId) {
    const jDef = JOB_TREES[newJobId];
    if (!jDef) return;
    const p = this.player;
    p.jobId = jDef.id;
    p.job = jDef.name;
    p.jobName = jDef.name;
    p.classKey = jDef.sprite;
    p.branch = jDef.branch;
    p.tier = jDef.tier;
    // Reset Job Lv to 1 for the new class tier just like authentic RO!
    p.jobLv = 1;
    p.jobExp = 0;

    // Grant starter skill of the new job if slots have room
    if (!p.skills) p.skills = {};
    const firstOff = (jDef.offensiveSkills || [])[0];
    if (firstOff && !p.skills[firstOff] && Object.keys(p.skills).length < MAX_OFFENSIVE_SLOTS) {
      p.skills[firstOff] = 1;
    }

    audio.playLevelUpSound();
    this.refreshAll();
    this.renderJobMasterModal();
  }

  // ==========================================================================
  // NPC 4: Refine Master Hollgrehenn - Authentic Renewal Dual-Window Forge (Image 4)
  // Left: อัพเกรด (Rate Bar, 5 Hex Sockets, Cat Furnace, Anvil, Upgrade Zeny Btn)
  // Right: ไอเทมที่ครอบครอง (5x8 = 40 Item Slots Grid with Tabs: cons, equip, etc, priv)
  // ==========================================================================
  openRefineModal() {
    const modal = document.getElementById('modal-refine');
    if (!modal) return;

    this.consolidateEtcItems();
    this.refineState = {
      selectedItem: null,
      selectedListKey: 'eqp',
      activeTab: 'equip'
    };

    // Auto-select first refinable item if available
    const firstEq = (this.items.eqp || []).find(it => it && (it.refine || 0) < 10);
    if (firstEq) {
      this.refineState.selectedItem = firstEq;
      this.refineState.selectedListKey = 'eqp';
    }

    this.setupRenewalRefineTabs();
    this.renderRenewalRefineUI();
    modal.classList.remove('hidden');
  }

  setupRenewalRefineTabs() {
    const tabs = document.querySelectorAll('.ro-refine-vert-tabs .refine-vtab');
    tabs.forEach(tab => {
      tab.onclick = () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.refineState.activeTab = tab.getAttribute('data-tab') || 'equip';
        this.renderRenewalRefineInventoryGrid();
      };
    });

    const upgradeBtn = document.getElementById('btn-do-refine-upgrade');
    if (upgradeBtn) {
      upgradeBtn.onclick = () => {
        if (this.refineState.selectedItem) {
          const req = getRefineRequirements(this.refineState.selectedItem);
          if (req) {
            this.performRefine(this.refineState.selectedItem, this.refineState.selectedListKey, req);
          }
        }
      };
    }

    // Outcome Back Button (กลับไป)
    const backBtn = document.getElementById('btn-refine-outcome-back');
    if (backBtn) {
      backBtn.onclick = () => {
        const kilnStage = document.getElementById('ro-forge-kiln-stage');
        if (kilnStage) kilnStage.className = 'ro-forge-kiln-stage state-idle';
        const outcomeBadge = document.getElementById('ro-refine-outcome-badge');
        if (outcomeBadge) outcomeBadge.classList.add('hidden');
        const actionsReady = document.getElementById('refine-actions-ready');
        const actionsOutcome = document.getElementById('refine-actions-outcome');
        if (actionsReady) actionsReady.classList.remove('hidden');
        if (actionsOutcome) actionsOutcome.classList.add('hidden');
        this.renderRenewalRefineUI();
      };
    }

    // Outcome Again Button (เริ่มอีกครั้ง / อัพเกรดต่อ)
    const againBtn = document.getElementById('btn-refine-outcome-again');
    if (againBtn) {
      againBtn.onclick = () => {
        const it = this.refineState.selectedItem;
        if (!it) return;
        if ((it.refine || 0) >= 10) {
          this.showROAlert(`ไอเทม [${it.name}] ตีบวกสูงสุด +10 แล้ว!`, 'ตีบวกเต็มแล้ว', '✨');
          return;
        }
        const outcomeBadge = document.getElementById('ro-refine-outcome-badge');
        if (outcomeBadge) outcomeBadge.classList.add('hidden');
        const actionsReady = document.getElementById('refine-actions-ready');
        const actionsOutcome = document.getElementById('refine-actions-outcome');
        if (actionsReady) actionsReady.classList.remove('hidden');
        if (actionsOutcome) actionsOutcome.classList.add('hidden');
        const req = getRefineRequirements(it);
        if (req) {
          this.performRefine(it, this.refineState.selectedListKey, req);
        }
      };
    }
  }

  renderRenewalRefineUI() {
    this.renderRenewalRefineInventoryGrid();
    this.updateRefineForgeUI();
  }

  renderRenewalRefineInventoryGrid() {
    const grid = document.getElementById('refine-inventory-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const tab = this.refineState.activeTab || 'equip';
    let sourceItems = [];

    if (tab === 'equip') {
      sourceItems = [
        ...(this.items.eqp || []).map(it => ({ item: it, listKey: 'eqp' })),
        ...(this.items.cos || []).map(it => ({ item: it, listKey: 'cos' }))
      ];
    } else if (tab === 'cons') {
      sourceItems = (this.items.use || []).map(it => ({ item: it, listKey: 'use' }));
    } else if (tab === 'etc') {
      sourceItems = (this.items.etc || []).map(it => ({ item: it, listKey: 'etc' }));
    } else if (tab === 'priv') {
      sourceItems = (this.items.card || []).map(it => ({ item: it, listKey: 'card' }));
    }

    // Exactly 5 columns x 8 rows = 40 slots
    for (let i = 0; i < 40; i++) {
      const slotEl = document.createElement('div');
      slotEl.className = 'ro-refine-grid-slot';

      const entry = sourceItems[i];
      if (entry && entry.item) {
        const it = entry.item;
        const isSelected = this.refineState.selectedItem === it;
        if (isSelected) slotEl.classList.add('selected');

        const refineBadge = (it.refine !== undefined && it.refine > 0) ? `<span class="slot-refine-badge">+${it.refine}</span>` : '';
        const countBadge = (it.count !== undefined && (it.count > 1 || tab === 'etc' || it.type === 'etc')) ? `<span class="slot-count-badge">${it.count}</span>` : '';

        slotEl.innerHTML = `
          ${refineBadge}
          <img src="${it.icon || '/grf/icon/1116.png'}" alt="${it.name}" onerror="this.src='assets/ui/btn_ok.png'" />
          ${countBadge}
        `;

        slotEl.onclick = () => {
          if (tab === 'equip') {
            if ((it.refine || 0) >= 10) {
              this.showROAlert(`ไอเทม [${it.name}] ตีบวกสูงสุด +10 แล้ว!`, 'ตีบวกเต็มแล้ว', '✨');
              return;
            }
            this.refineState.selectedItem = it;
            this.refineState.selectedListKey = entry.listKey;
            this.renderRenewalRefineInventoryGrid();
            this.updateRefineForgeUI();
          } else {
            this.showROAlert(`ไอเทมชิ้นนี้ไม่ใช่ของสวมใส่ที่สามารถตีบวกได้ กรุณาเลือกแท็บ equip`, 'เลือกอุปกรณ์', '⚔️');
          }
        };
      }

      grid.appendChild(slotEl);
    }
  }

  updateRefineForgeUI() {
    const item = this.refineState.selectedItem;
    const rateFill = document.getElementById('refine-rate-fill');
    const rateLabel = document.getElementById('refine-rate-label');
    const anvilImg = document.getElementById('refine-selected-item-img');
    const anvilHint = document.getElementById('refine-empty-anvil-hint');
    const nameLabel = document.getElementById('refine-selected-item-name');
    const costDisplay = document.getElementById('refine-cost-display');
    const upgradeBtn = document.getElementById('btn-do-refine-upgrade');

    const kilnStage = document.getElementById('ro-forge-kiln-stage');
    const outcomeBadge = document.getElementById('ro-refine-outcome-badge');
    const actionsReady = document.getElementById('refine-actions-ready');
    const actionsOutcome = document.getElementById('refine-actions-outcome');

    if (kilnStage && !kilnStage.classList.contains('state-forging')) {
      kilnStage.className = 'ro-forge-kiln-stage state-idle';
    }
    if (outcomeBadge) outcomeBadge.classList.add('hidden');
    if (actionsReady) actionsReady.classList.remove('hidden');
    if (actionsOutcome) actionsOutcome.classList.add('hidden');

    const hexOreSlot = document.getElementById('hex-ore-slot');
    const hexOreIcon = document.getElementById('hex-ore-icon');
    const hexOreCount = document.getElementById('hex-ore-count');

    const hexHdSlot = document.getElementById('hex-hd-slot');
    const hexHdIcon = document.getElementById('hex-hd-icon');
    const hexHdCount = document.getElementById('hex-hd-count');

    const hexAnvilSlot = document.getElementById('hex-anvil-slot');
    const hexAnvilIcon = document.getElementById('hex-anvil-icon');
    const hexAnvilCount = document.getElementById('hex-anvil-count');

    const cHd = this.getOwnedCount('mat_hd_stone');
    const cAnvil = this.getOwnedCount('mat_anvil');

    if (hexHdCount) hexHdCount.textContent = `${cHd}/1`;
    if (hexHdSlot) {
      if (cHd >= 1) hexHdSlot.classList.add('active');
      else hexHdSlot.classList.remove('active');
    }

    if (hexAnvilCount) hexAnvilCount.textContent = `${cAnvil}/1`;
    if (hexAnvilSlot) {
      if (cAnvil >= 1) hexAnvilSlot.classList.add('active');
      else hexAnvilSlot.classList.remove('active');
    }

    if (!item) {
      if (rateFill) {
        rateFill.style.width = '0%';
        rateFill.style.background = 'linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%)';
      }
      if (rateLabel) rateLabel.textContent = 'สำเร็จ 0%';
      if (anvilImg) anvilImg.classList.add('hidden');
      if (anvilHint) anvilHint.classList.remove('hidden');
      if (nameLabel) nameLabel.textContent = 'กรุณาเลือกอุปกรณ์ที่จะตีบวก';
      if (costDisplay) costDisplay.textContent = '0 Z';
      if (upgradeBtn) upgradeBtn.disabled = true;
      if (hexOreCount) hexOreCount.textContent = '0/1';
      if (hexOreSlot) hexOreSlot.classList.remove('active');
      return;
    }

    const req = getRefineRequirements(item);
    if (!req) return;

    const ownedOre = this.getOwnedCount(req.oreId);
    const canAfford = (this.player.zeny || 0) >= req.zenyCost && ownedOre >= 1;

    // Rate display
    if (rateFill) {
      rateFill.style.width = `${req.successRate}%`;
      rateFill.style.background = 'linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%)';
    }
    if (rateLabel) {
      rateLabel.textContent = req.canBreak ? `สำเร็จ ${req.successRate}% (มีโอกาสแตก)` : `สำเร็จ ${req.successRate}% (ระยะปลอดภัย 100%)`;
    }

    // Anvil preview
    if (anvilImg) {
      anvilImg.src = item.icon || '/grf/icon/1116.png';
      anvilImg.classList.remove('hidden');
    }
    if (anvilHint) anvilHint.classList.add('hidden');
    if (nameLabel) {
      nameLabel.textContent = `${item.name} ➔ +${req.nextRefine}`;
    }

    // Hex Ore Socket
    if (hexOreIcon) hexOreIcon.src = req.oreIcon || '/grf/icon/1010.png';
    if (hexOreCount) hexOreCount.textContent = `${ownedOre}/1`;
    if (hexOreSlot) {
      if (ownedOre >= 1) hexOreSlot.classList.add('active');
      else hexOreSlot.classList.remove('active');
    }

    // Upgrade Button
    if (costDisplay) costDisplay.textContent = `${req.zenyCost.toLocaleString()} Z`;
    if (upgradeBtn) upgradeBtn.disabled = !canAfford;
  }

  getOwnedCount(itemId) {
    const found = (this.items.etc || []).find(it => it && it.id === itemId);
    return found ? (found.count || 0) : 0;
  }

  consumeEtcMaterial(itemId, amount = 1) {
    const arr = this.items.etc || [];
    const idx = arr.findIndex(it => it && it.id === itemId);
    if (idx < 0 || (arr[idx].count || 1) < amount) return false;
    if (arr[idx].count > amount) {
      arr[idx].count -= amount;
    } else {
      arr.splice(idx, 1);
    }
    return true;
  }

  renderRefineModal() {
    this.renderRenewalRefineUI();
  }

  async performRefine(item, listKey, req) {
    if ((this.player.zeny || 0) < req.zenyCost) {
      this.showROAlert(`เงิน Zeny ไม่พอ! ต้องใช้ ${req.zenyCost.toLocaleString()} Z (สามารถซื้อแร่ได้ที่ร้านของใช้ทั่วไป)`, 'เงิน Zeny ไม่พอ', '💰');
      return;
    }
    if (this.getOwnedCount(req.oreId) < 1) {
      this.showROAlert(`ไม่มีแร่ [${req.oreName}]! สามารถหาซื้อได้ที่ NPC ร้านของใช้ทั่วไปในเมือง Prontera`, 'ขาดแร่ตีบวก', '🪨');
      return;
    }

    let usingHdStone = false;
    if (req.canBreak) {
      const hdCount = this.getOwnedCount('mat_hd_stone');
      if (hdCount > 0) {
        usingHdStone = true;
      } else {
        const confirmRisk = await this.showROConfirm(
          `⚠️ คำเตือนจากเตาหลอม!\n\nการตีบวก [${item.name}] ขึ้น +${req.nextRefine} มีโอกาสสำเร็จเพียง ${req.successRate}%!\nคุณไม่มี/ไม่ได้ใช้ Blessing Ore (หินกันแตก) — หากล้มเหลว อุปกรณ์ชิ้นนี้จะแตกสลายหายไปถาวร!\n\nยืนยันที่จะเสี่ยงตีบวกหรือไม่?`,
          'คำเตือนความเสี่ยงตีบวก',
          '⚠️'
        );
        if (!confirmRisk) return;
      }
    }

    // Deduct Zeny, Ore, and Blessing Ore (if used)
    this.player.zeny -= req.zenyCost;
    this.consumeEtcMaterial(req.oreId, 1);
    if (usingHdStone) {
      this.consumeEtcMaterial('mat_hd_stone', 1);
    }

    const roll = Math.random() * 100;
    const isSuccess = roll < req.successRate;

    // Launch In-Kiln Animated Flame Spirit Sequence (ตรงตามรูปตัวอย่าง)
    this.animateKilnFlameRefine(item, listKey, req, isSuccess, usingHdStone);
  }

  animateKilnFlameRefine(item, listKey, req, isSuccess, usingHdStone) {
    const kilnStage = document.getElementById('ro-forge-kiln-stage');
    const outcomeBadge = document.getElementById('ro-refine-outcome-badge');
    const successBanner = document.getElementById('outcome-success-banner');
    const failedBanner = document.getElementById('outcome-failed-banner');
    const actionsReady = document.getElementById('refine-actions-ready');
    const actionsOutcome = document.getElementById('refine-actions-outcome');
    const upgradeBtn = document.getElementById('btn-do-refine-upgrade');
    const nameLabel = document.getElementById('refine-selected-item-name');
    const anvilBox = document.getElementById('refine-anvil-target-box');
    const againCostDisplay = document.getElementById('refine-again-cost-display');

    if (upgradeBtn) upgradeBtn.disabled = true;
    if (outcomeBadge) outcomeBadge.classList.add('hidden');
    if (actionsReady) actionsReady.classList.remove('hidden');
    if (actionsOutcome) actionsOutcome.classList.add('hidden');

    // Step 0: Set Flame Spirit to Forging State! (trembles, squints, sweat drop)
    if (kilnStage) kilnStage.className = 'ro-forge-kiln-stage state-forging';

    const hollgImg = document.getElementById('ro-hollg-smith-img');
    const swingHammer = () => {
      if (hollgImg) {
        hollgImg.style.transform = 'rotate(-28deg) translateY(-5px)';
        setTimeout(() => { if (hollgImg) hollgImg.style.transform = 'rotate(10deg) translateY(3px)'; }, 100);
        setTimeout(() => { if (hollgImg) hollgImg.style.transform = 'none'; }, 240);
      }
    };

    const spawnAnvilSparks = (count = 14) => {
      if (!anvilBox) return;
      for (let i = 0; i < count; i++) {
        const sp = document.createElement('div');
        sp.className = 'anvil-spark-burst';
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.8;
        const dist = 16 + Math.random() * 28;
        sp.style.setProperty('--tx', `${Math.cos(angle) * dist}px`);
        sp.style.setProperty('--ty', `${Math.sin(angle) * dist}px`);
        anvilBox.appendChild(sp);
        setTimeout(() => sp.remove(), 400);
      }
    };

    // Strike 1 (0.4s)
    setTimeout(() => {
      audio.playRefineClank(1);
      swingHammer();
      spawnAnvilSparks(12);
      if (anvilBox) {
        anvilBox.style.transform = 'scale(1.1)';
        setTimeout(() => { if (anvilBox) anvilBox.style.transform = 'scale(1)'; }, 100);
      }
    }, 400);

    // Strike 2 (1.2s)
    setTimeout(() => {
      audio.playRefineClank(2);
      swingHammer();
      spawnAnvilSparks(16);
      if (anvilBox) {
        anvilBox.style.transform = 'scale(1.15)';
        setTimeout(() => { if (anvilBox) anvilBox.style.transform = 'scale(1)'; }, 100);
      }
    }, 1200);

    // Strike 3 - Final Clank! (2.0s)
    setTimeout(() => {
      audio.playRefineClank(1);
      swingHammer();
      spawnAnvilSparks(24);
      if (anvilBox) {
        anvilBox.style.transform = 'scale(1.22)';
        setTimeout(() => { if (anvilBox) anvilBox.style.transform = 'scale(1)'; }, 120);
      }
    }, 2000);

    // Outcome Reveal (2.4s)
    setTimeout(() => {
      if (isSuccess) {
        // Success State: Blazing warm flame, ecstatic face, 3D SUCCESS banner
        if (kilnStage) kilnStage.className = 'ro-forge-kiln-stage state-success';
        audio.playRefineSuccess();

        item.refine = req.nextRefine;
        const baseName = item.baseName || item.name.replace(/^\+\d+\s+/, '').replace(/\s*\[\d+\]$/, '');
        const slotSuffix = item.slots > 0 ? ` [${item.slots}]` : '';
        item.name = `+${item.refine} ${baseName}${slotSuffix}`;

        const bonusAtkPerLv = req.isWeapon ? (req.wLv === 4 ? 14 : req.wLv === 3 ? 10 : req.wLv === 2 ? 7 : 5) : 0;
        const bonusDefPerLv = !req.isWeapon ? 4 : 0;
        if (item.atk > 0 || req.isWeapon) item.atk = (item.baseAtk || item.atk || 25) + item.refine * bonusAtkPerLv;
        if (item.matk > 0) item.matk = (item.baseMatk || item.matk) + item.refine * bonusAtkPerLv;
        if (item.def > 0 || !req.isWeapon) item.def = (item.baseDef || item.def || 10) + item.refine * bonusDefPerLv;
        item.sellPrice = (item.sellPrice || 300) + 250 * item.refine;

        if (nameLabel) nameLabel.textContent = `✨ ${item.name} ✨`;

        const rateFill = document.getElementById('refine-rate-fill');
        const rateLabel = document.getElementById('refine-rate-label');
        if (rateFill) {
          rateFill.style.width = '100%';
          rateFill.style.background = 'linear-gradient(90deg, #f59e0b 0%, #ef4444 100%)';
        }
        if (rateLabel) rateLabel.textContent = 'อัพเกรดสำเร็จ 100%';

        if (successBanner) successBanner.classList.remove('hidden');
        if (failedBanner) failedBanner.classList.add('hidden');
        if (outcomeBadge) outcomeBadge.classList.remove('hidden');

        this.showROBroadcast(`✨ [เตาหลอม]: ตีบวกอุปกรณ์ [${item.name}] สำเร็จแล้ว!! ✨`, 'success');

        // Next Refine info
        const nextReq = getRefineRequirements(item);
        if (againCostDisplay) {
          againCostDisplay.textContent = nextReq ? `${nextReq.zenyCost.toLocaleString()} Z` : 'MAX';
        }

      } else {
        // Failed State: Smoky gray flame, crying face, FAILED banner
        if (kilnStage) kilnStage.className = 'ro-forge-kiln-stage state-fail';
        audio.playRefineFailed();

        if (usingHdStone) {
          this.showROAlert(`การตีบวก [${item.name}] ล้มเหลว!\nโชคดีที่คุณใช้ Blessing Ore อุปกรณ์จึงไม่แตกสลาย!`, 'ป้องกันการแตกสำเร็จ', '🛡️');
          this.showROBroadcast(`🛡️ [Blessing Ore]: ส่องแสงปกป้อง [${item.name}] ไว้ได้ ไม่สูญหาย!`, 'info');
        } else {
          // Item Broken!
          const targetList = this.items[listKey] || [];
          const idx = targetList.indexOf(item);
          if (idx >= 0) targetList.splice(idx, 1);
          this.refineState.selectedItem = null;
          if (nameLabel) nameLabel.textContent = `[${item.name}] แตกสลายหายไปแล้ว...`;
          const anvilImg = document.getElementById('refine-selected-item-img');
          const anvilHint = document.getElementById('refine-empty-anvil-hint');
          if (anvilImg) anvilImg.classList.add('hidden');
          if (anvilHint) anvilHint.classList.remove('hidden');
          this.showROBroadcast(`💥 [เตาหลอม]: การตีบวกอุปกรณ์ [${item.name}] ล้มเหลว... อุปกรณ์แตกสลาย! 💥`, 'fail');
        }

        if (successBanner) successBanner.classList.add('hidden');
        if (failedBanner) failedBanner.classList.remove('hidden');
        if (outcomeBadge) outcomeBadge.classList.remove('hidden');

        if (againCostDisplay) againCostDisplay.textContent = '0 Z';
      }

      // Switch bottom buttons to Outcome Mode (กลับไป / เริ่มอีกครั้ง)
      if (actionsReady) actionsReady.classList.add('hidden');
      if (actionsOutcome) actionsOutcome.classList.remove('hidden');

      this.refreshAll();
      this.renderRenewalRefineInventoryGrid();
    }, 2400);
  }

  // ==========================================================================
  // NPC 3: Tool Dealer NPC - Buy Potions/Refine Ores & Sell Monster Drops
  // ==========================================================================
  openToolShopModal() {
    const modal = document.getElementById('modal-tool-shop');
    if (!modal) return;
    this.renderToolShop();
    modal.classList.remove('hidden');
  }

  renderToolShop() {
    const listEl = document.getElementById('shop-items-list');
    const zenyEl = document.getElementById('shop-player-zeny');
    const sellAllBar = document.getElementById('shop-sell-all-bar');
    if (!listEl) return;

    if (zenyEl) zenyEl.textContent = `${(this.player.zeny || 0).toLocaleString()} Z`;
    listEl.innerHTML = '';

    if (this.shopTab === 'buy') {
      if (sellAllBar) sellAllBar.classList.add('hidden');
      SHOP_CATALOG.forEach(item => {
        const row = document.createElement('div');
        row.className = 'ro-job-row';
        row.innerHTML = `
          <div class="job-avatar">
            <img src="${item.icon}" alt="${item.name}" style="width:32px;height:32px;object-fit:contain;" onerror="this.src='assets/items/red_potion.png'" />
          </div>
          <div class="job-info">
            <div class="job-name">${item.name}</div>
            <div class="job-desc">${item.desc}</div>
            <div class="job-perk">ราคา: ${item.buyPrice.toLocaleString()} Z | น้ำหนัก: ${item.weight || 5}</div>
          </div>
          <button class="btn-job-pick">ซื้อ 1 ชิ้น</button>
        `;
        row.querySelector('button').onclick = (e) => {
          e.stopPropagation();
          this.buyShopItem(item);
        };
        listEl.appendChild(row);
      });
    } else {
      if (sellAllBar) sellAllBar.classList.remove('hidden');
      const sellable = [
        ...(this.items.etc || []).map(it => ({ item: it, listKey: 'etc' })),
        ...(this.items.eqp || []).filter(it => !it.equipped).map(it => ({ item: it, listKey: 'eqp' })),
        ...(this.items.cos || []).filter(it => !it.equipped).map(it => ({ item: it, listKey: 'cos' }))
      ];

      if (!sellable.length) {
        listEl.innerHTML = `<div style="padding:18px; text-align:center; color:#64748b; font-size:12px;">ไม่มีขยะมอนสเตอร์ (Etc) หรืออุปกรณ์ที่ไม่ได้สวมใส่ให้ขาย</div>`;
        return;
      }

      sellable.forEach(({ item, listKey }) => {
        const price = item.sellPrice || 25;
        const count = item.count || 1;
        const row = document.createElement('div');
        row.className = 'ro-job-row';
        row.innerHTML = `
          <div class="job-avatar">
            <img src="${item.icon || 'assets/ui/btn_ok.png'}" alt="${item.name}" style="width:32px;height:32px;object-fit:contain;" />
          </div>
          <div class="job-info">
            <div class="job-name">${item.name} ${count > 1 ? `x${count}` : ''}</div>
            <div class="job-perk">ขายได้ชิ้นละ: ${price.toLocaleString()} Z (รวม ${(price * count).toLocaleString()} Z) | น้ำหนักรวม: ${(item.weight || 5) * count}</div>
          </div>
          <button class="btn-job-pick" style="background:#10b981; border-color:#059669;">ขาย</button>
        `;
        row.querySelector('button').onclick = (e) => {
          e.stopPropagation();
          this.sellSingleItem(item, listKey);
        };
        listEl.appendChild(row);
      });
    }
  }

  buyShopItem(shopItem) {
    if ((this.player.zeny || 0) < shopItem.buyPrice) {
      this.showROAlert('เงิน Zeny ไม่เพียงพอสำหรับซื้อไอเทมนี้!', 'เงินไม่พอ', '💰');
      return;
    }
    if (!this.canCarryWeight(shopItem.weight || 5)) {
      this.showROAlert('⚖️ น้ำหนักในกระเป๋าเกินขีดจำกัด!\nกรุณาขายขยะหรือทิ้งไอเทมก่อนซื้อเพิ่ม', 'น้ำหนักเกิน', '⚖️');
      return;
    }
    this.player.zeny -= shopItem.buyPrice;
    this.addLootItem({ ...shopItem, count: 1 });
    audio.playCoinSound();
    this.refreshAll();
    this.renderToolShop();
  }

  sellSingleItem(item, listKey) {
    const price = (item.sellPrice || 25) * (item.count || 1);
    this.player.zeny = (this.player.zeny || 0) + price;
    const arr = this.items[listKey] || [];
    const idx = arr.indexOf(item);
    if (idx >= 0) arr.splice(idx, 1);
    audio.playCoinSound();
    this.refreshAll();
    this.renderToolShop();
  }

  sellAllEtc() {
    const etcList = this.items.etc || [];
    // Keep Refine Ores & Blessing Ore safe when clicking "Sell All Monster Trash (Etc)"!
    const keepIds = new Set(['mat_phracon', 'mat_emveretarcon', 'mat_oridecon', 'mat_elunium', 'mat_hd_stone']);
    const toSell = etcList.filter(it => it && !keepIds.has(it.id));
    if (!toSell.length) {
      this.showROAlert('ไม่มีขยะมอนสเตอร์ให้ขาย\n(แร่ตีบวกและหินกันแตกจะถูกเก็บไว้ให้อย่างปลอดภัยโดยอัตโนมัติ)', 'ไม่มีขยะให้ขาย', '📦');
      return;
    }
    let totalEarned = 0;
    toSell.forEach(it => {
      totalEarned += (it.sellPrice || 20) * (it.count || 1);
    });
    this.items.etc = etcList.filter(it => it && keepIds.has(it.id));
    this.player.zeny = (this.player.zeny || 0) + totalEarned;
    audio.playLevelUpSound();
    this.refreshAll();
    this.renderToolShop();
  }
}
