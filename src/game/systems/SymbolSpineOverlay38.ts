import { Application, Assets, Container, Graphics } from 'pixi7';
import { Spine } from '@pixi-spine/all-3.8';
import type { SymbolSpineClipConfig, SymbolSpineGameLike, SymbolSpineHandle } from './symbolSpineTypes';

type SpineResource = {
  spineData?: {
    animations?: Array<{ name?: string; duration?: number }> | Record<string, { duration?: number }>;
  };
};

export default class SymbolSpineOverlay38 {
  private readonly game: SymbolSpineGameLike;
  private app: Application | null = null;
  private host: HTMLDivElement | null = null;
  private layer: Container | null = null;
  private reelMask: Graphics | null = null;
  private readonly onResize: () => void;

  constructor(game: SymbolSpineGameLike) {
    this.game = game;
    this.onResize = () => this.syncViewport();
  }

  async preload(clips: SymbolSpineClipConfig[]): Promise<void> {
    this.ensureApp();
    for (let i = 0; i < clips.length; i += 1) {
      const clip = clips[i];
      await Assets.load({
        src: clip.jsonPath,
        data: {
          spineAtlasFile: clip.atlasPath
        }
      });
    }
  }

  play(clip: SymbolSpineClipConfig, x: number, y: number): SymbolSpineHandle | null {
    this.ensureApp();
    if (!this.layer) return null;

    const resource = Assets.get(clip.jsonPath) as SpineResource | undefined;
    if (!resource || !resource.spineData) {
      return null;
    }

    const spine = new Spine(resource.spineData as never);
    spine.eventMode = 'none';
    spine.visible = true;
    spine.scale.set(Number.isFinite(clip.scale) ? Number(clip.scale) : 1);
    this.layer.addChild(spine);

    const animationName = this.resolveAnimationName(resource, clip);
    spine.state.setAnimation(0, animationName, clip.loop === true);
    const durationMs = this.resolveAnimationDuration(resource, animationName, clip);

    const setPosition = (nextX: number, nextY: number): void => {
      spine.position.set(
        nextX + (Number.isFinite(clip.offsetX) ? Number(clip.offsetX) : 0),
        nextY + (Number.isFinite(clip.offsetY) ? Number(clip.offsetY) : 0)
      );
      spine.zIndex = spine.y + 10000;
    };

    setPosition(x, y);

    return {
      stop: () => {
        spine.state.clearTracks();
        spine.destroy({ children: true });
      },
      setPosition,
      durationMs,
      bringToFront: () => {
        if (!spine.parent) return;
        const parent = spine.parent;
        const idx = parent.children.indexOf(spine);
        if (idx < 0) return;
        parent.children.splice(idx, 1);
        parent.children.push(spine);
      }
    };
  }

  destroy(): void {
    window.removeEventListener('resize', this.onResize);
    if (this.app) {
      this.app.destroy(true, { children: true });
      this.app = null;
    }
    if (this.host && this.host.parentNode) {
      this.host.parentNode.removeChild(this.host);
    }
    this.host = null;
    this.layer = null;
    this.reelMask = null;
  }

  setVisible(visible: boolean): void {
    if (!this.host) return;
    this.host.style.display = visible ? '' : 'none';
  }

  private ensureApp(): void {
    if (this.app) {
      this.syncViewport();
      return;
    }

    const target = this.game.displayManager?.getTargetResolution?.() || { width: 1920, height: 1080 };
    this.app = new Application({
      width: target.width,
      height: target.height,
      backgroundAlpha: 0,
      antialias: true
    });
    this.host = document.createElement('div');
    this.host.setAttribute('data-role', 'symbol-spine-overlay-38');
    this.host.style.position = 'absolute';
    this.host.style.pointerEvents = 'none';
    this.host.style.zIndex = '20';
    this.host.appendChild(this.app.view as HTMLCanvasElement);
    document.body.appendChild(this.host);

    this.layer = new Container();
    this.layer.sortableChildren = true;
    this.app.stage.addChild(this.layer);

    this.reelMask = new Graphics();
    this.layer.mask = this.reelMask;
    this.app.stage.addChild(this.reelMask);

    window.addEventListener('resize', this.onResize);
    this.syncViewport();
  }

  private syncViewport(): void {
    if (!this.app) return;
    const mainView = this.game.renderer && ((this.game.renderer as any).canvas || (this.game.renderer as any).view);
    const overlayView = this.app.view as HTMLCanvasElement;
    if (mainView) {
      overlayView.style.position = 'absolute';
      overlayView.style.left = mainView.style.left;
      overlayView.style.top = mainView.style.top;
      overlayView.style.width = mainView.style.width;
      overlayView.style.height = mainView.style.height;
    }
    this.updateReelMask();
  }

  private updateReelMask(): void {
    if (!this.reelMask) return;
    const reels = this.game.reels;
    const x = Number.isFinite(reels?.REELS_POSITION_X) ? Number(reels.REELS_POSITION_X) : 0;
    const y = Number.isFinite(reels?.REELS_POSITION_Y) ? Number(reels.REELS_POSITION_Y) : 0;
    const width = Number.isFinite(reels?.REEL_WIDTH) && Number.isFinite(reels?.REELS_SPACING) && Number.isFinite(reels?.NUMBER_OF_REELS)
      ? Number(reels.REELS_SPACING) * (Number(reels.NUMBER_OF_REELS) - 1) + Number(reels.REEL_WIDTH)
      : 1920;
    const height = Number.isFinite(reels?.REEL_HEIGHT) ? Number(reels.REEL_HEIGHT) : 1080;

    this.reelMask.clear();
    this.reelMask.beginFill(0xffffff);
    this.reelMask.drawRect(x, y, width, height);
    this.reelMask.endFill();
  }

  private resolveAnimationName(resource: SpineResource, clip: SymbolSpineClipConfig): string {
    if (typeof clip.animationName === 'string' && clip.animationName.length > 0) {
      return clip.animationName;
    }

    const animations = resource.spineData?.animations;
    if (Array.isArray(animations) && animations[0] && typeof animations[0].name === 'string') {
      return animations[0].name;
    }

    if (animations && typeof animations === 'object') {
      const names = Object.keys(animations);
      if (names.length > 0) return names[0];
    }

    return 'animation';
  }

  private resolveAnimationDuration(resource: SpineResource, animationName: string, clip: SymbolSpineClipConfig): number | undefined {
    if (clip.loop === true) {
      return undefined;
    }

    const animations = resource.spineData?.animations;
    if (Array.isArray(animations)) {
      const match = animations.find((item) => item && item.name === animationName);
      if (match && Number.isFinite(match.duration)) {
        return Math.max(0, Math.round(Number(match.duration) * 1000));
      }
      return undefined;
    }

    if (animations && typeof animations === 'object') {
      const match = animations[animationName];
      if (match && Number.isFinite(match.duration)) {
        return Math.max(0, Math.round(Number(match.duration) * 1000));
      }
    }

    return undefined;
  }
}
