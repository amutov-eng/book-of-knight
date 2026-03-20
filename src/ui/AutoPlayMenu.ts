import { Container, Graphics, Rectangle, Sprite, Text, TextStyle, Texture } from 'pixi.js';
import type BaseGame from '../core/BaseGame';
import { APP_FONT_WEIGHT_REGULAR } from '../config/fontConfig';

function toNumber(value: unknown, fallback = 0): number {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function getLocalized(game: any, key: string, fallback: string): string {
  if (game && game.localization && typeof game.localization.t === 'function') {
    return String(game.localization.t(key, {}, { defaultValue: fallback }));
  }
  return fallback;
}

type ToggleControl = {
  root: Sprite;
  setSelected: (selected: boolean) => void;
  isSelected: () => boolean;
  setEnabled: (enabled: boolean) => void;
};

type TextButton = {
  root: Sprite;
  label: Text;
  setText: (value: string) => void;
};

export default class AutoPlayMenu extends Container {
  private readonly game: BaseGame & Record<string, any>;
  private readonly config: Record<string, any>;
  private readonly onStart: (count: number) => void;
  private readonly onClose: () => void;

  private readonly overlay: Graphics;
  private readonly panel: Sprite | null;
  private readonly titleText: Text;
  private readonly autoSpinsLabelText: Text;
  private readonly infoText: Text;

  private readonly closeButton: Sprite | null;
  private readonly startButton: TextButton | null;
  private readonly turboButton: ToggleControl | null;
  private readonly skipScreenButton: ToggleControl | null;
  private readonly textureCache = new Map<string, Texture | null>();

  private spinValues: number[];
  private spinButtons: Array<{ value: number; control: ToggleControl; label: Text }>;
  private selectedSpinValue: number;
  private lastTextKey = '';
  private lastToggleKey = '';

  constructor(
    game: BaseGame,
    hudConfig: Record<string, any> | null | undefined,
    onStart: (count: number) => void,
    onClose: () => void
  ) {
    super();

    this.game = game as BaseGame & Record<string, any>;
    this.config = (hudConfig && typeof hudConfig.autoPlayMenu === 'object') ? hudConfig.autoPlayMenu : {};
    this.onStart = onStart;
    this.onClose = onClose;

    this.spinValues = this.getSpinValues();
    this.selectedSpinValue = this.spinValues[this.spinValues.length - 1] || 1000;
    this.spinButtons = [];

    const overlayColor = toNumber(this.get('overlay.color'), 0x000000);
    const overlayAlpha = toNumber(this.get('overlay.alpha'), 0.5);

    this.overlay = new Graphics()
      .rect(0, 0, 1920, 1080)
      .fill({ color: overlayColor, alpha: overlayAlpha });
    this.overlay.eventMode = 'static';
    this.overlay.cursor = 'default';
    this.overlay.on('pointertap', () => this.hide());
    this.addChild(this.overlay);

    this.panel = this.createSprite(
      this.getFrame('panel.frame', 'bg_auto.png'),
      this.getPointX('panel.x', 846),
      this.getPointY('panel.y', 6)
    );

    if (this.panel) {
      const panelHitArea = new Container();
      panelHitArea.eventMode = 'static';
      panelHitArea.hitArea = new Rectangle(this.panel.x, this.panel.y, this.panel.width, this.panel.height);
      panelHitArea.on('pointertap', (event) => event.stopPropagation());
      this.addChild(panelHitArea);
    }

    const titleFont = this.getFontFamily('primary');

    this.titleText = this.createText('', this.getPointX('title.x', 1293), this.getPointY('title.y', 92), {
      fontFamily: titleFont,
      fontSize: toNumber(this.get('title.fontSize'), 56),
      fill: toNumber(this.get('title.color'), 0x93a7bf),
      anchorX: 0.5,
      align: 'center',
      fontWeight: APP_FONT_WEIGHT_REGULAR
    });

    this.autoSpinsLabelText = this.createText('', this.getPointX('autoSpinsLabel.x', 1293), this.getPointY('autoSpinsLabel.y', 500), {
      fontFamily: titleFont,
      fontSize: toNumber(this.get('autoSpinsLabel.fontSize'), 48),
      fill: toNumber(this.get('autoSpinsLabel.color'), 0x93a7bf),
      anchorX: 0.5,
      align: 'center',
      fontWeight: APP_FONT_WEIGHT_REGULAR
    });

    this.infoText = this.createText('', this.getPointX('infoText.x', 1293), this.getPointY('infoText.y', 312), {
      fontFamily: titleFont,
      fontSize: toNumber(this.get('infoText.fontSize'), 36),
      fill: toNumber(this.get('infoText.color'), 0xb9c5d3),
      anchorX: 0.5,
      align: 'center',
      fontWeight: APP_FONT_WEIGHT_REGULAR
    });

    this.closeButton = this.createPushButton(
      this.getFrame('buttons.close.frame', 'button_closesmall_001.png'),
      this.getFrame('buttons.close.pressed', 'button_closesmall_002.png'),
      this.getFrame('buttons.close.hover', ''),
      this.getPointX('buttons.close.x', 1515),
      this.getPointY('buttons.close.y', 59),
      () => this.hide()
    );

    this.startButton = this.createTextButton(
      this.getFrame('buttons.start.frame', 'start_autospins_001.png'),
      this.getFrame('buttons.start.pressed', 'start_autospins_002.png'),
      this.getFrame('buttons.start.hover', ''),
      this.getPointX('buttons.start.x', 1040),
      this.getPointY('buttons.start.y', 841),
      () => this.handleStartPressed(),
      {
        fontFamily: titleFont,
        fontSize: toNumber(this.get('buttons.start.fontSize'), 60),
        fill: toNumber(this.get('buttons.start.color'), 0xbee1f5),
        maxTextWidth: toNumber(this.get('buttons.start.maxTextWidth'), 390),
        minFontSize: toNumber(this.get('buttons.start.minFontSize'), 20),
        textOffsetY: toNumber(this.get('buttons.start.textOffsetY'), 0)
      }
    );

    const spinPositions = this.getSpinPositions();
    const spinFontSize = toNumber(this.get('buttons.spin.fontSize'), 56);
    const spinColor = toNumber(this.get('buttons.spin.color'), 0xbee1f5);

    for (let i = 0; i < this.spinValues.length && i < spinPositions.length; i += 1) {
      const value = this.spinValues[i];
      const position = spinPositions[i];
      const button = this.createToggleButton(
        this.getFrame('buttons.spin.frame', 'button_digit_001.png'),
        this.getFrame('buttons.spin.pressed', 'button_digit_002.png'),
        this.getFrame('buttons.spin.hover', ''),
        position.x,
        position.y,
        () => this.selectSpinValue(value)
      );

      if (!button) continue;

      const label = new Text({
        text: `${value}`,
        style: new TextStyle({
          fontFamily: titleFont,
          fontSize: spinFontSize,
          fill: spinColor,
          fontWeight: APP_FONT_WEIGHT_REGULAR,
          align: 'center'
        })
      });
      label.anchor.set(0.5);
      label.position.set(button.root.width / 2, button.root.height / 2);
      button.root.addChild(label);

      this.spinButtons.push({ value, control: button, label });
    }

    this.turboButton = this.createToggleButton(
      this.getFrame('buttons.turbo.frame', 'turbo_bg_001.png'),
      this.getFrame('buttons.turbo.pressed', 'turbo_bg_002.png'),
      this.getFrame('buttons.turbo.hover', ''),
      this.getPointX('buttons.turbo.x', 1040),
      this.getPointY('buttons.turbo.y', 212),
      () => this.toggleTurbo()
    );
    this.attachToggleLabel(this.turboButton, 'settingsTurboSpin', 'TURBO SPINS', 'buttons.turbo');

    this.skipScreenButton = this.createToggleButton(
      this.getFrame('buttons.skip.frame', 'skipscreen_bg_001.png'),
      this.getFrame('buttons.skip.pressed', 'skipscreen_bg_002.png'),
      this.getFrame('buttons.skip.hover', ''),
      this.getPointX('buttons.skip.x', 1040),
      this.getPointY('buttons.skip.y', 371),
      () => this.toggleSkipScreen()
    );
    this.attachToggleLabel(this.skipScreenButton, 'settingsSkipScreen', 'SKIP SCREENS', 'buttons.skip');

    this.visible = false;
    this.refreshTexts();
    this.refreshSelection();
    this.refreshTogglesFromContext();
  }

  isOpen(): boolean {
    return this.visible;
  }

  show(): void {
    this.spinValues = this.getSpinValues();
    this.selectedSpinValue = this.spinValues[this.spinValues.length - 1] || 1000;
    this.refreshSelection();
    this.refreshTexts();
    this.refreshTogglesFromContext();
    this.visible = true;
  }

  hide(notify = true): void {
    const wasVisible = this.visible;
    this.visible = false;
    if (notify && wasVisible) {
      this.onClose();
    }
  }

  private handleStartPressed(): void {
    this.onStart(this.selectedSpinValue);
  }

  private toggleTurbo(): void {
    if (!this.game || !this.game.context) return;
    if (this.game.context.turboSpinIsEnabled === false) {
      this.game.context.turboGame = false;
      this.refreshTogglesFromContext();
      return;
    }
    this.game.context.turboGame = !this.game.context.turboGame;
    this.refreshTogglesFromContext();
  }

  private toggleSkipScreen(): void {
    if (!this.game || !this.game.context) return;
    this.game.context.skipScreen = !this.game.context.skipScreen;
    this.refreshTogglesFromContext();
  }

  private refreshTogglesFromContext(): void {
    const context: any = this.game && this.game.context ? this.game.context : {};
    const toggleKey = `${context.turboSpinIsEnabled !== false}|${!!context.turboGame}|${!!context.skipScreen}`;
    if (toggleKey === this.lastToggleKey) {
      return;
    }
    this.lastToggleKey = toggleKey;

    if (this.turboButton) {
      const turboEnabled = context.turboSpinIsEnabled !== false;
      this.turboButton.setEnabled(turboEnabled);
      this.turboButton.setSelected(!!context.turboGame && turboEnabled);
      this.turboButton.root.alpha = turboEnabled ? 1 : 0.35;
    }

    if (this.skipScreenButton) {
      this.skipScreenButton.setEnabled(true);
      this.skipScreenButton.setSelected(!!context.skipScreen);
      this.skipScreenButton.root.alpha = 1;
    }
  }

  private refreshSelection(): void {
    for (let i = 0; i < this.spinButtons.length; i += 1) {
      const item = this.spinButtons[i];
      item.control.setSelected(item.value === this.selectedSpinValue);
    }
  }

  private selectSpinValue(value: number): void {
    this.selectedSpinValue = value;
    this.refreshSelection();
    this.refreshTexts();
  }

  private refreshTexts(): void {
    const title = getLocalized(this.game, 'autoPlayTitle', 'AUTOPLAY');
    const autoSpinsLabel = getLocalized(this.game, 'autoNumbersTxtLabel', 'NUMBER OF AUTOSPINS');
    const info = getLocalized(this.game, 'settingsTurboSpinTxt', 'Play faster by skipping animations');
    const textKey = `${title}|${autoSpinsLabel}|${info}|${this.selectedSpinValue}`;
    if (textKey === this.lastTextKey) {
      return;
    }
    this.lastTextKey = textKey;

    this.titleText.text = title;
    this.autoSpinsLabelText.text = autoSpinsLabel;
    this.infoText.text = info;

    if (this.startButton) {
      const startPrefix = getLocalized(this.game, 'autoPlayStart', 'START AUTOPLAY');
      this.startButton.setText(`${startPrefix} (${this.selectedSpinValue})`);
    }
  }

  private attachToggleLabel(
    button: ToggleControl | null,
    localeKey: string,
    fallback: string,
    configRoot: string
  ): void {
    if (!button) return;

    const label = new Text({
      text: getLocalized(this.game, localeKey, fallback),
      style: new TextStyle({
        fontFamily: this.getFontFamily('primary'),
        fontSize: toNumber(this.get(`${configRoot}.fontSize`), 36),
        fill: toNumber(this.get(`${configRoot}.color`), 0xb9c5d3),
        fontWeight: APP_FONT_WEIGHT_REGULAR,
        align: String(this.get(`${configRoot}.textAlign`) || 'left') as 'left' | 'center' | 'right'
      })
    });

    const align = String(this.get(`${configRoot}.textAlign`) || 'left');
    if (align === 'center') {
      label.anchor.set(0.5, 0.5);
      label.x = toNumber(this.get(`${configRoot}.textX`), button.root.width / 2);
    } else if (align === 'right') {
      label.anchor.set(1, 0.5);
      label.x = toNumber(this.get(`${configRoot}.textX`), button.root.width - 24);
    } else {
      label.anchor.set(0, 0.5);
      label.x = toNumber(this.get(`${configRoot}.textX`), 80);
    }
    label.y = toNumber(this.get(`${configRoot}.textY`), button.root.height / 2) + toNumber(this.get(`${configRoot}.textOffsetY`), 0);
    button.root.addChild(label);
  }

  private createTextButton(
    normalFrame: string,
    pressedFrame: string,
    hoverFrame: string,
    x: number,
    y: number,
    onRelease: () => void,
    styleOptions: {
      fontFamily: string;
      fontSize: number;
      fill: number;
      maxTextWidth: number;
      minFontSize: number;
      textOffsetY: number;
    }
  ): TextButton | null {
    const button = this.createPushButton(normalFrame, pressedFrame, hoverFrame, x, y, onRelease);
    if (!button) return null;

    const label = new Text({
      text: '',
      style: new TextStyle({
        fontFamily: styleOptions.fontFamily,
        fontSize: styleOptions.fontSize,
        fill: styleOptions.fill,
        fontWeight: APP_FONT_WEIGHT_REGULAR,
        align: 'center'
      })
    });

    label.anchor.set(0.5, 0.5);
    label.x = button.width / 2;
    label.y = (button.height / 2) + styleOptions.textOffsetY;
    button.addChild(label);

    return {
      root: button,
      label,
      setText: (value: string) => {
        this.applyFittedText(label, value, styleOptions.maxTextWidth, styleOptions.fontSize, styleOptions.minFontSize);
      }
    };
  }

  private applyFittedText(text: Text, value: string, maxWidth: number, baseFontSize: number, minFontSize: number): void {
    const style = text.style as TextStyle;
    const safeMin = Math.max(10, Math.floor(minFontSize));
    let size = Math.max(safeMin, Math.floor(baseFontSize));

    style.fontSize = size;
    if (text.text !== value) {
      text.text = value;
    }

    while (size > safeMin && text.width > maxWidth) {
      size -= 1;
      style.fontSize = size;
    }
  }

  private createToggleButton(
    normalFrame: string,
    pressedFrame: string,
    hoverFrame: string,
    x: number,
    y: number,
    onRelease: () => void
  ): ToggleControl | null {
    const normal = this.getTexture(normalFrame);
    if (!normal) return null;

    const down = this.getTexture(pressedFrame) || normal;
    const hover = hoverFrame ? (this.getTexture(hoverFrame) || normal) : normal;

    const sprite = new Sprite(normal);
    sprite.x = x;
    sprite.y = y;
    sprite.eventMode = 'static';
    sprite.cursor = 'pointer';

    let enabled = true;
    let selected = false;
    let isDown = false;
    let isOver = false;

    const refreshTexture = (): void => {
      if (!enabled) {
        sprite.texture = selected ? down : normal;
        return;
      }
      if (selected || isDown) {
        sprite.texture = down;
        return;
      }
      sprite.texture = isOver ? hover : normal;
    };

    sprite.on('pointerover', () => {
      if (!enabled) return;
      isOver = true;
      refreshTexture();
    });

    sprite.on('pointerout', () => {
      if (!enabled) return;
      isOver = false;
      isDown = false;
      refreshTexture();
    });

    sprite.on('pointerdown', () => {
      if (!enabled) return;
      isDown = true;
      refreshTexture();
    });

    sprite.on('pointerup', () => {
      if (!enabled) return;
      isDown = false;
      onRelease();
      refreshTexture();
    });

    sprite.on('pointerupoutside', () => {
      if (!enabled) return;
      isDown = false;
      refreshTexture();
    });

    this.addChild(sprite);
    refreshTexture();

    return {
      root: sprite,
      setSelected: (value: boolean) => {
        selected = !!value;
        refreshTexture();
      },
      isSelected: () => selected,
      setEnabled: (value: boolean) => {
        enabled = !!value;
        sprite.eventMode = enabled ? 'static' : 'none';
        sprite.cursor = enabled ? 'pointer' : 'default';
        refreshTexture();
      }
    };
  }

  private createPushButton(
    normalFrame: string,
    pressedFrame: string,
    hoverFrame: string,
    x: number,
    y: number,
    onRelease: () => void
  ): Sprite | null {
    const normal = this.getTexture(normalFrame);
    if (!normal) return null;

    const down = this.getTexture(pressedFrame) || normal;
    const hover = hoverFrame ? (this.getTexture(hoverFrame) || normal) : normal;

    const sprite = new Sprite(normal);
    sprite.x = x;
    sprite.y = y;
    sprite.eventMode = 'static';
    sprite.cursor = 'pointer';

    let isDown = false;
    let isOver = false;

    sprite.on('pointerover', () => {
      isOver = true;
      if (!isDown) sprite.texture = hover;
    });

    sprite.on('pointerout', () => {
      isOver = false;
      isDown = false;
      sprite.texture = normal;
    });

    sprite.on('pointerdown', () => {
      isDown = true;
      sprite.texture = down;
    });

    sprite.on('pointerup', () => {
      if (!isDown) return;
      isDown = false;
      sprite.texture = isOver ? hover : normal;
      onRelease();
    });

    sprite.on('pointerupoutside', () => {
      isDown = false;
      sprite.texture = isOver ? hover : normal;
    });

    this.addChild(sprite);
    return sprite;
  }

  private createSprite(frame: string, x: number, y: number): Sprite | null {
    const texture = this.getTexture(frame);
    if (!texture) return null;

    const sprite = new Sprite(texture);
    sprite.x = x;
    sprite.y = y;
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
      anchorX: number;
      align: 'left' | 'center' | 'right';
      fontWeight: any;
    }
  ): Text {
    const text = new Text({
      text: value,
      style: new TextStyle({
        fontFamily: styleOptions.fontFamily,
        fontSize: styleOptions.fontSize,
        fill: styleOptions.fill,
        align: styleOptions.align,
        fontWeight: styleOptions.fontWeight
      })
    });

    text.anchor.set(styleOptions.anchorX, 0);
    text.x = x;
    text.y = y;
    this.addChild(text);
    return text;
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

  private getSpinValues(): number[] {
    const configValues = this.get('buttons.spin.values');
    if (Array.isArray(configValues)) {
      const parsed = configValues
        .map((value) => toNumber(value, NaN))
        .filter((value) => Number.isFinite(value) && value > 0)
        .map((value) => Math.floor(value));

      if (parsed.length >= 1) {
        return parsed;
      }
    }

    return [10, 20, 50, 100, 1000];
  }

  private getSpinPositions(): Array<{ x: number; y: number }> {
    const cfg = this.get('buttons.spin.positions');
    const count = this.spinValues.length;

    if (Array.isArray(cfg) && cfg.length >= count) {
      const parsed = cfg
        .slice(0, count)
        .map((item) => ({
          x: toNumber(item && (item as any).x, NaN),
          y: toNumber(item && (item as any).y, NaN)
        }));

      if (parsed.every((item) => Number.isFinite(item.x) && Number.isFinite(item.y))) {
        return parsed;
      }
    }

    return [
      { x: 963, y: 427 },
      { x: 1190, y: 427 },
      { x: 1417, y: 427 },
      { x: 1070, y: 554 },
      { x: 1297, y: 554 }
    ].slice(0, count);
  }
}




