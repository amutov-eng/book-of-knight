import { Application, Assets, Graphics, Sprite, Texture } from 'pixi7';
import { Spine } from 'pixi-spine';
import type { SpineIntroConfig } from '../config/introConfig';
import type { IntroPlayer } from './types';
import DisplayManager from '../core/display/DisplayManager';
import { getRuntimeVariant } from '../config/runtimeConfig';

type SpineResource = {
  spineData?: {
    animations?: Array<{ name?: string }> | Record<string, unknown>;
  };
};

export default class LegacySpine38IntroPlayer implements IntroPlayer {
  private readonly config: SpineIntroConfig;
  private readonly displayManager: DisplayManager;
  private app: Application | null = null;
  private spine: Spine | null = null;
  private background: Sprite | null = null;
  private loadingEmptyBar: Sprite | null = null;
  private loadingFillBar: Sprite | null = null;
  private loadingFillMask: Graphics | null = null;
  private host: HTMLDivElement | null = null;
  private readonly onResize: () => void;
  private completionPromise: Promise<void> | null = null;
  private resolveCompletion: (() => void) | null = null;
  private completed: boolean = false;
  private loadingSweepTime: number = 0;

  constructor(config: SpineIntroConfig) {
    this.config = config;
    this.displayManager = new DisplayManager(getRuntimeVariant());
    this.onResize = () => {
      if (this.app) {
        this.displayManager.applyRendererResolution(this.app.renderer);
        this.displayManager.applyViewport(this.app.renderer);
      }
      this.layout();
    };
  }

  async start(): Promise<void> {
    this.completed = false;
    this.completionPromise = new Promise((resolve) => {
      this.resolveCompletion = resolve;
    });
    this.host = this.createHost();
    const target = this.displayManager.getTargetResolution();
    this.app = new Application({
      width: target.width,
      height: target.height,
      backgroundAlpha: 1,
      backgroundColor: this.config.backgroundColor,
      antialias: true
    });

    this.host.appendChild(this.app.view as HTMLCanvasElement);
    document.body.appendChild(this.host);
    this.displayManager.applyRendererResolution(this.app.renderer);
    this.displayManager.applyViewport(this.app.renderer);

    const resource = await Assets.load({
      src: this.config.skeletonJsonPath,
      data: {
        spineAtlasFile: this.config.atlasPath
      }
    }) as SpineResource;

    if (this.config.backgroundImagePath) {
      const texture = await Assets.load(this.config.backgroundImagePath);
      this.background = Sprite.from(texture);
      this.background.eventMode = 'none';
      this.app.stage.addChild(this.background);
    }

    await this.setupLoadingBar();

    if (!resource || !resource.spineData) {
      throw new Error(`LegacySpine38IntroPlayer: failed to load spine data from ${this.config.skeletonJsonPath}`);
    }

    this.spine = new Spine(resource.spineData as never);
    this.spine.eventMode = 'none';
    this.app.stage.addChild(this.spine);
    this.playAnimation(resource);
    this.layout();
    this.app.ticker.add(this.updateLoadingBar, this);
    window.addEventListener('resize', this.onResize);
  }

  async destroy(): Promise<void> {
    this.finish();
    window.removeEventListener('resize', this.onResize);

    if (this.app) {
      this.app.ticker.remove(this.updateLoadingBar, this);
    }

    if (this.spine) {
      this.spine.destroy({
        children: true
      });
      this.spine = null;
    }

    if (this.loadingFillBar) {
      this.loadingFillBar.destroy();
      this.loadingFillBar = null;
    }
    if (this.loadingFillMask) {
      this.loadingFillMask.destroy();
      this.loadingFillMask = null;
    }

    if (this.loadingEmptyBar) {
      this.loadingEmptyBar.destroy();
      this.loadingEmptyBar = null;
    }

    if (this.background) {
      this.background.destroy();
      this.background = null;
    }

    if (this.app) {
      this.app.destroy(true, {
        children: true
      });
      this.app = null;
    }

    if (this.host && this.host.parentNode) {
      this.host.parentNode.removeChild(this.host);
    }
    this.host = null;
  }

  private createHost(): HTMLDivElement {
    const host = document.createElement('div');
    host.setAttribute('data-role', 'boot-intro-spine-38');
    host.style.position = 'fixed';
    host.style.inset = '0';
    host.style.zIndex = '9999';
    host.style.pointerEvents = 'none';
    return host;
  }

  private playAnimation(resource: SpineResource): void {
    if (!this.spine) return;
    const animationName = this.resolveAnimationName(resource);
    this.spine.state.setAnimation(0, animationName, this.config.loop);
    if (!this.config.loop) {
      this.spine.state.addListener({
        complete: () => {
          this.finish();
        }
      });
    }
  }

  private resolveAnimationName(resource: SpineResource): string {
    if (this.config.animationName) {
      return this.config.animationName;
    }

    const animations = resource.spineData?.animations;
    if (Array.isArray(animations) && animations[0] && typeof animations[0].name === 'string') {
      return animations[0].name;
    }

    if (animations && typeof animations === 'object') {
      const first = Object.keys(animations)[0];
      if (first) return first;
    }

    return 'animation';
  }

  private layout(): void {
    if (!this.app || !this.spine) return;

    if (this.background) {
      const bgViewport = this.config.viewport?.background;
      this.background.position.set(
        Number.isFinite(bgViewport?.x) ? Number(bgViewport.x) : 0,
        Number.isFinite(bgViewport?.y) ? Number(bgViewport.y) : 0
      );
      this.background.width = Number.isFinite(bgViewport?.width) ? Number(bgViewport.width) : this.app.screen.width;
      this.background.height = Number.isFinite(bgViewport?.height) ? Number(bgViewport.height) : this.app.screen.height;
    }

    if (this.config.layoutMode === 'native-center-top') {
      const bounds = this.spine.getLocalBounds();
      const targetX = Number.isFinite(this.config.viewport?.spine?.x)
        ? Number(this.config.viewport.spine.x)
        : this.app.screen.width * 0.5;
      const targetY = Number.isFinite(this.config.viewport?.spine?.y)
        ? Number(this.config.viewport.spine.y)
        : 0;
      this.spine.scale.set(1);
      this.spine.position.set(
        targetX - (bounds.x + bounds.width * 0.5),
        targetY - bounds.y
      );
      return;
    }

    const bounds = this.spine.getLocalBounds();
    const targetX = Number.isFinite(this.config.viewport?.spine?.x)
      ? Number(this.config.viewport.spine.x)
      : this.app.screen.width * 0.5;
    const targetY = Number.isFinite(this.config.viewport?.spine?.y)
      ? Number(this.config.viewport.spine.y)
      : this.app.screen.height * 0.5;
    const availableWidth = this.app.screen.width * 0.7;
    const availableHeight = this.app.screen.height * 0.28;
    const safeWidth = bounds.width > 0 ? bounds.width : 1;
    const safeHeight = bounds.height > 0 ? bounds.height : 1;
    const scale = Math.min(availableWidth / safeWidth, availableHeight / safeHeight);

    this.spine.scale.set(scale);

    this.spine.position.set(
      targetX - (bounds.x + bounds.width * 0.5) * scale,
      targetY - (bounds.y + bounds.height * 0.5) * scale
    );

    this.layoutLoadingBar();
  }

  async waitForCompletion(): Promise<void> {
    if (this.config.loop) return;
    if (!this.completionPromise) return;
    await this.completionPromise;
  }

  private finish(): void {
    if (this.completed) return;
    this.completed = true;
    const resolve = this.resolveCompletion;
    this.resolveCompletion = null;
    resolve?.();
  }

  private async setupLoadingBar(): Promise<void> {
    if (!this.app || this.config.layoutMode !== 'fit-center') return;

    const atlasPath = this.config.viewport?.loadingBar?.atlasPath;
    if (!atlasPath) return;

    const resource = await Assets.load(atlasPath) as { textures?: Record<string, Texture> };
    const textures = resource && resource.textures ? resource.textures : null;
    const emptyTexture = textures?.['loading_empty.png'] || Texture.from('loading_empty.png');
    const fillTexture = textures?.['loading_full.png'] || Texture.from('loading_full.png');

    if (!emptyTexture || !fillTexture) return;

    this.loadingEmptyBar = new Sprite(emptyTexture);
    this.loadingEmptyBar.eventMode = 'none';
    this.app.stage.addChild(this.loadingEmptyBar);

    this.loadingFillBar = new Sprite(fillTexture);
    this.loadingFillBar.eventMode = 'none';
    this.app.stage.addChild(this.loadingFillBar);

    this.loadingFillMask = new Graphics();
    this.loadingFillMask.eventMode = 'none';
    this.app.stage.addChild(this.loadingFillMask);
    this.loadingFillBar.mask = this.loadingFillMask;

    this.layoutLoadingBar();
  }

  private layoutLoadingBar(): void {
    if (!this.loadingEmptyBar || !this.loadingFillBar) return;

    const cfg = this.config.viewport?.loadingBar;
    const x = Number.isFinite(cfg?.x) ? Number(cfg.x) : 678;
    const y = Number.isFinite(cfg?.y) ? Number(cfg.y) : 408;
    const width = Number.isFinite(cfg?.width) ? Number(cfg.width) : this.loadingEmptyBar.texture.width;
    const height = Number.isFinite(cfg?.height) ? Number(cfg.height) : this.loadingEmptyBar.texture.height;

    this.loadingEmptyBar.position.set(x, y);
    this.loadingEmptyBar.width = width;
    this.loadingEmptyBar.height = height;

    this.loadingFillBar.position.set(x, y);
    this.loadingFillBar.width = width;
    this.loadingFillBar.height = height;
    this.loadingFillMask?.position.set(0, 0);
  }

  private updateLoadingBar(): void {
    if (!this.app || !this.loadingFillBar || !this.loadingEmptyBar) return;

    const cfg = this.config.viewport?.loadingBar;
    const width = Number.isFinite(cfg?.width) ? Number(cfg.width) : this.loadingEmptyBar.width;
    const speed = Number.isFinite(cfg?.sweepSpeed) ? Number(cfg.sweepSpeed) : 420;
    const chunkFraction = Number.isFinite(cfg?.chunkFraction) ? Number(cfg.chunkFraction) : 0.25;
    const deltaSeconds = this.app.ticker.deltaMS / 1000;

    this.loadingSweepTime += deltaSeconds;

    const chunk = Math.max(8, width * chunkFraction);
    const travel = width + chunk;
    const head = (this.loadingSweepTime * speed) % travel - chunk;
    const left = Math.max(0, Math.min(width, head));
    const right = Math.max(0, Math.min(width, head + chunk));
    const visible = Math.max(0, right - left);

    this.loadingFillBar.position.x = this.loadingEmptyBar.position.x;
    this.loadingFillMask?.clear();
    this.loadingFillMask?.beginFill(0xffffff, 1);
    this.loadingFillMask?.drawRect(this.loadingEmptyBar.position.x + left, this.loadingEmptyBar.position.y, visible, this.loadingEmptyBar.height);
    this.loadingFillMask?.endFill();
  }
}
