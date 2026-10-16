export class CollisionSystem {
  minX = 20;
  maxX = 860;
  groundY = 186;
  platforms = [];

  configure(worldWidth, groundY, isWaterfront, platforms = []) {
    this.minX = 15;
    this.maxX = isWaterfront ? 750 : worldWidth - 15;
    this.groundY = groundY;
    this.platforms = platforms;
  }

  clampX(x) { return Math.max(this.minX, Math.min(this.maxX, x)); }

  resolveVertical(x, oldY, newY, vy) {
    let targetY = newY;
    let grounded = false;
    let newVy = vy;

    if (vy >= 0) {
      for (const p of this.platforms) {
        if (x >= p.x - 4 && x <= p.x + p.width + 4) {
          if (oldY <= p.y + 3 && targetY >= p.y) {
            targetY = p.y;
            newVy = 0;
            grounded = true;
            return { y: targetY, vy: newVy, isGrounded: grounded };
          }
        }
      }
    }

    if (targetY >= this.groundY) {
      targetY = this.groundY;
      newVy = 0;
      grounded = true;
    }
    return { y: targetY, vy: newVy, isGrounded: grounded };
  }
}
