import { Assets, Cache, Container, Sprite, Text, TextStyle, Texture } from 'pixi.js';
import { GameplayEvent } from '../architecture/gameplay/GameplayStateMachine';
import type BaseGame from '../core/BaseGame';
import { APP_FONT_FAMILY, APP_FONT_WEIGHT_REGULAR } from '../config/fontConfig';
import { formatMoneyByGame, getGameCurrency, getLocalizedText } from './uiTextFormat';

const STAGE_HEIGHT = 1080;

function toNumber(value: unknown, fallback = 0): number {
  return Number.isFinite(value) ? Number(value) : fallback;
}

type PushButton = {
  root: Sprite;
  setEnabled: (enabled: boolean) => void;
};

export default class BuyBonusConfirm extends Container {
  private readonly game: BaseGame & Record<string, any>;
  private readonly onReject: () => void;

  private readonly title: Text;
  private readonly panel: Sprite;
  private readonly freeSymbol: Sprite | null;
  private readonly hawSymbol: Sprite | null;
  private readonly yesButton: PushButton | null;
  private readonly noButton: PushButton | null;

  private bonusType = 0;
  private bonusCost = 0;
  private readonly config: any;
  private readonly textureCache = new Map<string, Texture | null>();

  constructor(game: BaseGame, onReject: () => void, hudConfig?: any) {
    super();
    this.game = game as BaseGame & Record<string, any>;
    this.onReject = onReject;
    this.config = this.resolveConfig(hudConfig && hudConfig.buyBonusConfirm);

    this.createMenuBackground();
    this.createSprite('logo.png', 20, 6, false);

    this.panel = new Sprite(Texture.EMPTY);
    this.panel.eventMode = 'static';
    this.addChild(this.panel);
    void this.resolvePanelTexture();

    this.freeSymbol = this.createSprite('book_blur_01.png', 782, 581);
    this.hawSymbol = this.createSprite('mega_blur_01.png', 811, 566);

    this.title = new Text({
      text: '',
      style: new TextStyle({
        fontFamily: APP_FONT_FAMILY,
        fontSize: toNumber(this.config.texts?.title?.fontSize, 54),
        fill: 0xbee1f5,
        fontWeight: APP_FONT_WEIGHT_REGULAR,
        align: 'center',
        wordWrap: true,
        wordWrapWidth: toNumber(this.config.texts?.title?.wordWrapWidth, 930)
      })
    });
    this.title.anchor.set(0.5, 0);
    this.title.position.set(960, toNumber(this.config.texts?.title?.y, 345));
    this.addChild(this.title);

    this.yesButton = this.createButton('b_yes_001.png', 'b_yes_002.png', 665, 331, () => this.accept());
    this.noButton = this.createButton('b_no_001.png', 'b_no_002.png', 988, 331, () => this.reject());

    const yesText = this.createButtonLabel(getLocalizedText(this.game, 'soundYes', 'YES'));
    const noText = this.createButtonLabel(getLocalizedText(this.game, 'soundNo', 'NO'));

    if (this.yesButton) {
      yesText.position.set(this.yesButton.root.width / 2, this.yesButton.root.height / 2);
      this.yesButton.root.addChild(yesText);
    }
    if (this.noButton) {
      noText.position.set(this.noButton.root.width / 2, this.noButton.root.height / 2);
      this.noButton.root.addChild(noText);
    }

    this.visible = false;
  }

  isOpen(): boolean {
    return this.visible;
  }

  show(type: 0 | 1, cost: number): void {
    this.bonusType = type;
    this.bonusCost = Math.max(0, Number.isFinite(cost) ? cost : 0);

    this.game.context.hasBuyBonus = false;

    const featureLabel = type === 0
      ? getLocalizedText(this.game, 'freeGameTxt', 'FREE GAMES')
      : getLocalizedText(this.game, 'holdAndWinTxt', 'HOLD AND WIN');

    this.title.text = `${getLocalizedText(this.game, 'buyTxt', 'BUY')}\n${featureLabel}\n${formatMoneyByGame(this.bonusCost, this.game)} ${getGameCurrency(this.game)}`;

    if (this.freeSymbol) this.freeSymbol.visible = type === 0;
    if (this.hawSymbol) this.hawSymbol.visible = type === 1;
    this.placeLegacyDisplay(this.title, 960, 585);

    this.visible = true;
  }

  hide(): void {
    this.visible = false;
  }

  private accept(): void {
    if (!this.game?.context) return;

    this.game.context.buyBonusType = this.bonusType;
    this.game.context.hasBuyBonus = true;

    this.hide();
    if (this.game?.controller) {
      this.game.controller.event = GameplayEvent.START;
    }
  }

  private reject(): void {
    if (this.game?.context) {
      this.game.context.hasBuyBonus = false;
    }
    this.hide();
    this.onReject();
  }

  private createButtonLabel(value: string): Text {
    const text = new Text({
      text: value,
      style: new TextStyle({
        fontFamily: APP_FONT_FAMILY,
        fontSize: 60,
        fill: 0xbee1f5,
        fontWeight: APP_FONT_WEIGHT_REGULAR,
        align: 'center'
      })
    });
    text.anchor.set(0.5, 0.5);
    return text;
  }

  private createSprite(frameName: string, x: number, y: number, legacyY = true): Sprite | null {
    const texture = this.getTexture(frameName);
    if (!texture) return null;
    const sprite = new Sprite(texture);
    if (legacyY) {
      this.placeLegacyDisplay(sprite, x, y);
    } else {
      sprite.position.set(x, y);
    }
    this.addChild(sprite);
    return sprite;
  }

  private createButton(normalFrame: string, pressedFrame: string, x: number, y: number, onRelease: () => void): PushButton | null {
    const normal = this.getTexture(normalFrame);
    if (!normal) return null;
    const pressed = this.getTexture(pressedFrame) || normal;

    const root = new Sprite(normal);
    this.placeLegacyDisplay(root, x, y);
    root.eventMode = 'static';
    root.cursor = 'pointer';

    let enabled = true;
    let isDown = false;

    const refresh = () => {
      root.texture = isDown ? pressed : normal;
      root.alpha = enabled ? 1 : 0.6;
      root.eventMode = enabled ? 'static' : 'none';
    };

    root.on('pointerdown', () => {
      if (!enabled) return;
      isDown = true;
      refresh();
    });

    root.on('pointerup', () => {
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
    if (this.textureCache.has(frameName)) {
      return this.textureCache.get(frameName) ?? null;
    }

    const slash = frameName.lastIndexOf('/');
    const baseName = slash >= 0 ? frameName.slice(slash + 1) : frameName;
    const candidates = [frameName];

    if (baseName !== frameName) {
      candidates.push(baseName);
    }

    if (baseName === 'bg_menu.png') {
      candidates.push('assets/ui/bg_menu.png');
    }

    if (baseName === 'confirmation_bg.png') {
      candidates.push('assets/desktop/ui/confirmation_bg.png');
      candidates.push('/assets/desktop/ui/confirmation_bg.png');
      candidates.push('assets/ui/confirmation_bg.png');
      candidates.push('/assets/ui/confirmation_bg.png');
    }

    for (let i = 0; i < candidates.length; i += 1) {
      const key = candidates[i];
      if (!Cache.has(key)) {
        continue;
      }

      const texture = Texture.from(key);
      if (texture && texture !== Texture.EMPTY) {
        this.textureCache.set(frameName, texture);
        return texture;
      }
    }

    this.textureCache.set(frameName, null);
    return null;
  }

  private createMenuBackground(): void {
    const bg = new Sprite(Texture.WHITE);
    bg.position.set(toNumber(this.config.background?.x, 0), toNumber(this.config.background?.y, 0));
    bg.width = toNumber(this.config.background?.width, 1920);
    bg.height = toNumber(this.config.background?.height, 1080);
    bg.alpha = 0;
    bg.eventMode = 'static';
    this.addChild(bg);

    void this.resolveMenuBackground(bg);
  }

  private async resolveMenuBackground(target: Sprite): Promise<void> {
    const candidates = [
      'assets/backgrounds/bg_menu.png',
      '/assets/backgrounds/bg_menu.png',
      'assets/ui/bg_menu.png',
      '/assets/ui/bg_menu.png'
    ];

    for (let i = 0; i < candidates.length; i += 1) {
      const key = candidates[i];
      let texture = Texture.EMPTY;
      if (Cache.has(key)) {
        texture = Texture.from(key);
      } else {
        try {
          texture = await Assets.load(key);
        } catch (_err) {
          texture = Texture.EMPTY;
        }
      }

      if (texture && texture !== Texture.EMPTY) {
        target.texture = texture;
        target.alpha = 1;
        target.width = toNumber(this.config.background?.width, 1920);
        target.height = toNumber(this.config.background?.height, 1080);
        return;
      }
    }
  }

  private resolveConfig(input: any): any {
    const fallback = {
      background: { x: 0, y: 0, width: 1920, height: 1080 },
      panel: { x: 465, y: 240 },
      symbols: {
        free: { x: 782, y: 581 },
        haw: { x: 811, y: 566 }
      },
      buttons: {
        yes: { x: 665, y: 331 },
        no: { x: 988, y: 331 }
      },
      texts: {
        title: { x: 960, y: 345, fontSize: 54, wordWrapWidth: 930 }
      }
    };

    const cfg = input && typeof input === 'object' ? input : {};
    return {
      background: { ...fallback.background, ...(cfg.background || {}) },
      panel: { ...fallback.panel, ...(cfg.panel || {}) },
      symbols: {
        free: { ...fallback.symbols.free, ...((cfg.symbols && cfg.symbols.free) || {}) },
        haw: { ...fallback.symbols.haw, ...((cfg.symbols && cfg.symbols.haw) || {}) }
      },
      buttons: {
        yes: { ...fallback.buttons.yes, ...((cfg.buttons && cfg.buttons.yes) || {}) },
        no: { ...fallback.buttons.no, ...((cfg.buttons && cfg.buttons.no) || {}) }
      },
      texts: {
        title: { ...fallback.texts.title, ...((cfg.texts && cfg.texts.title) || {}) }
      }
    };
  }

  private placeLegacyDisplay(target: { height: number; position: { set: (x: number, y: number) => void }; anchor?: { y: number } }, x: number, legacyBottomY: number): void {
    const anchorY = target.anchor && Number.isFinite(target.anchor.y) ? Number(target.anchor.y) : 0;
    const y = STAGE_HEIGHT - legacyBottomY - (target.height * (1 - anchorY));
    target.position.set(x, y);
  }

  private async resolvePanelTexture(): Promise<void> {
    const candidates = [
      'assets/desktop/ui/confirmation_bg.png',
      '/assets/desktop/ui/confirmation_bg.png',
      'assets/ui/confirmation_bg.png',
      '/assets/ui/confirmation_bg.png'
    ];

    for (let i = 0; i < candidates.length; i += 1) {
      const key = candidates[i];
      let texture = Texture.EMPTY;
      if (Cache.has(key)) {
        texture = Texture.from(key);
      } else {
        try {
          texture = await Assets.load(key);
        } catch (_err) {
          texture = Texture.EMPTY;
        }
      }

      if (texture && texture !== Texture.EMPTY) {
        this.panel.texture = texture;
        this.placeLegacyDisplay(this.panel, 465, 240);
        return;
      }
    }
  }
}

