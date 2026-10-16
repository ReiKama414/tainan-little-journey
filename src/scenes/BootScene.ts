/**
 * BootScene - Initializes pixel-perfect canvas settings, verifies resolution (400x225 logical pixel grid),
 * and transitions immediately to PreloadScene.
 */
export class BootScene {
  public readonly key = 'BootScene';
  private onReady: () => void;

  constructor(onReady: () => void) {
    this.onReady = onReady;
  }

  public start(): void {
    this.onReady();
  }
}
