import { Application, Assets, type Container as Pixi7Container } from 'pixi7';
import { Spine } from 'pixi-spine';
import type BaseGame from '../../core/BaseGame';
import { SOUND_IDS } from '../../config/soundConfig';
import { getGameplaySpineConfig } from '../../config/assetsConfig';
import { getAssetsManifest } from '../../core/RuntimeContext';

type OverlayClipId = 'freeGamesIntro' | 'freeGamesBook' | 'freeGamesCongrats';

type OverlayClipConfig = {
  jsonPath: string;
  atlasPath: string;
  animationName: string;
  loopAnimationName?: string;
  soundId?: string;
  x: number;
  y: number;
  scale: number;
  pivot: 'center' | 'top-center';
};

type SpineResource = {
  spineData?: {
    animations?: Array<{ name?: string }> | Record<string, unknown>;
  };
};

const DEFAULT_CLIPS: Partial<Record<OverlayClipId, OverlayClipConfig>> = {
  freeGamesIntro: {
    jsonPath: 'assets/spine/animations/1920_free_games_v1.json',
    atlasPath: 'assets/spine/animations/1920_free_games_v1.atlas',
    animationName: 'animation_start',
    loopAnimationName: 'animation_loop',
    soundId: SOUND_IDS.FREE_GAMES,
    x: 960,
    y: 0,
    scale: 1,
    pivot: 'top-center'
  },
  freeGamesCongrats: {
    jsonPath: 'assets/spine/animations/1920_congrats_v1.json',
    atlasPath: 'assets/spine/animations/1920_congrats_v1.atlas',
    animationName: 'animation',
    soundId: SOUND_IDS.CONGRATS,
    x: 960,
    y: 540,
    scale: 1,
    pivot: 'center'
  }
};

export default class GameplaySpineOverlay {
  private readonly game: BaseGame & Record<string, any>;
  private app: Application | null = null;
  private host: HTMLDivElement | null = null;
  private spine: Spine | null = null;
  private clipResources: Partial<Record<OverlayClipId, SpineResource>> = {};
  private activeClipId: OverlayClipId | null = null;
  private animationComplete = false;
  private overlayReady = false;
  private readonly onResize: () => void;
  private readonly onPointerUp: () => void;

  constructor(game: BaseGame) {
    this.game = game as BaseGame & Record<string, any>;
    this.onResize = () => this.syncViewport();
    this.onPointerUp = () => {
      if (!this.animationComplete || !this.game?.controller) return;
      this.game.controller.event = 1;
    };
  }

  async preload(): Promise<void> {
    // Keep the overlay app and clip resources warm across presentations.
    // This avoids the one-frame gap we observed with the legacy FG spine flow.
    await this.ensureApp();
    const clips = this.getClips();
    const clipIds = Object.keys(clips) as OverlayClipId[];
    for (let i = 0; i < clipIds.length; i += 1) {
      const clip = clips[clipIds[i]];
      if (!clip) continue;
      this.clipResources[clipIds[i]] = await Assets.load({
        src: clip.jsonPath,
        data: {
          spineAtlasFile: clip.atlasPath
        }
      }) as SpineResource;
    }
  }

  async play(clipId: OverlayClipId): Promise<void> {
    const clip = this.getClip(clipId);
    if (!clip) {
      this.animationComplete = true;
      return;
    }

    await this.ensureApp();
    this.clearSpine();
    this.activeClipId = clipId;
    this.animationComplete = false;
    this.overlayReady = false;

    // Legacy transition path still depends on having the first FG frame ready
    // before the scene switches to the free-games visuals.
    const resource = this.clipResources[clipId]
      || await Assets.load({
        src: clip.jsonPath,
        data: {
          spineAtlasFile: clip.atlasPath
        }
      }) as SpineResource;
    this.clipResources[clipId] = resource;

    if (!this.app || !resource?.spineData) {
      this.animationComplete = true;
      return;
    }

    this.spine = new Spine(resource.spineData as never);
    this.spine.eventMode = 'none';
    this.app.stage.addChild(this.spine as unknown as Pixi7Container);
    this.syncViewport();
    this.layout();

    this.spine.state.setAnimation(0, clip.animationName, false);
    if (clip.loopAnimationName) {
      this.spine.state.addAnimation(0, clip.loopAnimationName, true, 0);
    }
    this.forceRender();
    this.host!.style.visibility = 'visible';
    this.host!.style.opacity = '1';
    this.overlayReady = true;
    this.spine.state.addListener({
      complete: (trackEntry: any) => {
        const animationName = trackEntry?.animation?.name;
        if (animationName && animationName !== clip.animationName) {
          return;
        }
        this.animationComplete = true;
      }
    });

    if (clip.soundId) {
      this.game.soundSystem?.play(clip.soundId as any, false);
    }
  }

  isComplete(): boolean {
    return this.animationComplete;
  }

  isReady(): boolean {
    return this.overlayReady;
  }

  hide(): void {
    this.clearSpine();
    this.activeClipId = null;
    this.animationComplete = false;
    this.overlayReady = false;
    if (this.host) {
      // Keep the canvas mounted; newer games can remove this once they use
      // a unified transition/presentation layer instead of the legacy FG flow.
      this.host.style.opacity = '0';
      this.host.style.visibility = 'hidden';
    }
  }

  async destroy(): Promise<void> {
    this.hide();
    window.removeEventListener('resize', this.onResize);
    if (this.host) {
      this.host.removeEventListener('pointerup', this.onPointerUp);
    }
    if (this.app) {
      this.app.destroy(true, { children: true });
      this.app = null;
    }
    if (this.host?.parentNode) {
      this.host.parentNode.removeChild(this.host);
    }
    this.host = null;
  }

  private async ensureApp(): Promise<void> {
    if (this.app && this.host) return;

    this.host = document.createElement('div');
    this.host.setAttribute('data-role', 'gameplay-spine-overlay');
    this.host.style.position = 'absolute';
    this.host.style.zIndex = '30';
    this.host.style.pointerEvents = 'auto';
    this.host.style.visibility = 'hidden';
    this.host.style.opacity = '0';
    this.host.addEventListener('pointerup', this.onPointerUp);

    const width = Number(this.game?.renderer?.width || 1920);
    const height = Number(this.game?.renderer?.height || 1080);
    this.app = new Application({
      width,
      height,
      backgroundAlpha: 0,
      antialias: true
    });

    const view = this.app.view as HTMLCanvasElement;
    view.style.background = 'transparent';
    view.style.display = 'block';
    view.style.position = 'absolute';
    this.host.appendChild(view);
    document.body.appendChild(this.host);
    window.addEventListener('resize', this.onResize);
    this.syncViewport();
  }

  private layout(): void {
    if (!this.app || !this.spine || !this.activeClipId || !this.host) return;

    const clip = this.getClip(this.activeClipId);
    if (!clip) return;
    const width = Math.max(1, Math.round(this.host.clientWidth || window.innerWidth || 1920));
    const height = Math.max(1, Math.round(this.host.clientHeight || window.innerHeight || 1080));
    this.app.renderer.resize(width, height);
    const stageScale = Math.min(width / 1920, height / 1080);
    const stageOffsetX = (width - 1920 * stageScale) * 0.5;
    const stageOffsetY = (height - 1080 * stageScale) * 0.5;
    const bounds = this.spine.getLocalBounds();
    this.spine.scale.set(clip.scale);
    this.spine.scale.set(stageScale * clip.scale);
    if (clip.pivot === 'top-center') {
      this.spine.pivot.set(bounds.x + bounds.width * 0.5, bounds.y);
    } else {
      this.spine.pivot.set(bounds.x + bounds.width * 0.5, bounds.y + bounds.height * 0.5);
    }
    this.spine.position.set(
      stageOffsetX + clip.x * stageScale,
      stageOffsetY + clip.y * stageScale
    );
  }

  private clearSpine(): void {
    if (!this.spine) return;
    this.app?.stage.removeChild(this.spine as unknown as Pixi7Container);
    this.spine.destroy({ children: true });
    this.spine = null;
  }

  private forceRender(): void {
    if (!this.app) return;
    const renderer = this.app.renderer as any;
    if (renderer && typeof renderer.render === 'function') {
      renderer.render(this.app.stage);
    }
  }

  private syncViewport(): void {
    if (!this.app || !this.host) return;
    const mainView = this.game.renderer && (((this.game.renderer as any).canvas || (this.game.renderer as any).view) as HTMLCanvasElement | undefined);
    const overlayView = this.app.view as HTMLCanvasElement;
    if (mainView) {
      const rect = mainView.getBoundingClientRect();
      this.host.style.left = `${rect.left + window.scrollX}px`;
      this.host.style.top = `${rect.top + window.scrollY}px`;
      this.host.style.width = `${rect.width}px`;
      this.host.style.height = `${rect.height}px`;
      overlayView.style.left = '0px';
      overlayView.style.top = '0px';
      overlayView.style.width = `${rect.width}px`;
      overlayView.style.height = `${rect.height}px`;
    }
    this.layout();
  }

  hasClip(clipId: OverlayClipId): boolean {
    return !!this.getClip(clipId);
  }

  private getClips(): Partial<Record<OverlayClipId, OverlayClipConfig>> {
    const manifestClips = getGameplaySpineConfig(getAssetsManifest());
    return {
      ...DEFAULT_CLIPS,
      ...manifestClips
    };
  }

  private getClip(clipId: OverlayClipId): OverlayClipConfig | null {
    const clip = this.getClips()[clipId];
    return clip || null;
  }
}
