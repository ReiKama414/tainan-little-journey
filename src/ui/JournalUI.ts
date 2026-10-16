import {
  CHARACTER_CUSTOM_OPTIONS,
  CHIKHAN_QUIZ_QUESTIONS,
  CONFUCIUS_BLESSINGS,
  TAINAN_FOOD_CHOICES
} from '../data/scenesData';
import { DEFAULT_APPEARANCE } from '../systems/PlayerController';

export class JournalUI {
  collectibles;
  player;
  audio;
  collectiblesImg = null;
  foodsImg = null;
  activeAnimFrame = null;

  constructor(collectibles, player, audio) {
    this.collectibles = collectibles;
    this.player = player;
    this.audio = audio;
  }

  stopActiveAnim() {
    if (this.activeAnimFrame !== null) {
      cancelAnimationFrame(this.activeAnimFrame);
      this.activeAnimFrame = null;
    }
  }

  setSpritesheets(collectiblesImg, foodsImg) {
    this.collectiblesImg = collectiblesImg;
    this.foodsImg = foodsImg;
  }

  createIconDataUrl(sheet, index, size = 48) {
    if (!sheet) return '';
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');
    if (ctx) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(sheet, index * size, 0, size, size, 0, 0, size, size);
    }
    return c.toDataURL('image/png');
  }

  triggerPhotoFlash(container) {
    const flashDiv = document.createElement('div');
    flashDiv.className = 'camera-flash-overlay';
    container.appendChild(flashDiv);
    window.setTimeout(() => {
      if (flashDiv.parentNode) flashDiv.parentNode.removeChild(flashDiv);
    }, 450);
  }

  renderNPCDialogue(container, npc, onOptionSelect, onClose) {
    this.stopActiveAnim();
    const opts = npc.options || [];
    const askedIndices = new Set();
    let hasAnsweredAny = false;

    const cleanupAndClose = () => {
      window.removeEventListener('keydown', onKeyHandler);
      onClose();
    };

    const renderOptionsStack = () => {
      const stackEl = container.querySelector('#dialogue-options-stack');
      if (!stackEl) return;

      const allAsked = opts.length === 0 || askedIndices.size >= opts.length;
      const choiceButtonsHtml = opts
        .map((opt, idx) => {
          const isVisited = askedIndices.has(idx);
          return `
            <button type="button" class="dialogue-choice-btn ${isVisited ? 'visited' : ''}" data-opt-idx="${idx}">
              <span class="choice-num">${idx + 1}.</span> ${opt.text} ${isVisited ? '<span style="float:right;font-size:10.5px;color:#D8A878;">[已詢問]</span>' : ''}
            </button>
          `;
        })
        .join('');

      const finishBtnClass = (allAsked || hasAnsweredAny) ? 'dialogue-choice-btn finish-primary' : 'dialogue-choice-btn';
      const finishBtnLabel = allAsked
        ? '[ 謝謝指教，結束對話繼續散策 (按 E / Space / ESC) ]'
        : '<span class="choice-num">[結束交談]</span> 謝謝分享，我繼續在附近散步！ (按 ESC 離開)';

      stackEl.innerHTML = `
        ${choiceButtonsHtml}
        <button type="button" class="${finishBtnClass}" id="btn-finish-dialogue">
          ${finishBtnLabel}
        </button>
      `;

      stackEl.querySelectorAll('[data-opt-idx]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const idx = parseInt(e.currentTarget.getAttribute('data-opt-idx') || '0', 10);
          const opt = opts[idx];
          if (!opt) return;

          // If the user clicks an already-asked option when all options have been asked, close cleanly
          if (askedIndices.has(idx) && askedIndices.size >= opts.length) {
            this.audio.playInteract();
            cleanupAndClose();
            return;
          }

          askedIndices.add(idx);
          hasAnsweredAny = true;
          const bodyEl = container.querySelector('#dialogue-main-text');
          if (bodyEl) {
            bodyEl.innerHTML = `<div style="color:#E2A45C;font-size:11px;margin-bottom:4px;">▸ 你的提問：「${opt.text}」</div><div>${opt.response}</div>`;
          }
          this.audio.playInteract();
          if (opt.questAction) onOptionSelect(opt.questAction);
          renderOptionsStack();
        });
      });

      const finishBtn = stackEl.querySelector('#btn-finish-dialogue');
      if (finishBtn) {
        finishBtn.addEventListener('click', () => {
          this.audio.playInteract();
          cleanupAndClose();
        });
      }
    };

    container.innerHTML = `
      <div class="pixel-modal-backdrop" id="dialogue-backdrop">
        <div class="dialogue-box-frame">
          <div class="dialogue-header">
            <div class="npc-avatar-badge" style="background:#BA3E30;"></div>
            <div>
              <h4 class="npc-name">${npc.name}</h4>
              <span class="npc-role">${npc.role}</span>
            </div>
            <button type="button" class="pixel-btn small close-dialogue-btn" style="margin-left:auto;">關閉 [ESC]</button>
          </div>
          <div class="dialogue-content-body" id="dialogue-main-text">
            「${npc.dialogueIntro}」
          </div>
          <div class="dialogue-options-stack" id="dialogue-options-stack"></div>
        </div>
      </div>
    `;

    renderOptionsStack();

    const closeBtn = container.querySelector('.close-dialogue-btn');
    if (closeBtn) closeBtn.addEventListener('click', () => {
      this.audio.playInteract();
      cleanupAndClose();
    });

    const backdrop = container.querySelector('#dialogue-backdrop');
    if (backdrop) {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          this.audio.playInteract();
          cleanupAndClose();
        }
      });
    }

    const onKeyHandler = (e) => {
      if (!container.querySelector('#dialogue-backdrop')) {
        window.removeEventListener('keydown', onKeyHandler);
        return;
      }
      if (e.code === 'Digit1' && opts[0]) {
        e.preventDefault();
        const b = container.querySelector('[data-opt-idx="0"]');
        if (b) b.click();
      } else if (e.code === 'Digit2' && opts[1]) {
        e.preventDefault();
        const b = container.querySelector('[data-opt-idx="1"]');
        if (b) b.click();
      } else if ((e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') && (opts.length === 0 || hasAnsweredAny)) {
        e.preventDefault();
        this.audio.playInteract();
        cleanupAndClose();
      }
    };
    window.setTimeout(() => {
      window.addEventListener('keydown', onKeyHandler);
    }, 60);
  }

  // Character Customizer Modal (Inclusive, Zero Emoji, In-Place DOM Update, Animated Preview)
  renderCharacterCreator(container, onStartGame, onClose) {
    this.stopActiveAnim();
    const cur = { ...DEFAULT_APPEARANCE, ...this.player.appearance };

    container.innerHTML = `
      <div class="pixel-modal-backdrop">
        <div class="pixel-modal-box character-creator-box">
          <div class="pixel-modal-header">
            <div>
              <div class="pixel-kicker">CHARACTER CUSTOMIZATION</div>
              <h3>府城旅人自由穿搭（即時套用全身動作）</h3>
            </div>
            <button type="button" class="pixel-btn small" id="close-creator-btn">完成並返回 [ESC]</button>
          </div>

          <div class="creator-layout-split">
            <!-- Left Live Character Preview -->
            <div class="creator-preview-pane">
              <div class="creator-preview-card">
                <canvas id="creator-preview-canvas" width="96" height="96"></canvas>
                <div class="preview-tag">旅人全身即時預覽</div>
              </div>
              <button type="button" class="pixel-btn" id="btn-random-appearance" style="width:100%;">
                [ 隨機穿搭組合 ]
              </button>
              <button type="button" class="pixel-btn primary large" id="btn-start-from-creator" style="width:100%;">
                [ 套用並開始散策 ]
              </button>
            </div>

            <!-- Right Options Grid (RWD 2-column grid, zero clipping) -->
            <div class="creator-options-pane">
              <div class="customizer-field-group">
                <label class="customizer-field-label">自由髮型 (10款立體輪廓)</label>
                <div class="customizer-chips-wrap">
                  ${CHARACTER_CUSTOM_OPTIONS.hairStyles.map(h => `
                    <button type="button" class="customizer-chip ${h.id === cur.hairStyleId ? 'selected' : ''}" data-field="hairStyleId" data-val="${h.id}">
                      ${h.name}
                    </button>
                  `).join('')}
                </div>
              </div>

              <div class="customizer-field-group">
                <label class="customizer-field-label">髮色搭配 (8種)</label>
                <div class="customizer-chips-wrap">
                  ${CHARACTER_CUSTOM_OPTIONS.hairColors.map(c => `
                    <button type="button" class="customizer-chip ${c.id === cur.hairColorId ? 'selected' : ''}" data-field="hairColorId" data-val="${c.id}">
                      ${c.name}
                    </button>
                  `).join('')}
                </div>
              </div>

              <div class="customizer-field-group">
                <label class="customizer-field-label">上衣款式與花色 (8種)</label>
                <div class="customizer-chips-wrap">
                  ${CHARACTER_CUSTOM_OPTIONS.shirts.map(sh => `
                    <button type="button" class="customizer-chip ${sh.id === cur.shirtId ? 'selected' : ''}" data-field="shirtId" data-val="${sh.id}">
                      ${sh.name}
                    </button>
                  `).join('')}
                </div>
              </div>

              <div class="customizer-field-group">
                <label class="customizer-field-label">下身褲裙版型 (6種)</label>
                <div class="customizer-chips-wrap">
                  ${CHARACTER_CUSTOM_OPTIONS.bottoms.map(b => `
                    <button type="button" class="customizer-chip ${b.id === cur.bottomId ? 'selected' : ''}" data-field="bottomId" data-val="${b.id}">
                      ${b.name}
                    </button>
                  `).join('')}
                </div>
              </div>

              <div class="customizer-field-group">
                <label class="customizer-field-label">五官神采與膚色</label>
                <div class="customizer-chips-wrap">
                  ${CHARACTER_CUSTOM_OPTIONS.faceStyles.map(f => `
                    <button type="button" class="customizer-chip ${f.id === cur.faceStyleId ? 'selected' : ''}" data-field="faceStyleId" data-val="${f.id}">
                      ${f.name}
                    </button>
                  `).join('')}
                  ${CHARACTER_CUSTOM_OPTIONS.skinTones.map(s => `
                    <button type="button" class="customizer-chip ${s.id === cur.skinToneId ? 'selected' : ''}" data-field="skinToneId" data-val="${s.id}">
                      ${s.name}
                    </button>
                  `).join('')}
                </div>
              </div>

              <div class="customizer-field-group">
                <label class="customizer-field-label">鞋履與隨身背包</label>
                <div class="customizer-chips-wrap">
                  ${CHARACTER_CUSTOM_OPTIONS.shoes.map(sh => `
                    <button type="button" class="customizer-chip ${sh.id === cur.shoesId ? 'selected' : ''}" data-field="shoesId" data-val="${sh.id}">
                      ${sh.name}
                    </button>
                  `).join('')}
                  ${CHARACTER_CUSTOM_OPTIONS.backpacks.map(bg => `
                    <button type="button" class="customizer-chip ${bg.id === cur.backpackId ? 'selected' : ''}" data-field="backpackId" data-val="${bg.id}">
                      ${bg.name}
                    </button>
                  `).join('')}
                </div>
              </div>

              <div class="customizer-field-group" style="grid-column: 1 / -1;">
                <label class="customizer-field-label">帽飾與眼鏡配件 (6種)</label>
                <div class="customizer-chips-wrap">
                  ${CHARACTER_CUSTOM_OPTIONS.accessories.map(ac => `
                    <button type="button" class="customizer-chip ${ac.id === cur.accessoryId ? 'selected' : ''}" data-field="accessoryId" data-val="${ac.id}">
                      ${ac.name}
                    </button>
                  `).join('')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    const syncChipStates = () => {
      container.querySelectorAll('.customizer-chip').forEach(btn => {
        const f = btn.getAttribute('data-field');
        const v = btn.getAttribute('data-val');
        if (f && v) {
          btn.classList.toggle('selected', cur[f] === v);
        }
      });
    };

    let previewTick = 0;
    const updatePreview = () => {
      this.player.saveAppearance(cur);
      syncChipStates();
    };

    updatePreview();

    const animatePreview = () => {
      const prevCanvas = container.querySelector('#creator-preview-canvas');
      if (!prevCanvas) {
        this.stopActiveAnim();
        return;
      }
      previewTick += 0.08;
      const pctx = prevCanvas.getContext('2d');
      const sheet = this.player.customSpriteCanvas;
      if (pctx && sheet) {
        pctx.clearRect(0, 0, 96, 96);
        pctx.imageSmoothingEnabled = false;
        const frameIdx = Math.floor(previewTick) % 4;
        pctx.drawImage(sheet, frameIdx * 32, 0, 32, 32, 0, 0, 96, 96);
      }
      this.activeAnimFrame = requestAnimationFrame(animatePreview);
    };
    this.activeAnimFrame = requestAnimationFrame(animatePreview);

    // Chip selection (in-place update, never destroys listeners!)
    container.querySelectorAll('.customizer-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const field = chip.getAttribute('data-field');
        const val = chip.getAttribute('data-val');
        if (field && val) {
          cur[field] = val;
          this.audio.playInteract();
          updatePreview();
        }
      });
    });

    const randBtn = container.querySelector('#btn-random-appearance');
    if (randBtn) {
      randBtn.addEventListener('click', () => {
        this.audio.playInteract();
        const pick = (arr) => arr[Math.floor(Math.random() * arr.length)].id;
        cur.faceStyleId = pick(CHARACTER_CUSTOM_OPTIONS.faceStyles);
        cur.hairStyleId = pick(CHARACTER_CUSTOM_OPTIONS.hairStyles);
        cur.skinToneId = pick(CHARACTER_CUSTOM_OPTIONS.skinTones);
        cur.hairColorId = pick(CHARACTER_CUSTOM_OPTIONS.hairColors);
        cur.shirtId = pick(CHARACTER_CUSTOM_OPTIONS.shirts);
        cur.bottomId = pick(CHARACTER_CUSTOM_OPTIONS.bottoms);
        cur.shoesId = pick(CHARACTER_CUSTOM_OPTIONS.shoes);
        cur.backpackId = pick(CHARACTER_CUSTOM_OPTIONS.backpacks);
        cur.accessoryId = pick(CHARACTER_CUSTOM_OPTIONS.accessories);
        updatePreview();
      });
    }

    const startFromCreatorBtn = container.querySelector('#btn-start-from-creator');
    if (startFromCreatorBtn) {
      startFromCreatorBtn.addEventListener('click', () => {
        this.stopActiveAnim();
        this.audio.playCollect();
        this.player.saveAppearance(cur);
        onStartGame();
      });
    }

    const closeBtn = container.querySelector('#close-creator-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.stopActiveAnim();
        this.audio.playInteract();
        this.player.saveAppearance(cur);
        onClose();
      });
    }
  }

  // ========================================================
  // SECOND-LAYER INTERACTIVE EXPERIENCE MODAL (#7 互動體驗與動畫)
  // ========================================================
  renderInteractiveExperienceModal(container, config, onComplete, onCancel) {
    this.stopActiveAnim();
    let step = 0;
    let animTick = 0;

    const stepsMap = {
      pong_sugar: [
        { badge: '步驟 1 / 3：炭火溫熱黑糖水', btn: '[ 煽風升旺炭火熬糖 ]', status: '請點擊按鈕煽旺炭爐，讓長柄銅杓裡的古早黑糖水煮沸起泡。' },
        { badge: '步驟 2 / 3：濃稠糖漿快速攪拌', btn: '[ 加入少許小蘇打粉快速攪拌 ]', status: '黑糖漿已沸騰冒出金黃大泡！快加入小蘇打粉並快速畫圈攪拌！' },
        { badge: '步驟 3 / 3：椪糖金黃膨發完成', btn: '[ 品嚐並收錄府中街椪糖記憶 ]', status: '銅杓中的糖漿瞬間膨發成飽滿金黃的半圓形蜂巢椪糖，焦香四溢！' }
      ],
      cat_pet: [
        { badge: '互動 1 / 3：輕聲靠近木凳上的小府', btn: '[ 伸手輕撓小府的下巴 ]', status: '橘貓「小府」正蜷在老木凳上曬太陽，瞇著眼睛看你。' },
        { badge: '互動 2 / 3：小府發出呼嚕呼嚕聲', btn: '[ 順順背毛並餵食小魚乾 ]', status: '小府舒服地仰起下巴，喉嚨發出療癒的呼嚕呼嚕聲！' },
        { badge: '互動 3 / 3：獲得橘貓的好感與御守', btn: '[ 收下巷弄橘貓幸運御守 ]', status: '小府開心地伸了個懶腰，將一枚幸運御守與貓耳髮箍送給了你！' }
      ],
      lantern_light: [
        { badge: '步驟 1 / 2：拉動老街花架麻繩', btn: '[ 點亮神農街祈福紅燈籠 ]', status: '午後微風拂過五條港老街屋，準備點亮跨街木樑上的祈福紅燈籠。' },
        { badge: '步驟 2 / 2：燈火輝映百年木窗花', btn: '[ 收錄神農街紅燈籠印章 ]', status: '整排紅燈籠依序亮起溫暖金光，映照著金華府與二樓木造卸貨門！' }
      ],
      well_pump: [
        { badge: '步驟 1 / 2：握住百年鑄鐵汲水把手', btn: '[ 上下壓動把手引出井水 ]', status: '神農街老屋門前的手壓汲水泵浦，連接著清冽的五條港地下水脈。' },
        { badge: '步驟 2 / 2：清涼井水湧出石槽', btn: '[ 掬水洗洗手完成體驗 ]', status: '清澈甘冽的井水嘩啦啦湧入石槽，洗去旅途的燥熱與疲憊！' }
      ],
      stamp_rub: [
        { badge: '步驟 1 / 2：準備拓印古蹟圖紋', btn: '[ 均勻沾取朱砂印泥並壓印 ]', status: '將旅行集章冊攤開，準備把眼前珍貴的四百年古蹟紋飾拓印下來。' },
        { badge: '步驟 2 / 2：古蹟朱紅印記完美顯現', btn: '[ 收錄至府城旅行紀念冊 ]', status: '朱紅色的古蹟印記清晰烙印在紀念冊頁面上，留下永恆的文化記憶！' }
      ],
      horse_pray: [
        { badge: '步驟 1 / 2：參拜祀典武廟馬使爺與赤兔馬', btn: '[ 順順赤兔神駒鬃毛並撫觸馬蹄 ]', status: '赤兔神駒石雕昂首佇立，相傳撫摸馬鬃與馬蹄可祈求行路矯健平安。' },
        { badge: '步驟 2 / 2：獲得赤兔神駒健步祝福', btn: '[ 完成參拜領取祝福 ]', status: '金光閃耀於神馬周圍，旅途步伐變得更加輕盈有力！' }
      ],
      blueprint_art: [
        { badge: '步驟 1 / 2：觀察3D藍晒圖工程透視線', btn: '[ 走入白色立體線條桌椅構圖 ]', status: '湛藍斜頂山牆上繪有精準的白色透視格線與半立體木椅。' },
        { badge: '步驟 2 / 2：古今交錯空間定格完成', btn: '[ 收錄海安路藍晒圖明信片 ]', status: '立體白線與真實街景完美融合，完成街道美術館踩點！' }
      ],
      telescope_view: [
        { badge: '步驟 1 / 2：轉動黃銅望遠鏡對焦環', btn: '[ 對焦遠眺安平港與台江內海 ]', status: '透過瞭望臺高倍望遠鏡，搜尋昔日大員港道與遠方海平線。' },
        { badge: '步驟 2 / 2：壯闊安平海景盡收眼底', btn: '[ 完成古堡登高遠眺體驗 ]', status: '紅瓦聚落、古運河與閃耀金光的台灣海峽在鏡片中清晰浮現！' }
      ],
      treehouse_explore: [
        { badge: '步驟 1 / 2：步上樹屋空中木棧道', btn: '[ 穿過百年老雀榕氣根簾幕 ]', status: '德記洋行舊倉庫被盤根錯節的粗大榕樹氣根緊緊包覆。' },
        { badge: '步驟 2 / 2：見證樹以牆為幹奇景', btn: '[ 完成樹屋共生奇景探索 ]', status: '陽光從濃密榕樹冠葉隙灑落紅磚牆，感受大自然與歷史建築共生的震撼！' }
      ],
      temple_pray: [
        { badge: '步驟 1 / 2：駐足古蹟殿前誠心瞻仰', btn: '[ 雙手合十行禮並細賞建築工藝 ]', status: '抬頭仰望重檐燕尾脊、剪黏龍鳳與歷代御匾的精湛匠藝。' },
        { badge: '步驟 2 / 2：感受三百五十年古都文風', btn: '[ 完成古蹟巡禮體驗 ]', status: '檀香與古木氣息撲面而來，深刻體會台南府城的歷史底蘊！' }
      ]
    };

    const expKey = config.expKey || 'temple_pray';
    const steps = stepsMap[expKey] || stepsMap.temple_pray;

    container.innerHTML = `
      <div class="pixel-modal-backdrop">
        <div class="pixel-modal-box" style="max-width:600px;">
          <div class="pixel-modal-header">
            <div>
              <div class="pixel-kicker">INTERACTIVE EXPERIENCE ・ 深度互動體驗</div>
              <h3>${config.title}</h3>
            </div>
            <button type="button" class="pixel-btn small" id="close-exp-btn">離開 [ESC]</button>
          </div>

          <div class="interactive-stage-layout">
            <div class="interactive-canvas-wrap">
              <canvas id="exp-stage-canvas" width="240" height="140"></canvas>
              <div class="interactive-Step-badge" id="exp-step-badge">${steps[0].badge}</div>
              <div class="interactive-progress-bar">
                <div class="interactive-progress-fill" id="exp-progress-fill" style="width: 33%;"></div>
              </div>
            </div>

            <div class="interactive-info-pane">
              <div class="interactive-lore-box">
                <div style="color:#FFE28A;font-weight:700;margin-bottom:4px;" id="exp-status-text">
                  ${steps[0].status}
                </div>
                <div style="font-size:11.5px;color:#D8C4AC;border-top:1px solid #483028;padding-top:6px;margin-top:6px;">
                  ${config.body}
                </div>
              </div>

              <button type="button" class="pixel-btn primary large" id="exp-action-btn" style="width:100%;">
                ${steps[0].btn}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    const drawStage = () => {
      const cvs = container.querySelector('#exp-stage-canvas');
      if (!cvs) {
        this.stopActiveAnim();
        return;
      }
      animTick += 0.06;
      const ctx = cvs.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#181014';
      ctx.fillRect(0, 0, 240, 140);

      // Decorative pixel frame
      ctx.strokeStyle = '#684232';
      ctx.strokeRect(2, 2, 236, 136);

      if (expKey === 'pong_sugar') {
        // Charcoal brazier stove
        ctx.fillStyle = '#583A32';
        ctx.fillRect(80, 92, 80, 38);
        ctx.fillStyle = '#382420';
        ctx.fillRect(88, 96, 64, 10);
        // Glowing charcoal embers
        const glow = step >= 1 ? 1.0 : 0.5;
        for (let i = 0; i < 8; i++) {
          ctx.fillStyle = (i + Math.floor(animTick * 4)) % 2 === 0 ? '#FF5232' : '#FFAA32';
          ctx.fillRect(92 + i * 7, 94 - (step >= 1 ? Math.sin(animTick * 5 + i) * 3 : 0), 6, 6);
        }
        // Long-handled bronze ladle
        ctx.fillStyle = '#C87632';
        ctx.fillRect(86, 72, 68, 18);
        ctx.fillStyle = '#784828';
        ctx.fillRect(154, 76, 66, 6);
        // Sugar inside ladle
        if (step === 0) {
          ctx.fillStyle = '#8C4820';
          ctx.fillRect(90, 68, 60, 6);
        } else if (step === 1) {
          // Bubbling syrup & stirring rod
          ctx.fillStyle = '#D88A28';
          ctx.fillRect(90, 64, 60, 10);
          for (let b = 0; b < 6; b++) {
            const by = 62 - ((animTick * 12 + b * 5) % 12);
            ctx.fillStyle = '#FFE078';
            ctx.fillRect(96 + b * 9, by, 5, 5);
          }
          // Stirring chopstick
          const stirX = 120 + Math.sin(animTick * 8) * 18;
          ctx.fillStyle = '#E8C898';
          ctx.fillRect(stirX, 28, 4, 44);
        } else {
          // Magical puffed golden honeycomb dome!
          const domeH = 34;
          ctx.fillStyle = '#E8A238';
          ctx.fillRect(84, 72 - domeH, 72, domeH);
          ctx.fillStyle = '#F6C258';
          ctx.fillRect(90, 72 - domeH - 6, 60, 8);
          ctx.fillStyle = '#FFE28A';
          ctx.fillRect(100, 72 - domeH - 2, 40, 6);
          // Honeycomb pores
          ctx.fillStyle = '#B87220';
          for (let px = 92; px < 148; px += 10) {
            ctx.fillRect(px, 52, 3, 3);
            ctx.fillRect(px + 4, 60, 3, 3);
          }
        }
      } else if (expKey === 'cat_pet') {
        // Wooden bench & potted plant
        ctx.fillStyle = '#78482C';
        ctx.fillRect(40, 102, 160, 10);
        ctx.fillRect(56, 112, 12, 24);
        ctx.fillRect(172, 112, 12, 24);
        // Cute large pixel orange tabby cat "小府"
        const purrBob = step >= 1 ? Math.round(Math.sin(animTick * 6) * 2) : 0;
        ctx.fillStyle = '#22181C';
        ctx.fillRect(86, 66 + purrBob, 68, 36);
        ctx.fillStyle = '#EE8E3A';
        ctx.fillRect(90, 70 + purrBob, 60, 28);
        ctx.fillStyle = '#FCB05C';
        ctx.fillRect(96, 76 + purrBob, 48, 20);
        // Cat ears
        ctx.fillStyle = '#EE8E3A';
        ctx.fillRect(90, 56 + purrBob, 14, 14);
        ctx.fillRect(126, 56 + purrBob, 14, 14);
        ctx.fillStyle = '#F29898';
        ctx.fillRect(94, 60 + purrBob, 6, 8);
        ctx.fillRect(130, 60 + purrBob, 6, 8);
        // Cat eyes (squinting happy arch when petted!)
        ctx.fillStyle = '#22181C';
        if (step >= 1) {
          ctx.fillRect(100, 76 + purrBob, 8, 2);
          ctx.fillRect(122, 76 + purrBob, 8, 2);
        } else {
          ctx.fillRect(102, 74 + purrBob, 6, 6);
          ctx.fillRect(124, 74 + purrBob, 6, 6);
        }
        // Tail wagging
        const tailWag = Math.round(Math.sin(animTick * 5) * 6);
        ctx.fillStyle = '#EE8E3A';
        ctx.fillRect(150, 72 + tailWag, 18, 8);
        // Floating pixel hearts when petted
        if (step >= 1) {
          for (let h = 0; h < 3; h++) {
            const hy = 48 - ((animTick * 10 + h * 12) % 32);
            const hx = 95 + h * 22 + Math.sin(animTick * 3 + h) * 4;
            ctx.fillStyle = '#FF5868';
            ctx.fillRect(hx, hy, 8, 6);
            ctx.fillRect(hx + 2, hy + 6, 4, 2);
          }
        }
        if (step >= 2) {
          // Dried fish treat
          ctx.fillStyle = '#78A8C8';
          ctx.fillRect(62, 92, 20, 8);
        }
      } else if (expKey === 'lantern_light') {
        // Overhead wooden beam & 4 red lanterns
        ctx.fillStyle = '#683E28';
        ctx.fillRect(20, 24, 200, 8);
        for (let i = 0; i < 4; i++) {
          const lx = 46 + i * 48;
          const sway = Math.sin(animTick * 3 + i) * 3;
          ctx.fillStyle = '#2A1E1B';
          ctx.fillRect(lx, 32, 2, 20);
          const isLit = (step >= 1);
          if (isLit) {
            ctx.fillStyle = 'rgba(255, 214, 102, 0.28)';
            ctx.fillRect(lx - 18 + sway, 46, 38, 42);
          }
          ctx.fillStyle = '#D89C52';
          ctx.fillRect(lx - 6 + sway, 50, 14, 4);
          ctx.fillStyle = isLit ? '#FF4838' : '#8E2820';
          ctx.fillRect(lx - 12 + sway, 54, 26, 28);
          if (isLit) {
            ctx.fillStyle = '#FFE888';
            ctx.fillRect(lx - 5 + sway, 60, 12, 16);
          }
          ctx.fillStyle = '#F2C654';
          ctx.fillRect(lx - 1 + sway, 82, 4, 12);
        }
      } else if (expKey === 'well_pump') {
        // Stone well slab & green cast-iron pump
        ctx.fillStyle = '#98908A';
        ctx.fillRect(50, 114, 140, 16);
        ctx.fillStyle = '#3A6854';
        ctx.fillRect(104, 48, 28, 66);
        ctx.fillRect(76, 74, 28, 12);
        // Moving pump handle
        const handleY = step >= 1 ? Math.sin(animTick * 7) * 14 : -8;
        ctx.fillStyle = '#C8D0D8';
        ctx.fillRect(132, 54 + handleY, 54, 8);
        // Gushing water stream
        if (step >= 1) {
          ctx.fillStyle = '#88D8FF';
          ctx.fillRect(78, 86, 12, 28);
          for (let s = 0; s < 5; s++) {
            ctx.fillStyle = '#D8F4FF';
            ctx.fillRect(68 + s * 7, 108 - ((animTick * 14 + s * 4) % 10), 4, 4);
          }
        }
      } else if (expKey === 'stamp_rub' || expKey === 'sword_lion' || expKey === 'pangong_arch') {
        // Parchment paper & carved seal stamp
        ctx.fillStyle = '#F4E8D0';
        ctx.fillRect(54, 30, 132, 86);
        ctx.strokeStyle = '#BA3E30';
        ctx.strokeRect(60, 36, 120, 74);
        if (step === 0) {
          // Unstamped parchment & hovering wooden seal
          const hoverY = Math.sin(animTick * 4) * 4;
          ctx.fillStyle = '#784228';
          ctx.fillRect(96, 42 + hoverY, 48, 36);
          ctx.fillStyle = '#D83828';
          ctx.fillRect(96, 74 + hoverY, 48, 6);
        } else {
          // Crisp vermilion seal impression revealed!
          ctx.fillStyle = '#C82E24';
          ctx.fillRect(88, 44, 64, 56);
          ctx.fillStyle = '#F4E8D0';
          ctx.fillRect(92, 48, 56, 48);
          ctx.fillStyle = '#C82E24';
          ctx.fillRect(98, 54, 44, 36);
          if (this.collectiblesImg && config.spriteIndex !== undefined) {
            ctx.drawImage(this.collectiblesImg, config.spriteIndex * 48, 0, 48, 48, 96, 48, 48, 48);
          }
        }
      } else {
        // Scenic temple / monument / telescope view with golden shimmer
        ctx.fillStyle = '#2E1E28';
        ctx.fillRect(20, 20, 200, 100);
        ctx.fillStyle = '#BA3E30';
        ctx.fillRect(50, 56, 140, 54);
        ctx.fillStyle = '#367E5C';
        ctx.fillRect(40, 40, 160, 18);
        ctx.fillStyle = '#F2C654';
        ctx.fillRect(88, 64, 64, 16);
        if (step >= 1) {
          for (let s = 0; s < 6; s++) {
            const sx = 45 + s * 30;
            const sy = 35 + Math.sin(animTick * 4 + s) * 10;
            ctx.fillStyle = '#FFE888';
            ctx.fillRect(sx, sy, 4, 4);
          }
        }
      }

      this.activeAnimFrame = requestAnimationFrame(drawStage);
    };

    this.activeAnimFrame = requestAnimationFrame(drawStage);

    const actionBtn = container.querySelector('#exp-action-btn');
    const badgeEl = container.querySelector('#exp-step-badge');
    const statusEl = container.querySelector('#exp-status-text');
    const progEl = container.querySelector('#exp-progress-fill');
    const closeBtn = container.querySelector('#close-exp-btn');

    if (actionBtn) {
      actionBtn.addEventListener('click', () => {
        if (step + 1 < steps.length) {
          step++;
          this.audio.playInteract();
          const curStep = steps[step];
          if (badgeEl) badgeEl.textContent = curStep.badge;
          if (statusEl) statusEl.textContent = curStep.status;
          if (progEl) progEl.style.width = `${Math.round(((step + 1) / steps.length) * 100)}%`;
          actionBtn.textContent = curStep.btn;
        } else {
          this.stopActiveAnim();
          this.audio.playCollect();
          onComplete();
        }
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.stopActiveAnim();
        onCancel();
      });
    }
  }

  // ========================================================
  // INTERACTIVE CAMERA VIEWFINDER & POLAROID MODAL (#10 拍照互動感)
  // ========================================================
  renderPhotoViewfinderModal(container, pspot, sceneCfg, skyImg, worldImg, onCaptured, onCancel) {
    this.stopActiveAnim();
    let filterMode = 0; // 0: 午後暖陽, 1: 復古底片, 2: 鮮明風景
    let zoomMode = 0;   // 0: 標準廣角, 1: 地標特寫
    let captured = false;
    let tick = 0;

    const filterNames = ['午後暖陽', '懷舊底片', '鮮明風景'];
    const zoomNames = ['標準廣角', '地標特寫'];

    container.innerHTML = `
      <div class="pixel-modal-backdrop">
        <div class="pixel-modal-box" style="max-width:600px;">
          <div class="pixel-modal-header">
            <div>
              <div class="pixel-kicker">CAMERA VIEWFINDER ・ 府城風景取景器</div>
              <h3 id="photo-modal-title">取景構圖：${pspot.scenicTitle}</h3>
            </div>
            <button type="button" class="pixel-btn small" id="close-photo-btn">收起相機 [ESC]</button>
          </div>

          <div class="interactive-stage-layout">
            <div class="interactive-canvas-wrap" style="width:256px;background:#1A1216;">
              <canvas id="viewfinder-canvas" width="240" height="135"></canvas>
              <div class="interactive-Step-badge" id="viewfinder-badge">濾鏡：午後暖陽 ｜ 焦段：標準廣角</div>
            </div>

            <div class="interactive-info-pane">
              <div class="interactive-lore-box" id="photo-desc-box">
                <div style="color:#FFE28A;font-weight:700;margin-bottom:4px;">取景提示</div>
                <div>${pspot.description}</div>
              </div>

              <div style="display:flex;gap:6px;flex-wrap:wrap;" id="camera-controls-row">
                <button type="button" class="pixel-btn small" id="btn-toggle-filter" style="flex:1;">
                  [ 切換濾鏡 ]
                </button>
                <button type="button" class="pixel-btn small" id="btn-toggle-zoom" style="flex:1;">
                  [ 切換焦距 ]
                </button>
              </div>

              <button type="button" class="pixel-btn primary large" id="btn-shutter-action" style="width:100%;">
                [ 按下快門拍攝相片 ]
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    const renderViewfinder = () => {
      const cvs = container.querySelector('#viewfinder-canvas');
      if (!cvs) {
        this.stopActiveAnim();
        return;
      }
      tick += 0.05;
      const ctx = cvs.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, 240, 135);

      const srcX = Math.max(0, Math.min(880 - 240, pspot.x - 120));
      if (zoomMode === 0) {
        if (skyImg) ctx.drawImage(skyImg, srcX * 0.28, 0, 240, 135, 0, 0, 240, 135);
        if (worldImg) ctx.drawImage(worldImg, srcX, 45, 240, 145, 0, 0, 240, 135);
      } else {
        if (skyImg) ctx.drawImage(skyImg, srcX * 0.28 + 30, 10, 160, 90, 0, 0, 240, 135);
        if (worldImg) ctx.drawImage(worldImg, srcX + 40, 55, 160, 100, 0, 0, 240, 135);
      }

      // Filter tint overlay
      if (filterMode === 0) {
        ctx.fillStyle = 'rgba(255, 200, 110, 0.14)';
        ctx.fillRect(0, 0, 240, 135);
      } else if (filterMode === 1) {
        ctx.fillStyle = 'rgba(168, 128, 88, 0.26)';
        ctx.fillRect(0, 0, 240, 135);
      }

      if (!captured) {
        // Rule-of-thirds grid & camera crosshair
        ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
        ctx.fillRect(80, 0, 1, 135);
        ctx.fillRect(160, 0, 1, 135);
        ctx.fillRect(0, 45, 240, 1);
        ctx.fillRect(0, 90, 240, 1);
        // Corner viewfinder brackets
        ctx.fillStyle = '#FFE28A';
        ctx.fillRect(10, 10, 12, 2); ctx.fillRect(10, 10, 2, 12);
        ctx.fillRect(218, 10, 12, 2); ctx.fillRect(228, 10, 2, 12);
        ctx.fillRect(10, 123, 12, 2); ctx.fillRect(10, 113, 2, 12);
        ctx.fillRect(218, 123, 12, 2); ctx.fillRect(228, 113, 2, 12);
        // Center focus reticle
        const pulse = Math.round(Math.sin(tick * 4) * 2);
        ctx.strokeStyle = '#FFE28A';
        ctx.strokeRect(108 - pulse, 55 - pulse, 24 + pulse * 2, 24 + pulse * 2);
      } else {
        // Polaroid white border frame
        ctx.strokeStyle = '#FFF8EC';
        ctx.lineWidth = 6;
        ctx.strokeRect(3, 3, 234, 129);
        ctx.lineWidth = 1;
      }

      this.activeAnimFrame = requestAnimationFrame(renderViewfinder);
    };

    this.activeAnimFrame = requestAnimationFrame(renderViewfinder);

    const badgeEl = container.querySelector('#viewfinder-badge');
    const updateBadge = () => {
      if (badgeEl) {
        badgeEl.textContent = captured
          ? `拍立得顯影完成｜${sceneCfg.timeOfDay}`
          : `濾鏡：${filterNames[filterMode]} ｜ 焦段：${zoomNames[zoomMode]}`;
      }
    };

    const filterBtn = container.querySelector('#btn-toggle-filter');
    const zoomBtn = container.querySelector('#btn-toggle-zoom');
    const shutterBtn = container.querySelector('#btn-shutter-action');
    const closeBtn = container.querySelector('#close-photo-btn');

    if (filterBtn) {
      filterBtn.addEventListener('click', () => {
        this.audio.playInteract();
        filterMode = (filterMode + 1) % filterNames.length;
        updateBadge();
      });
    }

    if (zoomBtn) {
      zoomBtn.addEventListener('click', () => {
        this.audio.playInteract();
        zoomMode = (zoomMode + 1) % zoomNames.length;
        updateBadge();
      });
    }

    if (shutterBtn) {
      shutterBtn.addEventListener('click', () => {
        if (!captured) {
          captured = true;
          this.audio.playCameraShutter();
          this.triggerPhotoFlash(container);
          updateBadge();
          const titleEl = container.querySelector('#photo-modal-title');
          if (titleEl) titleEl.textContent = `相片顯影完成：${pspot.scenicTitle}`;
          shutterBtn.textContent = '[ 將相片收錄至旅行紀念冊 ]';
        } else {
          this.stopActiveAnim();
          this.audio.playCollect();
          onCaptured();
        }
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.stopActiveAnim();
        onCancel();
      });
    }
  }

  // ========================================================
  // SINGLE FOOD INTERACTIVE COOKING & TASTING MODAL (#12 & #7)
  // ========================================================
  renderSingleFoodModal(container, food, onTaste, onCancel) {
    this.stopActiveAnim();
    const iconUrl = this.createIconDataUrl(this.foodsImg, food.spriteIndex, 48);
    let cooked = false;

    container.innerHTML = `
      <div class="pixel-modal-backdrop">
        <div class="pixel-modal-box" style="max-width:540px;">
          <div class="pixel-modal-header">
            <div>
              <div class="pixel-kicker">TAINAN DELICACY ・ 府城職人の味</div>
              <h3>${food.name}</h3>
            </div>
            <button type="button" class="pixel-btn small" id="close-food-btn">離開攤位 [ESC]</button>
          </div>

          <div class="interactive-stage-layout">
            <div class="interactive-canvas-wrap" style="width:170px;">
              <div style="width:72px;height:72px;background:#120A0E;border:2px solid #F2C66D;display:flex;align-items:center;justify-content:center;">
                <img src="${iconUrl}" alt="${food.name}" id="food-stage-img" style="width:60px;height:60px;image-rendering:pixelated;transition:transform 0.25s;" />
              </div>
              <div class="interactive-Step-badge" id="food-step-badge">步驟 1 / 2：職手作料理</div>
              <div class="interactive-progress-bar">
                <div class="interactive-progress-fill" id="food-prog-fill" style="width: 50%;"></div>
              </div>
            </div>

            <div class="interactive-info-pane">
              <div class="interactive-lore-box">
                <div style="font-size:12px;color:#F2C66D;font-weight:700;margin-bottom:4px;">
                  ${food.subtitle}
                </div>
                <div id="food-live-desc" style="color:#F5EAD8;">
                  ${food.description}
                </div>
              </div>

              <button type="button" class="pixel-btn primary large" id="taste-food-btn" style="width:100%;">
                [ 步驟 1：${food.prepStepLabel || '現場手作料理'} ]
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    const tasteBtn = container.querySelector('#taste-food-btn');
    const descEl = container.querySelector('#food-live-desc');
    const badgeEl = container.querySelector('#food-step-badge');
    const progEl = container.querySelector('#food-prog-fill');
    const imgEl = container.querySelector('#food-stage-img');
    const closeBtn = container.querySelector('#close-food-btn');

    if (tasteBtn) {
      tasteBtn.addEventListener('click', () => {
        if (!cooked) {
          cooked = true;
          this.audio.playInteract();
          if (imgEl) imgEl.style.transform = 'scale(1.12)';
          if (badgeEl) badgeEl.textContent = '步驟 2 / 2：熱騰騰上桌';
          if (progEl) progEl.style.width = '100%';
          if (descEl) descEl.innerHTML = `<strong style="color:#FFE28A;">料理完成：</strong>${food.prepDoneText || food.description}`;
          tasteBtn.textContent = `[ 大口品嚐「${food.name}」 ]`;
        } else {
          onTaste();
        }
      });
    }

    if (closeBtn) closeBtn.addEventListener('click', onCancel);
  }

  renderFoodChallengeModal(container, onSelect, onCancel) {
    this.stopActiveAnim();
    const targetChallengeFood = TAINAN_FOOD_CHOICES[Math.floor(Math.random() * TAINAN_FOOD_CHOICES.length)];
    const pool = [targetChallengeFood];
    while (pool.length < 4) {
      const candidate = TAINAN_FOOD_CHOICES[Math.floor(Math.random() * TAINAN_FOOD_CHOICES.length)];
      if (!pool.some(f => f.id === candidate.id)) pool.push(candidate);
    }
    pool.sort(() => Math.random() - 0.5);

    const cardsHtml = pool.map(f => {
      const iconUrl = this.createIconDataUrl(this.foodsImg, f.spriteIndex, 48);
      return `
        <div class="pixel-choice-card" data-food-id="${f.id}">
          <div class="choice-icon-wrap">
            <img src="${iconUrl}" alt="${f.name}" />
          </div>
          <div class="choice-body">
            <h4>${f.name}</h4>
            <div class="choice-sub">${f.subtitle}</div>
          </div>
          <button type="button" class="pixel-btn primary small select-challenge-btn" data-food-id="${f.id}">
            [ 送出這道小吃 ]
          </button>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="pixel-modal-backdrop">
        <div class="pixel-modal-box" style="max-width:660px;">
          <div class="pixel-modal-header">
            <div>
              <div class="pixel-kicker">SCENE 05 ・ 永樂市場老饕點餐挑戰</div>
              <h3>阿桃姨考考你的老饕味蕾</h3>
            </div>
            <button type="button" class="pixel-btn small" id="cancel-challenge-btn">稍後挑戰 [ESC]</button>
          </div>
          <div class="food-challenge-prompt-box">
            <strong>阿桃姨出題：</strong>「人客啊！我要一道特色是【<strong>${targetChallengeFood.subtitle}</strong>】、具有【${targetChallengeFood.hintKey}】風味的名點，請幫我找出來！」
          </div>
          <div class="pixel-choices-grid">
            ${cardsHtml}
          </div>
        </div>
      </div>
    `;

    container.querySelectorAll('.select-challenge-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-food-id');
        const found = TAINAN_FOOD_CHOICES.find(item => item.id === id);
        if (found) {
          const isCorrect = (found.id === targetChallengeFood.id);
          onSelect(found, isCorrect);
        }
      });
    });

    const cancelBtn = container.querySelector('#cancel-challenge-btn');
    if (cancelBtn) cancelBtn.addEventListener('click', onCancel);
  }

  renderQuizModal(container, onComplete, onCancel) {
    this.stopActiveAnim();
    let currentQ = 0;
    let score = 0;

    const renderQuestion = () => {
      if (currentQ >= CHIKHAN_QUIZ_QUESTIONS.length) {
        container.innerHTML = `
          <div class="pixel-modal-backdrop">
            <div class="pixel-modal-box" style="max-width:460px;text-align:center;">
              <div class="pixel-kicker">QUIZ COMPLETED</div>
              <h3>歷史問答挑戰成果</h3>
              <p style="font-size:15px;color:#ffe28a;margin:12px 0;">
                你答對了 ${score} / ${CHIKHAN_QUIZ_QUESTIONS.length} 題
              </p>
              <p style="font-size:12px;color:#d8c4a8;margin-bottom:14px;">
                ${score >= 2 ? '太厲害了！你對府城四百年歷史瞭若指掌，榮獲【祀典武廟大丈夫文衡令】！' : '謝謝你的參與！赤崁樓與祀典武廟蘊含豐厚的時代記憶，隨時可再來挑戰！'}
              </p>
              <button type="button" class="pixel-btn primary" id="finish-quiz-btn">[ 領取挑戰成果 ]</button>
            </div>
          </div>
        `;
        const finishBtn = container.querySelector('#finish-quiz-btn');
        if (finishBtn) finishBtn.addEventListener('click', () => { this.audio.playCollect(); onComplete(score); });
        return;
      }

      const q = CHIKHAN_QUIZ_QUESTIONS[currentQ];
      const optsHtml = q.options.map((opt, i) => `
        <button type="button" class="quiz-option-btn" data-opt-idx="${i}">
          <span class="choice-num">${String.fromCharCode(65 + i)}.</span> ${opt}
        </button>
      `).join('');

      container.innerHTML = `
        <div class="pixel-modal-backdrop">
          <div class="pixel-modal-box" style="max-width:520px;">
            <div class="pixel-modal-header">
              <div>
                <div class="pixel-kicker">SCENE 04 ・ 府城古蹟歷史問答 (第 ${currentQ + 1} / ${CHIKHAN_QUIZ_QUESTIONS.length} 題)</div>
                <h3>${q.question}</h3>
              </div>
              <button type="button" class="pixel-btn small" id="cancel-quiz-btn">離開 [ESC]</button>
            </div>
            <div class="quiz-options-stack">
              ${optsHtml}
            </div>
          </div>
        </div>
      `;

      const cancelBtn = container.querySelector('#cancel-quiz-btn');
      if (cancelBtn) cancelBtn.addEventListener('click', onCancel);

      container.querySelectorAll('.quiz-option-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const chosen = parseInt(e.currentTarget.getAttribute('data-opt-idx') || '0', 10);
          const isCorrect = (chosen === q.correctIndex);
          if (isCorrect) { score++; this.audio.playInteract(); }

          container.innerHTML = `
            <div class="pixel-modal-backdrop">
              <div class="pixel-modal-box" style="max-width:520px;">
                <div class="pixel-modal-header">
                  <div>
                    <div class="pixel-kicker">解答說明</div>
                    <h3 style="color:${isCorrect ? '#88e070' : '#f27868'};">${isCorrect ? '【答對了】' : '【答錯囉】'}</h3>
                  </div>
                </div>
                <div style="font-size:12.5px;line-height:1.6;color:#f5ead8;margin:10px 0;">
                  ${q.explanation}
                </div>
                <button type="button" class="pixel-btn primary" id="next-quiz-btn" style="width:100%;">
                  [ 進入下一題 ]
                </button>
              </div>
            </div>
          `;
          const nextBtn = container.querySelector('#next-quiz-btn');
          if (nextBtn) nextBtn.addEventListener('click', () => { currentQ++; renderQuestion(); });
        });
      });
    };

    renderQuestion();
  }

  renderBlessingModal(container, onSelect, onCancel) {
    this.stopActiveAnim();
    const iconUrl = this.createIconDataUrl(this.collectiblesImg, 6, 48);
    const listHtml = CONFUCIUS_BLESSINGS.map(b => `
      <div class="pixel-blessing-option">
        <div class="blessing-text-wrap">
          <h4>${b.title}</h4>
          <p>「${b.text}」</p>
        </div>
        <button type="button" class="pixel-btn primary small select-blessing-btn" data-blessing-id="${b.id}">
          [ 題寫此祈願 ]
        </button>
      </div>
    `).join('');

    container.innerHTML = `
      <div class="pixel-modal-backdrop">
        <div class="pixel-modal-box" style="max-width:580px;">
          <div class="pixel-modal-header">
            <div style="display:flex;align-items:center;gap:10px;">
              <img src="${iconUrl}" alt="祈福卡" style="width:36px;height:36px;image-rendering:pixelated;" />
              <div>
                <div class="pixel-kicker">SCENE 06 ・ 臺南孔廟祈願亭</div>
                <h3>挑選一段祝福語題寫於祈願木牌</h3>
              </div>
            </div>
            <button type="button" class="pixel-btn small" id="cancel-blessing-btn">返回庭院 [ESC]</button>
          </div>
          <div class="pixel-blessing-list">
            ${listHtml}
          </div>
        </div>
      </div>
    `;

    container.querySelectorAll('.select-blessing-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-blessing-id');
        const found = CONFUCIUS_BLESSINGS.find(item => item.id === id);
        if (found) onSelect(found);
      });
    });

    const cancelBtn = container.querySelector('#cancel-blessing-btn');
    if (cancelBtn) cancelBtn.addEventListener('click', onCancel);
  }

  renderJournalModal(container, onClose) {
    this.stopActiveAnim();
    let activeTab = 'souvenirs';

    const renderContent = () => {
      const collItems = this.collectibles.getAllCollectiblesWithState();
      const foodItems = this.collectibles.getAllFoodsWithState();
      const questItems = this.collectibles.getAllSideQuestsWithState();
      const photos = this.collectibles.getPhotos();
      const collCount = this.collectibles.getCollectedCount();
      const totalColl = this.collectibles.getTotalCount();
      const questCount = this.collectibles.getCompletedSideQuestCount();
      const foodCount = this.collectibles.getTastedFoodCount();

      let bodyHtml = '';

      if (activeTab === 'souvenirs') {
        bodyHtml = `
          <div class="pixel-journal-list">
            ${collItems.map(item => {
              const iconUrl = this.createIconDataUrl(this.collectiblesImg, item.spriteIndex, 48);
              return `
                <div class="pixel-journal-item ${item.unlocked ? 'unlocked' : 'locked'}">
                  <div class="pixel-journal-thumb">
                    <img src="${iconUrl}" alt="${item.name}" class="${item.unlocked ? '' : 'silhouette'}" />
                  </div>
                  <div class="pixel-journal-info">
                    <div class="pixel-journal-head">
                      <span class="scene-tag">${item.sceneCode}</span>
                      <h4>${item.unlocked ? item.name : '？？？・尚未收錄'}</h4>
                      <span class="status-badge">${item.unlocked ? '已收錄' : '未發現'}</span>
                    </div>
                    <p class="loc-line">${item.location}</p>
                    <p class="desc-line">${item.unlocked ? item.summary : '漫步於此場景探索時靠近關鍵地標即可體驗收集。'}</p>
                    ${item.unlocked ? `<div class="history-box"><strong>考據紀錄：</strong>${item.historicalNote}</div>` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `;
      } else if (activeTab === 'foods') {
        bodyHtml = `
          <div class="pixel-choices-grid">
            ${foodItems.map(food => {
              const iconUrl = this.createIconDataUrl(this.foodsImg, food.spriteIndex, 48);
              return `
                <div class="pixel-choice-card ${food.tasted ? 'recommended' : ''}">
                  <div class="choice-icon-wrap">
                    <img src="${iconUrl}" alt="${food.name}" class="${food.tasted ? '' : 'silhouette'}" />
                  </div>
                  <div class="choice-body">
                    <h4>${food.tasted ? food.name : '？？？・待品嚐'}</h4>
                    <div class="choice-sub">${food.subtitle}</div>
                    <p>${food.tasted ? food.description : '前往其所屬場景專屬小吃店鋪品嚐解鎖！'}</p>
                  </div>
                  <span class="status-badge" style="margin-top:auto;">${food.tasted ? '已品嚐' : '未嚐過'}</span>
                </div>
              `;
            }).join('')}
          </div>
        `;
      } else if (activeTab === 'quests') {
        bodyHtml = `
          <div class="pixel-journal-list">
            ${questItems.map(q => `
              <div class="pixel-journal-item ${q.completed ? 'unlocked' : 'locked'}">
                <div class="pixel-journal-info">
                  <div class="pixel-journal-head">
                    <span class="scene-tag">${q.location}</span>
                    <h4>${q.title}</h4>
                    <span class="status-badge">${q.completed ? '已完成' : '進行中'}</span>
                  </div>
                  <p class="desc-line">${q.completed ? q.summary : q.hint}</p>
                  <div class="custom-memory-note">獎勵：${q.rewardName}</div>
                </div>
              </div>
            `).join('')}
          </div>
        `;
      } else if (activeTab === 'photos') {
        if (photos.length === 0) {
          bodyHtml = `
            <div style="text-align:center;padding:28px;color:#d8c4a8;">
              <h4>相簿尚無相片</h4>
              <p style="font-size:12px;margin-top:6px;">在各場景找到風景最佳的【拍照點】按下 [E] 開啟相機取景窗拍攝即可珍藏回憶！</p>
            </div>
          `;
        } else {
          bodyHtml = `
            <div class="pixel-choices-grid" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));">
              ${photos.map(p => `
                <div class="pixel-journal-item unlocked" style="flex-direction:column;">
                  <div class="pixel-journal-head" style="width:100%;">
                    <span class="scene-tag">${p.sceneCode}</span>
                    <h4>${p.scenicTitle}</h4>
                    <span style="font-size:10px;color:#dfb882;margin-left:auto;">${p.timeStr}</span>
                  </div>
                  <p class="desc-line" style="margin-top:4px;">${p.description}</p>
                </div>
              `).join('')}
            </div>
          `;
        }
      }

      container.innerHTML = `
        <div class="pixel-modal-backdrop" id="journal-backdrop">
          <div class="pixel-modal-box journal-box">
            <div class="pixel-modal-header">
              <div>
                <div class="pixel-kicker">TAINAN TRAVEL JOURNAL</div>
                <h3>府城旅行紀念冊（探索進度 ${this.collectibles.getExplorationPercentage()}%）</h3>
              </div>
              <button type="button" class="pixel-btn small" id="close-journal-btn">關閉 [ESC]</button>
            </div>
            <div class="journal-tabs-bar">
              <button type="button" class="journal-tab-btn ${activeTab === 'souvenirs' ? 'active' : ''}" data-tab="souvenirs">
                古蹟印章 (${collCount}/${totalColl})
              </button>
              <button type="button" class="journal-tab-btn ${activeTab === 'foods' ? 'active' : ''}" data-tab="foods">
                九味小吃 (${foodCount}/9)
              </button>
              <button type="button" class="journal-tab-btn ${activeTab === 'quests' ? 'active' : ''}" data-tab="quests">
                支線任務 (${questCount}/8)
              </button>
              <button type="button" class="journal-tab-btn ${activeTab === 'photos' ? 'active' : ''}" data-tab="photos">
                風景相簿 (${photos.length})
              </button>
            </div>
            <div class="journal-tab-body">
              ${bodyHtml}
            </div>
          </div>
        </div>
      `;

      const closeBtn = container.querySelector('#close-journal-btn');
      if (closeBtn) closeBtn.addEventListener('click', onClose);

      container.querySelectorAll('.journal-tab-btn').forEach(tabBtn => {
        tabBtn.addEventListener('click', (e) => {
          activeTab = e.currentTarget.getAttribute('data-tab');
          this.audio.playInteract();
          renderContent();
        });
      });
    };

    renderContent();
  }
}
