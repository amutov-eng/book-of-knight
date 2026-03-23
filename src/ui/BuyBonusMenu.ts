import { Assets, Cache, Container, Sprite, Text, TextStyle, Texture } from 'pixi.js';
import type BaseGame from '../core/BaseGame';
import { APP_FONT_FAMILY, APP_FONT_WEIGHT_LIGHT, APP_FONT_WEIGHT_REGULAR } from '../config/fontConfig';
import { formatMoneyByGame, getGameCurrency, getLocalizedText } from './uiTextFormat';
import { fitPixiTextToBounds } from './utils/fitText';

const STAGE_HEIGHT = 1080;

type BuyType = 0 | 1;

type ButtonVisualState = 'normal' | 'pressed' | 'disabled';

type PushButton = {
  root: Sprite;
  setEnabled: (enabled: boolean) => void;
  setLabelState: (state: ButtonVisualState) => void;
};

function toNumber(value: unknown, fallback = 0): number {
  return Number.isFinite(value) ? Number(value) : fallback;
}

export default class BuyBonusMenu extends Container {
  private readonly game: BaseGame & Record<string, any>;
  private readonly onClose: () => void;
  private readonly onRequestConfirm: (type: BuyType, cost: number) => void;

  private readonly titleText: Text;
  private readonly totalBetLabel: Text;
  private readonly totalBetValue: Text;
  private readonly freeTitle: Text;
  private readonly hawTitle: Text;
  private readonly freePrice: Text;
  private readonly hawPrice: Text;

  private readonly freePanelDisabled: Sprite | null;
  private readonly hawPanelDisabled: Sprite | null;
  private readonly freePanelActive: Sprite | null;
  private readonly hawPanelActive: Sprite | null;
  private readonly freeSymbol: Sprite | null;
  private readonly hawSymbol: Sprite | null;

  private readonly plusButton: PushButton | null;
  private readonly minusButton: PushButton | null;
  private readonly closeButton: PushButton | null;
  private readonly freeBuyButton: PushButton | null;
  private readonly hawBuyButton: PushButton | null;

  private readonly freeBuyLabel: Text;
  private readonly hawBuyLabel: Text;

  private currentValue = 0;
  private readonly config: any;
  private readonly textureCache = new Map<string, Texture | null>();
  private lastRefreshKey = '';

  constructor(
    game: BaseGame,
    onClose: () => void,
    onRequestConfirm: (type: BuyType, cost: number) => void,
    hudConfig?: any
  ) {
    super();

    this.game = game as BaseGame & Record<string, any>;
    this.onClose = onClose;
    this.onRequestConfirm = onRequestConfirm;
    this.config = this.resolveConfig(hudConfig && hudConfig.buyBonusMenu);

    this.createMenuBackground();
    this.createSprite('logo.png', 20, 6, false);

    this.freePanelDisabled = this.createSprite('b_bg_disable.png', 420, 190);
    this.hawPanelDisabled = this.createSprite('b_bg_disable.png', 989, 190);
    this.freePanelActive = this.createSprite('b_bg_active.png', 420, 190);
    this.hawPanelActive = this.createSprite('b_bg_active.png', 989, 190);

    this.titleText = this.createText('', toNumber(this.config.texts?.title?.x, 960), toNumber(this.config.texts?.title?.y, 40), {
      fontFamily: APP_FONT_FAMILY,
      fontSize: toNumber(this.config.texts?.title?.fontSize, 60),
      fill: 0x93a7bf,
      fontWeight: APP_FONT_WEIGHT_REGULAR,
      align: 'center',
      anchorX: 0.5,
      anchorY: 0
    });

    this.freeSymbol = this.createSprite('book_blur_01.png', 493, 605);
    this.hawSymbol = this.createSprite('mega_blur_01.png', 1100, 590);

    this.freeTitle = this.createText('', toNumber(this.config.texts?.freeTitle?.x, 672), toNumber(this.config.texts?.freeTitle?.y, 560), {
      fontFamily: APP_FONT_FAMILY,
      fontSize: toNumber(this.config.texts?.freeTitle?.fontSize, 54),
      fill: 0xff9d2d,
      fontWeight: APP_FONT_WEIGHT_REGULAR,
      align: 'center',
      anchorX: 0.5,
      anchorY: 0
    });

    this.hawTitle = this.createText('', toNumber(this.config.texts?.hawTitle?.x, 1241), toNumber(this.config.texts?.hawTitle?.y, 560), {
      fontFamily: APP_FONT_FAMILY,
      fontSize: toNumber(this.config.texts?.hawTitle?.fontSize, 54),
      fill: 0xff9d2d,
      fontWeight: APP_FONT_WEIGHT_REGULAR,
      align: 'center',
      anchorX: 0.5,
      anchorY: 0
    });

    this.freePrice = this.createText('', toNumber(this.config.texts?.freePrice?.x, 672), toNumber(this.config.texts?.freePrice?.y, 465), {
      fontFamily: APP_FONT_FAMILY,
      fontSize: toNumber(this.config.texts?.freePrice?.fontSize, 54),
      fill: 0x93a7bf,
      fontWeight: APP_FONT_WEIGHT_REGULAR,
      align: 'center',
      anchorX: 0.5,
      anchorY: 0
    });

    this.hawPrice = this.createText('', toNumber(this.config.texts?.hawPrice?.x, 1241), toNumber(this.config.texts?.hawPrice?.y, 465), {
      fontFamily: APP_FONT_FAMILY,
      fontSize: toNumber(this.config.texts?.hawPrice?.fontSize, 54),
      fill: 0x93a7bf,
      fontWeight: APP_FONT_WEIGHT_LIGHT,
      align: 'center',
      anchorX: 0.5,
      anchorY: 0
    });

    const betBg = this.createSprite('bet_value.png', 703, 86);
    if (betBg) this.addChild(betBg);

    this.totalBetLabel = this.createText('', toNumber(this.config.texts?.totalBetLabel?.x, 956), toNumber(this.config.texts?.totalBetLabel?.y, 206), {
      fontFamily: APP_FONT_FAMILY,
      fontSize: toNumber(this.config.texts?.totalBetLabel?.fontSize, 46),
      fill: 0xbee1f5,
      fontWeight: APP_FONT_WEIGHT_LIGHT,
      align: 'center',
      anchorX: 0.5,
      anchorY: 0.5
    });

    this.totalBetValue = this.createText('', toNumber(this.config.texts?.totalBetValue?.x, 956), toNumber(this.config.texts?.totalBetValue?.y, 139), {
      fontFamily: APP_FONT_FAMILY,
      fontSize: toNumber(this.config.texts?.totalBetValue?.fontSize, 46),
      fill: 0xbee1f5,
      fontWeight: APP_FONT_WEIGHT_LIGHT,
      align: 'center',
      anchorX: 0.5,
      anchorY: 0.5
    });

    this.plusButton = this.createButton('plus_001.png', 'plus_002.png', '', 1068, 78, () => {
      if (!this.game?.meters) return;
      this.game.meters.incrementBetPerLine();
      this.onMetersChanged();
    });

    this.minusButton = this.createButton('minus_001.png', 'minus_002.png', '', 709, 78, () => {
      if (!this.game?.meters) return;
      this.game.meters.decrementBetPerLine();
      this.onMetersChanged();
    });

    this.closeButton = this.createButton('button_closesmall_001.png', 'button_closesmall_002.png', 'button_close_hover.png', 1711, 928, () => {
      this.hide();
    });

    this.freeBuyButton = this.createButton('bbuy_001.png', 'bbuy_002.png', '', 552, 285, () => {
      this.onBuyPressed(0);
    }, 'bbuy_deact.png');

    this.hawBuyButton = this.createButton('bbuy_001.png', 'bbuy_002.png', '', 1121, 285, () => {
      this.onBuyPressed(1);
    }, 'bbuy_deact.png');

    this.freeBuyLabel = this.createBuyLabel(0);
    this.hawBuyLabel = this.createBuyLabel(1);

    if (this.freeBuyButton) {
      this.freeBuyLabel.position.set(this.freeBuyButton.root.width / 2, this.freeBuyButton.root.height / 2);
      this.freeBuyButton.root.addChild(this.freeBuyLabel);
    }
    if (this.hawBuyButton) {
      this.hawBuyLabel.position.set(this.hawBuyButton.root.width / 2, this.hawBuyButton.root.height / 2);
      this.hawBuyButton.root.addChild(this.hawBuyLabel);
    }

    this.applyLanguageTweaks();
    this.visible = false;
    this.refresh();
  }

  isOpen(): boolean {
    return this.visible;
  }

  show(): void {
    this.refresh();
    this.visible = true;
  }

  hide(notify = true): void {
    const wasOpen = this.visible;
    this.visible = false;
    if (notify && wasOpen) {
      this.onClose();
    }
  }

  refresh(): void {
    const meters: any = this.game?.meters;
    if (!meters) return;

    const totalBet = toNumber(meters.getTotalBet ? meters.getTotalBet() : 0, 0);
    this.currentValue = totalBet;

    const currency = getGameCurrency(this.game);
    const title = getLocalizedText(this.game, 'buyBonusTxt', 'BUY BONUS');
    const totalBetLabel = getLocalizedText(this.game, 'menuBetTotalBet', 'BET');
    const freeTitle = getLocalizedText(this.game, 'freeGameTxt', 'FREE GAMES');
    const hawTitle = getLocalizedText(this.game, 'holdAndWinTxt', 'HOLD AND WIN');

    const freeCost = totalBet * this.getBuyMultiplier(0);
    const hawCost = totalBet * this.getBuyMultiplier(1);
    const credit = toNumber(meters.credit, 0);
    const freeEnabled = freeCost <= credit && freeCost > 0;
    const hawEnabled = hawCost <= credit && hawCost > 0;
    const refreshKey = [
      title,
      totalBetLabel,
      totalBet,
      currency,
      freeTitle,
      hawTitle,
      freeCost,
      hawCost,
      freeEnabled,
      hawEnabled
    ].join('|');

    if (refreshKey === this.lastRefreshKey) {
      return;
    }
    this.lastRefreshKey = refreshKey;

    this.titleText.text = title;
    this.totalBetLabel.text = totalBetLabel;
    this.totalBetValue.text = `${formatMoneyByGame(totalBet, this.game)} ${currency}`;
    this.freeTitle.text = freeTitle;
    this.hawTitle.text = hawTitle;
    this.freePrice.text = `${formatMoneyByGame(freeCost, this.game)}\n${currency}`;
    this.hawPrice.text = `${formatMoneyByGame(hawCost, this.game)}\n${currency}`;
    this.fitConfiguredText(this.titleText, this.config.texts?.title, 760, 30);
    this.fitConfiguredText(this.freeTitle, this.config.texts?.freeTitle, 430, 28);
    this.fitConfiguredText(this.hawTitle, this.config.texts?.hawTitle, 430, 28);
    this.freeBuyLabel.text = getLocalizedText(this.game, 'buyTxt', 'BUY');
    this.hawBuyLabel.text = getLocalizedText(this.game, 'buyTxt', 'BUY');
    this.fitBuyLabel(this.freeBuyLabel);
    this.fitBuyLabel(this.hawBuyLabel);
    this.placeLegacyDisplay(this.totalBetLabel, 956, 206);
    this.placeLegacyDisplay(this.totalBetValue, 956, 139);
    this.placeLegacyDisplay(this.freeTitle, 672, 560);
    this.placeLegacyDisplay(this.hawTitle, 1241, 560);
    this.placeLegacyDisplay(this.freePrice, 672, 465);
    this.placeLegacyDisplay(this.hawPrice, 1241, 465);

    if (this.freeBuyButton) {
      this.freeBuyButton.setEnabled(freeEnabled);
      this.freeBuyButton.setLabelState(freeEnabled ? 'normal' : 'disabled');
    }
    if (this.hawBuyButton) {
      this.hawBuyButton.setEnabled(hawEnabled);
      this.hawBuyButton.setLabelState(hawEnabled ? 'normal' : 'disabled');
    }

    if (this.freePanelActive) this.freePanelActive.visible = freeEnabled;
    if (this.hawPanelActive) this.hawPanelActive.visible = hawEnabled;
  }

  private onMetersChanged(): void {
    if (this.game?.meters) {
      (this.game.meters as any).win = 0;
    }

    if (this.game?.controller?.updateMeters) {
      this.game.controller.updateMeters();
    } else if (this.game?.menu?.updateMeters) {
      this.game.menu.updateMeters();
    }

    this.refresh();
  }

  private onBuyPressed(type: BuyType): void {
    const cost = this.currentValue * this.getBuyMultiplier(type);
    this.hide(false);
    this.onRequestConfirm(type, cost);
  }

  private getBuyMultiplier(type: BuyType): number {
    const context: any = this.game?.context || {};
    const server: any = context.server || {};
    const free = toNumber(context.buyFreeGamesMult ?? server.buyFreeGamesMult, 0);
    const haw = toNumber(context.buyHoldAndWinMult ?? server.buyHoldAndWinMult, 0);
    return type === 0 ? free : haw;
  }

  private applyLanguageTweaks(): void {
    const lang = String((this.game?.gsLink as any)?.lang || '').toUpperCase();
    if (lang === 'RUS') {
      this.hawTitle.scale.set(0.55, 0.55);
      this.freeTitle.scale.set(0.8, 0.8);
    } else if (lang === 'PL' || lang === 'FRA' || lang === 'POR' || lang === 'ESP') {
      this.hawTitle.scale.set(0.8, 0.8);
    } else if (lang === 'TUR') {
      this.freeTitle.scale.set(0.8, 0.8);
    }
  }

  private createBuyLabel(type: BuyType): Text {
    const text = new Text({
      text: getLocalizedText(this.game, 'buyTxt', 'BUY'),
      style: new TextStyle({
        fontFamily: APP_FONT_FAMILY,
        fontSize: 60,
        fill: type === 0 ? 0xffff00 : 0xffff00,
        fontWeight: APP_FONT_WEIGHT_REGULAR,
        align: 'center'
      })
    });
    text.anchor.set(0.5, 0.5);
    this.fitBuyLabel(text);
    return text;
  }

  private fitBuyLabel(label: Text): void {
    fitPixiTextToBounds(label, {
      maxWidth: toNumber(this.config.texts?.buyButton?.maxWidth, 180),
      maxHeight: toNumber(this.config.texts?.buyButton?.maxHeight, 0),
      minFontSize: toNumber(this.config.texts?.buyButton?.minFontSize, 24)
    });
  }

  private fitConfiguredText(label: Text, config: any, fallbackMaxWidth: number, fallbackMinFontSize: number): void {
    fitPixiTextToBounds(label, {
      maxWidth: toNumber(config?.maxWidth, fallbackMaxWidth),
      maxHeight: toNumber(config?.maxHeight, 0),
      minFontSize: toNumber(config?.minFontSize, fallbackMinFontSize)
    });
  }

  private createText(
    value: string,
    x: number,
    y: number,
    options: {
      fontFamily: string;
      fontSize: number;
      fill: number;
      fontWeight: any;
      align: 'left' | 'center' | 'right';
      anchorX: number;
      anchorY: number;
    }
  ): Text {
    const text = new Text({
      text: value,
      style: new TextStyle({
        fontFamily: options.fontFamily,
        fontSize: options.fontSize,
        fill: options.fill,
        fontWeight: options.fontWeight,
        align: options.align
      })
    });
    text.anchor.set(options.anchorX, options.anchorY);
    text.position.set(x, y);
    this.addChild(text);
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

  private createButton(
    normalFrame: string,
    pressedFrame: string,
    hoverFrame: string,
    x: number,
    y: number,
    onRelease: () => void,
    disabledFrame = '',
    legacyY = true
  ): PushButton | null {
    const normal = this.getTexture(normalFrame);
    if (!normal) return null;

    const pressed = this.getTexture(pressedFrame) || normal;
    const hover = hoverFrame ? (this.getTexture(hoverFrame) || normal) : normal;
    const disabled = disabledFrame ? (this.getTexture(disabledFrame) || normal) : normal;

    const root = new Sprite(normal);
    if (legacyY) {
      this.placeLegacyDisplay(root, x, y);
    } else {
      root.position.set(x, y);
    }

    let enabled = true;
    let isDown = false;
    let isOver = false;

    const refresh = () => {
      if (!enabled) {
        root.texture = disabled;
        return;
      }
      if (isDown) {
        root.texture = pressed;
        return;
      }
      root.texture = isOver ? hover : normal;
    };

    const setEnabled = (value: boolean) => {
      enabled = !!value;
      root.eventMode = enabled ? 'static' : 'none';
      root.cursor = enabled ? 'pointer' : 'default';
      isDown = false;
      isOver = false;
      refresh();
    };

    const setLabelState = (state: ButtonVisualState) => {
      const target = root.children.find((child) => child instanceof Text) as Text | undefined;
      if (!target) return;
      if (state === 'disabled') {
        target.style.fill = 0x83837f;
      } else if (state === 'pressed') {
        target.style.fill = 0xffffa1;
      } else {
        target.style.fill = 0xffff00;
      }
    };

    root.eventMode = 'static';
    root.cursor = 'pointer';

    root.on('pointerover', () => {
      if (!enabled) return;
      isOver = true;
      refresh();
    });

    root.on('pointerout', () => {
      if (!enabled) return;
      isOver = false;
      isDown = false;
      setLabelState('normal');
      refresh();
    });

    root.on('pointerdown', () => {
      if (!enabled) return;
      isDown = true;
      setLabelState('pressed');
      refresh();
    });

    root.on('pointerup', () => {
      if (!enabled || !isDown) return;
      isDown = false;
      setLabelState('normal');
      refresh();
      onRelease();
    });

    root.on('pointerupoutside', () => {
      if (!enabled) return;
      isDown = false;
      setLabelState('normal');
      refresh();
    });

    this.addChild(root);
    refresh();

    return { root, setEnabled, setLabelState };
  }

  private placeLegacyDisplay(target: { height: number; position: { set: (x: number, y: number) => void }; anchor?: { y: number } }, x: number, legacyBottomY: number): void {
    const anchorY = target.anchor && Number.isFinite(target.anchor.y) ? Number(target.anchor.y) : 0;
    const y = STAGE_HEIGHT - legacyBottomY - (target.height * (1 - anchorY));
    target.position.set(x, y);
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
      panels: {
        free: { x: 420, y: 190 },
        haw: { x: 989, y: 190 }
      },
      symbols: {
        free: { x: 493, y: 605 },
        haw: { x: 1100, y: 590 }
      },
      controls: {
        betBg: { x: 703, y: 86 },
        plus: { x: 1068, y: 78 },
        minus: { x: 709, y: 78 },
        close: { x: 1711, y: 928 },
        freeBuy: { x: 552, y: 285 },
        hawBuy: { x: 1121, y: 285 }
      },
      texts: {
        title: { x: 960, y: 40, fontSize: 60 },
        totalBetLabel: { x: 956, y: 206, fontSize: 46 },
        totalBetValue: { x: 956, y: 139, fontSize: 46 },
        freeTitle: { x: 672, y: 560, fontSize: 54 },
        hawTitle: { x: 1241, y: 560, fontSize: 54 },
        freePrice: { x: 672, y: 465, fontSize: 54 },
        hawPrice: { x: 1241, y: 465, fontSize: 54 }
      }
    };

    const cfg = input && typeof input === 'object' ? input : {};
    return {
      background: { ...fallback.background, ...(cfg.background || {}) },
      panels: {
        free: { ...fallback.panels.free, ...((cfg.panels && cfg.panels.free) || {}) },
        haw: { ...fallback.panels.haw, ...((cfg.panels && cfg.panels.haw) || {}) }
      },
      symbols: {
        free: { ...fallback.symbols.free, ...((cfg.symbols && cfg.symbols.free) || {}) },
        haw: { ...fallback.symbols.haw, ...((cfg.symbols && cfg.symbols.haw) || {}) }
      },
      controls: {
        betBg: { ...fallback.controls.betBg, ...((cfg.controls && cfg.controls.betBg) || {}) },
        plus: { ...fallback.controls.plus, ...((cfg.controls && cfg.controls.plus) || {}) },
        minus: { ...fallback.controls.minus, ...((cfg.controls && cfg.controls.minus) || {}) },
        close: { ...fallback.controls.close, ...((cfg.controls && cfg.controls.close) || {}) },
        freeBuy: { ...fallback.controls.freeBuy, ...((cfg.controls && cfg.controls.freeBuy) || {}) },
        hawBuy: { ...fallback.controls.hawBuy, ...((cfg.controls && cfg.controls.hawBuy) || {}) }
      },
      texts: {
        title: { ...fallback.texts.title, ...((cfg.texts && cfg.texts.title) || {}) },
        totalBetLabel: { ...fallback.texts.totalBetLabel, ...((cfg.texts && cfg.texts.totalBetLabel) || {}) },
        totalBetValue: { ...fallback.texts.totalBetValue, ...((cfg.texts && cfg.texts.totalBetValue) || {}) },
        freeTitle: { ...fallback.texts.freeTitle, ...((cfg.texts && cfg.texts.freeTitle) || {}) },
        hawTitle: { ...fallback.texts.hawTitle, ...((cfg.texts && cfg.texts.hawTitle) || {}) },
        freePrice: { ...fallback.texts.freePrice, ...((cfg.texts && cfg.texts.freePrice) || {}) },
        hawPrice: { ...fallback.texts.hawPrice, ...((cfg.texts && cfg.texts.hawPrice) || {}) }
      }
    };
  }
}



