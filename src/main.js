// RO Survivors - Main Entry Point
import { CLASSES } from './classes.js';
import { audio } from './audio.js';
import { CharacterSelectSystem } from './charselect.js';
import { PronteraWorld } from './world.js';
import { InGameUIManager } from './ui.js';
import { BattleArena } from './battle.js';
import { getStageInfo, getMaxStages, loadFullRoDatabase, JOB_TREES } from './gamedata.js';

const LOADING_IMAGES = [
  'assets/ui/loading00.jpg',
  'assets/ui/loading01.jpg',
  'assets/ui/loading02.jpg',
  'assets/ui/loading03.jpg',
  'assets/ui/loading04.jpg',
  'assets/ui/loading05.jpg',
  'assets/ui/loading06.jpg',
  'assets/ui/loading07.jpg',
  'assets/ui/loading_base00.jpg',
  'assets/ui/loading_base01.jpg',
  'assets/ui/loading_base02.jpg',
  'assets/ui/loading_base03.jpg'
];

class GameApp {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');

    // Portrait Game Canvas resolution: 480 x 854 (9:16 aspect ratio)
    this.canvas.width = 480;
    this.canvas.height = 854;

    this.state = 'TITLE'; // 'TITLE' | 'CHAR_SELECT' | 'LOADING' | 'WORLD' | 'BATTLE'
    this.activeCharacter = null;
    this.pendingStageNum = 1;
    this.spritePool = {};

    this.charSelectSystem = null;
    this.pronteraWorld = null;
    this.uiManager = null;
    this.battleArena = null;
    this.battle = null;
    this.lastTime = performance.now();

    window.gameApp = this;
    this.init();
  }

  async init() {
    this.setupUIHandlers();

    // Load 100% RO Full Database (29,368 items + 1,272 maps) in parallel with sprite manifest
    loadFullRoDatabase().catch(err => console.error('Failed to load RO_DB:', err));

    try {
      const res = await fetch('assets/sprites/manifest.json');
      const manifest = await res.json();
      await this.loadAllSprites(manifest);
      this.registerAll40JobSprites();
    } catch (err) {
      console.error('Failed to load sprite manifest:', err);
    }

    for (const src of LOADING_IMAGES) {
      const img = new Image();
      img.src = src;
    }

    requestAnimationFrame((t) => this.loop(t));
  }

  async loadAllSprites(manifest) {
    const promises = [];
    for (const [key, items] of Object.entries(manifest)) {
      this.spritePool[key] = [];
      for (const item of items) {
        const img = new Image();
        img.src = item.file;
        const p = new Promise((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
        });
        promises.push(p);
        this.spritePool[key].push(img);
      }
    }
    await Promise.all(promises);
  }

  // Register all 40 Authentic RO Job Class outfits (standing + 8-directional walk frames) into spritePool
  registerAll40JobSprites() {
    const allJobSprites = new Set(Object.values(JOB_TREES).map(j => j.sprite));
    for (const spriteKey of allJobSprites) {
      const baseKey = `class_${spriteKey}`;
      if (!this.spritePool[baseKey] || !this.spritePool[baseKey].length) {
        const standImg = new Image();
        standImg.src = `assets/sprites/${baseKey}_0.png`;
        this.spritePool[baseKey] = [standImg];
      }
      for (let d = 0; d <= 4; d++) {
        const dirKey = `${baseKey}_d${d}`;
        if (!this.spritePool[dirKey] || !this.spritePool[dirKey].length) {
          this.spritePool[dirKey] = [];
          for (let f = 0; f < 8; f++) {
            const img = new Image();
            img.src = `assets/sprites/${baseKey}_d${d}_${f}.png`;
            this.spritePool[dirKey].push(img);
          }
        }
      }
    }
    // Ensure NPC sprites are registered, especially Hollgrehenn the blacksmith!
    if (!this.spritePool['npc_blacksmith'] || !this.spritePool['npc_blacksmith'].length) {
      const smithImg = new Image();
      smithImg.src = 'assets/effects/refine/hollgrehenn_0.png';
      this.spritePool['npc_blacksmith'] = [smithImg];
    }
  }

  // Preload authentic 8-directional character sprites (Stand, Walk, Attack) with user's exact gender, hairstyle, and hair color
  async loadActiveCharacterSprites(char) {
    if (!char) return;
    const job = char.jobId || char.classKey || 'novice';
    const gender = (char.gender === 'female' || char.gender === 'f') ? 'f' : 'm';
    const hair = char.hairStyle || 1;
    const color = char.hairColor || 'blonde';

    const charKey = `${job}_${gender}_h${hair}_c${color}`;
    if (this._loadedCharKey === charKey && this.spritePool['player_walk_d0']?.length && this.spritePool['player_walk_d0'][0].complete) {
      return;
    }
    this._loadedCharKey = charKey;

    const promises = [];

    // Preload Stand (8 dirs * 3 frames = 24 frames)
    for (let d = 0; d < 8; d++) {
      const standKey = `player_stand_d${d}`;
      this.spritePool[standKey] = [];
      for (let f = 0; f < 3; f++) {
        const img = new Image();
        img.src = `/grf/character/${job}_${gender}_h${hair}_c${color}_stand_d${d}_${f}.png`;
        promises.push(new Promise((resolve) => {
          if (img.complete) return resolve();
          img.onload = () => resolve();
          img.onerror = () => resolve();
        }));
        this.spritePool[standKey].push(img);
      }
    }

    // Preload Walk (8 dirs * 8 frames = 64 alternating step frames)
    for (let d = 0; d < 8; d++) {
      const walkKey = `player_walk_d${d}`;
      this.spritePool[walkKey] = [];
      for (let f = 0; f < 8; f++) {
        const img = new Image();
        img.src = `/grf/character/${job}_${gender}_h${hair}_c${color}_walk_d${d}_${f}.png`;
        promises.push(new Promise((resolve) => {
          if (img.complete) return resolve();
          img.onload = () => resolve();
          img.onerror = () => resolve();
        }));
        this.spritePool[walkKey].push(img);
      }
    }

    // Preload Attack (8 dirs * 3 frames = 24 frames)
    for (let d = 0; d < 8; d++) {
      const atkKey = `player_atk_d${d}`;
      this.spritePool[atkKey] = [];
      for (let f = 0; f < 3; f++) {
        const img = new Image();
        img.src = `/grf/character/${job}_${gender}_h${hair}_c${color}_atk_d${d}_${f}.png`;
        promises.push(new Promise((resolve) => {
          if (img.complete) return resolve();
          img.onload = () => resolve();
          img.onerror = () => resolve();
        }));
        this.spritePool[atkKey].push(img);
      }
    }

    await Promise.all(promises);
  }

  setupUIHandlers() {
    // PWA Service Worker Cleanup & Cache Purge
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        for (const reg of regs) reg.unregister();
      });
    }
    if ('caches' in window) {
      caches.keys().then((keys) => {
        for (const k of keys) caches.delete(k);
      });
    }

    // PWA Install Prompt Button Hook
    let deferredPrompt = null;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      const installBtn = document.getElementById('btn-pwa-install');
      if (installBtn) {
        installBtn.classList.remove('hidden');
        installBtn.onclick = async () => {
          if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
              installBtn.classList.add('hidden');
            }
            deferredPrompt = null;
          }
        };
      }
    });

    // Start Authentic RO Title BGM on first interaction
    const startTitleBgm = () => {
      if (this.state === 'TITLE') {
        audio.playBgm('title');
      }
      window.removeEventListener('click', startTitleBgm);
      window.removeEventListener('touchstart', startTitleBgm);
    };
    window.addEventListener('click', startTitleBgm);
    window.addEventListener('touchstart', startTitleBgm);

    const btnLogin = document.getElementById('btn-login-start');
    if (btnLogin) {
      btnLogin.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleLogin();
      });
    }

    // Audio & Game Settings Modal wiring
    const btnSettings = document.getElementById('btn-title-settings');
    const modalSettings = document.getElementById('modal-settings');
    const btnSettingsClose = document.getElementById('btn-settings-close');
    const btnSettingsSave = document.getElementById('btn-settings-save');
    const chkMasterMute = document.getElementById('setting-master-mute');
    const chkBgmEnable = document.getElementById('setting-bgm-enable');
    const sliderBgm = document.getElementById('setting-bgm-slider');
    const valBgm = document.getElementById('setting-bgm-val');
    const chkSfxEnable = document.getElementById('setting-sfx-enable');
    const sliderSfx = document.getElementById('setting-sfx-slider');
    const valSfx = document.getElementById('setting-sfx-val');

    const syncSettingsUI = () => {
      if (chkMasterMute) chkMasterMute.checked = !!audio.muted;
      if (chkBgmEnable) chkBgmEnable.checked = !!audio.bgmEnabled;
      if (chkSfxEnable) chkSfxEnable.checked = !!audio.sfxEnabled;
      const bPct = Math.round(audio.bgmVolume * 100);
      const sPct = Math.round(audio.sfxVolume * 100);
      if (sliderBgm) sliderBgm.value = bPct;
      if (valBgm) valBgm.textContent = `${bPct}%`;
      if (sliderSfx) sliderSfx.value = sPct;
      if (valSfx) valSfx.textContent = `${sPct}%`;
    };
    syncSettingsUI();

    if (btnSettings && modalSettings) {
      btnSettings.addEventListener('click', (e) => {
        e.stopPropagation();
        syncSettingsUI();
        modalSettings.classList.remove('hidden');
      });
    }

    if (btnSettingsClose && modalSettings) {
      btnSettingsClose.addEventListener('click', () => {
        modalSettings.classList.add('hidden');
      });
    }
    if (btnSettingsSave && modalSettings) {
      btnSettingsSave.addEventListener('click', () => {
        modalSettings.classList.add('hidden');
      });
    }

    if (chkMasterMute) {
      chkMasterMute.addEventListener('change', (e) => {
        audio.setMasterMute(e.target.checked);
      });
    }
    if (chkBgmEnable) {
      chkBgmEnable.addEventListener('change', (e) => {
        audio.setBgmEnabled(e.target.checked);
      });
    }
    if (sliderBgm) {
      sliderBgm.addEventListener('input', (e) => {
        const val = Number(e.target.value) / 100;
        audio.setBgmVolume(val);
        if (valBgm) valBgm.textContent = `${e.target.value}%`;
      });
    }
    if (chkSfxEnable) {
      chkSfxEnable.addEventListener('change', (e) => {
        audio.setSfxEnabled(e.target.checked);
      });
    }
    if (sliderSfx) {
      sliderSfx.addEventListener('input', (e) => {
        const val = Number(e.target.value) / 100;
        audio.setSfxVolume(val);
        if (valSfx) valSfx.textContent = `${e.target.value}%`;
      });
    }

    const btnReturnTown = document.getElementById('btn-return-town');
    if (btnReturnTown) {
      btnReturnTown.addEventListener('click', () => {
        document.getElementById('modal-gameover').classList.add('hidden');
        this.showLoadingTransition('WORLD', 'Prontera City, Capital of Rune-Midgarts (prontera.gat)');
      });
    }

    const btnBattleTown = document.getElementById('btn-battle-town');
    if (btnBattleTown) {
      btnBattleTown.addEventListener('click', () => {
        audio.playCoinSound();
        this.showLoadingTransition('WORLD', 'Prontera City, Capital of Rune-Midgarts (prontera.gat)');
      });
    }
  }

  handleLogin() {
    if (this.state !== 'TITLE') return;
    audio.playCoinSound();

    const titleEl = document.getElementById('title-screen');
    if (titleEl) titleEl.classList.add('hidden');

    const charSelectEl = document.getElementById('char-select-screen');
    if (charSelectEl) charSelectEl.classList.remove('hidden');

    this.state = 'CHAR_SELECT';
    this.charSelectSystem = new CharacterSelectSystem((char) => this.onEnterWorld(char));
  }

  onEnterWorld(character) {
    this.activeCharacter = character;
    this.loadActiveCharacterSprites(character);
    audio.playCoinSound();

    const charSelectEl = document.getElementById('char-select-screen');
    if (charSelectEl) charSelectEl.classList.add('hidden');

    this.showLoadingTransition('WORLD', 'Prontera City, Capital of Rune-Midgarts (prontera.gat)');
  }

  showLoadingTransition(targetState, mapName) {
    this.state = 'LOADING';
    document.getElementById('btn-battle-town')?.classList.add('hidden');
    document.getElementById('persistent-hud-bars')?.classList.add('hidden');

    const loadingEl = document.getElementById('loading-screen');
    const loadingImg = document.getElementById('loading-art-img');
    const mapTitle = document.getElementById('loading-map-title');
    const progressFill = document.getElementById('loading-progress-fill');
    const percentText = document.getElementById('loading-percent-text');
    const tipText = document.getElementById('loading-status-tip');

    const randImg = LOADING_IMAGES[Math.floor(Math.random() * LOADING_IMAGES.length)];
    if (loadingImg) loadingImg.src = randImg;

    if (mapTitle) mapTitle.textContent = mapName;
    if (progressFill) progressFill.style.width = '0%';
    if (percentText) percentText.textContent = '0%';
    if (loadingEl) loadingEl.classList.remove('hidden');

    const duration = 900;
    const startAnim = performance.now();
    let preloadDone = false;
    this.loadActiveCharacterSprites(this.activeCharacter).then(() => {
      preloadDone = true;
    }).catch(() => {
      preloadDone = true;
    });

    const updateProgress = (now) => {
      const elapsed = now - startAnim;
      const pct = Math.min(100, Math.floor((elapsed / duration) * 100));

      if (progressFill) progressFill.style.width = `${pct}%`;
      if (percentText) percentText.textContent = `${pct}%`;

      if (tipText) {
        if (pct < 35) tipText.textContent = 'กำลังโหลดข้อมูลแผนที่ .gnd และมอนสเตอร์จากไฟล์ GRF...';
        else if (pct < 75) tipText.textContent = 'กำลังเชื่อมต่อข้อมูลตัวละครใน Rune-Midgarts...';
        else tipText.textContent = 'โหลดข้อมูลเสร็จสมบูรณ์ กำลังเข้าสู่พื้นที่!';
      }

      if (elapsed < duration || !preloadDone) {
        requestAnimationFrame(updateProgress);
      } else {
        if (loadingEl) loadingEl.classList.add('hidden');
        if (targetState === 'WORLD') {
          this.enterWorld();
        } else if (targetState === 'BATTLE') {
          this.enterBattleZone(this.pendingStageNum, this.pendingMapCode);
        }
      }
    };

    requestAnimationFrame(updateProgress);
  }

  enterWorld() {
    this.state = 'WORLD';
    this.battle = null;
    audio.playBgm('town');
    document.getElementById('btn-battle-town')?.classList.add('hidden');

    const hudEl = document.getElementById('ingame-hud');
    if (hudEl) hudEl.classList.remove('hidden');
    document.getElementById('persistent-hud-bars')?.classList.remove('hidden');

    if (!this.pronteraWorld) {
      this.pronteraWorld = new PronteraWorld(
        this.canvas,
        this.activeCharacter,
        (_zoneName) => this.warpToStage(1)
      );
      this.pronteraWorld.loadSprites(this.spritePool);
      this.uiManager = new InGameUIManager(this.activeCharacter, this.pronteraWorld);
    } else {
      this.pronteraWorld.player = this.activeCharacter;
      this.pronteraWorld.loadSprites(this.spritePool);
      this.pronteraWorld.warpToFountain();
      if (this.uiManager) {
        this.uiManager.player = this.activeCharacter;
        this.uiManager.refreshAll();
      }
    }
    this.pronteraWorld.setActive(true);
  }

  warpToStage(stageNum = 1, customMapCode = null) {
    // Enforce strict stage progression lock!
    const maxUnlocked = this.activeCharacter?.maxUnlockedStage || 1;
    if (stageNum > maxUnlocked) {
      alert(`🔒 ด่านที่ ${stageNum} ยังไม่เปิด!\nคุณต้องปราบบอสประจำด่านที่ ${stageNum - 1} ก่อน (ปัจจุบันปลดล็อกถึงด่านที่ ${maxUnlocked})`);
      return;
    }
    this.pendingStageNum = Math.max(1, Math.min(getMaxStages(), stageNum));
    this.pendingMapCode = customMapCode;
    document.getElementById('modal-warp-zones')?.classList.add('hidden');
    const stgInfo = getStageInfo(this.pendingStageNum, this.pendingMapCode);
    this.showLoadingTransition('BATTLE', `${stgInfo.title} (${stgInfo.mapCode}.gnd)`);
  }

  warpToZone(_zoneName) {
    this.warpToStage(1);
  }

  enterBattleZone(stageNum = 1, customMapCode = null) {
    this.state = 'BATTLE';
    if (this.pronteraWorld) this.pronteraWorld.setActive(false);
    this.loadActiveCharacterSprites(this.activeCharacter);

    // Hide Town basic info box (Battle draws its own full top HUD), but KEEP #persistent-hud-bars visible!
    document.getElementById('ingame-hud')?.classList.add('hidden');
    document.getElementById('persistent-hud-bars')?.classList.remove('hidden');
    document.getElementById('btn-battle-town')?.classList.remove('hidden');

    ['status', 'inventory', 'equipment', 'skills'].forEach(w => {
      document.getElementById(`win-${w}`)?.classList.add('hidden');
      if (this.uiManager && this.uiManager.activeWindows) {
        this.uiManager.activeWindows[w] = false;
      }
    });

    if (this.uiManager) {
      this.uiManager.recalcStats();
      this.uiManager.renderQuickUsableBar();
    }

    const spriteKey = this.activeCharacter.classKey || 'novice';
    const playerCfg = CLASSES[spriteKey] || CLASSES.swordsman;
    const customCfg = {
      ...playerCfg,
      id: spriteKey,
      name: this.activeCharacter.jobName || this.activeCharacter.name,
      hp: this.activeCharacter.maxHp || 250,
      maxHp: this.activeCharacter.maxHp || 250,
      sp: this.activeCharacter.maxSp || 100,
      maxSp: this.activeCharacter.maxSp || 100,
      atk: this.activeCharacter.atk || 50,
      def: this.activeCharacter.def || 25
    };

    this.battleArena = new BattleArena(
      this.canvas,
      customCfg,
      this.spritePool,
      (choices, onPick, slotInfo) => this.showLevelUpModal(choices, onPick, slotInfo),
      (stats) => this.showGameOverModal(stats),
      this.activeCharacter,
      this.uiManager,
      stageNum,
      customMapCode
    );
    this.battle = this.battleArena;
  }

  showLevelUpModal(choices, onPick, slotInfo = null) {
    const modalEl = document.getElementById('modal-levelup');
    const container = document.getElementById('card-choices');
    const subEl = modalEl ? modalEl.querySelector('.ro-card-modal-sub') : null;
    const rerollBtn = document.getElementById('btn-reroll-skills');
    if (!modalEl || !container) return;

    const renderChoices = (currentChoices) => {
      const isNov = (this.activeCharacter?.jobId === 'novice' || this.activeCharacter?.branch === 'novice');
      if (subEl) {
        if (isNov) {
          subEl.innerHTML = '<span style="color:#ffd700; font-weight:bold;">🔰 [Novice]: คุณยังไม่มีสกิลต่อสู้ กรุณาเก็บเลเวล Job 10 เพื่อไปเปลี่ยนอาชีพที่เมือง Prontera!</span>';
        } else if (slotInfo) {
          let statusNote = `ช่องสกิลโจมตี: ${slotInfo.offCount}/${slotInfo.offMax} | ช่องสกิลซัพพอร์ต: ${slotInfo.supCount}/${slotInfo.supMax}`;
          if (slotInfo.supCount >= slotInfo.supMax && slotInfo.offCount < slotInfo.offMax) {
            statusNote += ` (ซัพพอร์ตเต็มแล้ว ➔ สุ่มสกิลโจมตี & อัพเวลแทน)`;
          } else if (slotInfo.supCount >= slotInfo.supMax && slotInfo.offCount >= slotInfo.offMax) {
            statusNote += ` (ช่องสกิลครบแล้ว ➔ อัพเลเวลสกิลที่มีอยู่แทน!)`;
          }
          subEl.textContent = statusNote;
        }
      }

      const myTier = this.activeCharacter?.tier || 0;
      const rerollCost = (myTier + 1) * 2000;
      if (rerollBtn) {
        const curZeny = this.activeCharacter?.zeny || this.battleArena?.player?.zeny || 0;
        rerollBtn.textContent = `🔄 สุ่มตัวเลือกสกิลใหม่ (ใช้ ${rerollCost.toLocaleString()} Z | มี ${curZeny.toLocaleString()} Z)`;
        rerollBtn.onclick = () => {
          const zenyNow = this.activeCharacter?.zeny || 0;
          if (zenyNow < rerollCost) {
            alert(`เงิน Zeny ไม่พอสำหรับการสุ่มสกิลใหม่! (ต้องใช้ ${rerollCost.toLocaleString()} Z ตามระดับคลาสของคุณ)`);
            return;
          }
          this.activeCharacter.zeny -= rerollCost;
          if (this.battleArena && this.battleArena.player) {
            this.battleArena.player.zeny = this.activeCharacter.zeny;
          }
          audio.playCoinSound();
          const isNov = (this.activeCharacter?.jobId === 'novice' || this.activeCharacter?.branch === 'novice');
          const newChoices = this.battleArena.skillManager.getLevelUpChoices(
            isNov ? 'novice' : (this.activeCharacter?.branch || 'swordsman'),
            isNov ? 0 : (this.activeCharacter?.tier ?? 1),
            3
          );
          renderChoices(newChoices);
        };
      }

      container.innerHTML = '';

      currentChoices.forEach((skill) => {
        const isOff = skill.category === 'offensive';
        const curLv = skill.currentLv || 0;
        const nextLv = skill.nextLv || (curLv + 1);
        const isLevelUp = curLv > 0;
        const isStatBoost = !!skill.isStatBoost;
        const isNovCard = skill.branch === 'novice';

        const badgeText = isNovCard
          ? '🔰 สเตตัส / ฟื้นฟูพื้นฐานโนวิซ'
          : isStatBoost
          ? '🌟 อัพสเตตัสพิเศษ (เมื่อสกิลเต็ม Lv.10)'
          : isLevelUp
          ? `⬆️ อัพเลเวลสกิล (Lv.${curLv} ➔ Lv.${nextLv}/10)`
          : `✨ เรียนสกิลใหม่ คลาส ${skill.tier || 1} (Lv.1/10)`;

        const card = document.createElement('div');
        card.className = 'ro-card-item';
        card.innerHTML = `
          <div class="ro-card-inner">
            <div class="ro-card-header">
              <span class="ro-card-tag" style="color:${isOff ? '#ff6b6b' : '#74b9ff'};">[ ${isOff ? '⚔️ สกิลโจมตี' : '✨ สกิลซัพพอร์ต'} | ${badgeText} ]</span>
              <span class="ro-card-name">${skill.name}</span>
            </div>
            <div class="ro-card-body">
              <div class="ro-card-icon">
                <img src="${skill.iconImg || 'assets/ui/btn_ok.png'}" alt="${skill.name}" />
              </div>
              <div class="ro-card-info">
                <div class="ro-card-desc">${skill.desc}</div>
                <div class="ro-card-type">สายต้นกำเนิด: ${(skill.branch || 'All').toUpperCase()} | คลาส: Tier ${skill.tier || 1}</div>
              </div>
            </div>
          </div>
        `;

        card.addEventListener('click', () => {
          audio.playCoinSound();
          modalEl.classList.add('hidden');
          onPick(skill);
        });

        container.appendChild(card);
      });
    };

    renderChoices(choices);
    modalEl.classList.remove('hidden');
  }

  showGameOverModal(stats) {
    const modal = document.getElementById('modal-gameover');
    if (!modal) return;

    const mins = String(Math.floor(stats.time / 60)).padStart(2, '0');
    const secs = String(Math.floor(stats.time % 60)).padStart(2, '0');

    const stgEl = document.getElementById('stat-stage');
    if (stgEl) stgEl.textContent = `Stage ${stats.stage || 1} / ${getMaxStages()}`;
    document.getElementById('stat-time').textContent = `${mins}:${secs}`;
    document.getElementById('stat-level').textContent = `Lv. ${stats.level}`;
    document.getElementById('stat-kills').textContent = `${stats.kills} ตัว`;
    document.getElementById('stat-zeny').textContent = `${(stats.zeny || 0).toLocaleString()} Z`;

    modal.classList.remove('hidden');
  }

  loop(currentTime) {
    const dt = Math.min((currentTime - this.lastTime) / 1000, 0.1);
    this.lastTime = currentTime;

    if (this.state === 'WORLD' && this.pronteraWorld) {
      this.pronteraWorld.update(dt);
      this.pronteraWorld.draw();
    } else if (this.state === 'BATTLE' && this.battleArena) {
      this.battleArena.update(dt);
      this.battleArena.draw();
    }

    requestAnimationFrame((t) => this.loop(t));
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new GameApp();
});
