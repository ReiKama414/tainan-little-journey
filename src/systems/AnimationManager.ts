export class AnimationManager {
  clips = {
    idle_r:     { row: 0,  frames: 4, fps: 4.5, loop: true },
    idle_l:     { row: 1,  frames: 4, fps: 4.5, loop: true },
    walk_r:     { row: 2,  frames: 6, fps: 9.0, loop: true },
    walk_l:     { row: 3,  frames: 6, fps: 9.0, loop: true },
    run_r:      { row: 4,  frames: 6, fps: 13.0, loop: true },
    run_l:      { row: 5,  frames: 6, fps: 13.0, loop: true },
    jump_r:     { row: 6,  frames: 2, fps: 6.0, loop: false },
    jump_l:     { row: 7,  frames: 2, fps: 6.0, loop: false },
    fall_r:     { row: 8,  frames: 2, fps: 6.0, loop: true },
    fall_l:     { row: 9,  frames: 2, fps: 6.0, loop: true },
    crouch_r:   { row: 10, frames: 2, fps: 4.0, loop: true },
    crouch_l:   { row: 11, frames: 2, fps: 4.0, loop: true },
    interact_r: { row: 12, frames: 4, fps: 7.0, loop: false },
    interact_l: { row: 13, frames: 4, fps: 7.0, loop: false },
    happy_r:    { row: 14, frames: 4, fps: 6.5, loop: false },
    sit_r:      { row: 15, frames: 4, fps: 3.0, loop: true }
  };

  currentState = 'idle_r';
  frameTimer = 0;
  currentFrame = 0;
  onCompleteCallback = null;

  play(state, forceRestart = false, onComplete) {
    if (this.currentState !== state || forceRestart) {
      this.currentState = state;
      this.currentFrame = 0;
      this.frameTimer = 0;
      this.onCompleteCallback = onComplete || null;
    }
  }

  update(dt) {
    const clip = this.clips[this.currentState] || this.clips.idle_r;
    this.frameTimer += dt;
    const frameDur = 1.0 / clip.fps;
    if (this.frameTimer >= frameDur) {
      this.frameTimer -= frameDur;
      if (this.currentFrame + 1 < clip.frames) {
        this.currentFrame++;
      } else if (clip.loop) {
        this.currentFrame = 0;
      } else {
        if (this.onCompleteCallback) {
          const cb = this.onCompleteCallback;
          this.onCompleteCallback = null;
          cb();
        }
      }
    }
  }

  getSourceRect() {
    const clip = this.clips[this.currentState] || this.clips.idle_r;
    return { sx: this.currentFrame * 32, sy: clip.row * 32, sw: 32, sh: 32 };
  }
}
