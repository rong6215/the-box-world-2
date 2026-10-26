// RO Survivors Battle Arena: 1,272 Authentic RO Maps (.gnd 3D Ground), Real Monster Stats & Sprites,
// 8-Direction Walk + 4-Frame Normal Attack, Hard RO EXP/Drop Rates, Weight Limit & Dual Skill Bar
import { SkillManager, SKILL_DEFS, MAX_OFFENSIVE_SLOTS, MAX_SUPPORT_SLOTS } from './skills.js';
import { WaveSpawner } from './monsters.js';
import { audio } from './audio.js';
import { getStageInfo, getMaxStages, generateLootEquipment, generateLootCostume, generateLootCard, generateLootEtc, SHOP_CATALOG, JOB_TREES } from './gamedata.js';
import { HAIR_COLOR_FILTERS } from './charselect.js';

export function calcNextBaseExp(lv) {
  return Math.round(95 * Math.pow(Math.max(1, lv), 1.72));
}

export function calcNextJobExp(jlv) {
  return Math.round(80 * Math.pow(Math.max(1, jlv), 1.68));
}

export class BattleArena {
  constructor(canvas, playerConfig, spritePool, onLevelUp, onGameOver, characterRef, uiManagerRef, startStage = 1, customMapCode = null) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.playerConfig = playerConfig;
    this.spritePool = spritePool;
    this.onLevelUp = onLevelUp;
    this.onGameOver = onGameOver;
    this.character = characterRef;
    this.uiManager = uiManagerRef;

    this.customMapCode = customMapCode;
    this.stageNum = Math.max(1, Math.min(getMaxStages(), startStage || 1));
    this.stageInfo = getStageInfo(this.stageNum, this.customMapCode);
    this.stageKills = 0;
    this.stageBossKilled = false;
    this.stageClearBannerTimer = 0;
    this.overweightWarnTimer = 0;

    const jobDef = JOB_TREES[this.character?.jobId || this.playerConfig.id] || JOB_TREES.novice;

    const startBaseLv = this.character?.baseLv || 1;
    const startJobLv = this.character?.jobLv || 1;

    // Player State synced with persistent Character
    this.player = {
      x: 0,
      y: 0,
      gender: this.character?.gender || 'male',
      hairStyle: this.character?.hairStyle || 1,
      hairColor: this.character?.hairColor || 'blonde',
      classKey: this.character?.classKey || 'novice',
      hp: this.character?.maxHp || playerConfig.hp || 150,
      maxHp: this.character?.maxHp || playerConfig.hp || 150,
      sp: this.character?.maxSp || 100,
      maxSp: this.character?.maxSp || 100,
      baseSpeed: playerConfig.speed || 3.1,
      speed: playerConfig.speed || 3.1,
      pickupRadius: 68,
      facingAngle: 0,
      facingLeft: false,
      facingBack: false,
      frameIndex: 0,
      animTimer: 0,
      attackTimer: 0,
      attackAnimDuration: 0.28,
      attackFrame: 0,
      attackType: jobDef.attackType || 'melee_slash',
      branch: jobDef.branch || 'novice',
      tier: jobDef.tier ?? 0,
      level: startBaseLv,
      jobLevel: startJobLv,
      exp: this.character?.baseExp || 0,
      nextExp: calcNextBaseExp(startBaseLv),
      jobExp: this.character?.jobExp || 0,
      nextJobExp: calcNextJobExp(startJobLv),
      kills: 0,
      zeny: this.character?.zeny || 0,
      invulnTime: 0,
      kyrieHits: 0,
      dmgReduce: 0,
      zenyBonus: 0
    };

    // Skill Manager
    this.skillManager = new SkillManager(this.player, this.character);
    if (playerConfig.startSkill && SKILL_DEFS[playerConfig.startSkill]) {
      this.skillManager.addSkill(playerConfig.startSkill, 1);
    }
    if (this.character?.skills) {
      for (const [skId, lv] of Object.entries(this.character.skills)) {
        if (lv > 0 && SKILL_DEFS[skId]) {
          this.skillManager.skills.set(skId, lv);
          if (!this.skillManager.cooldowns.has(skId)) this.skillManager.cooldowns.set(skId, 0);
        }
      }
    }

    // Entities
    this.monsters = [];
    this.drops = [];
    this.damageNumbers = [];
    this.particles = [];
    this.waveSpawner = new WaveSpawner(spritePool, this.stageInfo);

    this.gameTime = 0;
    this.paused = false;
    this.levelUpEffectTimer = 0;

    // Zone Ground Textures & Drop Icon Cache
    this.zoneTextures = {};
    this.dropIconCache = new Map();
    this.loadStageAssets();

    // Preload Skill Icons for HUD
    this.skillIconImages = {};
    for (const [id, def] of Object.entries(SKILL_DEFS)) {
      if (def.iconImg) {
        const img = new Image();
        img.src = def.iconImg;
        this.skillIconImages[id] = img;
      }
    }

    // Preload 4-Frame Attack Pose Sprites
    this.attackSprites = {};
    this.reloadClassSprites(jobDef.sprite || this.playerConfig.id);

    // Screen Shake for Impactful Critical Hits
    this.screenShake = 0;

    // Preload Authentic RO Damage Digit Sprites (newnumber_*.png) & Message Sprites (newnumber_msg_*.png)
    this.damageDigits = {};
    for (let d = 0; d <= 9; d++) {
      const img = new Image();
      img.src = `assets/effects/numbers/newnumber_${d}.png`;
      img.onerror = () => { img.src = `assets/effects/numbers/숫자_${d}.png`; };
      this.damageDigits[d] = img;
    }
    this.msgSprites = {
      miss: new Image(),
      guard: new Image(),
      critical: new Image(),
      critStar: new Image()
    };
    this.msgSprites.miss.src = 'assets/effects/numbers/newnumber_msg_0.png';
    this.msgSprites.guard.src = 'assets/effects/numbers/newnumber_msg_1.png';
    this.msgSprites.critical.src = 'assets/effects/numbers/newnumber_msg_2.png';
    this.msgSprites.critStar.src = 'assets/effects/numbers/newnumber_msg_3.png';

    // Controls
    this.keys = {};
    this.joystick = {
      active: false,
      baseX: 0,
      baseY: 0,
      curX: 0,
      curY: 0,
      dx: 0,
      dy: 0
    };

    this.setupInput();
  }

  getDropIconImage(url) {
    if (!url) return null;
    if (this.dropIconCache.has(url)) return this.dropIconCache.get(url);
    const img = new Image();
    img.src = url;
    this.dropIconCache.set(url, img);
    return img;
  }

  reloadClassSprites(spriteKey) {
    const key = spriteKey || 'novice';
    this.currentSpriteKey = key;
    for (let a = 0; a < 4; a++) {
      const img = new Image();
      img.src = `assets/sprites/class_${key}_attack_${a}.png`;
      this.attackSprites[a] = img;
    }
  }

  loadStageAssets() {
    if (this.stageInfo && this.stageInfo.groundMapImg && !this.zoneTextures[this.stageInfo.groundMapImg]) {
      const gImg = new Image();
      gImg.src = this.stageInfo.groundMapImg;
      this.zoneTextures[this.stageInfo.groundMapImg] = gImg;
    }
    if (this.stageInfo && this.stageInfo.tex && !this.zoneTextures[this.stageInfo.tex]) {
      const img = new Image();
      img.src = this.stageInfo.tex;
      this.zoneTextures[this.stageInfo.tex] = img;
    }
    if (this.stageInfo && this.stageInfo.mapImg && !this.zoneTextures[this.stageInfo.mapImg]) {
      const mImg = new Image();
      mImg.src = this.stageInfo.mapImg;
      this.zoneTextures[this.stageInfo.mapImg] = mImg;
    }
    if (this.stageInfo && this.stageInfo.bgm) {
      audio.playStageBgm(this.stageInfo.bgm);
    }
  }

  advanceToStage(nextStageNum) {
    this.stageNum = Math.max(1, Math.min(getMaxStages(), nextStageNum));
    this.stageInfo = getStageInfo(this.stageNum);
    this.stageKills = 0;
    this.stageBossKilled = false;
    this.stageClearBannerTimer = 2.8;
    this.waveSpawner.setStageInfo(this.stageInfo);
    this.loadStageAssets();

    this.player.hp = Math.min(this.player.maxHp, this.player.hp + Math.round(this.player.maxHp * 0.35));
    audio.playLevelUpSound();
    this.spawnDamageNumber(this.player.x, this.player.y - 55, `🚩 ปลดล็อกด่าน ${this.stageNum}: ${this.stageInfo.name}`, '#ffeaa7', true);
  }

  setupInput() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.key.toLowerCase()] = true;
      if (e.code) this.keys[e.code.toLowerCase()] = true;
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.key.toLowerCase()] = false;
      if (e.code) this.keys[e.code.toLowerCase()] = false;
    });

    this.canvas.addEventListener('touchstart', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const touch = e.touches[0];
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      const tx = (touch.clientX - rect.left) * scaleX;
      const ty = (touch.clientY - rect.top) * scaleY;

      if (ty > 105 && ty < this.canvas.height - 135) {
        this.joystick.active = true;
        this.joystick.baseX = tx;
        this.joystick.baseY = ty;
        this.joystick.curX = tx;
        this.joystick.curY = ty;
        this.joystick.dx = 0;
        this.joystick.dy = 0;
      }
    }, { passive: true });

    this.canvas.addEventListener('touchmove', (e) => {
      if (!this.joystick.active) return;
      const rect = this.canvas.getBoundingClientRect();
      const touch = e.touches[0];
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      const tx = (touch.clientX - rect.left) * scaleX;
      const ty = (touch.clientY - rect.top) * scaleY;

      this.joystick.curX = tx;
      this.joystick.curY = ty;

      const diffX = tx - this.joystick.baseX;
      const diffY = ty - this.joystick.baseY;
      const dist = Math.hypot(diffX, diffY);
      const maxDist = 50;

      if (dist > 0) {
        const clamped = Math.min(dist, maxDist);
        this.joystick.dx = (diffX / dist) * (clamped / maxDist);
        this.joystick.dy = (diffY / dist) * (clamped / maxDist);
      }
    }, { passive: true });

    const resetJoy = () => {
      this.joystick.active = false;
      this.joystick.dx = 0;
      this.joystick.dy = 0;
    };
    this.canvas.addEventListener('touchend', resetJoy);
    this.canvas.addEventListener('touchcancel', resetJoy);
  }

  spawnDamageNumber(x, y, text, color = '#ffffff', isCrit = false) {
    const str = String(text).trim();
    const isMiss = str === 'MISS';
    const isGuard = str.includes('GUARD');
    const isNumeric = /^-?\d+$/.test(str);

    if (isCrit) {
      audio.playCriticalHit();
      this.screenShake = 0.18;
      // Spawn authentic RO critical starburst flash
      this.particles.push({
        x,
        y: y - 12,
        vx: 0,
        vy: 0,
        isCritStar: true,
        life: 0.32,
        maxLife: 0.32
      });
    }

    this.damageNumbers.push({
      x: x + (Math.random() - 0.5) * 12,
      y,
      startY: y,
      startX: x,
      text: str,
      color,
      isCrit,
      isMiss,
      isGuard,
      isNumeric,
      life: isCrit ? 1.2 : 0.88,
      maxLife: isCrit ? 1.2 : 0.88,
      vx: (Math.random() - 0.5) * 0.5,
      vy: isCrit ? -3.5 : -2.4
    });
  }

  spawnParticle(x, y, color) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.5 + Math.random() * 3.5;
    this.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color: color || '#ffea00',
      radius: 2 + Math.random() * 3,
      life: 0.45,
      maxLife: 0.45
    });
  }

  screenDirTo8(nx, ny) {
    const ang = Math.atan2(-nx, ny);
    const norm = (ang + Math.PI * 2) % (Math.PI * 2);
    return Math.round(norm / (Math.PI / 4)) % 8;
  }

  get8DirFrames(classKey, dir8 = 0) {
    const base = 'class_' + (classKey || 'novice');
    const mapDir = [0, 1, 2, 3, 4, 3, 2, 1][dir8 % 8] ?? 0;
    const flip = dir8 >= 5;
    const frames = this.spritePool[`${base}_d${mapDir}`] || this.spritePool[base] || [];
    return { frames, flip };
  }

  update(dt) {
    if (this.paused) return;

    this.gameTime += dt;
    if (this.screenShake > 0) this.screenShake = Math.max(0, this.screenShake - dt);
    if (this.levelUpEffectTimer > 0) this.levelUpEffectTimer -= dt;
    if (this.stageClearBannerTimer > 0) this.stageClearBannerTimer -= dt;
    if (this.player.attackTimer > 0) this.player.attackTimer -= dt;
    if (this.overweightWarnTimer > 0) this.overweightWarnTimer -= dt;

    // Sync maxHp & job sprite from character
    if (this.character) {
      if (this.character.maxHp) this.player.maxHp = this.character.maxHp;
      const jobDef = JOB_TREES[this.character.jobId];
      if (jobDef && jobDef.sprite !== this.currentSpriteKey) {
        this.reloadClassSprites(jobDef.sprite);
        this.player.attackType = jobDef.attackType || 'melee_slash';
        this.player.branch = jobDef.branch || 'novice';
        this.player.tier = jobDef.tier ?? 0;
      }
    }

    // 8-Direction Movement (Up/Down/Left/Right + Diagonals) clamped inside map bounds [-1120, 1120]
    let mx = 0;
    let my = 0;
    if (this.keys['w'] || this.keys['keyw'] || this.keys['arrowup']) my -= 1;
    if (this.keys['s'] || this.keys['keys'] || this.keys['arrowdown']) my += 1;
    if (this.keys['a'] || this.keys['keya'] || this.keys['arrowleft']) mx -= 1;
    if (this.keys['d'] || this.keys['keyd'] || this.keys['arrowright']) mx += 1;

    if (this.joystick.active) {
      mx += this.joystick.dx;
      my += this.joystick.dy;
    }

    const len = Math.hypot(mx, my);
    const isMoving = len > 0.05;
    this.player.isMoving = isMoving;

    if (isMoving) {
      const spd = this.player.speed * (dt * 60);
      const nx = mx / len;
      const ny = my / len;
      this.player.x = Math.max(-1120, Math.min(1120, this.player.x + nx * spd));
      this.player.y = Math.max(-1120, Math.min(1120, this.player.y + ny * spd));
      this.player.facingAngle = Math.atan2(ny, nx);
      this.player.dir8 = this.screenDirTo8(nx, ny);
      if (Math.abs(nx) > 0.08) this.player.facingLeft = nx < 0;
      if (Math.abs(ny) > 0.25) this.player.facingBack = ny < 0;

      this.player.animTimer += dt;
      if (this.player.animTimer > 0.065) {
        this.player.animTimer -= 0.065;
        this.player.frameIndex = (this.player.frameIndex + 1) % 8;
      }
    } else {
      this.player.animTimer = 0;
      this.player.frameIndex = 0;
    }

    if (this.player.invulnTime > 0) {
      this.player.invulnTime -= dt;
    }

    // Natural HP regen based on VIT
    const vitRegen = 1.2 + ((this.character?.stats?.vit || 10) * 0.08);
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + dt * vitRegen);

    // Spawner update
    const spawnedBoss = this.waveSpawner.update(dt, this.gameTime, this.player, this.monsters, this.stageKills);
    if (spawnedBoss) {
      audio.playCriticalHit();
      this.screenShake = 0.25;
      this.spawnDamageNumber(this.player.x, this.player.y - 50, `⚠️ BOSS ประจำด่านปรากฏตัว: ${spawnedBoss.name}!`, '#ff4757', true);
      if (this.uiManager && this.uiManager.showROBroadcast) {
        this.uiManager.showROBroadcast(`⚠️ [แจ้งเตือน]: บอสประจำด่าน [${spawnedBoss.name}] ปรากฏตัวแล้ว!! ⚠️`, 'fail');
      }
    }

    // Skill Manager & Normal Attack update
    this.skillManager.update(
      dt,
      this.monsters,
      (x, y, text, col, crit) => this.spawnDamageNumber(x, y, text, col, crit),
      (x, y, col) => this.spawnParticle(x, y, col)
    );

    // Monsters update & collision
    for (let i = this.monsters.length - 1; i >= 0; i--) {
      const m = this.monsters[i];
      m.update(dt, this.player, this.monsters);
      // Keep monsters inside map bounds
      m.x = Math.max(-1160, Math.min(1160, m.x));
      m.y = Math.max(-1160, Math.min(1160, m.y));

      if (!m.alive) {
        this.player.kills++;
        this.stageKills++;
        if (m.isBoss) {
          this.stageBossKilled = true;
          if (this.uiManager && this.uiManager.showROBroadcast) {
            this.uiManager.showROBroadcast(`🏆 [MVP VICTORY]: สังหาร [${m.name}] สำเร็จ! ปลดล็อคด่านถัดไป! 🏆`, 'success');
          }
        }
        this.onMonsterKilled(m);
        this.monsters.splice(i, 1);

        // Strict Stage Progression Lock: Stage N+1 unlocks ONLY after killing Stage N's Boss!
        if (this.stageKills >= this.stageInfo.killQuota && this.stageBossKilled) {
          if (this.character) {
            const unlocked = Math.max(this.character.maxUnlockedStage || 1, this.stageNum + 1);
            this.character.maxUnlockedStage = Math.min(getMaxStages(), unlocked);
          }
          if (this.stageNum < getMaxStages()) {
            this.advanceToStage(this.stageNum + 1);
          }
        }
        continue;
      }

      const dist = Math.hypot(m.x - this.player.x, m.y - this.player.y);
      if (dist < m.radius + 15 && this.player.invulnTime <= 0) {
        if (this.player.kyrieHits > 0) {
          this.player.kyrieHits--;
          this.player.invulnTime = 0.45;
          this.spawnDamageNumber(this.player.x, this.player.y - 30, `🛡️ GUARD (Kyrie)`, '#74b9ff', true);
          continue;
        }

        const charDef = this.character?.def || this.playerConfig.def || 15;
        let actualDmg = Math.max(2, Math.round(m.damage - charDef * 0.42));
        if (this.player.dmgReduce > 0) {
          actualDmg = Math.max(1, Math.round(actualDmg * (1 - this.player.dmgReduce)));
        }

        this.player.hp -= actualDmg;
        this.player.invulnTime = 0.48;
        this.spawnDamageNumber(this.player.x, this.player.y - 30, `-${actualDmg}`, '#ff3333');
        audio.playHitSound();

        if (this.player.hp <= 0) {
          this.player.hp = 0;
          this.triggerGameOver();
          return;
        }
      }
    }

    // Drops & Magnetism (respecting Weight Limit for physical items!)
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      const dist = Math.hypot(this.player.x - d.x, this.player.y - d.y);

      const isPhysicalItem = d.type === 'etc_loot' || d.type === 'equip_drop' || d.type === 'costume_drop' || d.type === 'card_drop' || d.type === 'ore_drop';
      const itemW = d.itemData?.weight || d.cardData?.weight || 5;
      const canCarry = !isPhysicalItem || !this.uiManager || this.uiManager.canCarryWeight(itemW);

      if (dist < this.player.pickupRadius && canCarry) {
        const pull = 7.5 * (dt * 60);
        d.x += ((this.player.x - d.x) / dist) * pull;
        d.y += ((this.player.y - d.y) / dist) * pull;
      }

      if (dist < 22) {
        if (!canCarry) {
          if (this.overweightWarnTimer <= 0) {
            this.overweightWarnTimer = 2.0;
            this.spawnDamageNumber(this.player.x, this.player.y - 36, `⚖️ น้ำหนักเกิน! เก็บของไม่ได้ (ขายหรือทิ้งของก่อน)`, '#ff4757', true);
          }
          continue;
        }
        this.collectDrop(d);
        this.drops.splice(i, 1);
      }
    }

    // Damage numbers arc motion
    for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
      const dn = this.damageNumbers[i];
      dn.life -= dt;
      if (dn.life <= 0) {
        this.damageNumbers.splice(i, 1);
        continue;
      }
      dn.vy += 6.0 * dt; // gravity deceleration
      dn.y += dn.vy * (dt * 60);
      dn.x += (dn.vx || 0) * (dt * 60);
    }

    // Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx * (dt * 60);
      pt.y += pt.vy * (dt * 60);
      pt.life -= dt;
      if (pt.life <= 0) this.particles.splice(i, 1);
    }
  }

  onMonsterKilled(m) {
    // 0. If MVP Boss killed, spawn authentic RO MVP Victory Sign animation!
    if (m.isBoss && this.skillManager && this.skillManager.spawnSprAnim) {
      this.skillManager.spawnSprAnim('ef_mvp', m.x, m.y - 45, 1.8, 1.5);
    }

    // 1. EXP & Job EXP Gem (always)
    this.drops.push({
      type: 'exp_gem',
      spriteKey: 'item_jellopy',
      x: m.x,
      y: m.y,
      value: m.exp,
      jobValue: m.jobExp || Math.round(m.exp * 0.72)
    });

    // 2. Zeny Coins (~40% chance, 100% on boss)
    if (m.isBoss || Math.random() < 0.40) {
      let zenyVal = Math.round((8 + Math.random() * 18) * (1 + this.stageNum * 0.16));
      if (m.isBoss) zenyVal *= 8;
      if (this.player.zenyBonus > 0) zenyVal = Math.round(zenyVal * (1 + this.player.zenyBonus));
      this.drops.push({
        type: 'zeny',
        spriteKey: 'item_zeny',
        label: `${zenyVal} Z`,
        x: m.x + (Math.random() - 0.5) * 24,
        y: m.y + (Math.random() - 0.5) * 24,
        value: zenyVal
      });
    }

    // 3. Common Monster Etc Drop from all 6,982 RO Etc items (~48% chance - easy to find!)
    if (Math.random() < 0.48) {
      const etcItem = generateLootEtc(this.stageNum);
      this.drops.push({
        type: 'etc_loot',
        iconUrl: etcItem.icon,
        label: etcItem.name.split(' (')[0],
        rarityColor: '#dfe6e9',
        x: m.x + (Math.random() - 0.5) * 28,
        y: m.y + (Math.random() - 0.5) * 28,
        itemData: etcItem
      });
    }

    // 4. Map Potion Loot (~14% normal, 100% on Boss) - No potions sold in shop; looted from maps!
    const potRoll = Math.random();
    if (m.isBoss || potRoll < 0.14) {
      const potDefs = [
        { id: 'use_red_potion', name: 'Red Potion', hp: 85, sp: 0, icon: 'assets/items/red_potion.png', color: '#ff7675' },
        { id: 'use_yellow_potion', name: 'Yellow Potion', hp: 240, sp: 0, icon: 'assets/items/yellow_potion.png', color: '#fdcb6e' },
        { id: 'use_white_potion', name: 'White Potion', hp: 580, sp: 0, icon: 'assets/items/white_potion.png', color: '#ffffff' },
        { id: 'use_blue_potion', name: 'Blue Potion', hp: 0, sp: 140, icon: 'assets/items/blue_potion.png', color: '#74b9ff' }
      ];
      let pickedPot = potDefs[0];
      if (this.stageNum > 40 || m.isBoss) {
        pickedPot = potDefs[Math.floor(Math.random() * potDefs.length)];
      } else if (this.stageNum > 15) {
        pickedPot = Math.random() < 0.55 ? potDefs[1] : (Math.random() < 0.3 ? potDefs[3] : potDefs[0]);
      }
      this.drops.push({
        type: 'potion',
        itemId: pickedPot.id,
        iconUrl: pickedPot.icon,
        label: pickedPot.name,
        rarityColor: pickedPot.color,
        x: m.x + (Math.random() - 0.5) * 22,
        y: m.y + (Math.random() - 0.5) * 22,
        value: pickedPot.hp || pickedPot.sp,
        potDef: pickedPot
      });
    }

    // 5. Refine Ore Drop (Phracon / Emveretarcon / Oridecon / Elunium) (~2.2% normal / 35% Boss)
    if (Math.random() < (m.isBoss ? 0.35 : 0.022)) {
      const oreIds = this.stageNum > 50 ? ['mat_oridecon', 'mat_elunium'] : ['mat_phracon', 'mat_emveretarcon', 'mat_elunium'];
      const pickedOreId = oreIds[Math.floor(Math.random() * oreIds.length)];
      const oreDef = SHOP_CATALOG.find(it => it.id === pickedOreId);
      if (oreDef) {
        const oreItem = { ...oreDef, count: 1 };
        this.drops.push({
          type: 'ore_drop',
          iconUrl: oreItem.icon,
          label: oreItem.name.split(' (')[0],
          rarityColor: '#74b9ff',
          x: m.x + (Math.random() - 0.5) * 24,
          y: m.y + (Math.random() - 0.5) * 24,
          itemData: oreItem
        });
      }
    }

    // 6. Very Rare RO Equipment (+0 ONLY!) from all 2,806 Weapons + 5,713 Armors (0.20% normal / 5.5% Boss!)
    const equipChance = m.isBoss ? 0.055 : 0.0020;
    if (Math.random() < equipChance) {
      const equipItem = generateLootEquipment(this.stageNum, m.isBoss);
      this.drops.push({
        type: 'equip_drop',
        iconUrl: equipItem.icon,
        label: equipItem.name,
        rarityColor: equipItem.rarityColor || '#55efc4',
        x: m.x + (Math.random() - 0.5) * 20,
        y: m.y + (Math.random() - 0.5) * 20,
        itemData: equipItem
      });
    }

    // 7. Very Rare RO Costume & Shadow Gear (+0 ONLY!) (0.12% normal / 3.0% Boss!)
    const cosChance = m.isBoss ? 0.030 : 0.0012;
    if (Math.random() < cosChance) {
      const cosItem = generateLootCostume(this.stageNum, m.isBoss);
      if (cosItem) {
        this.drops.push({
          type: 'costume_drop',
          iconUrl: cosItem.icon,
          label: cosItem.name,
          rarityColor: '#a29bfe',
          x: m.x + (Math.random() - 0.5) * 20,
          y: m.y + (Math.random() - 0.5) * 20,
          itemData: cosItem
        });
      }
    }

    // 8. Authentic Ultra-Rare RO Monster Card: 0.01% normal / 0.0001% Boss (rarest in the game!)
    const cardChance = m.isBoss ? 0.000001 : 0.0001;
    if (Math.random() < cardChance) {
      const cardData = generateLootCard(this.stageNum, m.typeKey);
      this.drops.push({
        type: 'card_drop',
        iconUrl: cardData.icon || 'assets/cards/card_0.png',
        label: cardData.name.split(' (')[0],
        rarityColor: '#ff9f43',
        x: m.x,
        y: m.y,
        cardData
      });
    }
  }

  collectDrop(d) {
    if (d.type === 'exp_gem') {
      audio.playGemSound();
      this.addExp(d.value, d.jobValue || Math.round(d.value * 0.72));
    } else if (d.type === 'zeny') {
      audio.playCoinSound();
      this.player.zeny += d.value;
      if (this.character) this.character.zeny = this.player.zeny;
      this.spawnDamageNumber(this.player.x, this.player.y - 20, `+${d.value} Z`, '#ffd700');
    } else if (d.type === 'potion') {
      audio.playCastSound('holy');
      if (d.potDef && d.potDef.sp > 0) {
        this.player.sp = Math.min(this.player.maxSp, this.player.sp + d.potDef.sp);
        this.spawnDamageNumber(this.player.x, this.player.y - 20, `+${d.potDef.sp} SP`, '#74b9ff');
      } else {
        const healAmt = d.value || 85;
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + healAmt);
        this.spawnDamageNumber(this.player.x, this.player.y - 20, `+${healAmt} HP`, '#ff3366');
      }
      // Collect into bag so player keeps potions found in map!
      if (this.player.items && Array.isArray(this.player.items.use)) {
        const pId = d.itemId || 'use_red_potion';
        const existing = this.player.items.use.find(it => it && it.id === pId);
        if (existing) {
          existing.count = (existing.count || 1) + 1;
        } else {
          this.player.items.use.push({
            id: pId,
            name: d.label || 'Red Potion',
            type: 'use',
            count: 1,
            icon: d.iconUrl || 'assets/items/red_potion.png',
            desc: `ฟื้นฟู ${d.value} ${d.potDef && d.potDef.sp ? 'SP' : 'HP'}`
          });
        }
      }
    } else if (d.type === 'etc_loot' || d.type === 'ore_drop') {
      audio.playGemSound();
      if (this.uiManager && this.uiManager.addLootItem) {
        this.uiManager.addLootItem(d.itemData);
      }
      this.spawnDamageNumber(this.player.x, this.player.y - 24, `📦 ${d.itemData.name.split(' (')[0]}`, d.rarityColor || '#dfe6e9');
    } else if (d.type === 'equip_drop') {
      audio.playCoinSound();
      if (this.uiManager && this.uiManager.addLootItem) {
        this.uiManager.addLootItem(d.itemData);
      }
      const col = d.itemData.rarityColor || '#55efc4';
      this.spawnDamageNumber(this.player.x, this.player.y - 34, `⚔️ ได้รับ: ${d.itemData.name}!`, col, true);
    } else if (d.type === 'costume_drop') {
      audio.playLevelUpSound();
      if (this.uiManager && this.uiManager.addLootItem) {
        this.uiManager.addLootItem(d.itemData);
      }
      this.spawnDamageNumber(this.player.x, this.player.y - 38, `👑 คอสสวมใส่: ${d.itemData.name}!`, '#a29bfe', true);
    } else if (d.type === 'card_drop') {
      audio.playLevelUpSound();
      if (this.uiManager && this.uiManager.addLootItem) {
        this.uiManager.addLootItem(d.cardData);
      }
      this.spawnDamageNumber(this.player.x, this.player.y - 45, `🃏 CARD DROP: ${d.cardData.name}!!`, '#ff9f43', true);
    }
  }

  addExp(baseAmt, jobAmt) {
    const expMult = 1 + ((this.character?.cardBonuses?.expPct || 0) / 100);
    baseAmt = Math.max(1, Math.round(baseAmt * expMult));
    jobAmt = Math.max(1, Math.round((jobAmt || baseAmt * 0.72) * expMult));

    // 1. Base EXP Progression
    this.player.exp += baseAmt;
    let baseLeveledUp = false;
    while (this.player.exp >= this.player.nextExp) {
      this.player.exp -= this.player.nextExp;
      this.player.level = Math.min(250, this.player.level + 1);
      this.player.nextExp = calcNextBaseExp(this.player.level);
      baseLeveledUp = true;

      if (this.character) {
        this.character.baseLv = this.player.level;
        this.character.statPoints = (this.character.statPoints || 0) + 5 + Math.floor(this.player.level / 10);
        if (!this.character.stats) {
          this.character.stats = { str: 1, agi: 1, vit: 1, int: 1, dex: 1, luk: 1 };
        }
        // Continuous auto-increase of stats with Base Level
        this.character.stats.str = (this.character.stats.str || 1) + 1;
        this.character.stats.agi = (this.character.stats.agi || 1) + 1;
        this.character.stats.vit = (this.character.stats.vit || 1) + 1;
        this.character.stats.int = (this.character.stats.int || 1) + 1;
        this.character.stats.dex = (this.character.stats.dex || 1) + 1;
        this.character.stats.luk = (this.character.stats.luk || 1) + 1;
      }
    }

    // 2. Job EXP Progression (caps by current Class Tier until player changes job!)
    const maxJobLvForTier = this.player.tier === 0 ? 10 : (this.player.tier === 1 ? 50 : 70);
    if (this.player.jobLevel < maxJobLvForTier) {
      this.player.jobExp += jobAmt;
      while (this.player.jobExp >= this.player.nextJobExp && this.player.jobLevel < maxJobLvForTier) {
        this.player.jobExp -= this.player.nextJobExp;
        this.player.jobLevel++;
        this.player.nextJobExp = calcNextJobExp(this.player.jobLevel);
        if (this.character) {
          this.character.jobLv = this.player.jobLevel;
          this.character.skillPoints = (this.character.skillPoints || 0) + 1;
        }
        this.spawnDamageNumber(this.player.x, this.player.y - 62, `🌟 JOB LEVEL UP! J.Lv.${this.player.jobLevel}`, '#74b9ff', true);
      }
    } else {
      this.player.jobExp = 0;
    }

    if (this.character) {
      this.character.baseExp = this.player.exp;
      this.character.jobExp = this.player.jobExp;
    }

    if (baseLeveledUp) {
      if (this.uiManager) this.uiManager.recalcStats();
      this.player.maxHp = this.character?.maxHp || (this.player.maxHp + 45);
      this.player.hp = this.player.maxHp;
      this.player.maxSp = this.character?.maxSp || (this.player.maxSp + 16);
      this.player.sp = this.player.maxSp;
      audio.playLevelUpSound();
      this.levelUpEffectTimer = 1.4;
      this.spawnDamageNumber(this.player.x, this.player.y - 45, `✨ BASE LEVEL UP! Lv.${this.player.level}`, '#ffff00', true);
      this.triggerLevelUp();
    }
  }

  triggerLevelUp() {
    this.paused = true;
    const myBranch = this.character?.branch || this.player.branch || 'swordsman';
    const myTier = this.character?.tier ?? this.player.tier ?? 1;

    const maxOff = this.skillManager.getMaxOffensiveSlots();
    const maxSup = this.skillManager.getMaxSupportSlots();
    const choices = this.skillManager.getLevelUpChoices(myBranch, myTier, 3);
    const slotInfo = {
      offCount: this.skillManager.getSkillsByCategory('offensive').length,
      offMax: maxOff,
      supCount: this.skillManager.getSkillsByCategory('support').length,
      supMax: maxSup
    };

    this.onLevelUp(choices, (chosenOption) => {
      const chosenId = typeof chosenOption === 'string' ? chosenOption : chosenOption.id;
      this.skillManager.addSkill(chosenId, 1);
      if (this.character && this.character.skills && SKILL_DEFS[chosenId]) {
        this.character.skills[chosenId] = this.skillManager.getSkillLevel(chosenId);
      }
      if (this.uiManager) this.uiManager.recalcStats();
      this.paused = false;
    }, slotInfo);
  }

  triggerGameOver() {
    this.paused = true;
    this.onGameOver({
      time: this.gameTime,
      stage: this.stageNum,
      level: this.player.level,
      kills: this.player.kills,
      zeny: this.player.zeny
    });
  }

  draw() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.fillStyle = '#1e272e';
    ctx.fillRect(0, 0, w, h);

    // Camera follow player (with Screen Shake on Critical Hits!)
    let shakeX = 0, shakeY = 0;
    if (this.screenShake > 0) {
      shakeX = (Math.random() - 0.5) * 8;
      shakeY = (Math.random() - 0.5) * 8;
    }
    ctx.save();
    ctx.translate(w / 2 - this.player.x + shakeX, h / 2 - this.player.y + shakeY);

    this.drawGround(ctx);
    this.drawDrops(ctx);
    this.skillManager.draw(ctx);

    for (const m of this.monsters) {
      m.draw(ctx);
    }

    this.drawPlayer(ctx);

    // Particles & Critical Starbursts
    for (const pt of this.particles) {
      ctx.save();
      if (pt.isCritStar) {
        const prog = 1 - (pt.life / pt.maxLife);
        const star = this.msgSprites.critStar;
        if (star && star.complete && star.width > 0) {
          ctx.globalAlpha = Math.max(0, (1 - prog) * 1.2);
          const sz = 72 * (0.75 + prog * 0.5);
          ctx.drawImage(star, pt.x - sz / 2, pt.y - sz / 2, sz, sz);
        }
      } else {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.radius, 0, Math.PI * 2);
        ctx.fillStyle = pt.color;
        ctx.globalAlpha = pt.life / pt.maxLife;
        ctx.fill();
      }
      ctx.restore();
    }

    // Authentic RO Damage Numbers & Sprites
    for (const dn of this.damageNumbers) {
      ctx.save();
      const alpha = Math.min(1, dn.life / (dn.maxLife * 0.28));
      ctx.globalAlpha = alpha;

      if (dn.isMiss) {
        const missImg = this.msgSprites.miss;
        if (missImg && missImg.complete && missImg.width > 0) {
          ctx.drawImage(missImg, Math.round(dn.x - missImg.width / 2), Math.round(dn.y - missImg.height / 2));
        }
      } else if (dn.isGuard) {
        const guardImg = this.msgSprites.guard;
        if (guardImg && guardImg.complete && guardImg.width > 0) {
          ctx.drawImage(guardImg, Math.round(dn.x - guardImg.width / 2), Math.round(dn.y - guardImg.height / 2));
        }
      } else if (dn.isNumeric) {
        // Draw Authentic RO Number Sprites (숫자_*.png)
        const str = dn.text.replace(/^-/, '');
        const scale = dn.isCrit ? 1.45 : 1.15;

        // If Critical Hit: Draw authentic CRITICAL banner above digits!
        if (dn.isCrit) {
          const critImg = this.msgSprites.critical;
          if (critImg && critImg.complete && critImg.width > 0) {
            const cw = critImg.width * 1.05;
            const ch = critImg.height * 1.05;
            ctx.drawImage(critImg, Math.round(dn.x - cw / 2), Math.round(dn.y - ch - 8), cw, ch);
          }
        }

        // Measure total width of digits
        let totalW = 0;
        const digitImgs = [];
        for (let i = 0; i < str.length; i++) {
          const d = parseInt(str[i], 10);
          const img = this.damageDigits[d];
          if (img && img.complete && img.width > 0) {
            digitImgs.push(img);
            totalW += (img.width * scale) + 1.5;
          }
        }

        if (digitImgs.length > 0) {
          let curX = Math.round(dn.x - totalW / 2);
          if (dn.isCrit) {
            ctx.shadowColor = '#e74c3c';
            ctx.shadowBlur = 12;
          }
          for (const img of digitImgs) {
            const dw = Math.round(img.width * scale);
            const dh = Math.round(img.height * scale);
            ctx.drawImage(img, curX, Math.round(dn.y - dh / 2), dw, dh);
            curX += dw + 1.5;
          }
        } else {
          ctx.textAlign = 'center';
          ctx.font = dn.isCrit ? 'bold 18px Tahoma, sans-serif' : 'bold 15px Tahoma, sans-serif';
          ctx.fillStyle = dn.isCrit ? '#ff4757' : '#ffd32a';
          ctx.strokeStyle = '#1e272e';
          ctx.lineWidth = 3.5;
          ctx.strokeText(str, dn.x, dn.y);
          ctx.fillText(str, dn.x, dn.y);
        }
      } else {
        // Text notifications (+100 HP, +500 Z, Stage Unlock, etc.)
        ctx.textAlign = 'center';
        ctx.font = dn.isCrit ? 'bold 13px Tahoma, sans-serif' : 'bold 11px Tahoma, sans-serif';
        ctx.fillStyle = dn.color;
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.strokeText(dn.text, dn.x, dn.y);
        ctx.fillText(dn.text, dn.x, dn.y);
      }

      ctx.restore();
    }

    ctx.restore();

    // Draw Authentic RO Basic Info & Active Timed Buffs
    this.drawROBasicInfoHUD(ctx, w, h);

    // Draw Authentic In-Dungeon RO Minimap (matching Prontera town style)
    this.drawROMinimap(ctx, w, h);

    if (this.joystick.active) {
      this.drawJoystick(ctx);
    }
  }

  drawGround(ctx) {
    const arenaSize = 2400;
    const half = arenaSize / 2;

    // 1. Render authentic RO .gnd 3D Ground Map (/grf/groundmap/<mapCode>.png)
    const gndImg = this.stageInfo?.groundMapImg ? this.zoneTextures[this.stageInfo.groundMapImg] : null;
    if (gndImg && gndImg.complete && gndImg.width > 0) {
      ctx.drawImage(gndImg, -half, -half, arenaSize, arenaSize);
      // Draw subtle arena boundary frame
      ctx.strokeStyle = 'rgba(255, 215, 0, 0.35)';
      ctx.lineWidth = 4;
      ctx.strokeRect(-half + 40, -half + 40, arenaSize - 80, arenaSize - 80);
      return;
    }

    // Fallback while .gnd groundmap is streaming
    const tileSize = 128;
    const startX = Math.floor((this.player.x - 320) / tileSize) * tileSize;
    const endX = startX + 640 + tileSize;
    const startY = Math.floor((this.player.y - 500) / tileSize) * tileSize;
    const endY = startY + 1000 + tileSize;

    const tex = this.stageInfo?.tex ? this.zoneTextures[this.stageInfo.tex] : null;
    const hasTex = tex && tex.complete && tex.width > 0;

    for (let x = startX; x <= endX; x += tileSize) {
      for (let y = startY; y <= endY; y += tileSize) {
        if (hasTex) {
          ctx.drawImage(tex, x, y, tileSize, tileSize);
        } else {
          ctx.fillStyle = ((x / tileSize + y / tileSize) % 2 === 0) ? '#2a3b2e' : '#253528';
          ctx.fillRect(x, y, tileSize, tileSize);
        }
      }
    }
  }

  drawDrops(ctx) {
    for (const d of this.drops) {
      ctx.save();
      ctx.translate(d.x, d.y);
      const bob = Math.sin(this.gameTime * 5 + d.x) * 2.5;

      // Ground shadow
      ctx.beginPath();
      ctx.ellipse(0, 10, 10, 4, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fill();

      // If drop has a real RO iconUrl (Equipment, Costume, Card, Etc, Potion, Ore), render it!
      if (d.iconUrl) {
        const iconImg = this.getDropIconImage(d.iconUrl);
        if (d.type === 'card_drop' || d.type === 'equip_drop' || d.type === 'costume_drop') {
          ctx.shadowBlur = 12;
          ctx.shadowColor = d.rarityColor || '#ffd700';
        }
        if (iconImg && iconImg.complete && iconImg.width > 0) {
          const size = (d.type === 'equip_drop' || d.type === 'costume_drop' || d.type === 'card_drop') ? 26 : 22;
          ctx.drawImage(iconImg, -size / 2, -size / 2 + bob, size, size);
        } else {
          ctx.fillStyle = d.rarityColor || '#ffeaa7';
          ctx.fillRect(-9, -9 + bob, 18, 18);
        }

        // Draw item name tag below the dropped item on ground
        if (d.label) {
          ctx.shadowBlur = 0;
          ctx.font = 'bold 9px Tahoma, sans-serif';
          ctx.textAlign = 'center';
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 2.5;
          ctx.strokeText(d.label, 0, 19);
          ctx.fillStyle = d.rarityColor || '#ffffff';
          ctx.fillText(d.label, 0, 19);
        }
        ctx.restore();
        continue;
      }

      const img = this.spritePool[d.spriteKey || `item_${d.type}`]?.[0];
      if (img && img.complete && img.width > 0) {
        const sw = 18;
        const sh = (img.height / img.width) * sw;
        ctx.drawImage(img, -sw / 2, -sh / 2 + bob, sw, sh);
      } else {
        ctx.beginPath();
        ctx.arc(0, bob, 5, 0, Math.PI * 2);
        ctx.fillStyle = d.type === 'zeny' ? '#ffd700' : '#74b9ff';
        ctx.fill();
      }
      ctx.restore();
    }
  }

  drawPlayer(ctx) {
    ctx.save();
    ctx.translate(this.player.x, this.player.y);

    if (this.player.invulnTime > 0 && Math.floor(this.gameTime * 20) % 2 === 0) {
      ctx.globalAlpha = 0.55;
    }

    // Shadow
    ctx.beginPath();
    ctx.ellipse(0, 18, 16, 6, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fill();

    // Kyrie Eleison Shield Visual
    if (this.player.kyrieHits > 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(116, 185, 255, 0.85)';
      ctx.fillStyle = 'rgba(116, 185, 255, 0.18)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, -12, 32, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Smooth 8-Direction Walk Animation when moving; 3-Frame Attack Pose when attacking; 3-Frame Gentle Breathing Stand Pose when Idle
    const dir8 = this.player.dir8 || 0;
    let currentImg = null;
    let flipHoriz = false;

    if (this.player.isMoving) {
      // Natural 8-Way Walking (d0..d7)
      const walkFrames = this.spritePool?.[`player_walk_d${dir8}`];
      if (walkFrames && walkFrames.length) {
        currentImg = walkFrames[this.player.frameIndex % walkFrames.length];
        flipHoriz = false;
      } else {
        const { frames, flip } = this.get8DirFrames(this.currentSpriteKey || this.playerConfig.id, dir8);
        currentImg = frames[this.player.frameIndex % (frames.length || 8)] || frames[0];
        flipHoriz = flip;
      }
    } else if (this.player.attackTimer > 0) {
      // Standing Attack Strike
      const dur = this.player.attackAnimDuration || 0.28;
      const progress = Math.max(0, Math.min(0.99, 1 - (this.player.attackTimer / dur)));
      const atkFrames = this.spritePool?.[`player_atk_d${dir8}`];
      if (atkFrames && atkFrames.length) {
        const atkIdx = Math.min(atkFrames.length - 1, Math.floor(progress * atkFrames.length));
        currentImg = atkFrames[atkIdx] || atkFrames[0];
        flipHoriz = false;
      } else {
        const atkIdx = Math.min(3, Math.floor(progress * 4));
        currentImg = this.attackSprites[atkIdx] || this.attackSprites[0];
        flipHoriz = this.player.facingLeft;
      }
    } else {
      // Authentic RO Idle Standing Pose (Actions 0..7: gentle 3-frame breathing with feet side-by-side!)
      const standFrames = this.spritePool?.[`player_stand_d${dir8}`];
      if (standFrames && standFrames.length) {
        const idleIdx = Math.floor(this.gameTime * 3.5) % standFrames.length;
        currentImg = standFrames[idleIdx] || standFrames[0];
        flipHoriz = false;
      } else {
        const { frames, flip } = this.get8DirFrames(this.currentSpriteKey || this.playerConfig.id, dir8);
        currentImg = frames[0];
        flipHoriz = flip;
      }
    }

    if (currentImg && currentImg.complete && currentImg.width > 0) {
      const sw = 56;
      const sh = (currentImg.height / currentImg.width) * sw;

      ctx.save();
      if (flipHoriz) {
        ctx.scale(-1, 1);
      }

      // Draw anchored so that (anchorX=55, anchorY=105) on the 110x120 canvas lands EXACTLY at (0, 18) on the shadow!
      const drawX = -sw / 2;
      const drawY = 18 - sh * (105 / 120);
      ctx.drawImage(currentImg, drawX, drawY, sw, sh);

      // Authentic RO Equipment Overlays (Headgear, Weapon, Shield)
      this.drawEquipmentOverlays(ctx, sw, sh, 0);
      ctx.restore();
    }

    if (this.levelUpEffectTimer > 0) {
      ctx.textAlign = 'center';
      ctx.font = 'bold 14px Tahoma, sans-serif';
      ctx.fillStyle = '#ffea00';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 6;
      ctx.fillText('⭐ LEVEL UP !! ⭐', 0, -45);
    }

    ctx.restore();
  }

  drawEquipmentOverlays(ctx, sw, sh, walkBob) {
    if (!this.character?.items) return;
    if (!this.equipImgs) this.equipImgs = new Map();
    const getEquipImg = (src) => {
      if (!src) return null;
      let img = this.equipImgs.get(src);
      if (!img) {
        img = new Image();
        img.src = src;
        this.equipImgs.set(src, img);
      }
      return (img.complete && img.width > 0) ? img : null;
    };

    const allEquipped = [
      ...(this.character.items.eqp || []).filter(it => it && it.equipped),
      ...(this.character.items.cos || []).filter(it => it && it.equipped)
    ];

    // 1. Headgear (Top Headgear or Costume Top)
    const headgear = allEquipped.find(it => it.slot === 'head_top' || it.slot === 'cos_top');
    if (headgear) {
      const hImg = getEquipImg(headgear.icon || headgear.collection);
      if (hImg) {
        const hw = 26, hh = 26;
        ctx.drawImage(hImg, -hw / 2, -sh * (105 / 120) + 4 + walkBob, hw, hh);
      }
    }

    // 2. Weapon (Right Hand)
    const weapon = allEquipped.find(it => it.slot === 'right_hand');
    if (weapon) {
      const wImg = getEquipImg(weapon.icon || weapon.collection);
      if (wImg) {
        const ww = 22, wh = 22;
        ctx.save();
        ctx.translate(14, -8 + walkBob);
        ctx.rotate(0.35);
        ctx.drawImage(wImg, -ww / 2, -wh / 2, ww, wh);
        ctx.restore();
      }
    }

    // 3. Shield (Left Hand)
    const shield = allEquipped.find(it => it.slot === 'left_hand');
    if (shield) {
      const sImg = getEquipImg(shield.icon || shield.collection);
      if (sImg) {
        const sww = 20, swh = 20;
        ctx.save();
        ctx.translate(-14, -6 + walkBob);
        ctx.drawImage(sImg, -sww / 2, -swh / 2, sww, swh);
        ctx.restore();
      }
    }
  }

  drawROBasicInfoHUD(ctx, w, h) {
    ctx.save();

    const minimapSize = 104;
    const boxX = 8;
    const boxY = 6;
    const boxW = w - minimapSize - 20;
    const boxH = 104;

    ctx.fillStyle = 'rgba(235, 238, 242, 0.94)';
    ctx.strokeStyle = '#4a5a70';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 6);
    ctx.fill();
    ctx.stroke();

    // Top line: Character Name + Job
    const charName = this.character?.name || 'Novice';
    const jobName = this.character?.jobName || this.playerConfig.name;
    ctx.textAlign = 'left';
    ctx.font = 'bold 11px Tahoma, sans-serif';
    ctx.fillStyle = '#1c2833';
    ctx.fillText(`${charName} [${jobName.split(' (')[0]}]`, boxX + 8, boxY + 16);

    ctx.textAlign = 'right';
    ctx.font = 'bold 10px Tahoma, sans-serif';
    ctx.fillStyle = '#b71540';
    ctx.fillText(`🚩 ด่านที่ ${this.stageNum}`, boxX + boxW - 8, boxY + 16);

    // HP Bar
    const hpPct = Math.max(0, this.player.hp / this.player.maxHp);
    const barX = boxX + 48;
    const barW = boxW - 56;

    ctx.fillStyle = '#2d3436';
    ctx.font = 'bold 10px Tahoma, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`HP`, boxX + 8, boxY + 32);

    ctx.fillStyle = '#dcdde1';
    ctx.fillRect(barX, boxY + 22, barW, 11);
    ctx.strokeStyle = '#718093';
    ctx.strokeRect(barX, boxY + 22, barW, 11);
    ctx.fillStyle = hpPct > 0.3 ? '#2ecc71' : '#ff4757';
    ctx.fillRect(barX + 1, boxY + 23, Math.max(0, (barW - 2) * hpPct), 9);

    ctx.font = '9px monospace';
    ctx.fillStyle = '#1e272e';
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(this.player.hp)}/${this.player.maxHp}`, barX + barW - 4, boxY + 31);

    // Stage Progress Bar (Kill Quota + Boss Status)
    const quota = this.stageInfo.killQuota || 25;
    const stgPct = Math.min(1, this.stageKills / quota);
    ctx.fillStyle = '#2d3436';
    ctx.font = 'bold 10px Tahoma, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`เป้าหมาย`, boxX + 8, boxY + 47);

    ctx.fillStyle = '#dcdde1';
    ctx.fillRect(barX, boxY + 37, barW, 11);
    ctx.strokeStyle = '#718093';
    ctx.strokeRect(barX, boxY + 37, barW, 11);
    ctx.fillStyle = '#0984e3';
    ctx.fillRect(barX + 1, boxY + 38, Math.max(0, (barW - 2) * stgPct), 9);

    ctx.font = '9px Tahoma, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    const bossTag = this.stageBossKilled
      ? 'เคลียร์บอสแล้ว!'
      : (this.stageKills >= quota ? '⚠️ ปราบบอสเพื่อเปิดด่าน!' : `สังหาร ${this.stageKills}/${quota} (บอส: ${this.stageInfo.bossType})`);
    ctx.fillText(bossTag, barX + barW / 2, boxY + 46);

    // Base EXP & Job EXP Bars side-by-side
    const halfBarW = Math.floor((barW - 54) / 2);
    const expPct = Math.min(1, this.player.exp / Math.max(1, this.player.nextExp));
    ctx.fillStyle = '#2d3436';
    ctx.font = 'bold 9px Tahoma, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Base`, boxX + 8, boxY + 62);

    ctx.fillStyle = '#dcdde1';
    ctx.fillRect(barX, boxY + 53, halfBarW, 9);
    ctx.strokeStyle = '#718093';
    ctx.strokeRect(barX, boxY + 53, halfBarW, 9);
    ctx.fillStyle = '#f39c12';
    ctx.fillRect(barX + 1, boxY + 54, Math.max(0, (halfBarW - 2) * expPct), 7);

    const jBarX = barX + halfBarW + 42;
    const jExpPct = Math.min(1, this.player.jobExp / Math.max(1, this.player.nextJobExp));
    ctx.fillStyle = '#2d3436';
    ctx.fillText(`Job`, barX + halfBarW + 6, boxY + 62);

    ctx.fillStyle = '#dcdde1';
    ctx.fillRect(jBarX, boxY + 53, halfBarW, 9);
    ctx.strokeStyle = '#718093';
    ctx.strokeRect(jBarX, boxY + 53, halfBarW, 9);
    ctx.fillStyle = '#8e44ad';
    ctx.fillRect(jBarX + 1, boxY + 54, Math.max(0, (halfBarW - 2) * jExpPct), 7);

    // Bottom info line: Zeny, Weight, Stats
    const curW = this.character?.currentWeight || 0;
    const maxW = this.character?.maxWeight || 2000;
    const isOverW = curW >= maxW;
    ctx.font = 'bold 10px Tahoma, sans-serif';
    ctx.fillStyle = isOverW ? '#c0392b' : '#2f3542';
    ctx.textAlign = 'left';
    ctx.fillText(
      `💰 ${this.player.zeny.toLocaleString()} Z  |  ⚖️ ${curW}/${maxW} ${isOverW ? '(เต็ม!)' : ''}  |  ⏱️ CDR -${this.character?.cdrPct || 0}%`,
      boxX + 8,
      boxY + 80
    );

    ctx.font = '10px Tahoma, sans-serif';
    ctx.fillStyle = '#1e3799';
    ctx.fillText(
      `⚔️ ATK ${this.character?.atk || 35} / MATK ${this.character?.matk || 30}  |  🛡️ DEF ${this.character?.def || 15}  |  ⚡ ASPD ${this.character?.aspd || 156}`,
      boxX + 8,
      boxY + 95
    );

    // Draw Active Timed Buffs on Right Side
    this.drawActiveBuffIcons(ctx, w);

    // Draw Dual-Row Skill Bar above bottom RO menu bar
    this.drawSkillTray(ctx, w, h);

    ctx.restore();
  }

  drawROMinimap(ctx, w, h) {
    const size = 104;
    const mx = w - size - 8;
    const my = 6;
    const headerH = 16;
    const bodyH = size - headerH;

    ctx.save();

    // 1. Window Frame & Header Bar (Authentic RO Minimap Frame)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
    ctx.fillRect(mx, my, size, size);
    ctx.strokeStyle = '#4a5a70';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(mx, my, size, size);

    // Header bar gradient
    const grad = ctx.createLinearGradient(mx, my, mx + size, my);
    grad.addColorStop(0, '#1e3799');
    grad.addColorStop(1, '#4a69bd');
    ctx.fillStyle = grad;
    ctx.fillRect(mx + 1, my + 1, size - 2, headerH);

    // Coordinates calculation (0..200 grid)
    const normPx = Math.max(0, Math.min(1, (this.player.x + 1200) / 2400));
    const normPy = Math.max(0, Math.min(1, (this.player.y + 1200) / 2400));
    const coordX = Math.round(normPx * 200);
    const coordY = Math.round(normPy * 200);

    ctx.font = 'bold 9px Tahoma, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText(this.stageInfo.mapCode || 'prt_fild', mx + 4, my + 12);
    ctx.textAlign = 'right';
    ctx.fillText(`${coordX}, ${coordY}`, mx + size - 4, my + 12);

    // 2. Map Image Viewport
    const viewY = my + headerH + 1;
    const viewH = bodyH - 2;
    const viewW = size - 2;
    const viewX = mx + 1;

    ctx.save();
    ctx.beginPath();
    ctx.rect(viewX, viewY, viewW, viewH);
    ctx.clip();

    const mapImg = this.zoneTextures[this.stageInfo.mapImg];
    if (mapImg && mapImg.complete && mapImg.width > 0) {
      ctx.drawImage(mapImg, viewX, viewY, viewW, viewH);
    } else {
      ctx.fillStyle = '#1e272e';
      ctx.fillRect(viewX, viewY, viewW, viewH);
    }

    // 3. Drops Dots on Minimap
    for (const d of this.drops) {
      const dnx = (d.x + 1200) / 2400;
      const dny = (d.y + 1200) / 2400;
      const dx = viewX + dnx * viewW;
      const dy = viewY + dny * viewH;
      ctx.fillStyle = '#f1c40f';
      ctx.fillRect(dx - 1, dy - 1, 2, 2);
    }

    // 4. Monsters Dots on Minimap
    for (const m of this.monsters) {
      if (!m.alive) continue;
      const mnx = (m.x + 1200) / 2400;
      const mny = (m.y + 1200) / 2400;
      const dotX = viewX + mnx * viewW;
      const dotY = viewY + mny * viewH;

      if (m.isBoss) {
        // Pulsing Boss Marker with Gold Ring
        const pulse = Math.sin(this.gameTime * 6) * 1.5;
        ctx.fillStyle = '#e74c3c';
        ctx.strokeStyle = '#f1c40f';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(dotX, dotY, 4.5 + pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillStyle = '#ff4757';
        ctx.beginPath();
        ctx.arc(dotX, dotY, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 5. Authentic RO Player Heading Arrow (Rotating Directional Red Triangle)
    const px = viewX + normPx * viewW;
    const py = viewY + normPy * viewH;
    const heading = this.player.facingAngle !== undefined ? (this.player.facingAngle + Math.PI / 2) : 0;

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(heading);
    ctx.fillStyle = '#ff3b3b';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4.5, 4.5);
    ctx.lineTo(0, 2);
    ctx.lineTo(-4.5, 4.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.restore(); // end clip

    ctx.restore();
  }

  drawActiveBuffIcons(ctx, w) {
    const buffs = Array.from(this.skillManager.activeBuffs.values());
    if (!buffs.length) return;

    const startY = 114;
    const boxSize = 36;
    const rightX = w - boxSize - 10;

    buffs.forEach((b, idx) => {
      const by = startY + idx * (boxSize + 6);
      ctx.fillStyle = 'rgba(20, 28, 40, 0.85)';
      ctx.strokeStyle = '#f1c40f';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(rightX, by, boxSize, boxSize, 5);
      ctx.fill();
      ctx.stroke();

      const iconImg = this.skillIconImages[b.id];
      if (iconImg && iconImg.complete && iconImg.width > 0) {
        ctx.drawImage(iconImg, rightX + 4, by + 3, 28, 22);
      }

      ctx.textAlign = 'center';
      ctx.font = 'bold 9px Tahoma, sans-serif';
      ctx.fillStyle = '#ffeaa7';
      ctx.fillText(`${Math.ceil(b.remaining)}s`, rightX + boxSize / 2, by + 33);
    });
  }

  drawSkillTray(ctx, w, h) {
    const trayH = 86;
    // Positioned above the bottom .ro-menu-bar so player can open Status/Equip/Items/Skills/Codex in battle!
    const trayY = h - trayH - 42;
    const trayX = 8;
    const trayW = w - 16;

    ctx.fillStyle = 'rgba(235, 238, 242, 0.94)';
    ctx.strokeStyle = '#4a5a70';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(trayX, trayY, trayW, trayH, 7);
    ctx.fill();
    ctx.stroke();

    const offensive = this.skillManager.getSkillsByCategory('offensive');
    const support = this.skillManager.getSkillsByCategory('support');

    const drawRow = (label, list, rowY, borderColor, maxSlots) => {
      ctx.textAlign = 'left';
      ctx.font = 'bold 10px Tahoma, sans-serif';
      ctx.fillStyle = '#2c3e50';
      ctx.fillText(label, trayX + 8, rowY + 23);

      const startX = trayX + 92;
      const slotW = 86;
      const slotH = 36;

      for (let i = 0; i < maxSlots; i++) {
        const sx = startX + i * (slotW + 5);
        const entry = list[i];

        ctx.fillStyle = entry ? '#ffffff' : 'rgba(200,208,218,0.5)';
        ctx.strokeStyle = entry ? borderColor : '#95a5a6';
        ctx.lineWidth = entry ? 1.5 : 1;
        ctx.beginPath();
        ctx.roundRect(sx, rowY, slotW, slotH, 4);
        ctx.fill();
        ctx.stroke();

        if (entry) {
          const [id, lv] = entry;
          const cd = Math.max(0, this.skillManager.cooldowns.get(id) || 0);
          const maxCd = Math.max(1, this.skillManager.maxCooldowns.get(id) || 2000);
          if (cd > 0) {
            const pct = Math.min(1, cd / maxCd);
            ctx.fillStyle = 'rgba(44, 62, 80, 0.18)';
            ctx.fillRect(sx + 1, rowY + 1, (slotW - 2) * pct, slotH - 2);
          }

          const iconImg = this.skillIconImages[id];
          if (iconImg && iconImg.complete && iconImg.width > 0) {
            ctx.drawImage(iconImg, sx + 4, rowY + 6, 24, 24);
          }
          ctx.textAlign = 'left';
          ctx.font = 'bold 10px Tahoma, sans-serif';
          ctx.fillStyle = '#c0392b';
          ctx.fillText(`Lv.${lv}/10`, sx + 32, rowY + 15);

          ctx.fillStyle = cd > 0 ? '#d35400' : '#27ae60';
          ctx.font = 'bold 9px Tahoma, sans-serif';
          ctx.fillText(cd > 0 ? `⏳ ${(cd / 1000).toFixed(1)}s` : '⚡ พร้อม', sx + 32, rowY + 29);
        } else {
          ctx.textAlign = 'center';
          ctx.font = '9px Tahoma, sans-serif';
          ctx.fillStyle = '#95a5a6';
          ctx.fillText('ช่องว่าง', sx + slotW / 2, rowY + 21);
        }
      }
    };

    const maxOff = this.skillManager ? this.skillManager.getMaxOffensiveSlots() : 4;
    const maxSup = this.skillManager ? this.skillManager.getMaxSupportSlots() : 4;
    drawRow(`⚔️ โจมตี (${offensive.length}/${maxOff}):`, offensive, trayY + 5, '#c0392b', maxOff);
    drawRow(`✨ บัพ/ซัพ (${support.length}/${maxSup}):`, support, trayY + 45, '#2980b9', maxSup);
  }

  drawJoystick(ctx) {
    const j = this.joystick;
    ctx.save();
    ctx.beginPath();
    ctx.arc(j.baseX, j.baseY, 44, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(j.baseX + j.dx * 34, j.baseY + j.dy * 34, 20, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(30, 144, 255, 0.7)';
    ctx.fill();
    ctx.restore();
  }
}
