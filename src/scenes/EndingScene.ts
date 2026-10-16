export class EndingScene {
  container;
  collectibles;
  journalUI;
  audio;
  onReplay;
  onFreeRoam;
  onOpenJournal;

  constructor(container, collectibles, journalUI, audio, onReplay, onFreeRoam, onOpenJournal) {
    this.container = container;
    this.collectibles = collectibles;
    this.journalUI = journalUI;
    this.audio = audio;
    this.onReplay = onReplay;
    this.onFreeRoam = onFreeRoam;
    this.onOpenJournal = onOpenJournal;
  }

  show(collectiblesImg) {
    const collItems = this.collectibles.getAllCollectiblesWithState();
    const collectedCount = this.collectibles.getCollectedCount();
    const foodCount = this.collectibles.getTastedFoodCount();
    const questCount = this.collectibles.getCompletedSideQuestCount();
    const photoCount = this.collectibles.getCapturedPhotosCount();
    const playSeconds = this.collectibles.getPlayTimeSeconds();
    const playMins = Math.floor(playSeconds / 60);
    const playSecs = playSeconds % 60;
    const timeStr = `${playMins} 分 ${playSecs} 秒`;
    const percent = this.collectibles.getExplorationPercentage();

    let currentPhase = 1;

    const renderPhase = () => {
      if (currentPhase === 1) {
        this.container.innerHTML = `
          <div class="ending-cinematic-overlay">
            <button type="button" class="pixel-btn small skip-ending-btn" style="position:absolute;top:12px;right:12px;">
              [ 跳過過場 ESC ]
            </button>
            <div class="ending-poem-block animate-fade-in" style="max-width:520px;">
              <div class="pixel-kicker" style="margin-bottom:8px;">ANPING SUNSET FINALE</div>
              <p class="poem-line-1">「有些城市，不需要走得很快。」</p>
              <p class="poem-line-2" style="margin-top:8px;">「一條巷子，一碗熱湯，一個午後。」</p>
              <p class="poem-line-2" style="margin-top:8px;">「這些小小的風景，都是台南。」</p>
              <p class="poem-line-1" style="margin-top:14px;color:#ffe28a;">「下次，再一起走走吧。」</p>
              <button type="button" class="pixel-btn primary large" id="btn-next-ending-phase" style="margin-top:18px;">
                [ 翻開旅途回憶明信片 ]
              </button>
            </div>
          </div>
        `;
        const nextBtn = this.container.querySelector('#btn-next-ending-phase');
        if (nextBtn) {
          nextBtn.addEventListener('click', () => {
            this.audio.playCollect();
            currentPhase = 2;
            renderPhase();
          });
        }
        const skipBtn = this.container.querySelector('.skip-ending-btn');
        if (skipBtn) {
          skipBtn.addEventListener('click', () => {
            this.audio.playInteract();
            currentPhase = 2;
            renderPhase();
          });
        }
      } else {
        const souvenirsHtml = collItems.map(item => {
          const iconUrl = this.journalUI.createIconDataUrl(collectiblesImg, item.spriteIndex, 48);
          return `
            <div class="ending-souvenir-card ${item.unlocked ? 'collected' : 'missed'}">
              <img src="${iconUrl}" alt="${item.name}" class="${item.unlocked ? '' : 'silhouette'}" />
              <div class="ending-souvenir-meta">
                <span class="scene-mini-code">${item.sceneCode}</span>
                <h5>${item.name}</h5>
                <p>${item.unlocked ? item.summary : '（旅途中未發現的地標古物）'}</p>
              </div>
            </div>
          `;
        }).join('');

        this.container.innerHTML = `
          <div class="ending-cinematic-overlay">
            <div class="ending-showcase-box">
              <div class="ending-showcase-header">
                <div>
                  <div class="pixel-kicker">TAINAN JOURNEY COMPLETED</div>
                  <h3>台南散策旅程結算・總探索達成度 ${percent}%</h3>
                </div>
                <div class="ending-summary-badges">
                  <span class="memory-pill">散策時間：${timeStr}</span>
                  <span class="memory-pill">地標走訪：10 / 10 全通關</span>
                </div>
              </div>
              <div class="ending-stats-row">
                <div class="stat-badge-box">
                  <span class="stat-num">${collectedCount} / ${collItems.length}</span>
                  <span class="stat-lbl">府城古蹟紀念印章</span>
                </div>
                <div class="stat-badge-box">
                  <span class="stat-num">${foodCount} / 9</span>
                  <span class="stat-lbl">府城代表名產小吃</span>
                </div>
                <div class="stat-badge-box">
                  <span class="stat-num">${questCount} / 8</span>
                  <span class="stat-lbl">府城支線任務</span>
                </div>
                <div class="stat-badge-box">
                  <span class="stat-num">${photoCount} / 6</span>
                  <span class="stat-lbl">散策取景相片</span>
                </div>
              </div>
              <div class="ending-souvenirs-grid">
                ${souvenirsHtml}
              </div>
              <div class="ending-actions-row">
                <button type="button" class="pixel-btn large primary" id="btn-replay-journey">
                  [ 重新開始旅程 Replay ]
                </button>
                <button type="button" class="pixel-btn large" id="btn-free-explore-mode" style="border-color:#f2c66d;color:#ffe28a;">
                  [ 自由探索模式 Free Roam ]
                </button>
                <button type="button" class="pixel-btn large" id="btn-open-journal-end">
                  [ 翻閱完整旅行紀念冊 ]
                </button>
              </div>
            </div>
          </div>
        `;

        const replayBtn = this.container.querySelector('#btn-replay-journey');
        const freeBtn = this.container.querySelector('#btn-free-explore-mode');
        const journalBtn = this.container.querySelector('#btn-open-journal-end');

        if (replayBtn) replayBtn.addEventListener('click', () => { this.audio.playCollect(); this.container.innerHTML = ''; this.onReplay(); });
        if (freeBtn) freeBtn.addEventListener('click', () => { this.audio.playInteract(); this.container.innerHTML = ''; this.onFreeRoam(); });
        if (journalBtn) journalBtn.addEventListener('click', () => { this.audio.playInteract(); this.onOpenJournal(); });
      }
    };

    renderPhase();
  }
}
