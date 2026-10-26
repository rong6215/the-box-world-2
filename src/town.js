// Walkable Town Hub (D2 Survivors Campfire Style - Walk freely, switch classes, talk to NPCs)
import { CLASSES } from './classes.js';
import { audio } from './audio.js';

export class TownHub {
  constructor(canvas, onStartBattle, onSelectClass, onResetChar) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onStartBattle = onStartBattle;
    this.onSelectClass = onSelectClass;
    this.onResetChar = onResetChar;

    this.selectedClassId = 'swordsman';
    this.spritePool = {};
    this.animTime = 0;

    // Player walking in Town
    this.player = {
      x: 240,
      y: 420,
      speed: 3.2,
      frameIndex: 0,
      animTimer: 0,
      facingLeft: false
    };

    // Town Layout: Campfire in the center
    this.campfire = { x: 240, y: 340, radius: 24 };

    // Other Classes standing in a circle around the campfire (like D2 Survivors)
    this.classPedestals = [];
    this.setupClassPedestals();

    // NPCs
    this.npcJobGuider = { x: 100, y: 220, w: 54, h: 72, name: 'Job Master', title: 'NPC เปลี่ยนอาชีพ' };
    this.npcKafra = { x: 380, y: 220, w: 54, h: 72, name: 'Kafra Service', title: 'บริการคาฟรา' };

    // Warp Portal / Waypoint to Battle (South of Campfire)
    this.warpPortal = { x: 240, y: 580, radius: 36, label: '⚔️ วาร์ปสู่สนามรบ ⚔️' };

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

    this.activeModal = null;
    this.notification = '🕹️ เดินสำรวจเมือง: แตะตัวละครรอบกองไฟเพื่อเปลี่ยนอาชีพ | เดินเข้าวาร์ปเพื่อเริ่มสู้';
    this.notifTimer = 5;

    this.setupInput();
  }

  setupClassPedestals() {
    const classKeys = Object.keys(CLASSES);
    const radius = 95;
    const count = classKeys.length;

    this.classPedestals = classKeys.map((key, i) => {
      // Angle around campfire (starting from South-West around to South-East)
      const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
      return {
        classId: key,
        x: this.campfire.x + Math.cos(angle) * radius,
        y: this.campfire.y + Math.sin(angle) * radius,
        info: CLASSES[key]
      };
    });
  }

  loadSprites(spritePool) {
    this.spritePool = spritePool;
  }

  setupInput() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.key.toLowerCase()] = true;
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.key.toLowerCase()] = false;
    });

    this.canvas.addEventListener('touchstart', (e) => {
      if (this.activeModal) return;
      const rect = this.canvas.getBoundingClientRect();
      const touch = e.touches[0];
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      const tx = (touch.clientX - rect.left) * scaleX;
      const ty = (touch.clientY - rect.top) * scaleY;

      // Tap on NPCs / Pedestals directly
      this.checkTapInteraction(tx, ty);

      // Joystick activation on bottom half
      if (ty > this.canvas.height * 0.45) {
        this.joystick.active = true;
        this.joystick.baseX = tx;
        this.joystick.baseY = ty;
        this.joystick.curX = tx;
        this.joystick.curY = ty;
        this.joystick.dx = 0;
        this.joystick.dy = 0;
      }
    });

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
      const maxDist = 45;

      if (dist > 0) {
        const clamped = Math.min(dist, maxDist);
        this.joystick.dx = (diffX / dist) * (clamped / maxDist);
        this.joystick.dy = (diffY / dist) * (clamped / maxDist);
      }
    });

    const resetJoy = () => {
      this.joystick.active = false;
      this.joystick.dx = 0;
      this.joystick.dy = 0;
    };
    this.canvas.addEventListener('touchend', resetJoy);
    this.canvas.addEventListener('touchcancel', resetJoy);

    // Desktop click support
    this.canvas.addEventListener('click', (e) => {
      if (this.activeModal) return;
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      const tx = (e.clientX - rect.left) * scaleX;
      const ty = (e.clientY - rect.top) * scaleY;
      this.checkTapInteraction(tx, ty);
    });
  }

  checkTapInteraction(x, y) {
    // Check NPC Job Guider
    if (Math.hypot(x - this.npcJobGuider.x, y - this.npcJobGuider.y) < 45) {
      this.openJobModal();
      audio.playCoinSound();
      return;
    }

    // Check NPC Kafra
    if (Math.hypot(x - this.npcKafra.x, y - this.npcKafra.y) < 45) {
      this.openResetModal();
      audio.playCoinSound();
      return;
    }

    // Check Warp Portal
    if (Math.hypot(x - this.warpPortal.x, y - this.warpPortal.y) < 45) {
      this.onStartBattle();
      return;
    }

    // Check Class Pedestals
    for (const ped of this.classPedestals) {
      if (Math.hypot(x - ped.x, y - ped.y) < 36) {
        this.switchClass(ped.classId);
        break;
      }
    }
  }

  switchClass(classId) {
    if (this.selectedClassId === classId) return;
    this.selectedClassId = classId;
    this.onSelectClass(classId);
    audio.playLevelUpSound();
    const info = CLASSES[classId];
    this.notification = `✨ เปลี่ยนเป็นอาชีพ ${info.name}!`;
    this.notifTimer = 3.0;
  }

  openJobModal() {
    const modalEl = document.getElementById('modal-job');
    if (modalEl) {
      this.renderJobList();
      modalEl.classList.remove('hidden');
      this.activeModal = 'JOB_CHANGE';
    }
  }

  closeJobModal() {
    const modalEl = document.getElementById('modal-job');
    if (modalEl) modalEl.classList.add('hidden');
    this.activeModal = null;
  }

  openResetModal() {
    const modalEl = document.getElementById('modal-reset');
    if (modalEl) {
      modalEl.classList.remove('hidden');
      this.activeModal = 'RESET';
    }
  }

  closeResetModal() {
    const modalEl = document.getElementById('modal-reset');
    if (modalEl) modalEl.classList.add('hidden');
    this.activeModal = null;
  }

  renderJobList() {
    const listEl = document.getElementById('job-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    Object.entries(CLASSES).forEach(([key, info]) => {
      const isSelected = key === this.selectedClassId;
      const card = document.createElement('div');
      card.className = `ro-job-row ${isSelected ? 'selected' : ''}`;
      card.innerHTML = `
        <div class="job-avatar">
          <img src="${info.sprite}" alt="${info.name}" />
        </div>
        <div class="job-info">
          <div class="job-name">${info.name}</div>
          <div class="job-desc">${info.desc}</div>
          <div class="job-perk">⭐ Perk: ${info.perk}</div>
          <div class="job-stats">HP: ${info.hp} | ATK: ${info.atk} | DEF: ${info.def} | SPD: ${info.speed}</div>
        </div>
        <button class="btn-job-pick ${isSelected ? 'active' : ''}">
          ${isSelected ? 'กำลังใช้งาน' : 'เลือกเปลี่ยน'}
        </button>
      `;

      card.onclick = () => {
        this.switchClass(key);
        this.closeJobModal();
      };

      listEl.appendChild(card);
    });
  }

  update(dt) {
    this.animTime += dt;
    if (this.notifTimer > 0) this.notifTimer -= dt;

    if (this.activeModal) return;

    // Player walking movement
    let mx = 0;
    let my = 0;

    if (this.keys['w'] || this.keys['arrowup']) my -= 1;
    if (this.keys['s'] || this.keys['arrowdown']) my += 1;
    if (this.keys['a'] || this.keys['arrowleft']) mx -= 1;
    if (this.keys['d'] || this.keys['arrowright']) mx += 1;

    if (this.joystick.active) {
      mx += this.joystick.dx;
      my += this.joystick.dy;
    }

    const len = Math.hypot(mx, my);
    if (len > 0.05) {
      const spd = this.player.speed * (dt * 60);
      this.player.x += (mx / len) * spd;
      this.player.y += (my / len) * spd;
      this.player.facingLeft = mx < 0;

      // Bound player inside town (40 to w-40, 100 to h-80)
      this.player.x = Math.max(40, Math.min(this.canvas.width - 40, this.player.x));
      this.player.y = Math.max(100, Math.min(this.canvas.height - 80, this.player.y));

      this.player.animTimer += dt;
      if (this.player.animTimer > 0.12) {
        this.player.animTimer = 0;
        const frames = this.spritePool['class_' + this.selectedClassId] || [];
        this.player.frameIndex = (this.player.frameIndex + 1) % (frames.length || 8);
      }

      // Check proximity to class pedestals (touching to change class!)
      for (const ped of this.classPedestals) {
        if (Math.hypot(this.player.x - ped.x, this.player.y - ped.y) < 28) {
          if (this.selectedClassId !== ped.classId) {
            this.switchClass(ped.classId);
          }
        }
      }

      // Check proximity to Warp Portal (walk in to start battle!)
      if (Math.hypot(this.player.x - this.warpPortal.x, this.player.y - this.warpPortal.y) < 32) {
        this.onStartBattle();
      }
    } else {
      this.player.frameIndex = 0;
    }
  }

  draw() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // 1. Town Ground (Paved Stone / Grass field)
    ctx.fillStyle = '#1e2925';
    ctx.fillRect(0, 0, w, h);

    // Stone Cobblestone Pattern
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // 2. Burning Campfire in Center (like D2 Survivors!)
    this.drawCampfire(ctx);

    // 3. Draw Standing Classes around Campfire
    this.drawClassPedestals(ctx);

    // 4. Draw NPCs
    this.drawNPC(ctx, this.npcJobGuider, 'npc_jobguider', '#44aaff', '💬 เปลี่ยนอาชีพ');
    this.drawNPC(ctx, this.npcKafra, 'npc_kafra', '#ff66aa', '💖 คาฟรา');

    // 5. Draw Waypoint / Warp Portal
    this.drawWarpPortal(ctx);

    // 6. Draw Player Character walking in Town
    this.drawPlayer(ctx);

    // 7. Town HUD Header & Notifications
    this.drawTownHUD(ctx, w, h);

    // 8. Virtual Joystick
    if (this.joystick.active) {
      this.drawJoystick(ctx);
    }
  }

  drawCampfire(ctx) {
    const cf = this.campfire;
    ctx.save();
    ctx.translate(cf.x, cf.y);

    // Stone circle
    ctx.beginPath();
    ctx.ellipse(0, 10, cf.radius + 6, cf.radius * 0.6 + 4, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#474747';
    ctx.fill();
    ctx.strokeStyle = '#2b2b2b';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Fire glow aura
    const flicker = Math.sin(this.animTime * 12) * 5;
    const radGrad = ctx.createRadialGradient(0, 0, 4, 0, 0, 75 + flicker);
    radGrad.addColorStop(0, 'rgba(255, 170, 0, 0.45)');
    radGrad.addColorStop(0.5, 'rgba(230, 80, 0, 0.2)');
    radGrad.addColorStop(1, 'rgba(230, 80, 0, 0)');
    ctx.fillStyle = radGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 80 + flicker, 0, Math.PI * 2);
    ctx.fill();

    // Wood logs
    ctx.fillStyle = '#5c3a21';
    ctx.fillRect(-16, 4, 32, 6);
    ctx.fillRect(-14, 8, 28, 6);

    // Animated Fire flames
    const flameH = 22 + Math.sin(this.animTime * 16) * 4;
    ctx.fillStyle = '#f39c12';
    ctx.beginPath();
    ctx.moveTo(-10, 8);
    ctx.quadraticCurveTo(-4, -flameH, 0, -flameH - 4);
    ctx.quadraticCurveTo(4, -flameH, 10, 8);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#f1c40f';
    ctx.beginPath();
    ctx.moveTo(-6, 8);
    ctx.quadraticCurveTo(-2, -flameH * 0.7, 0, -flameH * 0.7 - 2);
    ctx.quadraticCurveTo(2, -flameH * 0.7, 6, 8);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  drawClassPedestals(ctx) {
    for (const ped of this.classPedestals) {
      const isSelected = ped.classId === this.selectedClassId;
      const spriteKey = `class_${ped.classId}`;
      const img = this.spritePool[spriteKey]?.[0];

      ctx.save();
      ctx.translate(ped.x, ped.y);

      // Stone Pedestal / Ground ring
      ctx.beginPath();
      ctx.ellipse(0, 16, 18, 7, 0, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? 'rgba(241, 196, 15, 0.4)' : 'rgba(0, 0, 0, 0.35)';
      ctx.fill();
      if (isSelected) {
        ctx.strokeStyle = '#f1c40f';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Selector arrow
        const bounce = Math.sin(this.animTime * 6) * 3;
        ctx.fillStyle = '#f1c40f';
        ctx.beginPath();
        ctx.moveTo(0, -38 + bounce);
        ctx.lineTo(-4, -44 + bounce);
        ctx.lineTo(4, -44 + bounce);
        ctx.fill();
      }

      // Sprite
      if (img && img.complete && img.width > 0) {
        const sw = 48;
        const sh = (img.height / img.width) * sw;
        ctx.drawImage(img, -sw / 2, -sh * (105 / 120) + 16, sw, sh);
      }

      // Name Tag
      ctx.font = isSelected ? 'bold 10px Tahoma, sans-serif' : '9px Tahoma, sans-serif';
      ctx.fillStyle = isSelected ? '#f1c40f' : '#b2bec3';
      ctx.textAlign = 'center';
      ctx.fillText(ped.info.id.toUpperCase(), 0, 28);

      ctx.restore();
    }
  }

  drawWarpPortal(ctx) {
    const wp = this.warpPortal;
    ctx.save();
    ctx.translate(wp.x, wp.y);

    // Glowing Waypoint Stone
    const pulse = Math.sin(this.animTime * 4) * 4;
    ctx.beginPath();
    ctx.ellipse(0, 0, wp.radius + pulse, wp.radius * 0.5 + pulse * 0.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 180, 255, 0.25)';
    ctx.fill();
    ctx.strokeStyle = '#00d2d3';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Blue Waypoint fire torches (like Image 3)
    const flameH = 14 + Math.sin(this.animTime * 14) * 3;
    [-wp.radius * 0.65, wp.radius * 0.65].forEach(tx => {
      ctx.fillStyle = '#00d2d3';
      ctx.beginPath();
      ctx.arc(tx, -4, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#54a0ff';
      ctx.beginPath();
      ctx.moveTo(tx - 3, -4);
      ctx.lineTo(tx, -4 - flameH);
      ctx.lineTo(tx + 3, -4);
      ctx.fill();
    });

    // Label
    ctx.font = 'bold 11px Tahoma, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#00d2d3';
    ctx.shadowBlur = 8;
    ctx.fillText(wp.label, 0, 24);

    ctx.restore();
  }

  drawNPC(ctx, npc, spriteKey, glowColor, badgeText) {
    const bob = Math.sin(this.animTime * 3) * 3;
    const img = this.spritePool[spriteKey]?.[0];

    ctx.save();
    ctx.translate(npc.x, npc.y + bob);

    ctx.beginPath();
    ctx.ellipse(0, 32, 22, 7, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fill();

    if (img && img.complete && img.width > 0) {
      const sw = npc.w;
      const sh = (img.height / img.width) * sw;
      ctx.drawImage(img, -sw / 2, -sh / 2 + 10, sw, sh);
    }

    ctx.textAlign = 'center';
    ctx.font = 'bold 11px Tahoma, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 8;
    ctx.fillText(badgeText, 0, -34);

    ctx.font = '10px Tahoma, sans-serif';
    ctx.fillStyle = '#fbc531';
    ctx.shadowBlur = 0;
    ctx.fillText(npc.name, 0, 44);

    ctx.restore();
  }

  drawPlayer(ctx) {
    ctx.save();
    ctx.translate(this.player.x, this.player.y);

    // Shadow
    ctx.beginPath();
    ctx.ellipse(0, 18, 16, 6, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fill();

    // Sprite
    const spriteKey = `class_${this.selectedClassId}`;
    const frames = this.spritePool[spriteKey] || [];
    const currentImg = frames[this.player.frameIndex] || frames[0];

    if (currentImg && currentImg.complete && currentImg.width > 0) {
      const sw = 56;
      const sh = (currentImg.height / currentImg.width) * sw;
      if (this.player.facingLeft) {
        ctx.scale(-1, 1);
      }
      ctx.drawImage(currentImg, -sw / 2, -sh * (105 / 120) + 16, sw, sh);
    }

    // Name tag above player
    ctx.textAlign = 'center';
    ctx.font = 'bold 11px Tahoma, sans-serif';
    ctx.fillStyle = '#00ffaa';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 4;
    ctx.fillText(`YOU: ${CLASSES[this.selectedClassId].name}`, 0, -36);

    ctx.restore();
  }

  drawTownHUD(ctx, w, h) {
    ctx.save();

    // Top Header Banner
    ctx.fillStyle = 'rgba(235, 238, 242, 0.94)';
    ctx.strokeStyle = '#5a6b82';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(12, 12, w - 24, 60, 6);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.font = 'bold 13px Tahoma, sans-serif';
    ctx.fillStyle = '#1e3799';
    ctx.fillText('🏛️ PRONTERA CAMPFIRE HUB', 24, 34);

    ctx.font = '11px Tahoma, sans-serif';
    ctx.fillStyle = '#2f3542';
    ctx.fillText(`อาชีพปัจจุบัน: ${CLASSES[this.selectedClassId].name}`, 24, 54);

    // Fast Battle Button on top right
    ctx.textAlign = 'right';
    ctx.font = 'bold 12px Tahoma, sans-serif';
    ctx.fillStyle = '#d35400';
    ctx.fillText('⚔️ แตะวาร์ปล่างเพื่อสู้', w - 24, 34);

    // Bottom Notification Bar if active
    if (this.notifTimer > 0) {
      ctx.fillStyle = 'rgba(15, 20, 30, 0.88)';
      ctx.strokeStyle = '#f1c40f';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(16, h - 120, w - 32, 38, 6);
      ctx.fill();
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.font = '11px Tahoma, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(this.notification, w / 2, h - 96);
    }

    ctx.restore();
  }

  drawJoystick(ctx) {
    const j = this.joystick;
    ctx.save();
    ctx.beginPath();
    ctx.arc(j.baseX, j.baseY, 46, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(j.baseX + j.dx * 36, j.baseY + j.dy * 36, 22, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(30, 144, 255, 0.7)';
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#1e90ff';
    ctx.fill();
    ctx.restore();
  }
}
