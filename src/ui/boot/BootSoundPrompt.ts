import {
  Container,
  Graphics,
  Rectangle,
  Sprite,
  Text,
  TextStyle,
  Texture,
  type FederatedPointerEvent
} from 'pixi.js';
import type BaseGame from '../../core/BaseGame';
import { SOUND_IDS } from '../../config/soundConfig';
import { getUiHudConfig } from '../../config/assetsConfig';
import { APP_FONT_FAMILY, APP_FONT_WEIGHT_REGULAR } from '../../config/fontConfig';
import { getAssetsManifest } from '../../core/RuntimeContext';
import { getAssetManager, getTextureCache } from '../../core/RuntimeContext';
import { getLocalizedText } from '../uiTextFormat';

type PromptSelection = 'yes' | 'no' | 'outside';

type PushButton = {
  root: Sprite;
  setEnabled: (enabled: boolean) => void;
};

const SCREEN_WIDTH = 1920;
const SCREEN_HEIGHT = 1080;

export default class BootSoundPrompt extends Container {
  private readonly game: BaseGame & Record<string, any>;
  private readonly config: any;
  private readonly blocker: Graphics;
  private readonly panel: Sprite | null;
  private readonly logo: Sprite | null;
  private readonly title: Text;
  private readonly yesButton: PushButton | null;
  private readonly noButton: PushButton | null;
  private pendingResolve: ((enabled: boolean) => void) | null;
  private resolved: boolean;

  constructor(game: BaseGame) {
    super();
    this.game = game as BaseGame & Record<string, any>;
    this.config = getUiHudConfig(getAssetsManifest()).bootSoundPrompt || {};
    this.pendingResolve = null;
    this.resolved = false;

    this.visible = false;
    this.eventMode = 'static';
    this.hitArea = new Rectangle(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    this.blocker = new Graphics();
    this.blocker.beginFill(0x000000, this.toNumber(this.config.background?.alpha, 0.92));
    this.blocker.drawRect(
      this.toNumber(this.config.background?.x, 0),
      this.toNumber(this.config.background?.y, 0),
      this.toNumber(this.config.background?.width, SCREEN_WIDTH),
      this.toNumber(this.config.background?.height, SCREEN_HEIGHT)
    );
    this.blocker.endFill();
    this.blocker.eventMode = 'static';
    this.blocker.on('pointertap', () => this.complete('outside'));
    this.addChild(this.blocker);

    this.panel = this.createSprite('loading_sound_bg.png', this.toNumber(this.config.panel?.x, 611), this.toNumber(this.config.panel?.y, 297));
    this.logo = this.createSprite('loading_logo.png', this.toNumber(this.config.logo?.x, 711), this.toNumber(this.config.logo?.y, 496));

    this.title = new Text({
      text: getLocalizedText(this.game, 'soundTitle', 'PLAY SOUND'),
      style: new TextStyle({
        fontFamily: APP_FONT_FAMILY,
        fontSize: this.toNumber(this.config.texts?.title?.fontSize, 54),
        fill: 0x93a7bf,
        fontWeight: APP_FONT_WEIGHT_REGULAR,
        align: 'center'
      })
    });
    this.title.anchor.set(0.5, 0);
    this.title.position.set(this.toNumber(this.config.texts?.title?.x, 960), this.toNumber(this.config.texts?.title?.y, 250));
    this.title.eventMode = 'static';
    this.title.on('pointertap', (event) => {
      event.stopPropagation();
    });
    this.addChild(this.title);

    this.yesButton = this.createButton(
      'loading_sound_button_001.png',
      'loading_sound_button_002.png',
      this.toNumber(this.config.buttons?.yes?.x, 665),
      this.toNumber(this.config.buttons?.yes?.y, 341),
      getLocalizedText(this.game, 'soundYes', 'YES'),
      () => this.complete('yes')
    );
    this.noButton = this.createButton(
      'loading_sound_button_001.png',
      'loading_sound_button_002.png',
      this.toNumber(this.config.buttons?.no?.x, 988),
      this.toNumber(this.config.buttons?.no?.y, 341),
      getLocalizedText(this.game, 'soundNo', 'NO'),
      () => this.complete('no')
    );
  }

  present(): Promise<boolean> {
    this.visible = true;
    this.interactiveChildren = true;
    this.resolved = false;
    return new Promise((resolve) => {
      this.pendingResolve = resolve;
    });
  }

  lock(): void {
    this.interactiveChildren = false;
    this.blocker.eventMode = 'none';
    this.yesButton?.setEnabled(false);
    this.noButton?.setEnabled(false);
  }

  override destroy(options?: Parameters<Container['destroy']>[0]): void {
    this.pendingResolve = null;
    super.destroy(options);
  }

  private complete(selection: PromptSelection): void {
    if (this.resolved) return;
    this.resolved = true;

    const enabled = selection !== 'no';
    const soundSystem = this.game.soundSystem;
    const settings = this.game.settings;

    if (selection === 'yes') {
      soundSystem?.play(SOUND_IDS.KNOCK);
    }

    if (selection === 'no') {
      soundSystem?.play(SOUND_IDS.KNOCK);
    }

    settings?.set('audioEnabled', enabled);
    soundSystem?.setEnabled(enabled);

    if (enabled) {
      soundSystem?.play(SOUND_IDS.SPIN_BACKGROUND, true);
    } else {
      soundSystem?.stop(SOUND_IDS.SPIN_BACKGROUND);
    }

    this.lock();
    const resolve = this.pendingResolve;
    this.pendingResolve = null;
    resolve?.(enabled);
  }

  private createSprite(frameName: string, x: number, y: number): Sprite | null {
    const texture = this.getTexture(frameName);
    if (!texture) return null;

    const sprite = new Sprite(texture);
    sprite.position.set(x, y);
    sprite.eventMode = 'static';
    sprite.on('pointertap', (event) => {
      event.stopPropagation();
    });
    this.addChild(sprite);
    return sprite;
  }

  private createButton(
    normalFrame: string,
    pressedFrame: string,
    x: number,
    y: number,
    label: string,
    onRelease: () => void
  ): PushButton | null {
    const normal = this.getTexture(normalFrame);
    if (!normal) return null;
    const pressed = this.getTexture(pressedFrame) || normal;

    const root = new Sprite(normal);
    root.position.set(x, y);
    root.eventMode = 'static';
    root.cursor = 'pointer';

    const text = new Text({
      text: label,
      style: new TextStyle({
        fontFamily: APP_FONT_FAMILY,
        fontSize: 44,
        fill: 0xbee1f5,
        fontWeight: APP_FONT_WEIGHT_REGULAR,
        align: 'center'
      })
    });
    text.anchor.set(0.5, 0.5);
    text.position.set(root.width / 2, root.height / 2);
    root.addChild(text);

    let enabled = true;
    let isDown = false;

    const refresh = () => {
      root.texture = isDown ? pressed : normal;
      root.alpha = enabled ? 1 : 0.75;
      root.eventMode = enabled ? 'static' : 'none';
    };

    root.on('pointerdown', (event: FederatedPointerEvent) => {
      event.stopPropagation();
      if (!enabled) return;
      isDown = true;
      refresh();
    });

    root.on('pointerup', (event: FederatedPointerEvent) => {
      event.stopPropagation();
      if (!enabled || !isDown) return;
      isDown = false;
      refresh();
      onRelease();
    });

    root.on('pointerupoutside', () => {
      if (!enabled) return;
      isDown = false;
      refresh();
    });

    root.on('pointertap', (event: FederatedPointerEvent) => {
      event.stopPropagation();
    });

    this.addChild(root);
    refresh();

    return {
      root,
      setEnabled: (value: boolean) => {
        enabled = !!value;
        isDown = false;
        refresh();
      }
    };
  }

  private getTexture(frameName: string): Texture | null {
    const manager = getAssetManager();
    const cachedTexture = manager?.getTexture(frameName) || getTextureCache()[frameName] || null;
    if (cachedTexture) return cachedTexture;

    try {
      const texture = Texture.from(frameName);
      return texture && texture !== Texture.EMPTY ? texture : null;
    } catch {
      return null;
    }
  }

  private toNumber(value: unknown, fallback: number): number {
    return Number.isFinite(value) ? Number(value) : fallback;
  }
}
