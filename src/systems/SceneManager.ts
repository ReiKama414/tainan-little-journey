import { SCENES_DATA } from '../data/scenesData';

export class SceneManager {
  currentIndex = 0;
  cameraX = 0;
  cameraZoom = 1.0;
  targetZoom = 1.0;
  transitionAlpha = 0;
  isTransitioning = false;

  getCurrentScene() { return SCENES_DATA[this.currentIndex]; }
  getCurrentIndex() { return this.currentIndex; }

  loadScene(index, spawnX) {
    this.currentIndex = Math.max(0, Math.min(SCENES_DATA.length - 1, index));
    const cfg = SCENES_DATA[this.currentIndex];
    const startX = spawnX !== undefined ? spawnX : cfg.spawnX;
    this.cameraX = Math.max(0, Math.min(cfg.worldWidth - 400, startX - 200));
    this.cameraZoom = 1.0;
    this.targetZoom = 1.0;
    return cfg;
  }

  transitionToScene(targetIndex, onMidpoint, customSpawnX) {
    if (this.isTransitioning) return;
    this.isTransitioning = true;
    const goingBack = targetIndex < this.currentIndex;
    let phase = 'fade_out';

    const step = () => {
      if (phase === 'fade_out') {
        this.transitionAlpha = Math.min(1, this.transitionAlpha + 0.08);
        if (this.transitionAlpha >= 1) {
          const nextCfg = SCENES_DATA[targetIndex];
          const spX = customSpawnX !== undefined ? customSpawnX : (goingBack ? nextCfg.worldWidth - 50 : nextCfg.spawnX);
          this.loadScene(targetIndex, spX);
          onMidpoint(nextCfg, spX);
          phase = 'fade_in';
        }
        requestAnimationFrame(step);
      } else {
        this.transitionAlpha = Math.max(0, this.transitionAlpha - 0.08);
        if (this.transitionAlpha > 0) {
          requestAnimationFrame(step);
        } else {
          this.isTransitioning = false;
        }
      }
    };
    requestAnimationFrame(step);
  }

  updateCamera(playerX, viewportWidth, worldWidth, dt) {
    const desiredX = Math.max(0, Math.min(worldWidth - viewportWidth, playerX - viewportWidth * 0.5));
    const lerpFactor = Math.min(1, dt * 6.5);
    this.cameraX += (desiredX - this.cameraX) * lerpFactor;
    this.cameraZoom += (this.targetZoom - this.cameraZoom) * Math.min(1, dt * 1.8);
  }
}
