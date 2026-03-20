import { getSymbolFrameDefsByIndex } from '../../config/assetsConfig';
import SymbolSpineOverlay38 from './SymbolSpineOverlay38';
import SymbolSpineOverlayV8 from './SymbolSpineOverlayV8';
import type { SymbolSpineClipConfig, SymbolSpineGameLike, SymbolSpineHandle, SymbolSpineRuntime } from './symbolSpineTypes';

export default class SymbolSpineOverlay {
  private readonly overlay38: SymbolSpineOverlay38;
  private readonly overlayV8: SymbolSpineOverlayV8;

  constructor(game: SymbolSpineGameLike) {
    this.overlay38 = new SymbolSpineOverlay38(game);
    this.overlayV8 = new SymbolSpineOverlayV8(game);
  }

  async preloadFromManifest(manifest: unknown): Promise<void> {
    const defs = getSymbolFrameDefsByIndex(manifest);
    const clips38 = new Map<string, SymbolSpineClipConfig>();
    const clips42 = new Map<string, SymbolSpineClipConfig>();

    for (let i = 0; i < defs.length; i += 1) {
      const spine = defs[i] && defs[i].spine ? defs[i].spine : null;
      if (!spine || typeof spine !== 'object') continue;
      const keys = Object.keys(spine);
      for (let j = 0; j < keys.length; j += 1) {
        const clip = spine[keys[j]];
        if (!clip || typeof clip !== 'object') continue;
        const runtime = this.resolveRuntime(clip);
        const target = runtime === '4.2' ? clips42 : clips38;
        target.set(`${clip.jsonPath}|${clip.atlasPath}|${runtime}`, clip);
      }
    }

    await this.overlay38.preload([...clips38.values()]);
    await this.overlayV8.preload([...clips42.values()]);
  }

  play(clip: SymbolSpineClipConfig, x: number, y: number): SymbolSpineHandle | null {
    const runtime = this.resolveRuntime(clip);
    if (runtime === '4.2') {
      return this.overlayV8.play(clip, x, y);
    }
    return this.overlay38.play(clip, x, y);
  }

  destroy(): void {
    this.overlay38.destroy();
    this.overlayV8.destroy();
  }

  private resolveRuntime(clip: SymbolSpineClipConfig): SymbolSpineRuntime {
    return clip && clip.runtime === '4.2' ? '4.2' : '3.8';
  }
}
