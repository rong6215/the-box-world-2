// Audio Manager: Authentic RO BGM streaming + Real Client WAV SFX + Web Audio fallback
class AudioManager {
  constructor() {
    this.audioSettings = this.loadSettings();
    this.muted = !!this.audioSettings.muted;
    this.bgmEnabled = this.audioSettings.bgmEnabled !== false;
    this.sfxEnabled = this.audioSettings.sfxEnabled !== false;
    this.bgmVolume = typeof this.audioSettings.bgmVolume === 'number' ? this.audioSettings.bgmVolume : 0.45;
    this.sfxVolume = typeof this.audioSettings.sfxVolume === 'number' ? this.audioSettings.sfxVolume : 0.55;

    this.bgmTitle = new Audio('/bgm/01.mp3');
    this.bgmTitle.loop = true;
    this.bgmTitle.volume = this.bgmVolume;
    this.bgmTitle.muted = this.muted || !this.bgmEnabled;

    this.bgmTown = new Audio('/bgm/08.mp3');
    this.bgmTown.loop = true;
    this.bgmTown.volume = this.bgmVolume;
    this.bgmTown.muted = this.muted || !this.bgmEnabled;

    this.bgmBattle = new Audio('/bgm/12.mp3');
    this.bgmBattle.loop = true;
    this.bgmBattle.volume = this.bgmVolume;
    this.bgmBattle.muted = this.muted || !this.bgmEnabled;

    this.currentBgm = null;
    this.audioCtx = null;
    this.wavCache = new Map();

    // User gesture initialization
    window.addEventListener('click', () => this.initContext(), { once: true });
    window.addEventListener('touchstart', () => this.initContext(), { once: true });
  }

  loadSettings() {
    try {
      const s = localStorage.getItem('ro_audio_settings');
      if (s) return JSON.parse(s);
    } catch (e) {}
    return { muted: false, bgmEnabled: true, sfxEnabled: true, bgmVolume: 0.45, sfxVolume: 0.55 };
  }

  saveSettings() {
    try {
      localStorage.setItem('ro_audio_settings', JSON.stringify({
        muted: this.muted,
        bgmEnabled: this.bgmEnabled,
        sfxEnabled: this.sfxEnabled,
        bgmVolume: this.bgmVolume,
        sfxVolume: this.sfxVolume
      }));
    } catch (e) {}
  }

  setMasterMute(muted) {
    this.muted = !!muted;
    if (this.currentBgm) this.currentBgm.muted = this.muted || !this.bgmEnabled;
    this.saveSettings();
  }

  setBgmEnabled(enabled) {
    this.bgmEnabled = !!enabled;
    if (this.currentBgm) {
      this.currentBgm.muted = this.muted || !this.bgmEnabled;
      if (this.bgmEnabled && !this.muted) {
        this.currentBgm.play().catch(() => {});
      } else {
        this.currentBgm.pause();
      }
    }
    this.saveSettings();
  }

  setSfxEnabled(enabled) {
    this.sfxEnabled = !!enabled;
    this.saveSettings();
  }

  setBgmVolume(volume) {
    this.bgmVolume = Math.max(0, Math.min(1, volume));
    if (this.bgmTown) this.bgmTown.volume = this.bgmVolume;
    if (this.bgmBattle) this.bgmBattle.volume = this.bgmVolume;
    if (this.currentBgm) this.currentBgm.volume = this.bgmVolume;
    this.saveSettings();
  }

  setSfxVolume(volume) {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
    this.saveSettings();
  }

  initContext() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  playBgm(track) {
    if (!this.bgmEnabled || this.muted) return;
    this.initContext();

    if (this.currentBgm) {
      this.currentBgm.pause();
      this.currentBgm.currentTime = 0;
    }

    if (track === 'title') {
      this.currentBgm = this.bgmTitle;
    } else if (track === 'town') {
      this.currentBgm = this.bgmTown;
    } else if (track === 'battle') {
      this.currentBgm = this.bgmBattle;
    } else if (track && track.startsWith('/bgm/')) {
      this.playStageBgm(track);
      return;
    }

    if (this.currentBgm) {
      this.currentBgm.play().catch(() => {});
    }
  }

  playStageBgm(bgmUrl) {
    if (!this.bgmEnabled || this.muted) return;
    this.initContext();
    if (this.currentBgm) {
      this.currentBgm.pause();
      this.currentBgm.currentTime = 0;
    }
    const a = new Audio(bgmUrl);
    a.loop = true;
    a.volume = 0.45;
    a.muted = this.muted;
    this.currentBgm = a;
    a.play().catch(() => {});
  }

  stopBgm() {
    if (this.currentBgm) {
      this.currentBgm.pause();
      this.currentBgm.currentTime = 0;
      this.currentBgm = null;
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.currentBgm) {
      this.currentBgm.muted = this.muted;
    }
    return this.muted;
  }

  // Play real RO client .wav SFX extracted into assets/sfx/<name>.wav
  playWav(name, volume = 0.45) {
    if (!this.sfxEnabled || this.muted || !name) return;
    try {
      const url = `assets/sfx/${name}.wav`;
      let base = this.wavCache.get(url);
      if (!base) {
        base = new Audio(url);
        base.preload = 'auto';
        this.wavCache.set(url, base);
      }
      const inst = base.cloneNode();
      inst.volume = Math.max(0.01, Math.min(1, volume * (this.sfxVolume / 0.55)));
      inst.play().catch(() => {});
    } catch (e) {}
  }

  playHitSound() {
    this.playWav('_enemy_hit1', 0.4);
  }

  playCriticalHit() {
    this.playWav('ef_hit2', 0.6);
  }

  playSwordAttack() {
    this.playWav('attack_short_sword_', 0.4);
  }

  playBowAttack() {
    this.playWav('attack_bow1', 0.4);
  }

  playRefineClank(strikeNum = 1) {
    const snd = (strikeNum % 2 === 1) ? 'refine/bs_refine_1' : 'refine/bs_refine_2';
    this.playWav(snd, 0.65);
  }

  playRefineSuccess() {
    this.playWav('refine/bs_refinesuccess', 0.7);
  }

  playRefineFailed() {
    this.playWav('refine/bs_refinefailed', 0.7);
  }

  playGemSound() {
    if (!this.sfxEnabled || this.muted) return;
    this.initContext();
    if (!this.audioCtx) return;

    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    const now = this.audioCtx.currentTime;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1760, now + 0.12);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start(now);
    osc.stop(now + 0.12);
  }

  playCoinSound() {
    if (!this.sfxEnabled || this.muted) return;
    this.initContext();
    if (!this.audioCtx) return;

    const now = this.audioCtx.currentTime;
    [987, 1318].forEach((freq, idx) => {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      const t = now + idx * 0.08;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.22, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(t);
      osc.stop(t + 0.1);
    });
  }

  playLevelUpSound() {
    this.playWav('levelup', 0.65);
  }

  playCastSound(type = 'fire') {
    switch (type) {
      case 'bash': this.playWav('ef_bash', 0.5); break;
      case 'magnum': this.playWav('ef_magnumbreak', 0.55); break;
      case 'bowling': this.playWav('knight_bowling_bash', 0.55); break;
      case 'stormgust': this.playWav('wizard_stormgust', 0.55); break;
      case 'meteor': this.playWav('wizard_meteor', 0.55); break;
      case 'thunderstorm': this.playWav('ef_thunderstorm', 0.55); break;
      case 'sonicblow': this.playWav('assasin_sonicblow', 0.55); break;
      case 'spiral': this.playWav('hn_spiral_pierce_max', 0.55); break;
      case 'magnus': this.playWav('priest_magnus', 0.55); break;
      case 'sanctuary': this.playWav('priest_sanctuary', 0.5); break;
      case 'judex': this.playWav('ab_judex', 0.5); break;
      case 'adoramus': this.playWav('ab_adoramus', 0.55); break;
      case 'firewall': this.playWav('ef_firewall', 0.5); break;
      case 'endure': this.playWav('ef_endure', 0.45); break;
      case 'blessing': this.playWav('ef_blessing', 0.5); break;
      case 'twohand': this.playWav('knight_twohandquicken', 0.5); break;
      case 'holy': this.playWav('cru_holy cross', 0.5); break;
      case 'poison': this.playWav('thief_invenom', 0.45); break;
      case 'arrow': this.playWav('skill_arrowstorm', 0.45); break;
      case 'fire': this.playWav('skill_fire', 0.45); break;
      case 'wind':
      case 'lightning': this.playWav('skill_thunder', 0.45); break;
      default: this.playWav('skill_bash', 0.45); break;
    }
  }
}

export const audio = new AudioManager();
