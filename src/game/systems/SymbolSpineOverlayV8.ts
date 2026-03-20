import { Application, Assets, Container, Graphics } from 'pixi.js';
import { Spine } from '@esotericsoftware/spine-pixi-v8';
import type { SymbolSpineClipConfig, SymbolSpineGameLike, SymbolSpineHandle } from './symbolSpineTypes';

export default class SymbolSpineOverlayV8 {
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
    await this.ensureApp();
    const aliases: string[] = [];
    for (let i = 0; i < clips.length; i += 1) {
      const clip = clips[i];
      Assets.add({ alias: clip.jsonPath, src: clip.jsonPath });
      Assets.add({ alias: clip.atlasPath, src: clip.atlasPath });
      aliases.push(clip.jsonPath, clip.atlasPath);
    }
    if (aliases.length > 0) {
      await Assets.load([...new Set(aliases)]);
    }
  }

  play(clip: SymbolSpineClipConfig, x: number, y: number): SymbolSpineHandle | null {
    if (!this.app) return null;
    if (!this.layer) return null;

    const spine = Spine.from({
      skeleton: clip.jsonPath,
      atlas: clip.atlasPath,
      scale: Number.isFinite(clip.scale) ? Number(clip.scale) : 1,
      autoUpdate: true
    });
    spine.eventMode = 'none';
    this.layer.addChild(spine);

    const animationName = this.resolveAnimationName(spine, clip);
    spine.state.setAnimation(0, animationName, clip.loop === true);
    const durationMs = this.resolveAnimationDuration(spine, animationName, clip);

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

  private async ensureApp(): Promise<void> {
    if (this.app) {
      this.syncViewport();
      return;
    }

    const target = this.game.displayManager?.getTargetResolution?.() || { width: 1920, height: 1080 };
    this.app = new Application();
    await this.app.init({
      width: target.width,
      height: target.height,
      backgroundAlpha: 0,
      antialias: true
    });

    this.host = document.createElement('div');
    this.host.setAttribute('data-role', 'symbol-spine-overlay-v8');
    this.host.style.position = 'absolute';
    this.host.style.pointerEvents = 'none';
    this.host.style.zIndex = '21';
    const view = (this.app.renderer as any).canvas || (this.app.canvas as HTMLCanvasElement);
    this.host.appendChild(view);
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
    const overlayView = (this.app.renderer as any).canvas || (this.app.canvas as HTMLCanvasElement);
    if (mainView && overlayView) {
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
    this.reelMask.rect(x, y, width, height).fill(0xffffff);
  }

  private resolveAnimationName(spine: Spine, clip: SymbolSpineClipConfig): string {
    if (typeof clip.animationName === 'string' && clip.animationName.length > 0) {
      return clip.animationName;
    }

    const animations = spine.skeleton?.data?.animations || [];
    if (Array.isArray(animations) && animations[0] && typeof animations[0].name === 'string') {
      return animations[0].name;
    }

    return 'animation';
  }

  private resolveAnimationDuration(spine: Spine, animationName: string, clip: SymbolSpineClipConfig): number | undefined {
    if (clip.loop === true) {
      return undefined;
    }

    const animations = spine.skeleton?.data?.animations || [];
    if (!Array.isArray(animations)) {
      return undefined;
    }

    const match = animations.find((item) => item && item.name === animationName);
    if (!match || !Number.isFinite((match as { duration?: number }).duration)) {
      return undefined;
    }

    return Math.max(0, Math.round(Number((match as { duration?: number }).duration) * 1000));
  }
}
