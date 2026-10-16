export interface PreloadedAssets {
  player: HTMLImageElement;
  collectibles: HTMLImageElement;
  foods: HTMLImageElement;
  interactiveObjects: HTMLImageElement;
  scenesSky: HTMLImageElement[];
  scenesWorld: HTMLImageElement[];
}

/**
 * PreloadScene - Preloads all 10 Tainan multi-layer pixel-art scenes,
 * 16-row character animation sprite sheet, 9-food atlas, 12-souvenir atlas,
 * and 20 in-world interactive animated objects.
 */
export class PreloadScene {
  public key: string = 'PreloadScene';
  private assetSources: Record<string, string>;

  constructor(assetSources: Record<string, string>) {
    this.assetSources = assetSources;
  }

  private loadImage(key: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = (err) => reject(err);
      img.src = this.assetSources[key] || `./assets/${key}.png`;
    });
  }

  public async loadAll(onProgress?: (ratio: number) => void): Promise<PreloadedAssets> {
    const keys = [
      'player_spritesheet',
      'collectibles_spritesheet',
      'foods_spritesheet',
      'interactive_objects',
      'scene1_sky', 'scene1_world',
      'scene2_sky', 'scene2_world',
      'scene3_sky', 'scene3_world',
      'scene4_sky', 'scene4_world',
      'scene5_sky', 'scene5_world',
      'scene6_sky', 'scene6_world',
      'scene7_sky', 'scene7_world',
      'scene8_sky', 'scene8_world',
      'scene9_sky', 'scene9_world',
      'scene10_sky', 'scene10_world'
    ];

    const loadedMap: Record<string, HTMLImageElement> = {};
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      loadedMap[k] = await this.loadImage(k);
      if (onProgress) onProgress((i + 1) / keys.length);
    }

    return {
      player: loadedMap['player_spritesheet'],
      collectibles: loadedMap['collectibles_spritesheet'],
      foods: loadedMap['foods_spritesheet'],
      interactiveObjects: loadedMap['interactive_objects'],
      scenesSky: [
        loadedMap['scene1_sky'],
        loadedMap['scene2_sky'],
        loadedMap['scene3_sky'],
        loadedMap['scene4_sky'],
        loadedMap['scene5_sky'],
        loadedMap['scene6_sky'],
        loadedMap['scene7_sky'],
        loadedMap['scene8_sky'],
        loadedMap['scene9_sky'],
        loadedMap['scene10_sky']
      ],
      scenesWorld: [
        loadedMap['scene1_world'],
        loadedMap['scene2_world'],
        loadedMap['scene3_world'],
        loadedMap['scene4_world'],
        loadedMap['scene5_world'],
        loadedMap['scene6_world'],
        loadedMap['scene7_world'],
        loadedMap['scene8_world'],
        loadedMap['scene9_world'],
        loadedMap['scene10_world']
      ]
    };
  }
}
