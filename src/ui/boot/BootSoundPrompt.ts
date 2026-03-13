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
    this.pendingResolve = null;
    this.resolved = false;

    this.visible = false;
    this.eventMode = 'static';
    this.hitArea = new Rectangle(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    this.blocker = new Graphics();
    this.blocker.beginFill(0x000000, 0.92);
    this.blocker.drawRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    this.blocker.endFill();
    this.blocker.eventMode = 'static';
    this.blocker.on('pointertap', () => this.complete('outside'));
    this.addChild(this.blocker);

    this.panel = this.createSprite('loading_sound_bg.png', 611, 297);
    this.logo = this.createSprite('loading_logo.png', 711, 496);

    this.title = new Text({
      text: getLocalizedText(this.game, 'soundTitle', 'PLAY SOUND'),
      style: new TextStyle({
        fontFamily: 'Arial',
        fontSize: 54,
        fill: 0x93a7bf,
        fontWeight: '700',
        align: 'center'
      })
    });
    this.title.anchor.set(0.5, 0);
    this.title.position.set(960, 250);
    this.title.eventMode = 'static';
    this.title.on('pointertap', (event) => {
      event.stopPropagation();
    });
    this.addChild(this.title);

    this.yesButton = this.createButton(
      'loading_sound_button_001.png',
      'loading_sound_button_002.png',
      665,
      341,
      getLocalizedText(this.game, 'soundYes', 'YES'),
      () => this.complete('yes')
    );
    this.noButton = this.createButton(
      'loading_sound_button_001.png',
      'loading_sound_button_002.png',
      988,
      341,
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
        fontFamily: 'Arial',
        fontSize: 44,
        fill: 0xbee1f5,
        fontWeight: '700',
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
    try {
      return Texture.from(frameName);
    } catch {
      return null;
    }
  }
}
