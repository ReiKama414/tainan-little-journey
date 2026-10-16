import { SCENES_DATA } from './data/scenesData';
import { EndingScene } from './scenes/EndingScene';
import { ExplorationScene } from './scenes/ExplorationScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { AnimationManager } from './systems/AnimationManager';
import { AudioManager } from './systems/AudioManager';
import { CollectibleSystem } from './systems/CollectibleSystem';
import { CollisionSystem } from './systems/CollisionSystem';
import { InteractionSystem } from './systems/InteractionSystem';
import { PlayerController } from './systems/PlayerController';
import { SceneManager } from './systems/SceneManager';
import { JournalUI } from './ui/JournalUI';

async function bootstrapTainanGame() {
  const canvas = document.getElementById('game-canvas');
  const modalLayer = document.getElementById('modal-layer');
  const menuLayer = document.getElementById('menu-layer');
  const hudSubLabel = document.getElementById('hud-scene-label');
  const hudProgressLabel = document.getElementById('hud-journal-count');

  if (!canvas || !modalLayer || !menuLayer || !hudSubLabel || !hudProgressLabel) return;

  canvas.width = 400;
  canvas.height = 225;

  const audio = new AudioManager();
  const collectibles = new CollectibleSystem();
  const collision = new CollisionSystem();
  const anim = new AnimationManager();
  const player = new PlayerController(anim, collision, audio);
  const interaction = new InteractionSystem();
  const sceneMgr = new SceneManager();
  const journalUI = new JournalUI(collectibles, player, audio);

  const assetMap = window.__TAINAN_EMBEDDED_ASSETS__ || {};

  const loadAsset = (key) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = assetMap[key] || `./assets/${key}.png`;
  });

  const keys = [
    'player_spritesheet', 'collectibles_spritesheet', 'foods_spritesheet', 'interactive_objects',
    'scene1_sky', 'scene1_world', 'scene2_sky', 'scene2_world', 'scene3_sky', 'scene3_world',
    'scene4_sky', 'scene4_world', 'scene5_sky', 'scene5_world', 'scene6_sky', 'scene6_world',
    'scene7_sky', 'scene7_world', 'scene8_sky', 'scene8_world', 'scene9_sky', 'scene9_world',
    'scene10_sky', 'scene10_world'
  ];

  const loadedMap = {};
  for (const k of keys) {
    loadedMap[k] = await loadAsset(k);
  }

  const assets = {
    player: loadedMap['player_spritesheet'],
    collectibles: loadedMap['collectibles_spritesheet'],
    foods: loadedMap['foods_spritesheet'],
    interactiveObjects: loadedMap['interactive_objects'],
    scenesSky: [
      loadedMap['scene1_sky'], loadedMap['scene2_sky'], loadedMap['scene3_sky'],
      loadedMap['scene4_sky'], loadedMap['scene5_sky'], loadedMap['scene6_sky'],
      loadedMap['scene7_sky'], loadedMap['scene8_sky'], loadedMap['scene9_sky'],
      loadedMap['scene10_sky']
    ],
    scenesWorld: [
      loadedMap['scene1_world'], loadedMap['scene2_world'], loadedMap['scene3_world'],
      loadedMap['scene4_world'], loadedMap['scene5_world'], loadedMap['scene6_world'],
      loadedMap['scene7_world'], loadedMap['scene8_world'], loadedMap['scene9_world'],
      loadedMap['scene10_world']
    ]
  };

  journalUI.setSpritesheets(assets.collectibles, assets.foods);
  player.generateCustomSpritesheet();

  let exploration;

  const ending = new EndingScene(
    menuLayer, collectibles, journalUI, audio,
    () => { collectibles.reset(); exploration.startAtScene(0); },
    () => { player.sitting = false; player.locked = false; sceneMgr.targetZoom = 1.0; },
    () => { exploration.openJournal(); }
  );

  exploration = new ExplorationScene(
    canvas, assets, player, anim, collision, interaction, sceneMgr,
    collectibles, audio, journalUI, ending, modalLayer, menuLayer,
    hudSubLabel, hudProgressLabel
  );

  exploration.startAtScene(0);
  exploration.enterTitleMenu();

  const showMainMenu = () => {
    exploration.enterTitleMenu();
    const mainMenu = new MainMenuScene(
      menuLayer, audio, collectibles,
      () => {
        collectibles.reset();
        // Already on scene 0 behind the menu — don't respawn (avoids position snap).
        exploration.beginFromTitle(0, false);
      },
      () => {
        const lastScene = collectibles.getData().hasWatchedSunset ? 9 : 0;
        exploration.beginFromTitle(lastScene, true);
      },
      () => { exploration.beginFromTitle(0, false); },
      () => {
        exploration.openCharacterCreator(() => {
          // Confirmed outfit from title → start journey
          menuLayer.innerHTML = '';
          collectibles.reset();
          exploration.beginFromTitle(0, true);
        });
      }
    );
    mainMenu.show();
  };

  showMainMenu();

  const btnJournal = document.getElementById('btn-hud-journal');
  const btnCustomizer = document.getElementById('btn-hud-customizer');
  const btnMute = document.getElementById('btn-hud-mute');
  const btnPause = document.getElementById('btn-hud-pause');
  const btnScenePicker = document.getElementById('btn-scene-picker');
  const scenePickerMenu = document.getElementById('scene-picker-menu');

  if (btnJournal) btnJournal.addEventListener('click', () => exploration.openJournal());
  if (btnCustomizer) btnCustomizer.addEventListener('click', () => exploration.openCharacterCreator());
  if (btnMute) {
    btnMute.addEventListener('click', () => {
      audio.init();
      const m = audio.toggleMute();
      btnMute.textContent = m ? '音效：關' : '音效：開';
    });
  }
  if (btnPause) btnPause.addEventListener('click', () => exploration.togglePauseMenu());

  if (btnScenePicker && scenePickerMenu) {
    btnScenePicker.addEventListener('click', (e) => {
      e.stopPropagation();
      audio.playInteract();
      scenePickerMenu.classList.toggle('hidden');
    });

    document.addEventListener('click', () => {
      scenePickerMenu.classList.add('hidden');
    });

    scenePickerMenu.querySelectorAll('.custom-pixel-menu-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const targetIdx = parseInt(item.getAttribute('data-scene') || '0', 10);
        scenePickerMenu.classList.add('hidden');
        if (!isNaN(targetIdx) && targetIdx >= 0 && targetIdx < SCENES_DATA.length) {
          menuLayer.innerHTML = '';
          exploration.closeModal();
          audio.playPortal();
          sceneMgr.transitionToScene(targetIdx, (nextCfg, spX) => {
            exploration.applySceneConfig(nextCfg, spX);
          });
        }
      });
    });
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyJ') exploration.openJournal();
  });

  const btnLeft = document.getElementById('touch-left');
  const btnRight = document.getElementById('touch-right');
  const btnJump = document.getElementById('touch-jump');
  const btnCrouch = document.getElementById('touch-crouch');
  const btnRun = document.getElementById('touch-run');
  const btnAct = document.getElementById('touch-interact');

  const bindHold = (el, setter) => {
    if (!el) return;
    const start = (ev) => {
      ev.preventDefault();
      audio.init();
      setter(true);
      el.classList.add('active');
    };
    const end = (ev) => {
      ev.preventDefault();
      setter(false);
      el.classList.remove('active');
    };
    el.addEventListener('pointerdown', start);
    el.addEventListener('pointerup', end);
    el.addEventListener('pointerleave', end);
    el.addEventListener('pointercancel', end);
  };

  bindHold(btnLeft, (d) => { player.touchLeft = d; });
  bindHold(btnRight, (d) => { player.touchRight = d; });
  bindHold(btnCrouch, (d) => { player.touchCrouch = d; });
  bindHold(btnRun, (d) => { player.touchRun = d; });

  if (btnJump) {
    btnJump.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      audio.init();
      player.triggerTouchJump();
      btnJump.classList.add('active');
      setTimeout(() => btnJump.classList.remove('active'), 150);
    });
  }

  if (btnAct) {
    btnAct.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      audio.init();
      player.triggerTouchInteract();
      btnAct.classList.add('active');
      setTimeout(() => btnAct.classList.remove('active'), 150);
    });
  }

  let lastTime = performance.now();
  const loop = (now) => {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    exploration.update(dt);
    exploration.render();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

window.addEventListener('DOMContentLoaded', () => {
  bootstrapTainanGame();
});
