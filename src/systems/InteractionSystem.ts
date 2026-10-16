export class InteractionSystem {
  hotspots = [];
  activeHotspot = null;

  setHotspots(hotspots) {
    this.hotspots = hotspots;
    this.activeHotspot = null;
  }

  update(playerX, playerY) {
    let closest = null;
    let bestDist = Infinity;
    for (const h of this.hotspots) {
      const dx = Math.abs(playerX - h.x);
      const dy = Math.abs(playerY - h.y);
      if (dx <= h.radius && dy <= 52 && dx < bestDist) {
        bestDist = dx;
        closest = h;
      }
    }
    this.activeHotspot = closest;
    return this.activeHotspot;
  }
}
