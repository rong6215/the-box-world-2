// RO Survivors - Character Selection and Creation Module
// Supports:
// - 24 Clean Male (hair_m_01..24) & 24 Clean Female (hair_f_01..24) Hairstyles
// - Male / Female body & hairstyle switching
// - 8-Direction rotation (< / >) in character creation preview
// - Hair color tinting & persistence

export const HAIR_COLOR_FILTERS = {
  blonde: 'none',
  brown: 'sepia(0.55) saturate(1.3) brightness(0.85)',
  black: 'grayscale(0.85) brightness(0.55) contrast(1.3)',
  silver: 'grayscale(0.9) brightness(1.18) contrast(1.05)',
  pink: 'hue-rotate(295deg) saturate(1.6) brightness(1.05)',
  blue: 'hue-rotate(175deg) saturate(1.7) brightness(0.95)',
  green: 'hue-rotate(75deg) saturate(1.6) brightness(0.95)',
  purple: 'hue-rotate(240deg) saturate(1.6) brightness(0.9)',
  red: 'hue-rotate(335deg) saturate(2.1) brightness(0.9)'
};

export const HAIR_COLOR_TINTS = {
  blonde: 0xffffff,
  brown: 0xcd853f,
  black: 0x555555,
  silver: 0xe0e0e0,
  pink: 0xffa0d0,
  blue: 0x70a1ff,
  green: 0x7bed9f,
  purple: 0xa55eea,
  red: 0xff4757
};

export class CharacterSelectSystem {
  constructor(onEnterWorld) {
    this.onEnterWorld = onEnterWorld;
    this.slots = this.loadSlots();
    this.selectedSlot = 0;

    // Create character state
    this.createState = {
      slotIndex: 3,
      name: '',
      gender: 'male',
      hairStyle: 1,
      hairColor: 'blonde',
      facing: 0 // 0..7 (8 directions!)
    };

    this.hairColors = [
      { name: 'blonde', hex: '#f6e58d' },
      { name: 'brown', hex: '#b08d57' },
      { name: 'black', hex: '#2f3542' },
      { name: 'silver', hex: '#dfe4ea' },
      { name: 'pink', hex: '#ff78b9' },
      { name: 'blue', hex: '#70a1ff' },
      { name: 'green', hex: '#7bed9f' },
      { name: 'purple', hex: '#a55eea' },
      { name: 'red', hex: '#ff4757' }
    ];

    this.init();
  }

  loadSlots() {
    try {
      const saved = localStorage.getItem('ro_characters_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === 15) {
          // Authentic Zero-Start: Level 1 Novices strictly start with 1 stats, 0 items, 0 skills
          parsed.forEach(c => {
            if (c && (c.baseLv === 1 || c.level === 1) && (c.jobId === 'novice' || c.classKey === 'novice')) {
              if (c.stats) {
                c.stats.str = 1; c.stats.agi = 1; c.stats.vit = 1;
                c.stats.int = 1; c.stats.dex = 1; c.stats.luk = 1;
              }
              c.str = 1; c.agi = 1; c.vit = 1; c.int = 1; c.dex = 1; c.luk = 1;
              if (!c.items || typeof c.items !== 'object') c.items = { use: [], eqp: [], cos: [], card: [], etc: [] };
            }
          });
          return parsed;
        }
      }
    } catch (e) {}

    const slots = new Array(15).fill(null);
    // Authentic Zero-Start: Newly created Novice starts with NO items, NO skills, and all stats at 1!
    slots[0] = {
      name: 'นักผจญภัย',
      gender: 'male',
      job: 'Novice (โนวิซ)',
      jobId: 'novice',
      baseLv: 1,
      level: 1,
      jobLv: 1,
      jobLevel: 1,
      map: 'Prontera, Capital of Rune-Midgarts',
      hp: 100,
      maxHp: 100,
      sp: 30,
      maxSp: 30,
      zeny: 0,
      statPoints: 0,
      skillPoints: 0,
      str: 1,
      agi: 1,
      vit: 1,
      int: 1,
      dex: 1,
      luk: 1,
      skills: {},
      items: { use: [], eqp: [], cos: [], card: [], etc: [] },
      hairStyle: 1,
      hairColor: 'blonde',
      classKey: 'novice'
    };

    return slots;
  }

  saveSlots() {
    try {
      localStorage.setItem('ro_characters_v2', JSON.stringify(this.slots));
    } catch (e) {}
  }

  init() {
    this.renderSlotGrid();
    this.renderRightPanel();
    this.setupEventListeners();
  }

  setupEventListeners() {
    const btnEnter = document.getElementById('btn-enter-world');
    if (btnEnter) {
      btnEnter.onclick = () => {
        const char = this.slots[this.selectedSlot];
        if (char) {
          this.onEnterWorld(char);
        } else {
          alert('กรุณาเลือกตัวละคร หรือกดช่องว่าง (+) เพื่อสร้างตัวละครใหม่ก่อนเข้าสู่โลก!');
        }
      };
    }

    const btnDelete = document.getElementById('btn-delete-char');
    if (btnDelete) {
      btnDelete.onclick = () => {
        const char = this.slots[this.selectedSlot];
        if (!char) return;
        if (confirm(`คุณต้องการลบตัวละคร [${char.name}] หรือไม่?`)) {
          this.slots[this.selectedSlot] = null;
          this.saveSlots();
          this.renderSlotGrid();
          this.renderRightPanel();
        }
      };
    }

    // Create Modal: Gender Buttons (Male vs Female)
    const btnMale = document.getElementById('create-gender-male');
    const btnFemale = document.getElementById('create-gender-female');
    if (btnMale && btnFemale) {
      btnMale.onclick = () => {
        this.createState.gender = 'male';
        btnMale.classList.add('active');
        btnFemale.classList.remove('active');
        this.renderHairGrid();
        this.updateCreatePreview();
      };
      btnFemale.onclick = () => {
        this.createState.gender = 'female';
        btnFemale.classList.add('active');
        btnMale.classList.remove('active');
        this.renderHairGrid();
        this.updateCreatePreview();
      };
    }

    // 8-Direction Rotate Buttons (< / >)
    const btnTurnLeft = document.getElementById('create-turn-left');
    const btnTurnRight = document.getElementById('create-turn-right');
    if (btnTurnLeft && btnTurnRight) {
      btnTurnLeft.onclick = () => {
        this.createState.facing = (this.createState.facing + 7) % 8;
        this.updateCreatePreview();
      };
      btnTurnRight.onclick = () => {
        this.createState.facing = (this.createState.facing + 1) % 8;
        this.updateCreatePreview();
      };
    }

    const btnCreateBack = document.getElementById('btn-create-back');
    if (btnCreateBack) {
      btnCreateBack.onclick = () => this.closeCreateModal();
    }

    const btnCreateConfirm = document.getElementById('btn-create-confirm');
    if (btnCreateConfirm) {
      btnCreateConfirm.onclick = () => this.confirmCreateCharacter();
    }
  }

  getCharPreviewSprite(char) {
    if (!char) return '/grf/character/novice_m_h1_cblonde_stand_d0_0.png';
    const g = char.gender === 'female' ? 'f' : 'm';
    const job = char.jobId || char.classKey || 'novice';
    const hs = char.hairStyle || 1;
    const color = char.hairColor || 'blonde';
    return `/grf/character/${job}_${g}_h${hs}_c${color}_stand_d0_0.png`;
  }

  renderSlotGrid() {
    const grid = document.getElementById('char-slots-grid');
    if (!grid) return;
    grid.innerHTML = '';

    for (let i = 0; i < 15; i++) {
      const char = this.slots[i];
      const slotEl = document.createElement('div');
      slotEl.className = `ro-char-slot ${this.selectedSlot === i ? 'selected' : ''}`;

      if (char) {
        const filter = HAIR_COLOR_FILTERS[char.hairColor] || 'none';
        const spriteSrc = this.getCharPreviewSprite(char);
        const jobShort = (char.job || 'Novice').split(' (')[0];
        const isSel = this.selectedSlot === i;
        slotEl.innerHTML = `
          <div class="char-slot-addon-tag ${char.gender === 'female' ? 'female' : 'male'}">${char.gender === 'female' ? '♀' : '♂'}</div>
          <div class="char-slot-sprite-wrap">
            <img src="${spriteSrc}" style="filter:${filter};" class="char-slot-sprite" alt="${char.name}" />
          </div>
          <div class="char-slot-info-box">
            <div class="char-slot-name-badge">${char.name}</div>
            <div class="char-slot-sub-badge">${jobShort} Lv.${char.baseLv || char.level || 1}</div>
          </div>
          ${isSel ? '<div class="char-slot-play-hint">▶ เลือกอยู่</div>' : ''}
        `;
        slotEl.onclick = () => {
          this.selectedSlot = i;
          this.renderSlotGrid();
          this.renderRightPanel();
        };
        slotEl.ondblclick = () => {
          this.selectedSlot = i;
          this.onEnterWorld(char);
        };
      } else {
        slotEl.innerHTML = `
          <div class="char-slot-empty">
            <div class="char-slot-plus-btn">+</div>
            <div class="char-slot-empty-label">สร้างตัวละคร</div>
          </div>
        `;
        slotEl.onclick = () => {
          this.openCreateModal(i);
        };
      }

      grid.appendChild(slotEl);
    }
  }

  renderRightPanel() {
    const char = this.slots[this.selectedSlot];
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

    const standingPreview = document.getElementById('char-preview-standing');
    const standingName = document.getElementById('char-preview-name');

    if (char) {
      set('char-info-map', char.map || 'Prontera, Capital of Rune-Midgarts');
      set('char-info-job', (char.job || 'Novice').split(' (')[0]);
      set('char-info-lv', char.baseLv || char.level || 1);
      set('char-info-exp', `${char.exp || 0}`);
      set('char-info-hp', char.hp || 100);
      set('char-info-sp', char.sp || 30);
      set('char-info-str', char.stats?.str || char.str || 1);
      set('char-info-agi', char.stats?.agi || char.agi || 1);
      set('char-info-vit', char.stats?.vit || char.vit || 1);
      set('char-info-int', char.stats?.int || char.int || 1);
      set('char-info-dex', char.stats?.dex || char.dex || 1);
      set('char-info-luk', char.stats?.luk || char.luk || 1);

      if (standingPreview) {
        standingPreview.src = this.getCharPreviewSprite(char);
        standingPreview.style.filter = HAIR_COLOR_FILTERS[char.hairColor] || 'none';
        standingPreview.style.display = 'block';
      }
      if (standingName) {
        standingName.textContent = `${char.name} (${(char.job || 'Novice').split(' (')[0]})`;
      }
    } else {
      ['map', 'job', 'lv', 'exp', 'hp', 'sp', 'str', 'agi', 'vit', 'int', 'dex', 'luk'].forEach(k => set(`char-info-${k}`, '-'));
      if (standingPreview) standingPreview.style.display = 'none';
      if (standingName) standingName.textContent = 'เลือกตัวละคร หรือสร้างใหม่';
    }
  }

  openCreateModal(slotIndex) {
    this.createState.slotIndex = slotIndex;
    this.createState.name = '';
    this.createState.hairStyle = 1;
    this.createState.hairColor = 'blonde';
    this.createState.gender = 'male';
    this.createState.facing = 0;

    document.getElementById('create-gender-male')?.classList.add('active');
    document.getElementById('create-gender-female')?.classList.remove('active');

    const inputName = document.getElementById('create-char-name-input');
    if (inputName) inputName.value = '';

    this.renderHairGrid();
    this.renderColorSwatches();
    this.updateCreatePreview();

    document.getElementById('modal-create-char')?.classList.remove('hidden');
  }

  closeCreateModal() {
    document.getElementById('modal-create-char')?.classList.add('hidden');
  }

  renderHairGrid() {
    const container = document.getElementById('create-hair-grid');
    if (!container) return;
    container.innerHTML = '';

    const g = this.createState.gender === 'female' ? 'f' : 'm';
    const filter = HAIR_COLOR_FILTERS[this.createState.hairColor] || 'none';

    for (let i = 1; i <= 24; i++) {
      const tile = document.createElement('div');
      tile.className = `ro-hair-tile ${this.createState.hairStyle === i ? 'selected' : ''}`;
      const numStr = String(i).padStart(2, '0');
      tile.innerHTML = `
        <div class="ro-hair-thumb-wrap">
          <img src="assets/sprites/hair_preview/${g}_${numStr}_d0.png" style="filter: ${filter};" class="ro-hair-thumb-img" alt="Hair ${i}" />
        </div>
        <span class="ro-hair-num">${i}</span>
      `;
      tile.onclick = () => {
        this.createState.hairStyle = i;
        this.renderHairGrid();
        this.updateCreatePreview();
      };
      container.appendChild(tile);
    }
  }

  renderColorSwatches() {
    const container = document.getElementById('create-hair-colors');
    if (!container) return;
    container.innerHTML = '';

    this.hairColors.forEach((c) => {
      const swatch = document.createElement('div');
      swatch.className = `ro-color-swatch ${this.createState.hairColor === c.name ? 'selected' : ''}`;
      swatch.style.backgroundColor = c.hex;
      swatch.title = c.name;
      swatch.onclick = () => {
        this.createState.hairColor = c.name;
        this.renderColorSwatches();
        this.renderHairGrid();
        this.updateCreatePreview();
      };
      container.appendChild(swatch);
    });
  }

  updateCreatePreview() {
    const previewImg = document.getElementById('create-preview-sprite');
    const raceImg = document.querySelector('#modal-create-char .race-sprite-preview img');
    const g = this.createState.gender === 'female' ? 'f' : 'm';
    const hs = this.createState.hairStyle || 1;
    const color = this.createState.hairColor || 'blonde';
    const dir = this.createState.facing % 8;
    const numStr = String(hs).padStart(2, '0');

    const dynamicUrl = `/grf/character/novice_${g}_h${hs}_c${color}_stand_d${dir}_0.png`;
    const fallbackSrc = `assets/sprites/hair_preview/${g}_${numStr}_d${dir}.png`;

    if (previewImg) {
      previewImg.src = dynamicUrl;
      previewImg.onerror = () => { previewImg.src = fallbackSrc; };
      previewImg.style.filter = 'none';
      previewImg.style.transform = 'scale(1.4)';
    }
    if (raceImg) {
      raceImg.src = `/grf/character/novice_${g}_h${hs}_c${color}_stand_d0_0.png`;
      raceImg.onerror = () => { raceImg.src = `assets/sprites/hair_preview/${g}_${numStr}_d0.png`; };
      raceImg.style.filter = 'none';
    }
  }

  confirmCreateCharacter() {
    const inputName = document.getElementById('create-char-name-input');
    const name = (inputName ? inputName.value.trim() : '') || `Novice_${Math.floor(Math.random() * 900 + 100)}`;

    // Authentic Zero-Start: Newly created Novice starts with NO items, NO skills, and ALL stats at 1!
    const newChar = {
      name,
      gender: this.createState.gender,
      job: 'Novice (โนวิซ)',
      jobId: 'novice',
      baseLv: 1,
      level: 1,
      jobLv: 1,
      jobLevel: 1,
      map: 'Prontera, Capital of Rune-Midgarts',
      hp: 100,
      maxHp: 100,
      sp: 30,
      maxSp: 30,
      str: 1,
      agi: 1,
      vit: 1,
      int: 1,
      dex: 1,
      luk: 1,
      zeny: 0,
      statPoints: 0,
      skillPoints: 0,
      skills: {},
      items: { use: [], eqp: [], cos: [], card: [], etc: [] },
      hairStyle: this.createState.hairStyle,
      hairColor: this.createState.hairColor,
      hairFilter: HAIR_COLOR_FILTERS[this.createState.hairColor] || 'none',
      classKey: 'novice'
    };

    this.slots[this.createState.slotIndex] = newChar;
    this.selectedSlot = this.createState.slotIndex;
    this.saveSlots();

    this.closeCreateModal();
    this.renderSlotGrid();
    this.renderRightPanel();
  }
}
