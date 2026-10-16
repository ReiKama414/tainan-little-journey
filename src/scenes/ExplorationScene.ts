import {
  COLLECTIBLES_DATA,
  SCENES_DATA,
  SIDE_QUESTS_DATA,
  TAINAN_FOOD_CHOICES
} from '../data/scenesData';
import { GAME_VERSION_LABEL } from '../version';

export class ExplorationScene {
  canvas;
  ctx;
  assets;
  player;
  anim;
  collision;
  interaction;
  sceneMgr;
  collectibles;
  audio;
  journalUI;
  endingScene;

  modalLayer;
  menuLayer;
  hudSubLabel;
  hudProgressLabel;
  toastContainer = null;
  promptElement = null;
  signboardsLayer = null;

  clouds = [];
  particles = [];
  birds = [];
  npcs = [];
  elapsedTime = 0;
  isPaused = false;
  isModalOpen = false;
  /** Main menu overlay — freeze player/NPC so Start doesn't snap them back */
  isTitleMenuOpen = false;
  talkingNpc = null;
  toastTimer = 0;
  tastingFoodSpriteIndex = null;
  tastingTimer = 0;

  constructor(
    canvas, assets, player, anim, collision, interaction, sceneMgr,
    collectibles, audio, journalUI, endingScene, modalLayer, menuLayer,
    hudSubLabel, hudProgressLabel
  ) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D context unavailable');
    this.ctx = context;
    this.ctx.imageSmoothingEnabled = false;

    this.assets = assets;
    this.player = player;
    this.anim = anim;
    this.collision = collision;
    this.interaction = interaction;
    this.sceneMgr = sceneMgr;
    this.collectibles = collectibles;
    this.audio = audio;
    this.journalUI = journalUI;
    this.endingScene = endingScene;
    this.modalLayer = modalLayer;
    this.menuLayer = menuLayer;
    this.hudSubLabel = hudSubLabel;
    this.hudProgressLabel = hudProgressLabel;

    this.toastContainer = document.getElementById('toast-container');
    this.promptElement = document.getElementById('floating-prompt');
    this.signboardsLayer = document.getElementById('world-signboards-layer');

    this.initAmbientEntities();
  }

  initAmbientEntities() {
    this.clouds = [
      { x: 30,  y: 18, w: 48, h: 11, speed: 4.2 },
      { x: 180, y: 28, w: 38, h: 9,  speed: 3.2 },
      { x: 350, y: 14, w: 56, h: 12, speed: 4.8 },
      { x: 530, y: 24, w: 44, h: 10, speed: 3.5 },
      { x: 720, y: 16, w: 50, h: 11, speed: 4.4 }
    ];
    this.birds = [
      { x: 100, y: 40, speed: 22, phase: 0.0 },
      { x: 112, y: 45, speed: 22, phase: 1.2 },
      { x: 126, y: 38, speed: 22, phase: 2.4 },
      { x: 480, y: 34, speed: 18, phase: 0.7 },
      { x: 494, y: 38, speed: 18, phase: 1.9 }
    ];
  }

  startAtScene(sceneIndex, customSpawnX) {
    const cfg = this.sceneMgr.loadScene(sceneIndex, customSpawnX);
    this.applySceneConfig(cfg, customSpawnX !== undefined ? customSpawnX : cfg.spawnX);
  }

  enterTitleMenu() {
    this.isTitleMenuOpen = true;
    this.player.locked = true;
    this.player.interactQueued = false;
    this.player.jumpQueued = false;
    this.updateFloatingPrompt(null, null);
  }

  leaveTitleMenu() {
    this.isTitleMenuOpen = false;
    if (!this.isModalOpen && !this.isPaused && !this.player.sitting) {
      this.player.locked = false;
    }
  }

  /** Start playing from title menu without respawning if already on that scene. */
  beginFromTitle(sceneIndex = 0, forceRestart = false) {
    this.leaveTitleMenu();
    if (forceRestart || this.sceneMgr.getCurrentIndex() !== sceneIndex) {
      this.startAtScene(sceneIndex);
    }
  }

  applySceneConfig(cfg, spawnX) {
    this.collision.configure(cfg.worldWidth, cfg.groundY, cfg.index === 9, cfg.platforms);
    this.player.spawn(spawnX, cfg.groundY);
    this.interaction.setHotspots(cfg.hotspots);
    this.particles = [];
    this.tastingFoodSpriteIndex = null;
    this.talkingNpc = null;

    this.npcs = cfg.npcs.map((n, idx) => ({
      ...n,
      dir: idx % 2 === 0 ? 1 : -1,
      walkPhase: idx * 1.7
    }));

    this.buildSceneSignboardsDOM(cfg);

    this.hudSubLabel.textContent = `${cfg.code}｜${cfg.name}（${cfg.timeOfDay}）— ${cfg.subtitle}`;
    this.updateHudProgress();
    // Shared BGM across all scenes — never restart on scene change
    this.audio.ensureSharedBgm();
    this.showToast(`${cfg.code} ・ ${cfg.name}`, cfg.subtitle, 3.0);
  }

  // Build crisp DOM signboard plaques for the current scene (#9 店名招牌)
  buildSceneSignboardsDOM(cfg) {
    if (!this.signboardsLayer) return;
    const signs = cfg.signboards || [];
    this.signboardsLayer.innerHTML = signs.map((s, idx) => `
      <div class="world-sign-plaque ${s.vertical ? 'vertical' : ''}" id="world-sign-${idx}"
           style="background-color:${s.bg};color:${s.fg};border-color:${s.border};">
        ${s.text}
      </div>
    `).join('');
  }

  updateWorldSignboards(cfg, camX) {
    if (!this.signboardsLayer) return;
    const isMenuVisible = this.menuLayer && this.menuLayer.innerHTML.trim() !== '';
    if (this.isModalOpen || this.isPaused || isMenuVisible) {
      this.signboardsLayer.style.display = 'none';
      return;
    }
    this.signboardsLayer.style.display = 'block';
    const signs = cfg.signboards || [];
    for (let i = 0; i < signs.length; i++) {
      const el = document.getElementById(`world-sign-${i}`);
      if (!el) continue;
      const s = signs[i];
      const screenX = s.x - camX;
      if (screenX < -60 || screenX > 460) {
        el.style.display = 'none';
      } else {
        el.style.display = 'block';
        el.style.left = `${(screenX / 400) * 100}%`;
        el.style.top = `${(s.y / 225) * 100}%`;
      }
    }
  }

  updateHudProgress() {
    const count = this.collectibles.getCollectedCount();
    const total = this.collectibles.getTotalCount();
    this.hudProgressLabel.textContent = `紀念冊 ${count}/${total}`;
  }

  showToast(title, subtitle, durationSec = 3.2) {
    if (!this.toastContainer) return;
    this.toastContainer.innerHTML = `
      <div class="toast-card-dom animate-toast">
        <div class="toast-title-line">${title}</div>
        <div class="toast-sub-line">${subtitle}</div>
      </div>
    `;
    this.toastTimer = durationSec;
  }

  prepareModalOpen() {
    this.isModalOpen = true;
    this.player.locked = true;
    this.player.interactQueued = false;
    this.player.jumpQueued = false;
    if (this.toastContainer) {
      this.toastContainer.innerHTML = '';
      this.toastTimer = 0;
    }
    const pickerMenu = document.getElementById('scene-picker-menu');
    if (pickerMenu) pickerMenu.classList.add('hidden');
    if (this.menuLayer && this.menuLayer.innerHTML.trim() !== '') {
      this.menuLayer.style.display = 'none';
    }
  }

  openJournal() {
    if (this.isModalOpen) return;
    this.prepareModalOpen();
    this.audio.playInteract();
    this.journalUI.renderJournalModal(this.modalLayer, () => {
      this.closeModal();
    });
  }

  openCharacterCreator(onStartFromMenu) {
    if (this.isModalOpen) return;
    this.prepareModalOpen();
    this.audio.playInteract();
    this.journalUI.renderCharacterCreator(
      this.modalLayer,
      () => {
        this.closeModal();
        if (onStartFromMenu) onStartFromMenu();
      },
      () => {
        this.closeModal();
      }
    );
  }

  togglePauseMenu() {
    if (this.isModalOpen) {
      this.closeModal();
      return;
    }
    this.isPaused = !this.isPaused;
    if (this.isPaused) {
      this.prepareModalOpen();
      const volPercent = Math.round(this.audio.getVolume() * 100);
      const muted = this.audio.getMuted();
      const currentIdx = this.sceneMgr.getCurrentIndex();
      const saveState = this.collectibles.getData();

      const sceneButtons = SCENES_DATA.map(s => `
        <button type="button" class="pixel-btn small jump-scene-btn ${s.index === currentIdx ? 'primary' : ''}" data-scene-idx="${s.index}">
          ${s.code} ${s.name}
        </button>
      `).join('');

      this.modalLayer.innerHTML = `
        <div class="pixel-modal-backdrop">
          <div class="pixel-modal-box" style="max-width:520px;">
            <div class="pixel-modal-header">
              <div>
                <div class="pixel-kicker">GAME PAUSED ・ ${GAME_VERSION_LABEL}</div>
                <h3>府城漫步設定與景點切換</h3>
              </div>
              <button type="button" class="pixel-btn small" id="btn-resume-game">繼續旅行 [ESC]</button>
            </div>
            <div style="display:flex;flex-direction:column;gap:10px;padding:4px 0;overflow-y:auto;">
              <div class="audio-control-row">
                <label for="pause-vol-slider">環境總音量：<span id="pause-vol-label">${volPercent}%</span></label>
                <input type="range" id="pause-vol-slider" min="0" max="100" value="${volPercent}" />
              </div>
              <div style="display:flex;gap:6px;flex-wrap:wrap;">
                <button type="button" class="pixel-btn small" id="pause-mute-btn">
                  ${muted ? '[ 音效：已靜音 ]' : '[ 音效：開啟中 ]'}
                </button>
                <button type="button" class="pixel-btn small" id="pause-toggle-controls">
                  [ 操作說明 ]
                </button>
                <button type="button" class="pixel-btn small" id="pause-open-customizer">
                  [ 隨時調整外觀穿搭 ]
                </button>
                <button type="button" class="pixel-btn small" id="pause-open-journal">
                  [ 旅行紀念冊 (${saveState.collectedIds.length}/12) ]
                </button>
              </div>

              <div class="menu-subpanel hidden" id="pause-panel-controls">
                <h4>操作說明（雙向漫步與深度互動）</h4>
                <div class="controls-grid">
                  <div><strong>左右漫步：</strong>A / D 或 ◀ / ▶（雙向自由往返十景）</div>
                  <div><strong>疾走奔跑：</strong>按住 [Shift] 或點擊觸控「疾走」</div>
                  <div><strong>輕巧跳躍：</strong>按 [Space] 或 [W] 或 [▲]</div>
                  <div><strong>低伏蹲下：</strong>按 [S] 或 [▼]</div>
                  <div><strong>深度互動：</strong>靠近招牌與地標按 [E] 取景／對話</div>
                  <div><strong>旅行紀念冊：</strong>按 [J] 開啟收集圖鑑</div>
                  <div><strong>暫停設定：</strong>按 [ESC] 開關本選單</div>
                  <div><strong>背景音樂：</strong>全場景共用同一首循環，切景不重播</div>
                </div>
              </div>

              <div style="border-top:2px solid #5a3e36;padding-top:8px;">
                <div style="font-size:11.5px;color:#e8c89b;margin-bottom:5px;">
                  府城十景快速切換：
                </div>
                <div style="display:flex;flex-wrap:wrap;gap:5px;">
                  ${sceneButtons}
                </div>
              </div>

              <div style="border-top:2px solid #5a3e36;padding-top:8px;display:flex;justify-content:space-between;gap:8px;">
                <button type="button" class="pixel-btn small" id="pause-restart-btn">
                  [ 從神農街重新出發 ]
                </button>
                <button type="button" class="pixel-btn primary small" id="btn-resume-bottom">
                  [ 繼續旅程 ]
                </button>
              </div>
            </div>
          </div>
        </div>
      `;

      const resumeBtn = this.modalLayer.querySelector('#btn-resume-game');
      const resumeBot = this.modalLayer.querySelector('#btn-resume-bottom');
      const volSlider = this.modalLayer.querySelector('#pause-vol-slider');
      const volLabel = this.modalLayer.querySelector('#pause-vol-label');
      const muteBtn = this.modalLayer.querySelector('#pause-mute-btn');
      const controlsBtn = this.modalLayer.querySelector('#pause-toggle-controls');
      const controlsPanel = this.modalLayer.querySelector('#pause-panel-controls');
      const customBtn = this.modalLayer.querySelector('#pause-open-customizer');
      const journalBtn = this.modalLayer.querySelector('#pause-open-journal');
      const restartBtn = this.modalLayer.querySelector('#pause-restart-btn');

      if (resumeBtn) resumeBtn.addEventListener('click', () => this.closeModal());
      if (resumeBot) resumeBot.addEventListener('click', () => this.closeModal());
      if (volSlider && volLabel) {
        volSlider.addEventListener('input', () => {
          const v = parseInt(volSlider.value, 10);
          volLabel.textContent = `${v}%`;
          this.audio.setVolume(v / 100);
        });
      }
      if (muteBtn) {
        muteBtn.addEventListener('click', () => {
          const m = this.audio.toggleMute();
          muteBtn.textContent = m ? '[ 音效：已靜音 ]' : '[ 音效：開啟中 ]';
        });
      }
      if (controlsBtn && controlsPanel) {
        controlsBtn.addEventListener('click', () => {
          this.audio.playInteract();
          controlsPanel.classList.toggle('hidden');
        });
      }
      if (customBtn) {
        customBtn.addEventListener('click', () => {
          this.closeModal();
          this.openCharacterCreator();
        });
      }
      if (journalBtn) {
        journalBtn.addEventListener('click', () => {
          this.closeModal();
          this.openJournal();
        });
      }
      if (restartBtn) {
        restartBtn.addEventListener('click', () => {
          this.closeModal();
          this.collectibles.reset();
          this.startAtScene(0);
        });
      }
      this.modalLayer.querySelectorAll('.jump-scene-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const idx = parseInt(e.currentTarget.getAttribute('data-scene-idx') || '0', 10);
          this.closeModal();
          this.sceneMgr.transitionToScene(idx, (nextCfg, spX) => {
            this.applySceneConfig(nextCfg, spX);
          });
        });
      });
    } else {
      this.closeModal();
    }
  }

  closeModal() {
    this.journalUI.stopActiveAnim();
    if (this.talkingNpc) {
      this.talkingNpc.pauseTimer = 1.0;
      this.talkingNpc = null;
    }
    this.isPaused = false;
    this.isModalOpen = false;
    this.modalLayer.innerHTML = '';
    this.player.interactQueued = false;
    this.player.jumpQueued = false;
    if (this.menuLayer) {
      this.menuLayer.style.display = '';
    }
    const isMenuActive = this.menuLayer && this.menuLayer.innerHTML.trim() !== '';
    if (!this.player.sitting && !isMenuActive) {
      this.player.locked = false;
    }
  }

  findNearbyNPC() {
    let best = null;
    let bestD = 34;
    for (const npc of this.npcs) {
      const d = Math.abs(this.player.x - npc.x);
      if (d < bestD) {
        bestD = d;
        best = npc;
      }
    }
    return best;
  }

  update(dt) {
    this.elapsedTime += dt;
    this.collectibles.addPlayTime(dt);

    if (this.player.consumePause()) {
      this.togglePauseMenu();
      return;
    }

    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0 && this.toastContainer) this.toastContainer.innerHTML = '';
    }

    if (this.tastingTimer > 0) {
      this.tastingTimer -= dt;
      if (this.tastingTimer <= 0) this.tastingFoodSpriteIndex = null;
    }

    const cfg = this.sceneMgr.getCurrentScene();

    for (const c of this.clouds) {
      c.x += c.speed * dt;
      if (c.x > cfg.worldWidth + 60) c.x = -80;
    }
    for (const b of this.birds) {
      b.x += b.speed * dt;
      b.phase += dt * 7.5;
      if (b.x > cfg.worldWidth + 60) b.x = -60;
    }

    this.spawnSceneParticles(cfg, dt);
    this.updateParticles(dt);

    const isMenuVisible = this.isTitleMenuOpen
      || (this.menuLayer && this.menuLayer.innerHTML.trim() !== '' && this.menuLayer.style.display !== 'none');

    if (this.isPaused || isMenuVisible) {
      // Keep sky ambience; freeze actors so closing the menu doesn't snap positions.
      this.player.locked = true;
      this.updateFloatingPrompt(null, null);
      return;
    }

    for (const npc of this.npcs) {
      if (this.talkingNpc && npc.id === this.talkingNpc.id) {
        npc.walkPhase = 0;
        continue;
      }
      if (npc.pauseTimer && npc.pauseTimer > 0) {
        npc.pauseTimer = Math.max(0, npc.pauseTimer - dt);
        npc.walkPhase = 0;
        continue;
      }
      npc.x += npc.speed * npc.dir * dt;
      npc.walkPhase += dt * 6.0;
      if (npc.x >= npc.maxX) { npc.x = npc.maxX; npc.dir = -1; }
      else if (npc.x <= npc.minX) { npc.x = npc.minX; npc.dir = 1; }
    }

    if (this.isModalOpen) {
      this.updateFloatingPrompt(null, null);
      return;
    }

    const moveRes = this.player.update(dt);
    if (moveRes.stepTriggered) {
      this.particles.push({
        x: this.player.x + (this.player.facing === 'right' ? -4 : 4),
        y: this.player.y - 1,
        vx: (Math.random() - 0.5) * 8,
        vy: -4 - Math.random() * 6,
        life: 0,
        maxLife: 0.45,
        color: '#d8c4a8',
        size: 2,
        kind: 'dust'
      });
    }

    // Bidirectional seamless scene transitions
    if (cfg.index < 9 && this.player.x >= cfg.worldWidth - 22 && !this.player.locked) {
      this.audio.playPortal();
      this.sceneMgr.transitionToScene(cfg.index + 1, (nextCfg) => {
        this.applySceneConfig(nextCfg, 40);
      });
      return;
    }

    if (cfg.index > 0 && this.player.x <= 24 && !this.player.locked) {
      this.audio.playPortal();
      this.sceneMgr.transitionToScene(cfg.index - 1, (prevCfg) => {
        this.applySceneConfig(prevCfg, prevCfg.worldWidth - 50);
      });
      return;
    }

    const activeHotspot = this.interaction.update(this.player.x, this.player.y);
    const nearbyNpc = !activeHotspot ? this.findNearbyNPC() : null;
    this.updateFloatingPrompt(activeHotspot, nearbyNpc);

    if (this.player.consumeInteract() && !this.player.locked) {
      if (activeHotspot) {
        this.executeHotspotInteraction(activeHotspot, cfg);
      } else if (nearbyNpc) {
        this.audio.playInteract();
        this.talkingNpc = nearbyNpc;
        nearbyNpc.walkPhase = 0;
        nearbyNpc.pauseTimer = 1.0;
        if (Math.abs(this.player.x - nearbyNpc.x) > 1) {
          nearbyNpc.dir = this.player.x < nearbyNpc.x ? -1 : 1;
          this.player.facing = this.player.x < nearbyNpc.x ? 'right' : 'left';
          this.player.anim.play(this.player.facing === 'left' ? 'idle_l' : 'idle_r', true);
        }
        this.prepareModalOpen();
        this.journalUI.renderNPCDialogue(this.modalLayer, nearbyNpc, () => {}, () => this.closeModal());
      }
    }

    this.sceneMgr.updateCamera(this.player.x, 400, cfg.worldWidth, dt);
  }

  updateFloatingPrompt(hotspot, npc) {
    if (!this.promptElement) return;
    const isMenuVisible = this.menuLayer && this.menuLayer.innerHTML.trim() !== '';
    if ((hotspot || npc) && !this.player.sitting && !this.isModalOpen && !isMenuVisible) {
      const camX = this.sceneMgr.cameraX;
      const targetX = hotspot ? hotspot.x : npc.x;
      const targetY = hotspot ? hotspot.y - 46 : this.sceneMgr.getCurrentScene().groundY - 40;
      const screenX = (targetX - camX) / 400 * 100;
      const screenY = targetY / 225 * 100;
      this.promptElement.textContent = hotspot ? hotspot.promptText : `[E] 與「${npc.name}」交談`;
      this.promptElement.style.display = 'block';
      this.promptElement.style.left = `${Math.max(12, Math.min(88, screenX))}%`;
      this.promptElement.style.top = `${Math.max(8, Math.min(90, screenY))}%`;
    } else {
      this.promptElement.style.display = 'none';
    }
  }

  executeHotspotInteraction(h, cfg) {
    if (h.type === 'portal' && h.targetSceneIndex !== undefined) {
      this.audio.playPortal();
      this.sceneMgr.transitionToScene(h.targetSceneIndex, (nextCfg, spX) => {
        this.applySceneConfig(nextCfg, spX);
      });
      return;
    }

    // Second-layer Interactive Experience for Inspect / Experience / Lantern / Stamp / Cat / SideQuest (#7)
    if (h.type === 'experience' || h.type === 'inspect') {
      this.audio.playInteract();
      this.prepareModalOpen();
      this.journalUI.renderInteractiveExperienceModal(
        this.modalLayer,
        {
          expKey: h.expType || 'temple_pray',
          title: h.inspectTitle || '府城古蹟深度體驗',
          body: h.inspectBody || ''
        },
        () => {
          this.closeModal();
          this.player.playSpecialAnimation('happy_r', 700);
          this.showToast(`完成體驗：【${h.inspectTitle || '古蹟巡禮'}】`, h.inspectBody || '', 4.5);
        },
        () => this.closeModal()
      );
      return;
    }

    if (h.type === 'lantern') {
      this.audio.playInteract();
      this.prepareModalOpen();
      const item = COLLECTIBLES_DATA[0];
      this.journalUI.renderInteractiveExperienceModal(
        this.modalLayer,
        {
          expKey: 'lantern_light',
          title: '神農老街・點亮祈福紅燈籠體驗',
          body: item.historicalNote
        },
        () => {
          this.closeModal();
          for (let i = 0; i < 24; i++) {
            this.particles.push({
              x: 520 + (Math.random() - 0.5) * 80,
              y: 110 + (Math.random() - 0.5) * 20,
              vx: (Math.random() - 0.5) * 24,
              vy: -12 - Math.random() * 20,
              life: 0,
              maxLife: 1.3,
              color: i % 2 === 0 ? '#FFE88F' : '#FF9C52',
              size: 2,
              kind: 'spark'
            });
          }
          this.collectibles.unlock('shennong_lantern');
          this.updateHudProgress();
          this.player.playSpecialAnimation('happy_r', 750);
          this.showToast(`收錄古蹟印章：【${item.name}】`, item.summary, 5.0);
        },
        () => this.closeModal()
      );
      return;
    }

    if (h.type === 'cat_quest') {
      this.audio.playInteract();
      this.prepareModalOpen();
      this.journalUI.renderInteractiveExperienceModal(
        this.modalLayer,
        {
          expKey: 'cat_pet',
          title: '神農街木屋簷下・與午睡橘貓「小府」互動',
          body: '神農街老屋花盆與木凳間常有街貓午後酣睡。輕輕撓撓小府的下巴並餵食小魚乾，感受老街最溫柔的療癒片刻。'
        },
        () => {
          this.closeModal();
          this.collectibles.completeSideQuest('quest_shennong_cat');
          this.updateHudProgress();
          this.player.playSpecialAnimation('happy_r', 800);
          this.showToast('完成支線任務：【巷弄尋貓記】', '獲得【巷弄橘貓幸運御守】與外觀配件【貓耳髮箍】！', 5.2);
        },
        () => this.closeModal()
      );
      return;
    }

    if (h.type === 'stamp') {
      this.audio.playInteract();
      this.prepareModalOpen();
      const collItem = COLLECTIBLES_DATA.find(c => c.id === h.collectibleId) || COLLECTIBLES_DATA[4];
      this.journalUI.renderInteractiveExperienceModal(
        this.modalLayer,
        {
          expKey: 'stamp_rub',
          spriteIndex: collItem.spriteIndex,
          title: h.inspectTitle || `古蹟紀念章拓印：${collItem.name}`,
          body: h.inspectBody || collItem.historicalNote
        },
        () => {
          this.closeModal();
          this.collectibles.unlock(collItem.id);
          this.updateHudProgress();
          this.player.playSpecialAnimation('happy_r', 750);
          this.showToast(`收錄古蹟印章：【${collItem.name}】`, collItem.summary, 5.0);
        },
        () => this.closeModal()
      );
      return;
    }

    if (h.type === 'side_quest' && h.sideQuestId) {
      this.audio.playInteract();
      this.prepareModalOpen();
      const questObj = SIDE_QUESTS_DATA.find(q => q.id === h.sideQuestId);
      this.journalUI.renderInteractiveExperienceModal(
        this.modalLayer,
        {
          expKey: h.expType || 'stamp_rub',
          title: h.inspectTitle || (questObj ? questObj.title : '府城文化支線體驗'),
          body: h.inspectBody || (questObj ? questObj.summary : '')
        },
        () => {
          this.closeModal();
          this.collectibles.completeSideQuest(h.sideQuestId);
          if (h.sideQuestId === 'quest_haian_scooter') {
            this.collectibles.unlock('haian_blueprint_postcard');
          }
          this.updateHudProgress();
          this.player.playSpecialAnimation('happy_r', 800);
          this.showToast(`完成支線任務：【${questObj ? questObj.title : '古蹟考察'}】`, questObj ? questObj.rewardName : '', 5.2);
        },
        () => this.closeModal()
      );
      return;
    }

    if (h.type === 'quiz') {
      this.audio.playInteract();
      this.prepareModalOpen();
      this.journalUI.renderQuizModal(
        this.modalLayer,
        (score) => {
          this.closeModal();
          if (score >= 2) {
            this.collectibles.completeSideQuest('quest_chihkan_quiz');
            this.updateHudProgress();
            this.player.playSpecialAnimation('happy_r', 800);
            this.showToast('通過府城古蹟歷史問答！', '獲得紀念收藏品【祀典武廟大丈夫文衡令】！', 5.5);
          } else {
            this.showToast('歷史問答挑戰完畢', '謝謝參與，漫步府城處處皆歷史，隨時可再次挑戰！', 4.2);
          }
        },
        () => this.closeModal()
      );
      return;
    }

    // Interactive Camera Viewfinder & Polaroid Modal (#10)
    if (h.type === 'photo_spot') {
      const pspot = cfg.photoSpots[0] || {
        id: `photo_${cfg.index}`,
        name: cfg.name,
        x: h.x,
        scenicTitle: `${cfg.name}・定格風景`,
        description: cfg.subtitle
      };
      this.audio.playInteract();
      this.prepareModalOpen();
      this.journalUI.renderPhotoViewfinderModal(
        this.modalLayer,
        pspot,
        cfg,
        this.assets.scenesSky[cfg.index],
        this.assets.scenesWorld[cfg.index],
        () => {
          this.closeModal();
          const record = {
            id: pspot.id,
            scenicTitle: pspot.scenicTitle,
            description: pspot.description,
            sceneCode: cfg.code,
            timeStr: cfg.timeOfDay
          };
          this.collectibles.addPhoto(record);
          this.updateHudProgress();
          this.player.playSpecialAnimation('happy_r', 750);
          this.showToast(`拍照收錄成功：【${pspot.scenicTitle}】`, '相片已珍藏入您的【旅行紀念冊・風景相簿】！', 5.0);
        },
        () => this.closeModal()
      );
      return;
    }

    // Single Food Interactive Cooking & Tasting Modal (#12 & #7)
    if (h.type === 'food' && h.foodId) {
      const food = TAINAN_FOOD_CHOICES.find(f => f.id === h.foodId);
      if (food) {
        this.audio.playInteract();
        this.isModalOpen = true;
        this.player.locked = true;
        this.journalUI.renderSingleFoodModal(
          this.modalLayer,
          food,
          () => {
            this.closeModal();
            this.audio.playCollect();
            this.tastingFoodSpriteIndex = food.spriteIndex;
            this.tastingTimer = 2.6;
            this.player.playSpecialAnimation(this.player.facing === 'left' ? 'interact_l' : 'interact_r', 650, () => {
              this.collectibles.recordFoodTasted(food.id);
              this.updateHudProgress();
              this.player.playSpecialAnimation('happy_r', 850);
              this.showToast(`品嚐【${food.name}】`, food.description, 5.2);
            });
          },
          () => this.closeModal()
        );
      }
      return;
    }

    if (h.type === 'food_challenge') {
      this.audio.playInteract();
      this.prepareModalOpen();
      this.journalUI.renderFoodChallengeModal(
        this.modalLayer,
        (selectedFood, isCorrect) => {
          this.closeModal();
          this.audio.playCollect();
          this.tastingFoodSpriteIndex = selectedFood.spriteIndex;
          this.tastingTimer = 2.6;
          this.player.playSpecialAnimation(this.player.facing === 'left' ? 'interact_l' : 'interact_r', 650, () => {
            this.collectibles.recordFoodTasted(selectedFood.id);
            if (isCorrect) {
              this.collectibles.completeSideQuest('quest_guohua_challenge');
              this.updateHudProgress();
              this.player.playSpecialAnimation('happy_r', 850);
              this.showToast(`挑戰成功：【${selectedFood.name}】`, '答對了！榮獲【國華街府城金獎美食卡】！', 5.5);
            } else {
              this.showToast(`品嚐【${selectedFood.name}】`, '雖然不是阿桃姨指定的題目，但也嚐到了道地的府城美味！', 4.5);
            }
          });
        },
        () => this.closeModal()
      );
      return;
    }

    if (h.type === 'blessing') {
      this.audio.playInteract();
      this.prepareModalOpen();
      this.journalUI.renderBlessingModal(
        this.modalLayer,
        (blessing) => {
          this.closeModal();
          this.audio.playCollect();
          this.player.playSpecialAnimation(this.player.facing === 'left' ? 'interact_l' : 'interact_r', 550, () => {
            this.collectibles.recordBlessing(blessing.title, blessing.text);
            this.updateHudProgress();
            this.player.playSpecialAnimation('happy_r', 800);
            this.showToast(`收錄【孔廟祈福卡】：${blessing.title}`, `「${blessing.text}」`, 5.2);
          });
        },
        () => this.closeModal()
      );
      return;
    }

    if (h.type === 'sunset_sit') {
      this.audio.playCollect();
      this.collectibles.unlock('anping_sunset_photo');
      this.collectibles.unlock('grand_finale_journal');
      this.updateHudProgress();

      this.player.x = 722;
      this.player.y = 146;
      this.player.enterSitState(146);
      this.sceneMgr.targetZoom = 0.88;

      this.showToast(
        '安平運河水岸・夕陽入暮',
        '有些城市，不需要走得很快。台南，等你再來。',
        4.0
      );
      window.setTimeout(() => {
        if (this.isModalOpen) this.closeModal();
        this.endingScene.show(this.assets.collectibles);
      }, 2200);
    }
  }

  spawnSceneParticles(cfg, dt) {
    if (cfg.index === 5 || cfg.index === 6 || cfg.index === 8) {
      if (Math.random() < dt * 3.5) {
        this.particles.push({
          x: Math.random() * cfg.worldWidth,
          y: 35 + Math.random() * 55,
          vx: 8 + Math.random() * 12,
          vy: 10 + Math.random() * 10,
          life: 0,
          maxLife: 3.5,
          color: cfg.index === 6 ? '#E85244' : '#68AA58',
          size: 2,
          kind: 'leaf'
        });
      }
    }

    if (cfg.index === 4) {
      if (Math.random() < dt * 8.0) {
        this.particles.push({
          x: 132 + (Math.random() - 0.5) * 14,
          y: cfg.groundY - 26,
          vx: (Math.random() - 0.5) * 4,
          vy: -14 - Math.random() * 8,
          life: 0,
          maxLife: 1.3,
          color: '#F4ECE2',
          size: 2,
          kind: 'steam'
        });
      }
    }

    if (cfg.index === 6) {
      if (Math.random() < dt * 3.0) {
        this.particles.push({
          x: 393 + (Math.random() - 0.5) * 8,
          y: cfg.groundY - 22,
          vx: (Math.random() - 0.5) * 4,
          vy: -10 - Math.random() * 6,
          life: 0,
          maxLife: 1.2,
          color: '#F2C66D',
          size: 2,
          kind: 'steam'
        });
      }
    }
  }

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'leaf') {
        p.x += Math.sin(this.elapsedTime * 3.5 + i) * 8 * dt;
      }
    }
  }

  render() {
    const ctx = this.ctx;
    const cfg = this.sceneMgr.getCurrentScene();
    const camX = Math.round(this.sceneMgr.cameraX);
    const zoom = this.sceneMgr.cameraZoom;

    this.updateWorldSignboards(cfg, camX);

    ctx.save();
    ctx.clearRect(0, 0, 400, 225);

    if (Math.abs(zoom - 1.0) > 0.005) {
      const centerX = 200;
      const centerY = 112;
      ctx.translate(centerX, centerY);
      ctx.scale(zoom, zoom);
      ctx.translate(-centerX, -centerY);
    }

    const skyImg = this.assets.scenesSky[cfg.index];
    const skyScrollX = Math.round(camX * 0.28);
    ctx.drawImage(skyImg, -skyScrollX, 0);

    for (const c of this.clouds) {
      const cx = Math.round(c.x - camX * 0.4);
      const cy = Math.round(c.y);
      ctx.fillStyle = cfg.index >= 7 ? 'rgba(255, 218, 172, 0.55)' : 'rgba(255, 250, 236, 0.72)';
      ctx.fillRect(cx, cy, c.w, c.h);
      ctx.fillRect(cx + 6, cy - 4, c.w - 12, 4);
    }

    for (const b of this.birds) {
      const bx = Math.round(b.x - camX * 0.55);
      const by = Math.round(b.y + Math.sin(b.phase * 0.5) * 2);
      const wingUp = Math.sin(b.phase) > 0;
      ctx.fillStyle = '#2A1E24';
      ctx.fillRect(bx, by, 3, 1);
      ctx.fillRect(bx - 2, wingUp ? by - 1 : by + 1, 2, 1);
      ctx.fillRect(bx + 3, wingUp ? by - 1 : by + 1, 2, 1);
    }

    const worldImg = this.assets.scenesWorld[cfg.index];
    ctx.drawImage(worldImg, -camX, 0);

    this.renderSceneDynamicDetails(ctx, cfg, camX);
    this.renderInWorldInteractiveObjects(ctx, cfg, camX);
    this.renderNPCs(ctx, cfg, camX);

    const src = this.anim.getSourceRect();
    const px = Math.round(this.player.x - camX - 16);
    const py = Math.round(this.player.y - 30);
    const spriteSheet = this.player.customSpriteCanvas || this.assets.player;
    ctx.drawImage(spriteSheet, src.sx, src.sy, src.sw, src.sh, px, py, 32, 32);

    if (this.tastingFoodSpriteIndex !== null) {
      const bowlX = Math.round(this.player.x - camX - 12);
      const bowlY = Math.round(this.player.y - 48 + Math.sin(this.elapsedTime * 6) * 2);
      ctx.drawImage(this.assets.foods, this.tastingFoodSpriteIndex * 48, 0, 48, 48, bowlX, bowlY, 24, 24);
    }

    for (const p of this.particles) {
      const alpha = 1.0 - p.life / p.maxLife;
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x - camX), Math.round(p.y), p.size, p.size);
      ctx.restore();
    }

    this.renderInteractiveIcons(ctx, cfg, camX);

    ctx.restore();

    if (this.sceneMgr.transitionAlpha > 0) {
      ctx.fillStyle = `rgba(22, 16, 20, ${this.sceneMgr.transitionAlpha.toFixed(2)})`;
      ctx.fillRect(0, 0, 400, 225);
    }
  }

  renderInWorldInteractiveObjects(ctx, cfg, camX) {
    if (!this.assets.interactiveObjects) return;
    for (const h of cfg.hotspots) {
      if (h.objectSpriteIndex !== undefined && h.objectSpriteIndex >= 0) {
        const ox = Math.round(h.x - camX - 16);
        const baseGroundY = (cfg.index === 9 && h.objectSpriteIndex === 19) ? 146 + 24 : cfg.groundY;
        const oy = Math.round(baseGroundY - 32);
        ctx.drawImage(
          this.assets.interactiveObjects,
          h.objectSpriteIndex * 32, 0, 32, 32,
          ox, oy, 32, 32
        );
      }
    }
  }

  renderSceneDynamicDetails(ctx, cfg, camX) {
    const isLanternLit = this.collectibles.isCollected('shennong_lantern');

    if (cfg.index === 0) {
      const lanternXs = [60, 120, 200, 285, 495, 560, 625, 700, 760, 830];
      for (let i = 0; i < lanternXs.length; i++) {
        const lx = lanternXs[i] - camX;
        const beamY = 102;
        const sway = Math.round(Math.sin(this.elapsedTime * 2.4 + i * 0.8) * 1.5);
        const ly = 114;

        ctx.fillStyle = '#2A1E1B';
        ctx.fillRect(lx, beamY, 1, ly - beamY);
        ctx.fillStyle = '#D89C52';
        ctx.fillRect(lx - 2 + sway, ly - 2, 5, 2);
        ctx.fillStyle = '#22171A';
        ctx.fillRect(lx - 4 + sway, ly, 9, 10);
        ctx.fillStyle = isLanternLit ? '#FF4D3B' : '#B8382C';
        ctx.fillRect(lx - 3 + sway, ly + 1, 7, 8);
        if (isLanternLit) {
          ctx.fillStyle = '#FFE680';
          ctx.fillRect(lx - 1 + sway, ly + 2, 3, 6);
          ctx.save();
          ctx.fillStyle = 'rgba(255, 210, 96, 0.22)';
          ctx.fillRect(lx - 10 + sway, ly - 5, 21, 20);
          ctx.restore();
        }
        ctx.fillStyle = '#F2C654';
        ctx.fillRect(lx + sway, ly + 10, 1, 4);
      }
    }

    if (cfg.index === 9) {
      const waterTop = 168;
      for (let wy = waterTop; wy < 225; wy += 2) {
        const depthRatio = (wy - waterTop) / 57.0;
        const waveShift = Math.round(Math.sin(this.elapsedTime * 3.2 + wy * 0.45) * (2.5 + depthRatio * 3.0));
        const sunScreenX = Math.round(520 - camX * 0.28) + waveShift;
        const sunW = Math.max(8, Math.round(48 * (1.0 - depthRatio * 0.45)));
        ctx.fillStyle = wy % 4 === 0 ? 'rgba(255, 224, 132, 0.78)' : 'rgba(244, 152, 82, 0.58)';
        ctx.fillRect(sunScreenX - sunW / 2, wy, sunW, 1);
      }

      const boats = [
        { baseX: 220, y: 180 },
        { baseX: 460, y: 194 }
      ];
      for (let i = 0; i < boats.length; i++) {
        const b = boats[i];
        const drift = Math.sin(this.elapsedTime * 0.4 + i * 2) * 24;
        const bob = Math.round(Math.sin(this.elapsedTime * 2.8 + i) * 1.2);
        const bx = Math.round(b.baseX + drift - camX);
        const by = b.y + bob;
        ctx.fillStyle = 'rgba(255, 230, 158, 0.65)';
        ctx.fillRect(bx - 2, by + 6, 30, 1);
        ctx.fillStyle = '#22171A';
        ctx.fillRect(bx, by + 1, 26, 5);
        ctx.fillStyle = '#7C4830';
        ctx.fillRect(bx + 2, by + 2, 22, 3);
        ctx.fillStyle = '#C89658';
        ctx.fillRect(bx + 7, by - 3, 12, 4);
        ctx.fillStyle = '#FFE28A';
        ctx.fillRect(bx + 11, by - 2, 4, 2);
      }
    }
  }

  // ========================================================
  // 8 DIVERSE TAIWANESE LOCAL NPCS WITH PROPORTIONAL HEIGHTS & SAME ART STYLE (#6)
  // ========================================================
  renderNPCs(ctx, cfg, camX) {
    const OUT = '#22181C';
    const r = (x, y, w, h, c) => {
      ctx.fillStyle = c;
      ctx.fillRect(Math.round(x), Math.round(y), w, h);
    };

    for (const npc of this.npcs) {
      const nx = Math.round(npc.x - camX);
      if (nx < -24 || nx > 424) continue;
      const ny = cfg.groundY;
      const isLeft = (npc.dir < 0);
      const bob = Math.round(Math.abs(Math.sin(npc.walkPhase)) * 1);
      const legSwing = Math.round(Math.sin(npc.walkPhase) * 2);

      // Ground shadow
      r(nx - 6, ny - 1, 12, 1, 'rgba(20, 14, 18, 0.45)');

      // Determine age-based proportional dimensions & palette
      let headH = 9, bodyH = 8, legH = 7;
      let skin = '#FCD6B6', skinShade = '#E4B28E';
      let hairDark = '#2A2230', hairMid = '#483C52';
      let topCol = '#F6EEDC', topShade = '#D6C8B0';
      let botCol = '#344258', shoeCol = '#6C4834';

      if (npc.type === 'child') {
        // Authentic Kid Height: 19px tall!
        headH = 8; bodyH = 5; legH = 4;
        skin = '#FDE4CE'; skinShade = '#E8C2A4';
        topCol = '#5898D4'; topShade = '#3C74A8';
        botCol = '#263448'; shoeCol = '#E4E6EE';
      } else if (npc.type === 'grandma') {
        // Petite Taiwanese Grandma: 22px tall!
        headH = 8; bodyH = 6; legH = 5;
        skin = '#ECC29C'; skinShade = '#D29C74';
        hairDark = '#787276'; hairMid = '#9E969A';
        topCol = '#C84E6E'; topShade = '#98324E';
        botCol = '#2A2830'; shoeCol = '#483834';
      } else if (npc.type === 'grandpa') {
        // Slightly stooped Taiwanese Grandpa: 23px tall!
        headH = 8; bodyH = 7; legH = 5;
        skin = '#ECC29C'; skinShade = '#D29C74';
        hairDark = '#B8B4B0'; hairMid = '#DCD8D4';
        topCol = '#F4F0E8'; topShade = '#D4CCC0';
        botCol = '#384658'; shoeCol = '#785238';
      } else if (npc.type === 'college_girl' || npc.type === 'adult_woman' || npc.type === 'vendor_woman') {
        // Adult Female: 25px tall (matching protagonist scale!)
        headH = 9; bodyH = 7; legH = 6;
        if (npc.type === 'vendor_woman') {
          topCol = '#BA4438'; topShade = '#8E2E24';
          botCol = '#343844'; hairDark = '#382622';
        } else if (npc.type === 'adult_woman') {
          topCol = '#E8B648'; topShade = '#B88C2E';
          botCol = '#4A5844'; hairDark = '#482E22'; hairMid = '#6E4836';
        } else {
          topCol = '#F6EEDC'; topShade = '#D6C8B0';
          botCol = '#4A688E';
        }
      } else {
        // Adult Man / Uncle: 26px tall (matching protagonist scale!)
        headH = 9; bodyH = 8; legH = 6;
        skin = '#ECC29C'; skinShade = '#D29C74';
        if (npc.type === 'uncle') {
          topCol = '#5A8866'; topShade = '#3C6046';
          botCol = '#9E8462';
        } else {
          topCol = '#4E7CA8'; topShade = '#345678';
          botCol = '#2A2A30';
        }
      }

      const legsTop = ny - legH;
      const bodyTop = legsTop - bodyH + bob;
      const headTop = bodyTop - headH;

      // 1. Outlined Legs & Shoes
      r(nx - 4 + (isLeft ? -legSwing : legSwing), legsTop, 4, legH, OUT);
      r(nx - 3 + (isLeft ? -legSwing : legSwing), legsTop, 2, legH - 2, botCol);
      r(nx - 4 + (isLeft ? -legSwing : legSwing), ny - 2, 4, 2, shoeCol);

      r(nx + 1 - (isLeft ? -legSwing : legSwing), legsTop, 4, legH, OUT);
      r(nx + 2 - (isLeft ? -legSwing : legSwing), legsTop, 2, legH - 2, botCol);
      r(nx + 1 - (isLeft ? -legSwing : legSwing), ny - 2, 4, 2, shoeCol);

      // 2. Outlined Torso & Clothing Details
      r(nx - 6, bodyTop, 12, bodyH + 1, OUT);
      r(nx - 5, bodyTop + 1, 10, bodyH - 1, topCol);
      r(nx - 5, bodyTop + bodyH - 2, 10, 2, topShade);

      if (npc.type === 'grandma') {
        // Floral blouse pattern & market basket
        r(nx - 3, bodyTop + 2, 2, 2, '#FFE2E8');
        r(nx + 1, bodyTop + 3, 2, 2, '#FFE2E8');
        const bx = isLeft ? nx - 9 : nx + 5;
        r(bx, bodyTop + 2, 5, 6, OUT);
        r(bx + 1, bodyTop + 3, 3, 4, '#D89C52');
      } else if (npc.type === 'grandpa') {
        // Walking cane in hand!
        const cx = isLeft ? nx - 7 : nx + 6;
        r(cx, bodyTop + 3, 2, ny - (bodyTop + 3), '#6C4228');
        r(cx - 1, bodyTop + 3, 3, 2, '#482A18');
      } else if (npc.type === 'vendor_woman') {
        // White chef apron
        r(nx - 4, bodyTop + 2, 8, bodyH - 2, '#F8F4EE');
      } else if (npc.type === 'child') {
        // Red school backpack
        const bagX = isLeft ? nx + 4 : nx - 7;
        r(bagX, bodyTop + 1, 3, 4, '#C8382E');
      } else if (npc.type === 'college_girl') {
        // Canvas tote bag
        const bagX = isLeft ? nx + 4 : nx - 7;
        r(bagX, bodyTop + 2, 3, 5, '#E8E4DA');
      }

      // 3. Outlined Head & Expressive Face (Same human art style as protagonist!)
      r(nx - 6, headTop + 1, 12, headH - 1, OUT);
      r(nx - 7, headTop + 2, 14, headH - 3, OUT);
      r(nx - 5, headTop + 2, 10, headH - 2, skin);
      r(nx - 5, headTop + headH - 1, 10, 1, skinShade);

      // 4. Hair & Headgear by Archetype
      if (npc.type === 'child') {
        // Bright yellow Taiwanese school cap
        r(nx - 6, headTop, 12, 3, '#F6D242');
        r(isLeft ? nx - 8 : nx + 2, headTop + 2, 6, 1, '#D8B028');
      } else if (npc.type === 'grandma') {
        // Curly silver-grey perm hair
        r(nx - 6, headTop - 1, 12, 4, hairDark);
        r(nx - 7, headTop + 1, 3, 4, hairDark);
        r(nx + 4, headTop + 1, 3, 4, hairDark);
        r(nx - 4, headTop, 8, 2, hairMid);
      } else if (npc.type === 'grandpa') {
        // Silver-grey hair & receding forehead
        r(nx - 6, headTop, 12, 2, hairDark);
        r(nx - 6, headTop + 1, 2, 4, hairMid);
        r(nx + 4, headTop + 1, 2, 4, hairMid);
      } else if (npc.type === 'college_girl') {
        // High ponytail
        r(nx - 6, headTop, 12, 3, hairDark);
        r(nx - 5, headTop + 2, 9, 2, hairDark);
        const px = isLeft ? nx + 5 : nx - 8;
        r(px, headTop + 1, 3, 6, hairDark);
      } else {
        // Classic parted hair
        r(nx - 6, headTop, 12, 3, hairDark);
        r(nx - 4, headTop, 8, 2, hairMid);
        r(nx - 6, headTop + 2, 2, 4, hairDark);
        r(nx + 4, headTop + 2, 2, 4, hairDark);
      }

      // 5. 2x2 Eyes with White Specular Highlight (Matches protagonist!)
      const eyeL = isLeft ? nx - 5 : nx - 3;
      const eyeR = isLeft ? nx : nx + 2;
      const eyeY = headTop + Math.max(3, headH - 4);
      r(eyeL, eyeY, 2, 2, OUT);
      r(eyeL, eyeY, 1, 1, '#FFFFFF');
      r(eyeR, eyeY, 2, 2, OUT);
      r(eyeR, eyeY, 1, 1, '#FFFFFF');

      if (npc.type === 'grandpa') {
        // Spectacles frame
        r(eyeL - 1, eyeY - 1, 8, 1, '#8C7854');
      }
    }
  }

  renderInteractiveIcons(ctx, cfg, camX) {
    for (const h of cfg.hotspots) {
      if (h.type === 'portal') continue;
      const hx = Math.round(h.x - camX);
      const baseGroundY = (cfg.index === 9 && h.id === 'sit_anping_sunset_finale') ? 146 : cfg.groundY;
      const hy = Math.round(baseGroundY - 36 + Math.sin(this.elapsedTime * 4.0 + h.x) * 2);
      const isCollected = h.collectibleId ? this.collectibles.isCollected(h.collectibleId) : false;

      ctx.fillStyle = isCollected ? '#88E070' : '#FFE272';
      ctx.fillRect(hx - 2, hy - 3, 5, 2);
      ctx.fillRect(hx - 1, hy - 1, 3, 2);
      ctx.fillRect(hx, hy + 1, 1, 2);
    }
  }
}
