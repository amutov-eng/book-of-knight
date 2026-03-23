import { Container, Graphics, Rectangle, Sprite, Text, TextStyle, Texture } from 'pixi.js';
import type BaseGame from '../core/BaseGame';
import { APP_FONT_WEIGHT_LIGHT, APP_FONT_WEIGHT_REGULAR } from '../config/fontConfig';
import { formatCentsByPattern, getDefaultNumberPattern } from '../utils/numberFormat';

type TextButton = {
  root: Sprite;
  label: Text;
  setText: (value: string) => void;
};

const DEFAULT_BET_ARRAY = [1, 2, 3, 4, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 150, 200, 250, 300, 350, 400, 450, 500, 550, 600, 650, 700, 750, 800, 850, 900, 950, 1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000, 3000, 4000, 8000];
const STAGE_HEIGHT = 1080;

function toNumber(value: unknown, fallback = 0): number {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function getLocalized(game: any, key: string, fallback: string): string {
  if (game && game.localization && typeof game.localization.t === 'function') {
    return String(game.localization.t(key, {}, { defaultValue: fallback }));
  }
  return fallback;
}

function getCurrency(game: any): string {
  const currency = game && game.gsLink && typeof game.gsLink.currency === 'string'
    ? game.gsLink.currency.trim()
    : '';
  return currency || 'FUN';
}

function getNumberPattern(game: any): string {
  if (!game || !game.gsLink || typeof game.gsLink.getNumberPattern !== 'function') {
    return getDefaultNumberPattern();
  }

  const pattern = game.gsLink.getNumberPattern();
  return typeof pattern === 'string' && pattern.trim().length > 0
    ? pattern
    : getDefaultNumberPattern();
}

function formatMoney(value: number, game: any): string {
  return formatCentsByPattern(value, getNumberPattern(game));
}

export default class BetMenu extends Container {
  private readonly game: BaseGame & Record<string, any>;

  private readonly config: Record<string, any>;

  private readonly onClose: () => void;

  private readonly overlay: Graphics;

  private readonly panel: Sprite | null;

  private readonly totalBetValueBg: Sprite | null;

  private readonly titleText: Text;

  private readonly totalBetText: Text;

  private readonly totalBetValueText: Text;

  private readonly linesText: Text;

  private readonly closeButton: Sprite | null;

  private readonly plusButton: Sprite | null;

  private readonly minusButton: Sprite | null;

  private readonly maxBetButton: TextButton | null;

  private readonly presetButtons: TextButton[];
  private readonly textureCache = new Map<string, Texture | null>();

  private presetValues: number[];
  private lastRefreshKey = '';

  constructor(game: BaseGame, hudConfig: Record<string, any> | null | undefined, onClose: () => void) {
    super();

    this.game = game as BaseGame & Record<string, any>;
    this.config = (hudConfig && typeof hudConfig.betMenu === 'object') ? hudConfig.betMenu : {};
    this.onClose = onClose;

    this.presetButtons = [];
    this.presetValues = [1, 10, 30, 60, 80, 150];

    const overlayColor = toNumber(this.get('overlay.color'), 0x000000);
    const overlayAlpha = toNumber(this.get('overlay.alpha'), 0.45);

    this.overlay = new Graphics()
      .rect(0, 0, 1920, 1080)
      .fill({ color: overlayColor, alpha: overlayAlpha });
    this.overlay.eventMode = 'static';
    this.overlay.cursor = 'default';
    this.overlay.on('pointertap', () => this.hide());
    this.addChild(this.overlay);

    this.panel = this.createSprite(this.getFrame('panel.frame', 'bg_bet.png'), 846, 86, true);
    this.totalBetValueBg = this.createSprite(this.getFrame('valueField.frame', 'bet_value.png'), 1036, 536, true);

    if (this.panel) {
      const panelHitArea = new Container();
      panelHitArea.eventMode = 'static';
      panelHitArea.hitArea = new Rectangle(this.panel.x, this.panel.y, this.panel.width, this.panel.height);
      panelHitArea.on('pointertap', (event) => {
        event.stopPropagation();
      });
      this.addChild(panelHitArea);
    }

    const primaryFont = this.getFontFamily('primary');
    this.titleText = this.createText('', this.getPointX('title.x', 1293), this.getPointY('title.y', 120), {
      fontFamily: primaryFont,
      fontSize: toNumber(this.get('title.fontSize'), 60),
      fill: toNumber(this.get('title.color'), 0x93a7bf),
      fontWeight: APP_FONT_WEIGHT_REGULAR,
      align: 'center',
      anchorX: 0.5
    });

    this.totalBetText = this.createText('', this.getPointX('totalBetLabel.x', 1293), this.getPointY('totalBetLabel.y', 641), {
      fontFamily: primaryFont,
      fontSize: toNumber(this.get('totalBetLabel.fontSize'), 46),
      fill: toNumber(this.get('totalBetLabel.color'), 0xbee1f5),
      fontWeight: APP_FONT_WEIGHT_LIGHT,
      align: 'center',
      anchorX: 0.5
    });

    this.totalBetValueText = this.createText('', this.getPointX('valueText.x', 1289), this.getPointY('valueText.y', 566), {
      fontFamily: primaryFont,
      fontSize: toNumber(this.get('valueText.fontSize'), 46),
      fill: toNumber(this.get('valueText.color'), 0xbee1f5),
      fontWeight: APP_FONT_WEIGHT_LIGHT,
      align: 'center',
      anchorX: 0.5
    });

    this.linesText = this.createText('', this.getPointX('lines.x', 1293), this.getPointY('lines.y', 166), {
      fontFamily: primaryFont,
      fontSize: toNumber(this.get('lines.fontSize'), 36),
      fill: toNumber(this.get('lines.color'), 0xbee1f5),
      fontWeight: APP_FONT_WEIGHT_REGULAR,
      align: 'center',
      anchorX: 0.5
    });

    this.maxBetButton = this.createTextButton(
      this.getFrame('buttons.max.frame', 'button_maxbet_001.png'),
      this.getFrame('buttons.max.pressed', 'button_maxbet_002.png'),
      this.getFrame('buttons.max.hover', ''),
      1136,
      740,
      () => {
        if (!this.game?.meters) return;
        this.game.meters.selectMaxbet();
        this.onMetersChanged();
      },
      true,
      {
        fontFamily: this.getFontFamily('primary'),
        fontSize: toNumber(this.get('buttons.max.fontSize'), 42),
        fill: toNumber(this.get('buttons.max.color'), 0xbee1f5),
        align: 'center',
        anchorX: 0.5,
        anchorY: 0.5,
        maxTextWidth: toNumber(this.get('buttons.max.maxTextWidth'), 262),
        minFontSize: toNumber(this.get('buttons.max.minFontSize'), 24),
        textOffsetY: toNumber(this.get('buttons.max.textOffsetY'), 0)
      }
    );

    this.plusButton = this.createButton(
      this.getFrame('buttons.plus.frame', 'plus_001.png'),
      this.getFrame('buttons.plus.pressed', 'plus_002.png'),
      this.getFrame('buttons.plus.hover', ''),
      1401,
      528,
      () => {
        if (!this.game?.meters) return;
        this.game.meters.incrementBetPerLine();
        this.onMetersChanged();
      },
      true
    );

    this.minusButton = this.createButton(
      this.getFrame('buttons.minus.frame', 'minus_001.png'),
      this.getFrame('buttons.minus.pressed', 'minus_002.png'),
      this.getFrame('buttons.minus.hover', ''),
      1042,
      528,
      () => {
        if (!this.game?.meters) return;
        this.game.meters.decrementBetPerLine();
        this.onMetersChanged();
      },
      true
    );

    this.closeButton = this.createButton(
      this.getFrame('buttons.close.frame', 'button_closesmall_001.png'),
      this.getFrame('buttons.close.pressed', 'button_closesmall_002.png'),
      this.getFrame('buttons.close.hover', ''),
      1550,
      815,
      () => this.hide(),
      true
    );

    const presetPositions = this.getPresetPositions();
    for (let i = 0; i < 6; i += 1) {
      const pos = presetPositions[i];
      const button = this.createTextButton(
        this.getFrame('buttons.preset.frame', 'button_digit_001.png'),
        this.getFrame('buttons.preset.pressed', 'button_digit_002.png'),
        this.getFrame('buttons.preset.hover', ''),
        pos.x,
        pos.y,
        () => {
          const value = this.presetValues[i];
          const meters = this.game?.meters as any;
          if (!meters || !Number.isFinite(value)) return;
          if (typeof meters.setBetPerLine === 'function') {
            meters.setBetPerLine(value);
          } else {
            meters.bet = value;
            if (typeof meters.update === 'function') meters.update();
          }
          this.onMetersChanged();
        },
        true,
        {
          fontFamily: this.getFontFamily('primary'),
          fontSize: toNumber(this.get('buttons.preset.fontSize'), 42),
          fill: toNumber(this.get('buttons.preset.color'), 0xbee1f5),
          align: 'center',
          anchorX: 0.5,
          anchorY: 0.5,
          maxTextWidth: toNumber(this.get('buttons.preset.maxTextWidth'), 178),
          minFontSize: toNumber(this.get('buttons.preset.minFontSize'), 20),
          textOffsetY: toNumber(this.get('buttons.preset.textOffsetY'), 0)
        }
      );

      if (button) {
        this.presetButtons.push(button);
      }
    }

    this.visible = false;
    this.recomputePresets();
    this.refresh();
  }

  isOpen(): boolean {
    return this.visible;
  }

  show(): void {
    this.recomputePresets();
    this.refresh();
    this.visible = true;
  }

  hide(): void {
    this.visible = false;
    this.onClose();
  }

  refresh(): void {
    const meters = this.game?.meters as any;
    if (!meters) return;

    const menuBetTitle = getLocalized(this.game, 'menuBetTitle', 'SELECT BET');
    const totalBetLabel = getLocalized(this.game, 'menuBetTotalBet', 'BET');
    const linesLabel = getLocalized(this.game, 'menuBetLines', 'LINES :');
    const currency = getCurrency(this.game);

    this.titleText.text = menuBetTitle;
    this.totalBetText.text = totalBetLabel;
    this.linesText.text = `${linesLabel} ${toNumber(meters.MAX_LINES, 10)}`;
    this.placeLegacyDisplay(this.totalBetText, 1293, 641);
    this.placeLegacyDisplay(this.linesText, 1293, 166);

    const totalBet = toNumber(meters.getTotalBet ? meters.getTotalBet() : meters.totalBet, 0);
    const currentBet = Math.max(1, toNumber(meters.getBetPerLine ? meters.getBetPerLine() : meters.bet, 1));
    const refreshKey = [
      menuBetTitle,
      totalBetLabel,
      linesLabel,
      meters.MAX_LINES,
      totalBet,
      currentBet,
      getCurrency(this.game)
    ].join('|');

    if (refreshKey === this.lastRefreshKey) {
      return;
    }
    this.lastRefreshKey = refreshKey;

    this.applyFittedText(
      this.totalBetValueText,
      `${formatMoney(totalBet, this.game)} ${currency}`,
      toNumber(this.get('valueText.maxWidth'), 220),
      toNumber(this.get('valueText.fontSize'), 46),
      toNumber(this.get('valueText.minFontSize'), 24)
    );
    this.placeLegacyDisplay(this.totalBetValueText, 1289, 536, true);

    if (this.maxBetButton) {
      this.maxBetButton.setText(getLocalized(this.game, 'menuBetMaxBet', 'MAX BET'));
    }
    for (let i = 0; i < this.presetButtons.length; i += 1) {
      const perLine = this.presetValues[i] || currentBet;
      const impliedTotal = Math.round((totalBet / currentBet) * perLine);
      this.presetButtons[i].setText(formatMoney(impliedTotal, this.game));
    }
  }

  private onMetersChanged(): void {
    const meters = this.game?.meters as any;
    if (meters) {
      meters.win = 0;
    }

    if (this.game?.controller && typeof this.game.controller.updateMeters === 'function') {
      this.game.controller.updateMeters();
    } else if (this.game?.menu && typeof this.game.menu.updateMeters === 'function') {
      this.game.menu.updateMeters();
    }

    this.recomputePresets();
    this.refresh();
  }

  private recomputePresets(): void {
    const meters = this.game?.meters as any;
    if (!meters) return;

    const allBets = Array.isArray(meters.betArray) && meters.betArray.length > 0
      ? meters.betArray.slice().filter((item: unknown) => Number.isFinite(item))
      : DEFAULT_BET_ARRAY.slice();

    const maxBet = Math.max(1, toNumber(meters.MAX_BET_PER_LINE, 1));
    const allowed = allBets.filter((item: number) => item <= maxBet);
    const source = allowed.length > 0 ? allowed : [1];

    const count = source.length;
    const step = Math.floor(count / 5);
    const values = [
      source[0],
      source[Math.min(count - 1, 1 * step)],
      source[Math.min(count - 1, 2 * step)],
      source[Math.min(count - 1, 3 * step)],
      source[Math.min(count - 1, 4 * step)],
      source[Math.min(count - 1, 5 * step)]
    ];

    for (let i = 0; i < values.length; i += 1) {
      values[i] = Math.min(maxBet, Math.max(1, toNumber(values[i], 1)));
    }

    this.presetValues = values;
  }

  private createTextButton(
    normalFrame: string,
    pressedFrame: string,
    hoverFrame: string,
    x: number,
    y: number,
    onRelease: () => void,
    legacyY: boolean,
    styleOptions: {
      fontFamily: string;
      fontSize: number;
      fill: number;
      align: 'left' | 'center' | 'right';
      anchorX: number;
      anchorY: number;
      maxTextWidth?: number;
      minFontSize?: number;
      textOffsetY?: number;
    }
  ): TextButton | null {
    const sprite = this.createButton(normalFrame, pressedFrame, hoverFrame, x, y, onRelease, legacyY);
    if (!sprite) return null;

    const label = new Text({
      text: '',
      style: new TextStyle({
        fontFamily: styleOptions.fontFamily,
        fontSize: styleOptions.fontSize,
        fill: styleOptions.fill,
        fontWeight: APP_FONT_WEIGHT_REGULAR,
        align: styleOptions.align
      })
    });
    label.anchor.set(styleOptions.anchorX, styleOptions.anchorY);
    label.x = sprite.width / 2;
    label.y = (sprite.height / 2) + (styleOptions.textOffsetY ?? 0);
    sprite.addChild(label);

    const maxTextWidth = Number.isFinite(styleOptions.maxTextWidth)
      ? Number(styleOptions.maxTextWidth)
      : Math.max(1, sprite.width - 32);
    const minFontSize = Number.isFinite(styleOptions.minFontSize)
      ? Number(styleOptions.minFontSize)
      : 20;

    return {
      root: sprite,
      label,
      setText: (value: string) => {
        this.applyFittedText(label, value, maxTextWidth, styleOptions.fontSize, minFontSize);
      }
    };
  }

  private applyFittedText(
    text: Text,
    value: string,
    maxWidth: number,
    baseFontSize: number,
    minFontSize: number
  ): void {
    if (text.text === value && Number(text.style.fontSize) === Math.max(Math.max(8, Math.floor(minFontSize)), Math.floor(baseFontSize))) {
      if (text.width <= maxWidth) {
        return;
      }
    }

    const style = text.style as TextStyle;
    const targetMin = Math.max(8, Math.floor(minFontSize));
    let size = Math.max(targetMin, Math.floor(baseFontSize));

    style.fontSize = size;
    if (text.text !== value) {
      text.text = value;
    }

    while (size > targetMin && text.width > maxWidth) {
      size -= 1;
      style.fontSize = size;
    }
  }

  private createButton(
    normalFrame: string,
    pressedFrame: string,
    hoverFrame: string,
    x: number,
    y: number,
    onRelease: () => void,
    legacyY = false
  ): Sprite | null {
    const normal = this.getTexture(normalFrame);
    if (!normal) return null;

    const down = this.getTexture(pressedFrame) || normal;
    const hover = hoverFrame ? this.getTexture(hoverFrame) : null;
    const sprite = new Sprite(normal);
    if (legacyY) {
      this.placeLegacyDisplay(sprite, x, y);
    } else {
      sprite.x = x;
      sprite.y = y;
    }
    sprite.eventMode = 'static';
    sprite.cursor = 'pointer';

    let isDown = false;
    let isOver = false;

    sprite.on('pointerover', () => {
      isOver = true;
      if (!isDown && hover) {
        sprite.texture = hover;
      }
    });

    sprite.on('pointerout', () => {
      isOver = false;
      if (!isDown) {
        sprite.texture = normal;
      }
    });

    sprite.on('pointerdown', () => {
      isDown = true;
      sprite.texture = down;
    });

    sprite.on('pointerup', () => {
      if (!isDown) return;
      isDown = false;
      sprite.texture = (isOver && hover) ? hover : normal;
      onRelease();
    });

    sprite.on('pointerupoutside', () => {
      isDown = false;
      sprite.texture = (isOver && hover) ? hover : normal;
    });

    this.addChild(sprite);
    return sprite;
  }

  private createSprite(frame: string, x: number, y: number, legacyY = false): Sprite | null {
    const texture = this.getTexture(frame);
    if (!texture) return null;

    const sprite = new Sprite(texture);
    if (legacyY) {
      this.placeLegacyDisplay(sprite, x, y);
    } else {
      sprite.x = x;
      sprite.y = y;
    }
    this.addChild(sprite);
    return sprite;
  }

  private createText(
    value: string,
    x: number,
    y: number,
    styleOptions: {
      fontFamily: string;
      fontSize: number;
      fill: number;
      align: 'left' | 'center' | 'right';
      anchorX: number;
      fontWeight: any;
    }
  ): Text {
    const text = new Text({
      text: value,
      style: new TextStyle({
        fontFamily: styleOptions.fontFamily,
        fontSize: styleOptions.fontSize,
        fill: styleOptions.fill,
        fontWeight: styleOptions.fontWeight,
        align: styleOptions.align
      })
    });
    text.anchor.set(styleOptions.anchorX, 0);
    text.x = x;
    text.y = y;
    this.addChild(text);
    return text;
  }

  private get(path: string): unknown {
    const parts = path.split('.');
    let current: unknown = this.config;

    for (let i = 0; i < parts.length; i += 1) {
      const key = parts[i];
      if (!current || typeof current !== 'object' || !(key in (current as Record<string, unknown>))) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[key];
    }

    return current;
  }

  private getFrame(path: string, fallback: string): string {
    const value = this.get(path);
    return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
  }

  private getPointX(path: string, fallback: number): number {
    return toNumber(this.get(path), fallback);
  }

  private getPointY(path: string, fallback: number): number {
    return toNumber(this.get(path), fallback);
  }

  private getFontFamily(fallback: string): string {
    const fonts = this.config && typeof this.config.fonts === 'object'
      ? (this.config.fonts as Record<string, unknown>)
      : {};
    const value = fonts.primary;
    return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
  }

  private getTexture(frameName: string): Texture | null {
    if (this.textureCache.has(frameName)) {
      return this.textureCache.get(frameName) ?? null;
    }

    const texture = Texture.from(frameName);
    if (!texture || texture === Texture.EMPTY) {
      this.textureCache.set(frameName, null);
      return null;
    }
    this.textureCache.set(frameName, texture);
    return texture;
  }

  private getPresetPositions(): Array<{ x: number; y: number }> {
    const cfg = this.get('buttons.preset.positions');
    if (Array.isArray(cfg) && cfg.length >= 6) {
      const parsed = cfg
        .slice(0, 6)
        .map((item) => ({
          x: toNumber(item && (item as any).x, 0),
          y: toNumber(item && (item as any).y, 0)
        }));
      if (parsed.every((item) => Number.isFinite(item.x) && Number.isFinite(item.y))) {
        return parsed;
      }
    }

    return [
      { x: 937, y: 364 },
      { x: 1182, y: 364 },
      { x: 1427, y: 364 },
      { x: 937, y: 220 },
      { x: 1182, y: 220 },
      { x: 1427, y: 220 }
    ];
  }

  private placeLegacyDisplay(
    target: { height: number; position: { set: (x: number, y: number) => void }; anchor?: { y: number } },
    x: number,
    legacyBottomY: number,
    useAnchor = false
  ): void {
    const anchorY = useAnchor && target.anchor && Number.isFinite(target.anchor.y) ? Number(target.anchor.y) : 0;
    const y = STAGE_HEIGHT - legacyBottomY - (target.height * (1 - anchorY));
    target.position.set(x, y);
  }
}
