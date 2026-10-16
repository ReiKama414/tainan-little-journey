import { CHARACTER_CUSTOM_OPTIONS } from '../data/scenesData';

export const DEFAULT_APPEARANCE = {
  faceStyleId: 'rosy',
  skinToneId: 'warm',
  hairStyleId: 'female_ponytail',
  hairColorId: 'dark_navy',
  shirtId: 'cream_tee',
  bottomId: 'navy_shorts',
  shoesId: 'brown_sneakers',
  backpackId: 'leather_sidebag',
  accessoryId: 'none'
};

export class PlayerController {
  x = 60;
  y = 186;
  vy = 0;
  facing = 'right';
  isGrounded = true;
  isRunning = false;
  isCrouching = false;
  locked = false;
  sitting = false;

  walkSpeed = 78;
  runSpeed = 128;
  jumpVelocity = -138;
  gravity = 540;

  coyoteTimer = 0;
  jumpBufferTimer = 0;
  stepTimer = 0;

  anim;
  collision;
  audio;

  keysDown = new Set();
  touchLeft = false;
  touchRight = false;
  touchRun = false;
  touchCrouch = false;
  jumpQueued = false;
  interactQueued = false;
  pauseQueued = false;

  appearance = { ...DEFAULT_APPEARANCE };
  customSpriteCanvas = null;

  constructor(anim, collision, audio) {
    this.anim = anim;
    this.collision = collision;
    this.audio = audio;
    this.loadAppearance();
    this.bindKeyboard();
  }

  loadAppearance() {
    try {
      const saved = localStorage.getItem('tainan_player_appearance_v23');
      if (saved) this.appearance = { ...DEFAULT_APPEARANCE, ...JSON.parse(saved) };
    } catch {}
  }

  saveAppearance(app) {
    this.appearance = { ...app };
    try {
      localStorage.setItem('tainan_player_appearance_v23', JSON.stringify(this.appearance));
    } catch {}
    this.generateCustomSpritesheet();
  }

  generateCustomSpritesheet() {
    const c = document.createElement('canvas');
    c.width = 32 * 6;
    c.height = 32 * 16;
    const ctx = c.getContext('2d');
    if (!ctx) return c;
    ctx.imageSmoothingEnabled = false;

    const faceStyle = this.appearance.faceStyleId || 'rosy';
    const skinOpt = CHARACTER_CUSTOM_OPTIONS.skinTones.find(s => s.id === this.appearance.skinToneId) || CHARACTER_CUSTOM_OPTIONS.skinTones[1];
    const hairCol = CHARACTER_CUSTOM_OPTIONS.hairColors.find(hc => hc.id === this.appearance.hairColorId) || CHARACTER_CUSTOM_OPTIONS.hairColors[0];
    const shirtOpt = CHARACTER_CUSTOM_OPTIONS.shirts.find(s => s.id === this.appearance.shirtId) || CHARACTER_CUSTOM_OPTIONS.shirts[0];
    const bottomOpt = CHARACTER_CUSTOM_OPTIONS.bottoms.find(b => b.id === this.appearance.bottomId) || CHARACTER_CUSTOM_OPTIONS.bottoms[0];
    const shoeOpt = CHARACTER_CUSTOM_OPTIONS.shoes.find(s => s.id === this.appearance.shoesId) || CHARACTER_CUSTOM_OPTIONS.shoes[0];
    const bagOpt = CHARACTER_CUSTOM_OPTIONS.backpacks.find(b => b.id === this.appearance.backpackId) || CHARACTER_CUSTOM_OPTIONS.backpacks[0];
    const accOpt = CHARACTER_CUSTOM_OPTIONS.accessories.find(a => a.id === this.appearance.accessoryId) || CHARACTER_CUSTOM_OPTIONS.accessories[0];

    const hairStyle = this.appearance.hairStyleId || 'female_ponytail';
    const OUTLINE = '#22181C';

    const drawPx = (xx, yy, col) => {
      ctx.fillStyle = col;
      ctx.fillRect(Math.round(xx), Math.round(yy), 1, 1);
    };

    const drawRect = (xx, yy, ww, hh, col) => {
      ctx.fillStyle = col;
      ctx.fillRect(Math.round(xx), Math.round(yy), ww, hh);
    };

    const rowSpecs = [
      ['idle', false, 4],
      ['idle', true,  4],
      ['walk', false, 6],
      ['walk', true,  6],
      ['run',  false, 6],
      ['run',  true,  6],
      ['jump', false, 2],
      ['jump', true,  2],
      ['fall', false, 2],
      ['fall', true,  2],
      ['crouch', false, 2],
      ['crouch', true,  2],
      ['interact', false, 4],
      ['interact', true,  4],
      ['happy', false, 4],
      ['sit', false, 4]
    ];

    for (let r = 0; r < rowSpecs.length; r++) {
      const [animName, isLeft, fcount] = rowSpecs[r];
      for (let col = 0; col < fcount; col++) {
        const ox = col * 32;
        const oy = r * 32;

        let bob = 0;
        let legLdx = 0, legLdy = 0;
        let legRdx = 0, legRdy = 0;
        let armLdx = 0, armLdy = 0;
        let armRdx = 0, armRdy = 0;
        let blink = false;

        const isCrouch = animName === 'crouch';
        const isJump = animName === 'jump';
        const isSit = animName === 'sit';

        if (animName === 'idle') {
          bob = (col === 1 || col === 2) ? 1 : 0;
          blink = (col === 3);
        } else if (animName === 'walk') {
          const wcycle = [
            [0, -2, 0,  2, -1,  1, -1],
            [1, -1, -1, 1,  0,  1,  0],
            [0,  0,  0, 0,  0,  0,  0],
            [0,  2, -1, -2, 0, -1,  1],
            [1,  1,  0, -1, -1,-1,  0],
            [0,  0,  0, 0,  0,  0,  0]
          ][col % 6];
          [bob, legLdx, legLdy, legRdx, legRdy, armLdx, armRdx] = wcycle;
        } else if (animName === 'run') {
          const rcycle = [
            [1, -3, 0,  3, -2,  2, -2],
            [0, -2, -1, 2,  0,  2,  0],
            [1,  0, -1, 0,  0,  0,  0],
            [1,  3, -2, -3, 0, -2,  2],
            [0,  2,  0, -2, -1,-2,  0],
            [1,  0, -1, 0,  0,  0,  0]
          ][col % 6];
          [bob, legLdx, legLdy, legRdx, legRdy, armLdx, armRdx] = rcycle;
        } else if (animName === 'jump') {
          bob = -3;
          legLdy = -2; legRdy = -1;
          armLdy = -2; armRdy = -2;
        } else if (animName === 'fall') {
          bob = -1;
          legLdy = 0; legRdy = 1;
          armLdy = -3; armRdy = -3;
        } else if (animName === 'crouch') {
          bob = 6;
        } else if (animName === 'interact') {
          bob = col % 2 === 0 ? 0 : -1;
          armRdx = 2 + (col % 2);
          armRdy = -2 - (col % 2);
        } else if (animName === 'happy') {
          bob = (col === 1 || col === 3) ? -2 : 0;
          armLdy = (col === 1 || col === 3) ? -3 : -1;
          armRdy = (col === 1 || col === 3) ? -3 : -1;
        } else if (animName === 'sit') {
          bob = 4;
        }

        const headY = oy + 4 + bob;
        const bodyY = oy + 15 + bob;
        const legsY = oy + 23;

        // Ground shadow
        if (!isJump && !isSit) {
          drawRect(ox + 10, oy + 30, 12, 1, 'rgba(20, 14, 18, 0.45)');
        }

        // Legs & Bottom Garment (Shorts vs Long Pants vs Pleated Skirt!)
        const isLongPants = (bottomOpt.style === 'long');
        const isSkirt = (bottomOpt.style === 'skirt');

        if (isSit) {
          drawRect(ox + 10, oy + 23, 12, 4, OUTLINE);
          drawRect(ox + 11, oy + 24, 10, 3, bottomOpt.color);
          drawRect(ox + 17, oy + 25, 4, 3, isLongPants ? bottomOpt.color : skinOpt.color);
          drawRect(ox + 17, oy + 28, 4, 2, shoeOpt.color);
          drawRect(ox + 17, oy + 30, 4, 1, shoeOpt.sole);
        } else if (isCrouch) {
          drawRect(ox + 8, oy + 23, 16, 8, OUTLINE);
          drawRect(ox + 9, oy + 24, 14, 3, bottomOpt.color);
          drawRect(ox + 8, oy + 27, 6, 3, shoeOpt.color);
          drawRect(ox + 8, oy + 30, 6, 1, shoeOpt.sole);
          drawRect(ox + 18, oy + 27, 6, 3, shoeOpt.color);
          drawRect(ox + 18, oy + 30, 6, 1, shoeOpt.sole);
        } else {
          if (isSkirt) {
            drawRect(ox + 9, legsY - 1, 14, 5, OUTLINE);
            drawRect(ox + 10, legsY, 12, 4, bottomOpt.color);
            drawPx(ox + 12, legsY + 1, bottomOpt.shade);
            drawPx(ox + 15, legsY + 1, bottomOpt.shade);
            drawPx(ox + 18, legsY + 1, bottomOpt.shade);
          }
          const lx = ox + 12 + (isLeft ? -legLdx : legLdx);
          const ly = legsY + legLdy;
          drawRect(lx - 1, ly, 4, 3, bottomOpt.shade);
          drawRect(lx, ly + 3, 2, 2, isLongPants ? bottomOpt.shade : skinOpt.shade);
          drawRect(lx - 1, ly + 5, 4, 2, shoeOpt.color);
          drawRect(lx - 1, ly + 6, 4, 1, shoeOpt.sole);

          const rx = ox + 16 + (isLeft ? -legRdx : legRdx);
          const ry = legsY + legRdy;
          drawRect(rx - 1, ry, 4, 3, bottomOpt.color);
          drawRect(rx, ry + 3, 2, 2, isLongPants ? bottomOpt.color : skinOpt.color);
          drawRect(rx - 1, ry + 5, 4, 2, shoeOpt.color);
          drawRect(rx - 1, ry + 6, 4, 1, shoeOpt.sole);
        }

        // Shirt &Distinct Garment Patterns (Plain, Striped, Buttoned, Vest, Pocket)
        drawRect(ox + 10, bodyY, 12, 8, OUTLINE);
        drawRect(ox + 11, bodyY + 1, 10, 6, shirtOpt.color);
        drawRect(ox + 11, bodyY + 5, 10, 2, shirtOpt.shade);
        drawRect(ox + 14, bodyY + 1, 4, 1, shirtOpt.collar);

        if (shirtOpt.pattern === 'stripe') {
          drawRect(ox + 11, bodyY + 2, 10, 1, shirtOpt.collar);
          drawRect(ox + 11, bodyY + 4, 10, 1, shirtOpt.collar);
        } else if (shirtOpt.pattern === 'button') {
          drawRect(ox + 15, bodyY + 1, 2, 6, shirtOpt.collar);
          drawPx(ox + 16, bodyY + 3, shirtOpt.shade);
          drawPx(ox + 16, bodyY + 5, shirtOpt.shade);
        } else if (shirtOpt.pattern === 'vest') {
          drawRect(ox + 13, bodyY + 1, 6, 5, shirtOpt.collar);
        } else if (shirtOpt.pattern === 'pocket') {
          drawRect(ox + 17, bodyY + 3, 3, 2, shirtOpt.collar);
        }

        // Backpack strap & pouch
        if (bagOpt.id !== 'none') {
          for (let i = 0; i < 6; i++) {
            const bx = (!isLeft) ? (ox + 12 + i) : (ox + 19 - i);
            drawPx(bx, bodyY + 1 + i, bagOpt.strap);
          }
          const bagX = (!isLeft) ? (ox + 8) : (ox + 20);
          drawRect(bagX, bodyY + 3, 4, 5, OUTLINE);
          drawRect(bagX + 1, bodyY + 4, 2, 3, bagOpt.body);
          drawPx(bagX + 1, bodyY + 4, bagOpt.buckle);
        }

        // Arms
        const alX = ox + (isLeft ? 20 : 9) + (isLeft ? -armLdx : armLdx);
        const alY = bodyY + 1 + armLdy;
        drawRect(alX, alY, 2, 4, shirtOpt.shade);
        drawRect(alX, alY + 4, 2, 2, skinOpt.shade);

        const arX = ox + (isLeft ? 9 : 20) + (isLeft ? -armRdx : armRdx);
        const arY = bodyY + 1 + armRdy;
        drawRect(arX, arY, 2, 4, shirtOpt.color);
        drawRect(arX, arY + 4, 2, 2, skinOpt.color);

        if (animName === 'interact' && (col === 1 || col === 2)) {
          const toolX = (!isLeft) ? (arX + 3) : (arX - 3);
          drawRect(toolX, arY + 1, 4, 3, '#3A3A44');
          drawPx(toolX + 1, arY + 2, '#FFE872');
        }

        // Head Base & Skin
        drawRect(ox + 10, headY + 1, 12, 9, OUTLINE);
        drawRect(ox + 9, headY + 2, 14, 7, OUTLINE);
        drawRect(ox + 11, headY + 3, 10, 6, skinOpt.color);
        drawRect(ox + 11, headY + 8, 10, 1, skinOpt.shade);

        // 10 BESPOKE HAIRSTYLES (All drawPx calls verified!)
        const hcol = hairCol;
        if (hairStyle === 'male_buzz') {
          drawRect(ox + 10, headY, 12, 3, hcol.dark);
          drawRect(ox + 9, headY + 1, 14, 2, hcol.dark);
          drawRect(ox + 11, headY + 1, 10, 1, hcol.mid);
        } else if (hairStyle === 'male_short') {
          drawRect(ox + 10, headY - 1, 12, 4, hcol.dark);
          drawRect(ox + 9, headY, 14, 3, hcol.dark);
          drawRect(ox + 11, headY, 10, 2, hcol.mid);
          drawPx(ox + 12, headY - 2, hcol.mid);
          drawPx(ox + 15, headY - 2, hcol.hi);
          drawPx(ox + 18, headY - 2, hcol.mid);
          if (!isLeft) {
            drawRect(ox + 9, headY + 2, 3, 4, hcol.dark);
            drawRect(ox + 12, headY + 3, 3, 2, hcol.mid);
          } else {
            drawRect(ox + 20, headY + 2, 3, 4, hcol.dark);
            drawRect(ox + 17, headY + 3, 3, 2, hcol.mid);
          }
        } else if (hairStyle === 'male_center') {
          drawRect(ox + 9, headY - 1, 14, 3, hcol.dark);
          drawRect(ox + 11, headY, 10, 2, hcol.mid);
          drawRect(ox + 10, headY + 2, 3, 3, hcol.dark);
          drawRect(ox + 11, headY + 3, 2, 2, hcol.mid);
          drawRect(ox + 18, headY + 2, 3, 3, hcol.dark);
          drawRect(ox + 18, headY + 3, 2, 2, hcol.mid);
          drawRect(ox + 14, headY + 2, 3, 2, skinOpt.color);
        } else if (hairStyle === 'male_wavy') {
          drawRect(ox + 8, headY - 1, 16, 4, hcol.dark);
          drawRect(ox + 10, headY - 2, 12, 2, hcol.mid);
          drawPx(ox + 9, headY - 3, hcol.hi);
          drawPx(ox + 13, headY - 3, hcol.hi);
          drawPx(ox + 17, headY - 3, hcol.hi);
          drawRect(ox + 9, headY + 2, 4, 3, hcol.mid);
          drawRect(ox + 18, headY + 2, 4, 3, hcol.mid);
        } else if (hairStyle === 'male_sidepart') {
          drawRect(ox + 9, headY - 2, 14, 4, hcol.dark);
          drawRect(ox + 12, headY - 2, 9, 2, hcol.hi);
          drawRect(ox + 10, headY, 4, 2, hcol.mid);
          if (!isLeft) {
            drawRect(ox + 8, headY + 1, 3, 5, hcol.dark);
          } else {
            drawRect(ox + 21, headY + 1, 3, 5, hcol.dark);
          }
        } else if (hairStyle === 'female_ponytail') {
          drawRect(ox + 10, headY, 12, 4, hcol.dark);
          drawRect(ox + 9, headY + 1, 14, 3, hcol.dark);
          drawRect(ox + 11, headY + 1, 10, 2, hcol.mid);
          drawRect(ox + 11, headY + 3, 9, 2, hcol.dark);
          if (!isLeft) {
            drawRect(ox + 7, headY, 3, 3, '#BA3E34');
            drawRect(ox + 6, headY + 1, 3, 6, hcol.dark);
            drawRect(ox + 5, headY + 4, 2, 4, hcol.mid);
          } else {
            drawRect(ox + 22, headY, 3, 3, '#BA3E34');
            drawRect(ox + 23, headY + 1, 3, 6, hcol.dark);
            drawRect(ox + 25, headY + 4, 2, 4, hcol.mid);
          }
        } else if (hairStyle === 'female_long_bangs') {
          drawRect(ox + 9, headY, 14, 4, hcol.dark);
          drawRect(ox + 11, headY + 1, 10, 2, hcol.mid);
          drawRect(ox + 11, headY + 3, 10, 2, hcol.dark);
          drawRect(ox + 8, headY + 2, 3, 12, hcol.dark);
          drawRect(ox + 21, headY + 2, 3, 12, hcol.dark);
          drawRect(ox + 8, headY + 7, 2, 6, hcol.mid);
          drawRect(ox + 22, headY + 7, 2, 6, hcol.mid);
        } else if (hairStyle === 'female_bob') {
          drawRect(ox + 9, headY, 14, 5, hcol.dark);
          drawRect(ox + 11, headY + 1, 10, 2, hcol.mid);
          drawRect(ox + 11, headY + 3, 9, 2, hcol.dark);
          drawRect(ox + 8, headY + 2, 3, 7, hcol.dark);
          drawRect(ox + 21, headY + 2, 3, 7, hcol.dark);
          drawPx(ox + 10, headY + 8, hcol.dark);
          drawPx(ox + 21, headY + 8, hcol.dark);
        } else if (hairStyle === 'female_twintails') {
          drawRect(ox + 10, headY, 12, 4, hcol.dark);
          drawRect(ox + 9, headY + 1, 14, 3, hcol.dark);
          drawRect(ox + 11, headY + 3, 9, 2, hcol.dark);
          drawRect(ox + 6, headY + 2, 3, 2, '#4E7CA8');
          drawRect(ox + 5, headY + 4, 3, 6, hcol.dark);
          drawRect(ox + 23, headY + 2, 3, 2, '#4E7CA8');
          drawRect(ox + 24, headY + 4, 3, 6, hcol.dark);
        } else {
          drawRect(ox + 9, headY, 14, 4, hcol.dark);
          drawRect(ox + 11, headY + 1, 10, 2, hcol.mid);
          drawRect(ox + 11, headY + 3, 9, 2, hcol.dark);
          drawRect(ox + 9, headY + 3, 2, 4, hcol.dark);
          drawRect(ox + 21, headY + 3, 2, 4, hcol.dark);
        }

        // Eyes & Facial Style
        const eyeL = isLeft ? ox + 11 : ox + 13;
        const eyeR = isLeft ? ox + 16 : ox + 18;
        if (faceStyle === 'bold') {
          drawRect(eyeL - 1, headY + 4, 3, 1, OUTLINE);
          drawRect(eyeR, headY + 4, 3, 1, OUTLINE);
        }
        if (blink || animName === 'happy') {
          drawPx(eyeL, headY + 6, OUTLINE);
          drawPx(eyeL + 1, animName === 'happy' ? headY + 5 : headY + 6, OUTLINE);
          drawPx(eyeR, headY + 6, OUTLINE);
          drawPx(eyeR + 1, animName === 'happy' ? headY + 5 : headY + 6, OUTLINE);
        } else {
          drawRect(eyeL, headY + 5, 2, 2, OUTLINE);
          drawPx(eyeL, headY + 5, '#FFFFFF');
          drawRect(eyeR, headY + 5, 2, 2, OUTLINE);
          drawPx(eyeR, headY + 5, '#FFFFFF');
        }

        if (faceStyle === 'rosy') {
          drawPx(eyeL - 1, headY + 7, '#F28A84');
          drawPx(eyeR + 2, headY + 7, '#F28A84');
        }

        // Accessories
        if (accOpt.id === 'straw_hat') {
          drawRect(ox + 6, headY - 1, 20, 3, accOpt.color || '#E8CA88');
          drawRect(ox + 10, headY - 4, 12, 3, accOpt.color || '#E8CA88');
          drawRect(ox + 10, headY - 1, 12, 1, '#B83E34');
        } else if (accOpt.id === 'beret') {
          drawRect(ox + 8, headY - 2, 16, 4, accOpt.color || '#4A3C52');
        } else if (accOpt.id === 'glasses') {
          drawRect(eyeL - 1, headY + 4, 4, 4, accOpt.color || '#F2C054');
          drawRect(eyeR - 1, headY + 4, 4, 4, accOpt.color || '#F2C054');
        } else if (accOpt.id === 'cat_ears') {
          drawPx(ox + 9, headY - 2, accOpt.color || '#2E2834');
          drawPx(ox + 10, headY - 1, '#F2A4A8');
          drawPx(ox + 22, headY - 2, accOpt.color || '#2E2834');
          drawPx(ox + 21, headY - 1, '#F2A4A8');
        } else if (accOpt.id === 'sunglasses') {
          drawRect(eyeL - 1, headY + 5, 4, 3, '#1E1C22');
          drawRect(eyeR - 1, headY + 5, 4, 3, '#1E1C22');
        }
      }
    }

    this.customSpriteCanvas = c;
    return c;
  }

  bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      const code = e.code;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) {
        e.preventDefault();
      }
      if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD', 'KeyW', 'KeyS', 'ArrowUp', 'ArrowDown', 'Space', 'ShiftLeft', 'ShiftRight', 'KeyE', 'Escape', 'KeyJ'].includes(code)) {
        if ((code === 'Space' || code === 'KeyW' || code === 'ArrowUp') && !this.keysDown.has(code)) {
          this.jumpQueued = true;
          this.jumpBufferTimer = 0.14;
        }
        if (code === 'KeyE' && !this.keysDown.has('KeyE')) {
          this.interactQueued = true;
        }
        if (code === 'Escape' && !this.keysDown.has('Escape')) {
          this.pauseQueued = true;
        }
        this.keysDown.add(code);
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keysDown.delete(e.code);
    });

    window.addEventListener('blur', () => {
      this.keysDown.clear();
      this.touchLeft = false;
      this.touchRight = false;
      this.touchRun = false;
      this.touchCrouch = false;
    });
  }

  triggerTouchJump() {
    this.jumpQueued = true;
    this.jumpBufferTimer = 0.14;
  }
  triggerTouchInteract() { this.interactQueued = true; }
  triggerPause() { this.pauseQueued = true; }
  consumeInteract() {
    if (this.interactQueued) { this.interactQueued = false; return true; }
    return false;
  }
  consumePause() {
    if (this.pauseQueued) { this.pauseQueued = false; return true; }
    return false;
  }

  spawn(x, groundY) {
    this.x = x;
    this.y = groundY;
    this.vy = 0;
    this.isGrounded = true;
    this.isCrouching = false;
    this.isRunning = false;
    this.locked = false;
    this.sitting = false;
    this.anim.play(this.facing === 'left' ? 'idle_l' : 'idle_r', true);
  }

  playSpecialAnimation(state, durationMs, onDone) {
    this.locked = true;
    this.anim.play(state, true);
    window.setTimeout(() => {
      if (!this.sitting) {
        this.locked = false;
        this.anim.play(this.facing === 'left' ? 'idle_l' : 'idle_r', true);
      }
      if (onDone) onDone();
    }, durationMs);
  }

  enterSitState(seatY) {
    this.sitting = true;
    this.locked = true;
    this.facing = 'right';
    if (seatY !== undefined) this.y = seatY;
    this.anim.play('sit_r', true);
  }

  update(dt) {
    if (this.sitting) {
      this.anim.play('sit_r');
      this.anim.update(dt);
      return { moving: false, stepTriggered: false, jumped: false };
    }

    if (this.locked) {
      this.anim.update(dt);
      return { moving: false, stepTriggered: false, jumped: false };
    }

    const moveLeft = this.keysDown.has('KeyA') || this.keysDown.has('ArrowLeft') || this.touchLeft;
    const moveRight = this.keysDown.has('KeyD') || this.keysDown.has('ArrowRight') || this.touchRight;
    const crouchKey = this.keysDown.has('KeyS') || this.keysDown.has('ArrowDown') || this.touchCrouch;
    const runKey = this.keysDown.has('ShiftLeft') || this.keysDown.has('ShiftRight') || this.touchRun;

    if (this.jumpBufferTimer > 0) this.jumpBufferTimer -= dt;
    if (this.isGrounded) {
      this.coyoteTimer = 0.12;
    } else {
      if (this.coyoteTimer > 0) this.coyoteTimer -= dt;
    }

    let jumped = false;
    if ((this.jumpQueued || this.jumpBufferTimer > 0) && (this.isGrounded || this.coyoteTimer > 0)) {
      this.vy = this.jumpVelocity;
      this.isGrounded = false;
      this.coyoteTimer = 0;
      this.jumpBufferTimer = 0;
      this.jumpQueued = false;
      jumped = true;
      this.audio.playInteract();
    }

    this.isRunning = runKey && !crouchKey;
    this.isCrouching = crouchKey && this.isGrounded;
    const currentSpeed = this.isCrouching ? this.walkSpeed * 0.45 : (this.isRunning ? this.runSpeed : this.walkSpeed);

    let dx = 0;
    if (moveLeft && !moveRight) {
      dx = -currentSpeed * dt;
      this.facing = 'left';
    } else if (moveRight && !moveLeft) {
      dx = currentSpeed * dt;
      this.facing = 'right';
    }

    this.vy += this.gravity * dt;
    const oldY = this.y;
    const newY = this.y + this.vy * dt;
    const vertRes = this.collision.resolveVertical(this.x + dx, oldY, newY, this.vy);
    this.y = vertRes.y;
    this.vy = vertRes.vy;
    this.isGrounded = vertRes.isGrounded;

    if (dx !== 0) {
      this.x = this.collision.clampX(this.x + dx);
    }

    let targetAnim = 'idle_r';
    if (!this.isGrounded) {
      targetAnim = (this.vy < 0)
        ? (this.facing === 'left' ? 'jump_l' : 'jump_r')
        : (this.facing === 'left' ? 'fall_l' : 'fall_r');
    } else if (this.isCrouching) {
      targetAnim = (this.facing === 'left') ? 'crouch_l' : 'crouch_r';
    } else if (dx !== 0) {
      if (this.isRunning) {
        targetAnim = (this.facing === 'left') ? 'run_l' : 'run_r';
      } else {
        targetAnim = (this.facing === 'left') ? 'walk_l' : 'walk_r';
      }
    } else {
      targetAnim = (this.facing === 'left') ? 'idle_l' : 'idle_r';
    }

    this.anim.play(targetAnim);
    this.anim.update(dt);

    let stepTriggered = false;
    if (dx !== 0 && this.isGrounded) {
      this.stepTimer += dt;
      const stepInterval = this.isRunning ? 0.22 : 0.35;
      if (this.stepTimer >= stepInterval) {
        this.stepTimer = 0;
        this.audio.playFootstep();
        stepTriggered = true;
      }
    } else {
      this.stepTimer = 0.2;
    }

    return { moving: dx !== 0, stepTriggered, jumped };
  }
}
