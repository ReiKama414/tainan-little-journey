import { GAME_VERSION_LABEL } from '../version';

export class MainMenuScene {
  container;
  audio;
  collectibles;
  onStartNewGame;
  onContinueGame;
  onFreeRoam;
  onOpenCustomizer;

  constructor(container, audio, collectibles, onStartNewGame, onContinueGame, onFreeRoam, onOpenCustomizer) {
    this.container = container;
    this.audio = audio;
    this.collectibles = collectibles;
    this.onStartNewGame = onStartNewGame;
    this.onContinueGame = onContinueGame;
    this.onFreeRoam = onFreeRoam;
    this.onOpenCustomizer = onOpenCustomizer;
  }

  show() {
    const volPercent = Math.round(this.audio.getVolume() * 100);
    const muted = this.audio.getMuted();
    const saveState = this.collectibles.getData();
    const hasSave = saveState.collectedIds.length > 0 || saveState.completedSideQuests.length > 0;
    const canFreeRoam = saveState.gameCompleted;

    this.container.innerHTML = `
      <div class="menu-overlay" id="main-menu-overlay">
        <div class="menu-title-frame">
          <div class="menu-pixel-tag">2D PIXEL ART COZY ADVENTURE ・ ${GAME_VERSION_LABEL}</div>
          <h1 class="menu-main-title">TAINAN</h1>
          <h2 class="menu-sub-title">A LITTLE JOURNEY</h2>
          <p class="menu-ch-title">台南散策 — 一段短短的府城旅行</p>

          <div class="menu-btn-stack">
            ${
              hasSave
                ? `
              <button type="button" class="pixel-btn large primary" id="btn-continue-journey">
                [ 繼續散策 (${saveState.collectedIds.length}/12 紀念品) ]
              </button>
            `
                : ''
            }
            <button type="button" class="pixel-btn large ${hasSave ? '' : 'primary'}" id="btn-start-journey">
              [ ${hasSave ? '重新出發 New Journey' : '開始散策 Start Journey'} ]
            </button>
            ${
              canFreeRoam
                ? `
              <button type="button" class="pixel-btn large" id="btn-free-roam" style="border-color:#f6ce74;color:#ffe28a;">
                [ 自由探索模式 Free Roam (10景點) ]
              </button>
            `
                : ''
            }
            <button type="button" class="pixel-btn large" id="btn-open-customizer">
              [ 旅人外觀自由穿搭 ]
            </button>
            <button type="button" class="pixel-btn large" id="btn-open-controls">
              [ 操作說明 ]
            </button>
            <button type="button" class="pixel-btn large" id="btn-open-audio">
              [ 音效設定 ]
            </button>
          </div>

          <div class="menu-subpanel hidden" id="panel-controls">
            <h4>操作說明 (雙向漫步與深度互動體驗)</h4>
            <div class="controls-grid">
              <div><strong>左右漫步：</strong>A / D 或 ◀ / ▶（雙向自由往返十景）</div>
              <div><strong>疾走奔跑：</strong>按住 [Shift] 鍵或點擊觸控「疾走」按鈕</div>
              <div><strong>輕巧跳躍：</strong>按 [Space] 或 [W] 或 [▲]</div>
              <div><strong>低伏蹲下：</strong>按 [S] 或 [▼]</div>
              <div><strong>深度互動：</strong>靠近招牌與地標提示按 [E] 開啟第二層體驗與取景</div>
              <div><strong>旅行紀念冊：</strong>按 [J] 鍵開啟 4 大收集圖鑑</div>
              <div><strong>暫停設定：</strong>按 [ESC] 鍵開啟設定選單</div>
            </div>
          </div>

          <div class="menu-subpanel hidden" id="panel-audio">
            <h4>音效與十大地標氛圍音樂</h4>
            <div class="audio-control-row">
              <label for="menu-vol-slider">環境總音量：<span id="menu-vol-label">${volPercent}%</span></label>
              <input type="range" id="menu-vol-slider" min="0" max="100" value="${volPercent}" />
            </div>
            <div class="audio-control-row" style="margin-top:8px;">
              <button type="button" class="pixel-btn small" id="menu-mute-toggle">
                ${muted ? '狀態：已靜音（點擊開啟）' : '狀態：音樂開啟（點擊靜音）'}
              </button>
            </div>
          </div>

          <div class="menu-footer-note">
            神農街・海安路・武廟・赤崁樓・國華街・孔廟・府中街・安平古堡・樹屋・運河夕陽
          </div>
        </div>
      </div>
    `;

    const startBtn = this.container.querySelector('#btn-start-journey');
    const contBtn = this.container.querySelector('#btn-continue-journey');
    const freeBtn = this.container.querySelector('#btn-free-roam');
    const customBtn = this.container.querySelector('#btn-open-customizer');
    const ctrlBtn = this.container.querySelector('#btn-open-controls');
    const audioBtn = this.container.querySelector('#btn-open-audio');
    const panelCtrl = this.container.querySelector('#panel-controls');
    const panelAudio = this.container.querySelector('#panel-audio');
    const volSlider = this.container.querySelector('#menu-vol-slider');
    const volLabel = this.container.querySelector('#menu-vol-label');
    const muteBtn = this.container.querySelector('#menu-mute-toggle');

    const unlockAudio = () => {
      this.audio.init();
      this.audio.ensureSharedBgm();
    };

    if (startBtn) {
      startBtn.addEventListener('click', () => {
        unlockAudio();
        this.audio.playCollect();
        this.container.innerHTML = '';
        this.onStartNewGame();
      });
    }

    if (contBtn) {
      contBtn.addEventListener('click', () => {
        unlockAudio();
        this.audio.playCollect();
        this.container.innerHTML = '';
        this.onContinueGame();
      });
    }

    if (freeBtn) {
      freeBtn.addEventListener('click', () => {
        unlockAudio();
        this.audio.playCollect();
        this.container.innerHTML = '';
        this.onFreeRoam();
      });
    }

    if (customBtn) {
      customBtn.addEventListener('click', () => {
        unlockAudio();
        this.audio.playInteract();
        // Keep title menu DOM; ExplorationScene hides it under the modal.
        this.onOpenCustomizer();
      });
    }

    if (ctrlBtn && panelCtrl && panelAudio) {
      ctrlBtn.addEventListener('click', () => {
        unlockAudio();
        this.audio.playInteract();
        panelCtrl.classList.toggle('hidden');
        panelAudio.classList.add('hidden');
      });
    }

    if (audioBtn && panelAudio && panelCtrl) {
      audioBtn.addEventListener('click', () => {
        unlockAudio();
        this.audio.playInteract();
        panelAudio.classList.toggle('hidden');
        panelCtrl.classList.add('hidden');
      });
    }

    if (volSlider && volLabel) {
      volSlider.addEventListener('input', () => {
        this.audio.init();
        const v = parseInt(volSlider.value, 10);
        volLabel.textContent = `${v}%`;
        this.audio.setVolume(v / 100);
      });
    }

    if (muteBtn) {
      muteBtn.addEventListener('click', () => {
        this.audio.init();
        const nowMuted = this.audio.toggleMute();
        muteBtn.textContent = nowMuted ? '狀態：已靜音（點擊開啟）' : '狀態：音樂開啟（點擊靜音）';
      });
    }
  }
}
