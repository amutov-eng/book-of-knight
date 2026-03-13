import { Application, Assets } from 'pixi7';
import { Spine } from 'pixi-spine';
import type { SpineIntroConfig } from '../config/introConfig';
import type { IntroPlayer } from './types';

type SpineResource = {
  spineData?: {
    animations?: Array<{ name?: string }> | Record<string, unknown>;
  };
};

export default class LegacySpine38IntroPlayer implements IntroPlayer {
  private readonly config: SpineIntroConfig;
  private app: Application | null = null;
  private spine: Spine | null = null;
  private host: HTMLDivElement | null = null;
  private readonly onResize: () => void;

  constructor(config: SpineIntroConfig) {
    this.config = config;
    this.onResize = () => {
      this.layout();
    };
  }

  async start(): Promise<void> {
    this.host = this.createHost();
    this.app = new Application({
      resizeTo: window,
      backgroundAlpha: 1,
      backgroundColor: this.config.backgroundColor,
      antialias: true
    });

    this.host.appendChild(this.app.view as HTMLCanvasElement);
    document.body.appendChild(this.host);

    const resource = await Assets.load({
      src: this.config.skeletonJsonPath,
      data: {
        spineAtlasFile: this.config.atlasPath
      }
    }) as SpineResource;

    if (!resource || !resource.spineData) {
      throw new Error(`LegacySpine38IntroPlayer: failed to load spine data from ${this.config.skeletonJsonPath}`);
    }

    this.spine = new Spine(resource.spineData as never);
    this.spine.eventMode = 'none';
    this.app.stage.addChild(this.spine);
    this.playAnimation(resource);
    this.layout();
    window.addEventListener('resize', this.onResize);
  }

  async destroy(): Promise<void> {
    window.removeEventListener('resize', this.onResize);

    if (this.spine) {
      this.spine.destroy({
        children: true
      });
      this.spine = null;
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
    host.style.background = '#000';
    return host;
  }

  private playAnimation(resource: SpineResource): void {
    if (!this.spine) return;
    const animationName = this.resolveAnimationName(resource);
    this.spine.state.setAnimation(0, animationName, this.config.loop);
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

    const bounds = this.spine.getLocalBounds();
    const availableWidth = this.app.screen.width * 0.7;
    const availableHeight = this.app.screen.height * 0.28;
    const safeWidth = bounds.width > 0 ? bounds.width : 1;
    const safeHeight = bounds.height > 0 ? bounds.height : 1;
    const scale = Math.min(availableWidth / safeWidth, availableHeight / safeHeight);

    this.spine.scale.set(scale);

    const scaledBounds = this.spine.getLocalBounds();
    this.spine.position.set(
      this.app.screen.width * 0.5 - (scaledBounds.x + scaledBounds.width * 0.5) * scale,
      this.app.screen.height * 0.5 - (scaledBounds.y + scaledBounds.height * 0.5) * scale
    );
  }
}
