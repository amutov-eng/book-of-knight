import { Application, Assets, type Container as Pixi7Container } from 'pixi7';
import { Spine } from 'pixi-spine';
import type BaseGame from '../../core/BaseGame';
import { SOUND_IDS } from '../../config/soundConfig';

type OverlayClipId = 'freeGamesIntro' | 'freeGamesBook' | 'freeGamesCongrats';

type OverlayClipConfig = {
  jsonPath: string;
  atlasPath: string;
  animationName: string;
  soundId?: string;
  x: number;
  y: number;
  scale: number;
  alignTop?: boolean;
};

type SpineResource = {
  spineData?: {
    animations?: Array<{ name?: string }> | Record<string, unknown>;
  };
};

const CLIPS: Record<OverlayClipId, OverlayClipConfig> = {
  freeGamesIntro: {
    jsonPath: 'assets/spine/animations/1920_free_games_v1.json',
    atlasPath: 'assets/spine/animations/1920_free_games_v1.atlas',
    animationName: 'animation_start',
    soundId: SOUND_IDS.FREE_GAMES,
    x: 960,
    y: 0,
    scale: 1,
    alignTop: true
  },
  freeGamesBook: {
    jsonPath: 'assets/spine/symbols/1920_book_v1.json',
    atlasPath: 'assets/spine/symbols/1920_book_v1.atlas',
    animationName: 'animation',
    soundId: SOUND_IDS.OPEN_BOOK,
    x: 960,
    y: 540,
    scale: 1
  },
  freeGamesCongrats: {
    jsonPath: 'assets/spine/animations/1920_congrats_v1.json',
    atlasPath: 'assets/spine/animations/1920_congrats_v1.atlas',
    animationName: 'animation',
    soundId: SOUND_IDS.CONGRATS,
    x: 960,
    y: 540,
    scale: 1
  }
};

export default class GameplaySpineOverlay {
  private readonly game: BaseGame & Record<string, any>;
  private app: Application | null = null;
  private host: HTMLDivElement | null = null;
  private spine: Spine | null = null;
  private activeClipId: OverlayClipId | null = null;
  private animationComplete = false;
  private readonly onResize: () => void;
  private readonly onPointerUp: () => void;

  constructor(game: BaseGame) {
    this.game = game as BaseGame & Record<string, any>;
    this.onResize = () => this.layout();
    this.onPointerUp = () => {
      if (!this.animationComplete || !this.game?.controller) return;
      this.game.controller.event = 1;
    };
  }

  async preload(): Promise<void> {
    const clipIds = Object.keys(CLIPS) as OverlayClipId[];
    for (let i = 0; i < clipIds.length; i += 1) {
      const clip = CLIPS[clipIds[i]];
      await Assets.load({
        src: clip.jsonPath,
        data: {
          spineAtlasFile: clip.atlasPath
        }
      });
    }
  }

  async play(clipId: OverlayClipId): Promise<void> {
    const clip = CLIPS[clipId];
    if (!clip) return;

    await this.ensureApp();
    this.clearSpine();
    this.activeClipId = clipId;
    this.animationComplete = false;

    const resource = await Assets.load({
      src: clip.jsonPath,
      data: {
        spineAtlasFile: clip.atlasPath
      }
    }) as SpineResource;

    if (!this.app || !resource?.spineData) {
      this.animationComplete = true;
      return;
    }

    this.host!.style.display = 'block';
    this.spine = new Spine(resource.spineData as never);
    this.spine.eventMode = 'none';
    this.app.stage.addChild(this.spine as unknown as Pixi7Container);
    this.layout();

    this.spine.state.setAnimation(0, clip.animationName, false);
    this.spine.state.addListener({
      complete: () => {
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

  hide(): void {
    this.clearSpine();
    this.activeClipId = null;
    this.animationComplete = false;
    if (this.host) {
      this.host.style.display = 'none';
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
    this.host.style.position = 'fixed';
    this.host.style.inset = '0';
    this.host.style.zIndex = '30';
    this.host.style.pointerEvents = 'auto';
    this.host.style.display = 'none';
    this.host.addEventListener('pointerup', this.onPointerUp);

    const width = Number(this.game?.renderer?.width || 1920);
    const height = Number(this.game?.renderer?.height || 1080);
    this.app = new Application({
      width,
      height,
      backgroundAlpha: 0,
      antialias: true
    });

    this.host.appendChild(this.app.view as HTMLCanvasElement);
    document.body.appendChild(this.host);
    window.addEventListener('resize', this.onResize);
  }

  private layout(): void {
    if (!this.app || !this.spine || !this.activeClipId) return;

    const clip = CLIPS[this.activeClipId];
    const bounds = this.spine.getLocalBounds();
    if (clip.alignTop) {
      const safeWidth = bounds.width > 0 ? bounds.width : 1;
      const safeHeight = bounds.height > 0 ? bounds.height : 1;
      const autoScale = Math.min(this.app.screen.width / safeWidth, this.app.screen.height / safeHeight) * 0.98;
      this.spine.scale.set(autoScale * clip.scale);
      this.spine.pivot.set(bounds.x + bounds.width * 0.5, bounds.y);
      this.spine.position.set(clip.x, clip.y);
      return;
    }

    this.spine.scale.set(clip.scale);
    this.spine.pivot.set(bounds.x + bounds.width * 0.5, bounds.y + bounds.height * 0.5);
    this.spine.position.set(clip.x, clip.y);
  }

  private clearSpine(): void {
    if (!this.spine) return;
    this.spine.destroy({ children: true });
    this.spine = null;
  }
}
