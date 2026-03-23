import { Application, Assets, Graphics, Rectangle, Sprite, Text, TextStyle, Texture } from 'pixi7';
import { Spine } from 'pixi-spine';
import type { SpineIntroConfig } from '../config/introConfig';
import type { IntroPlayer } from './types';
import DisplayManager from '../core/display/DisplayManager';
import { getRuntimeVariant } from '../config/runtimeConfig';
import { APP_FONT_FAMILY, APP_FONT_WEIGHT_REGULAR } from '../config/fontConfig';
import { warn } from '../core/utils/logger';
import { fitPixiTextToBounds } from '../ui/utils/fitText';

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
  private skipPromptLabel: Text | null = null;
  private host: HTMLDivElement | null = null;
  private readonly onResize: () => void;
  private completionPromise: Promise<void> | null = null;
  private resolveCompletion: (() => void) | null = null;
  private completed: boolean = false;
  private loadingSweepTime: number = 0;
  private skipPromptElapsed: number = 0;

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
    this.configurePointerHandling();
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
    this.setupSkipPrompt();
    this.layout();
    this.app.ticker.add(this.updateLoadingBar, this);
    this.app.ticker.add(this.updateSkipPrompt, this);
    window.addEventListener('resize', this.onResize);
  }

  async destroy(): Promise<void> {
    this.finish();
    window.removeEventListener('resize', this.onResize);

    if (this.app) {
      this.app.ticker.remove(this.updateLoadingBar, this);
      this.app.ticker.remove(this.updateSkipPrompt, this);
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
    if (this.skipPromptLabel) {
      this.skipPromptLabel.destroy();
      this.skipPromptLabel = null;
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
      const explicitScale = Number.isFinite(this.config.viewport?.spine?.scale)
        ? Number(this.config.viewport.spine.scale)
        : 1;
      this.spine.scale.set(explicitScale);
      this.spine.pivot.set(bounds.x + bounds.width * 0.5, bounds.y);
      this.spine.position.set(targetX, targetY);
      this.alignSpineToTarget(targetX, targetY, 'top-center');
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
    const explicitScale = Number.isFinite(this.config.viewport?.spine?.scale)
      ? Number(this.config.viewport.spine.scale)
      : null;
    const scale = explicitScale ?? Math.min(availableWidth / safeWidth, availableHeight / safeHeight);

    this.spine.scale.set(scale);
    this.spine.pivot.set(bounds.x + bounds.width * 0.5, bounds.y + bounds.height * 0.5);
    this.spine.position.set(targetX, targetY);
    this.alignSpineToTarget(targetX, targetY, 'center');

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

  private configurePointerHandling(): void {
    if (!this.host || !this.app) return;

    const skipEnabled = !!this.config.skipPrompt?.enabled;
    this.host.style.pointerEvents = skipEnabled ? 'auto' : 'none';
    if (!skipEnabled) return;

    this.app.stage.eventMode = 'static';
    this.app.stage.hitArea = new Rectangle(0, 0, this.app.screen.width, this.app.screen.height);
    this.app.stage.on('pointertap', () => {
      if (!this.skipPromptLabel || !this.skipPromptLabel.visible) return;
      this.finish();
    });
  }

  private setupSkipPrompt(): void {
    if (!this.app || !this.config.skipPrompt?.enabled) return;

    const prompt = this.config.skipPrompt;
    this.skipPromptElapsed = 0;
    this.skipPromptLabel = new Text(
      prompt.text || 'TAP TO CONTINUE',
      new TextStyle({
        fontFamily: APP_FONT_FAMILY,
        fontSize: Number.isFinite(prompt.fontSize) ? Number(prompt.fontSize) : 60,
        fill: Number.isFinite(prompt.color) ? Number(prompt.color) : 0xffffff,
        align: 'center',
        fontWeight: APP_FONT_WEIGHT_REGULAR
      })
    );
    this.skipPromptLabel.anchor.set(0.5, 0.5);
    this.skipPromptLabel.position.set(
      Number.isFinite(prompt.x) ? Number(prompt.x) : this.app.screen.width * 0.5,
      Number.isFinite(prompt.y) ? Number(prompt.y) : this.app.screen.height * 0.57
    );
    this.skipPromptLabel.visible = false;
    this.skipPromptLabel.eventMode = 'none';
    fitPixiTextToBounds(this.skipPromptLabel, {
      maxWidth: Number.isFinite(prompt.maxWidth) ? Number(prompt.maxWidth) : 900,
      minFontSize: 24
    });
    this.app.stage.addChild(this.skipPromptLabel);
  }

  private async setupLoadingBar(): Promise<void> {
    if (!this.app || this.config.layoutMode !== 'fit-center') return;

    const atlasPath = this.config.viewport?.loadingBar?.atlasPath;
    if (!atlasPath) return;

    let resource: { textures?: Record<string, Texture> } | null = null;
    try {
      resource = await Assets.load(atlasPath) as { textures?: Record<string, Texture> };
    } catch (error) {
      warn(`LegacySpine38IntroPlayer::skipLoadingBar ${error instanceof Error ? error.message : String(error)}`);
      return;
    }

    const textures = resource && resource.textures ? resource.textures : null;
    const emptyTexture = textures?.['loading_empty.png'] || this.tryGetTexture('loading_empty.png');
    const fillTexture = textures?.['loading_full.png'] || this.tryGetTexture('loading_full.png');

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

  private tryGetTexture(frameName: string): Texture | null {
    try {
      const texture = Texture.from(frameName);
      return texture && texture !== Texture.EMPTY ? texture : null;
    } catch {
      return null;
    }
  }

  private layoutLoadingBar(): void {
    if (!this.loadingEmptyBar || !this.loadingFillBar) return;

    const cfg = this.config.viewport?.loadingBar;
    const width = Number.isFinite(cfg?.width) ? Number(cfg.width) : this.loadingEmptyBar.texture.width;
    const height = Number.isFinite(cfg?.height) ? Number(cfg.height) : this.loadingEmptyBar.texture.height;
    const offsetX = Number.isFinite(cfg?.x) ? Number(cfg.x) : 0;
    const offsetY = Number.isFinite(cfg?.y) ? Number(cfg.y) : 36;

    let x = offsetX;
    let y = offsetY;

    if (this.spine && this.config.layoutMode === 'fit-center') {
      const globalBounds = this.spine.getBounds();
      const visualBottom = globalBounds.y + globalBounds.height;
      x = globalBounds.x + globalBounds.width * 0.5 - width * 0.5 + offsetX;
      y = visualBottom + offsetY;
    }

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

  private updateSkipPrompt(): void {
    if (!this.app || !this.skipPromptLabel || !this.config.skipPrompt?.enabled) return;

    this.skipPromptElapsed += this.app.ticker.deltaMS / 1000;
    const prompt = this.config.skipPrompt;
    const delaySec = Number.isFinite(prompt.delaySec) ? Number(prompt.delaySec) : 1.2;
    if (this.skipPromptElapsed < delaySec) {
      this.skipPromptLabel.visible = false;
      return;
    }

    this.skipPromptLabel.visible = true;
    const minAlpha = Number.isFinite(prompt.minAlpha) ? Number(prompt.minAlpha) : 0.15;
    const maxAlpha = Number.isFinite(prompt.maxAlpha) ? Number(prompt.maxAlpha) : 1;
    const pulse = (Math.sin((this.skipPromptElapsed - delaySec) * Math.PI * 2) + 1) * 0.5;
    this.skipPromptLabel.alpha = minAlpha + (maxAlpha - minAlpha) * pulse;
  }

  private alignSpineToTarget(targetX: number, targetY: number, mode: 'center' | 'top-center'): void {
    if (!this.spine) return;

    const globalBounds = this.spine.getBounds();
    const currentCenterX = globalBounds.x + globalBounds.width * 0.5;
    const currentCenterY = globalBounds.y + globalBounds.height * 0.5;
    const currentTopY = globalBounds.y;
    const offsetX = Number.isFinite(this.config.viewport?.spine?.offsetX)
      ? Number(this.config.viewport?.spine?.offsetX)
      : 0;
    const offsetY = Number.isFinite(this.config.viewport?.spine?.offsetY)
      ? Number(this.config.viewport?.spine?.offsetY)
      : 0;

    this.spine.position.x += targetX - currentCenterX + offsetX;
    this.spine.position.y += mode === 'top-center'
      ? targetY - currentTopY + offsetY
      : targetY - currentCenterY + offsetY;
  }
}
