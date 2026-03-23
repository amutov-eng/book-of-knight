import { Assets, Cache, Container, Graphics, Rectangle, Sprite, Text, TextStyle, Texture } from 'pixi.js';
import type BaseGame from '../core/BaseGame';
import { APP_FONT_WEIGHT_LIGHT, APP_FONT_WEIGHT_REGULAR } from '../config/fontConfig';
import { fitPixiTextToBounds } from './utils/fitText';
import { formatCentsByPattern, getDefaultNumberPattern } from '../utils/numberFormat';

function toNumber(value: unknown, fallback = 0): number {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function getLocalized(game: any, key: string, fallback: string): string {
  if (game && game.localization && typeof game.localization.t === 'function') {
    return String(game.localization.t(key, {}, { defaultValue: fallback }));
  }
  return fallback;
}

function getNumberPattern(game: any): string {
  if (!game || !game.gsLink || typeof game.gsLink.getNumberPattern !== 'function') {
    return getDefaultNumberPattern();
  }
  const pattern = game.gsLink.getNumberPattern();
  return typeof pattern === 'string' && pattern.trim().length > 0 ? pattern : getDefaultNumberPattern();
}

function formatMoney(value: number, game: any): string {
  return formatCentsByPattern(Math.max(0, Math.round(value)), getNumberPattern(game));
}

type TabId = 'paytable' | 'settings' | 'rules';

type ToggleControl = {
  root: Sprite;
  label: Text;
  setSelected: (selected: boolean) => void;
  setEnabled: (enabled: boolean) => void;
};

type PushButton = {
  root: Sprite;
  setEnabled: (enabled: boolean) => void;
};

type TextButton = {
  root: Sprite;
  label: Text;
  setText: (value: string) => void;
  setSelected: (selected: boolean) => void;
};

type TabButton = {
  root: Sprite;
  label: Text;
  setSelected: (selected: boolean) => void;
};

type PaySymbol = {
  frame: string;
  descriptionKey?: string;
  descriptionFallback?: string;
  pays: Array<{ count: number; mult: number }>;
};

const PAYTABLE_PAGE_1: PaySymbol[] = [
  {
    frame: 'book_blur_01.png',
    descriptionKey: 'paytableScatter',
    descriptionFallback: 'This symbol is both WILD and SCATTER.',
    pays: [
      { count: 5, mult: 1000 },
      { count: 4, mult: 40 },
      { count: 3, mult: 2 }
    ]
  },
  { frame: '10_blur_01.png', pays: [{ count: 5, mult: 100 }, { count: 4, mult: 20 }, { count: 3, mult: 5 }] },
  { frame: 'J_blur_01.png', pays: [{ count: 5, mult: 100 }, { count: 4, mult: 20 }, { count: 3, mult: 5 }] },
  { frame: 'Q_blur_01.png', pays: [{ count: 5, mult: 100 }, { count: 4, mult: 20 }, { count: 3, mult: 5 }] },
  { frame: 'K_blur_01.png', pays: [{ count: 5, mult: 150 }, { count: 4, mult: 30 }, { count: 3, mult: 5 }] }
];

const PAYTABLE_PAGE_2: PaySymbol[] = [
  { frame: 'A_blur_01.png', pays: [{ count: 5, mult: 150 }, { count: 4, mult: 30 }, { count: 3, mult: 5 }] },
  { frame: 'torch_blur_01.png', pays: [{ count: 5, mult: 750 }, { count: 4, mult: 100 }, { count: 3, mult: 20 }] },
  { frame: 'axe_blur_01.png', pays: [{ count: 5, mult: 750 }, { count: 4, mult: 100 }, { count: 3, mult: 20 }] },
  { frame: 'chalice_blur_01.png', pays: [{ count: 5, mult: 2000 }, { count: 4, mult: 400 }, { count: 3, mult: 30 }] },
  { frame: 'knight_blur_01.png', pays: [{ count: 5, mult: 5000 }, { count: 4, mult: 1000 }, { count: 3, mult: 100 }, { count: 2, mult: 5 }] }
];

const PAYTABLE_GOLD_PAGE: PaySymbol[] = [
  { frame: 'knight_blur_01.png', pays: [{ count: 5, mult: 5000 }, { count: 4, mult: 1000 }, { count: 3, mult: 100 }, { count: 2, mult: 5 }] },
  { frame: 'chalice_blur_01.png', pays: [{ count: 5, mult: 2000 }, { count: 4, mult: 400 }, { count: 3, mult: 30 }] },
  { frame: 'axe_blur_01.png', pays: [{ count: 5, mult: 750 }, { count: 4, mult: 100 }, { count: 3, mult: 20 }] },
  { frame: 'torch_blur_01.png', pays: [{ count: 5, mult: 750 }, { count: 4, mult: 100 }, { count: 3, mult: 20 }] },
  { frame: 'A_blur_01.png', pays: [{ count: 5, mult: 150 }, { count: 4, mult: 30 }, { count: 3, mult: 5 }] },
  { frame: 'K_blur_01.png', pays: [{ count: 5, mult: 150 }, { count: 4, mult: 30 }, { count: 3, mult: 5 }] },
  { frame: 'Q_blur_01.png', pays: [{ count: 5, mult: 100 }, { count: 4, mult: 20 }, { count: 3, mult: 5 }] },
  { frame: 'J_blur_01.png', pays: [{ count: 5, mult: 100 }, { count: 4, mult: 20 }, { count: 3, mult: 5 }] },
  { frame: '10_blur_01.png', pays: [{ count: 5, mult: 100 }, { count: 4, mult: 20 }, { count: 3, mult: 5 }] }
];

const PAYLINE_PATTERNS: number[][] = [
  [1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0],
  [2, 2, 2, 2, 2],
  [0, 1, 2, 1, 0],
  [2, 1, 0, 1, 2],
  [0, 0, 1, 0, 0],
  [2, 2, 1, 2, 2],
  [1, 0, 0, 0, 1],
  [1, 2, 2, 2, 1],
  [0, 1, 1, 1, 0]
];

export default class HelpMenu extends Container {
  private static readonly SCREEN_WIDTH = 1920;
  private static readonly SCREEN_HEIGHT = 1080;
  private readonly game: BaseGame & Record<string, any>;
  private readonly onClose: () => void;
  private readonly textureCache = new Map<string, Texture | null>();

  private readonly overlay: Graphics;
  private readonly panel: Sprite | null;
  private readonly titleText: Text;
  private readonly pageText: Text;
  private readonly logoSprite: Sprite | null;
  private readonly historyButton: TabButton | null;
  private readonly closeButton: PushButton | null;
  private readonly prevButton: PushButton | null;
  private readonly nextButton: PushButton | null;

  private readonly tabButtons: Record<TabId, TabButton | null>;
  private readonly pageContainers: Record<TabId, Container>;

  private readonly payPages: Container[];
  private readonly rulesPages: Container[];
  private readonly settingsPage: Container;
  private readonly paytableValueTexts: Array<{ text: Text; count: number; mult: number }>;

  private readonly settingsToggles: {
    soundOn: ToggleControl | null;
    gameSounds: ToggleControl | null;
    music: ToggleControl | null;
    skipIntro: ToggleControl | null;
    turbo: ToggleControl | null;
    skipScreen: ToggleControl | null;
  };

  private readonly volumeValueText: Text;
  private readonly settingsInfoText: Text;
  private readonly rulesRtpText: Text;
  private readonly rulesBuyFreeRtpText: Text;
  private readonly rulesBuyHoldRtpText: Text;
  private lobbyButton: TextButton | null;
  private volumeMinusButton: PushButton | null;
  private volumePlusButton: PushButton | null;

  private activeTab: TabId = 'paytable';
  private payPageIndex = 0;
  private rulesPageIndex = 0;
  private lastRefreshKey = '';

  constructor(game: BaseGame, onClose: () => void) {
    super();

    this.game = game as BaseGame & Record<string, any>;
    this.onClose = onClose;

    this.overlay = new Graphics()
      .rect(0, 0, HelpMenu.SCREEN_WIDTH, HelpMenu.SCREEN_HEIGHT)
      .fill({ color: 0x000000, alpha: 0.08 });
    this.overlay.eventMode = 'static';
    this.overlay.cursor = 'default';
    this.overlay.on('pointertap', () => this.hide());
    this.addChild(this.overlay);

    this.panel = this.createResolvedMenuBackground();
    if (this.panel) {
      this.panel.width = HelpMenu.SCREEN_WIDTH;
      this.panel.height = HelpMenu.SCREEN_HEIGHT;

      const blocker = new Container();
      blocker.eventMode = 'static';
      blocker.hitArea = new Rectangle(this.panel.x, this.panel.y, this.panel.width, this.panel.height);
      blocker.on('pointertap', (event) => event.stopPropagation());
      this.addChild(blocker);
    }

    this.titleText = this.createText('', 960, 98, {
      fontSize: 58,
      fill: 0x93a7bf,
      anchorX: 0.5
    });
    this.pageText = this.createText('', 1745, 925, {
      fontSize: 28,
      fill: 0xffffff,
      anchorX: 0.5
    });
    this.logoSprite = this.createSprite('logo.png', 18, 0);
    if (this.logoSprite) {
      this.logoSprite.scale.set(0.76);
      this.logoSprite.position.set(18, 8);
      this.addChild(this.logoSprite);
    }

    this.closeButton = this.createButton('button_close_001.png', 'button_close_002.png', 1711, 928, () => this.hide(), false);
    this.prevButton = this.createButton('button_arrow_l_001.png', 'button_arrow_l_002.png', 1610, 805, () => this.changePage(-1), false);
    this.nextButton = this.createButton('button_arrow_r_001.png', 'button_arrow_r_002.png', 1710, 805, () => this.changePage(1), false);
    this.historyButton = this.createTabButton('button_history', 94, 768, 'helpHistory', 'HISTORY', () => undefined, false);

    this.tabButtons = {
      paytable: this.createTabButton('button_pay', 354, 768, 'helpPay', 'PAYTABLE', () => this.selectTab('paytable'), false),
      settings: this.createTabButton('button_sett', 874, 768, 'helpSettings', 'SETTINGS', () => this.selectTab('settings'), false),
      rules: this.createTabButton('button_rules', 1394, 768, 'helpRules', 'RULES', () => this.selectTab('rules'), false)
    };

    this.settingsToggles = {
      soundOn: null,
      gameSounds: null,
      music: null,
      skipIntro: null,
      turbo: null,
      skipScreen: null
    };

    this.volumeValueText = this.createText('', 258, 609, {
      fontSize: 38,
      fill: 0xb9c5d3,
      anchorX: 0.5
    });
    this.settingsInfoText = this.createText('', 614, 720, {
      fontSize: 26,
      fill: 0xb9c5d3,
      anchorX: 0.5,
      maxWidth: 320
    });
    this.rulesRtpText = this.createText('', 20, 690, { fontSize: 28, fill: 0xffffff, maxWidth: 820 });
    this.rulesBuyFreeRtpText = this.createText('', 20, 734, { fontSize: 28, fill: 0xffffff, maxWidth: 820 });
    this.rulesBuyHoldRtpText = this.createText('', 20, 778, { fontSize: 28, fill: 0xffffff, maxWidth: 820 });
    this.lobbyButton = null;
    this.volumeMinusButton = null;
    this.volumePlusButton = null;

    this.pageContainers = {
      paytable: new Container(),
      settings: new Container(),
      rules: new Container()
    };
    this.paytableValueTexts = [];

    for (const tab of Object.values(this.pageContainers)) this.addChild(tab);

    this.payPages = [
      this.buildHoldAndWinPage(),
      this.buildFreeGamesPage(),
      this.buildPaytablePage(PAYTABLE_PAGE_1),
      this.buildPaytablePage(PAYTABLE_PAGE_2),
      this.buildPaylinesPage()
    ];

    this.rulesPages = [
      this.buildRulesHowToPage(),
      this.buildRulesBetSettingsPage(),
      this.buildRulesLinesPage(),
      this.buildRulesExtraPage(),
      this.buildRulesAddFreeGamesPage()
    ];

    this.settingsPage = this.buildSettingsPage();

    for (const page of this.payPages) {
      page.visible = false;
      this.pageContainers.paytable.addChild(page);
    }

    for (const page of this.rulesPages) {
      page.visible = false;
      this.pageContainers.rules.addChild(page);
    }

    this.settingsPage.visible = false;
    this.pageContainers.settings.addChild(this.settingsPage);

    this.visible = false;
  }

  isOpen(): boolean {
    return this.visible;
  }

  show(): void {
    this.selectTab('paytable', true);
    this.refresh();
    this.visible = true;
  }

  hide(notify = true): void {
    const wasVisible = this.visible;
    this.visible = false;
    if (notify && wasVisible) {
      this.onClose();
    }
  }

  private refresh(): void {
    const key = [
      this.activeTab,
      this.payPageIndex,
      this.rulesPageIndex,
      this.getSettingBool('audioEnabled', true) ? 1 : 0,
      this.getSettingBool('gameSoundsEnabled', true) ? 1 : 0,
      this.getSettingBool('musicEnabled', true) ? 1 : 0,
      this.getSettingBool('skipIntro', false) ? 1 : 0,
      !!this.game?.context?.skipScreen ? 1 : 0,
      !!this.game?.context?.turboGame ? 1 : 0,
      !!this.game?.context?.turboSpinIsEnabled ? 1 : 0,
      this.getVolumeStep(),
      this.game?.context?.gamePercent ?? '',
      this.game?.context?.gamePercentBuyFree ?? '',
      this.game?.context?.gamePercentBuyHold ?? ''
    ].join('|');

    if (key === this.lastRefreshKey) {
      return;
    }
    this.lastRefreshKey = key;

    this.refreshTitles();
    this.refreshPageVisibility();
    this.refreshPaytableAmounts();
    this.refreshSettingsControls();
    this.refreshRulesFooter();
  }

  private refreshPaytableAmounts(): void {
    const lineBet = this.getLineBet();
    for (let i = 0; i < this.paytableValueTexts.length; i += 1) {
      const item = this.paytableValueTexts[i];
      item.text.text = `${item.count}x   ${formatMoney(item.mult * lineBet, this.game)}`;
    }
  }

  private refreshTitles(): void {
    let title = '';
    if (this.activeTab === 'settings') {
      title = getLocalized(this.game, 'settingsTitle', 'SETTINGS');
    } else if (this.activeTab === 'rules') {
      title = getLocalized(this.game, 'rulesTitle', 'RULES');
    } else {
      const payTitles = [
        getLocalized(this.game, 'splashTitle', 'HOLD AND WIN'),
        getLocalized(this.game, 'splashSecTitle', 'FREE GAMES'),
        getLocalized(this.game, 'paytableTitle', 'PAYTABLE'),
        getLocalized(this.game, 'paytableTitle', 'PAYTABLE'),
        getLocalized(this.game, 'paylinesTitle', 'PAYLINES')
      ];
      title = payTitles[this.payPageIndex] || getLocalized(this.game, 'paytableTitle', 'PAYTABLE');
    }

    this.titleText.text = title;
    fitPixiTextToBounds(this.titleText, { maxWidth: 760, minFontSize: 28 });

    const pagePrefix = getLocalized(this.game, 'helpPages', 'PAGE');
    if (this.activeTab === 'settings') {
      this.pageText.visible = false;
      if (this.prevButton) this.prevButton.root.visible = false;
      if (this.nextButton) this.nextButton.root.visible = false;
      return;
    }

    const pageIndex = this.activeTab === 'rules' ? this.rulesPageIndex : this.payPageIndex;
    const totalPages = this.activeTab === 'rules' ? this.rulesPages.length : this.payPages.length;
    this.pageText.visible = true;
    this.pageText.text = `${pagePrefix} ${pageIndex + 1}/${totalPages}`;
    fitPixiTextToBounds(this.pageText, { maxWidth: 180, minFontSize: 18 });
    this.pageText.position.set(1750, 925);
    if (this.prevButton) this.prevButton.root.visible = true;
    if (this.nextButton) this.nextButton.root.visible = true;
  }

  private refreshPageVisibility(): void {
    this.pageContainers.paytable.visible = this.activeTab === 'paytable';
    this.pageContainers.settings.visible = this.activeTab === 'settings';
    this.pageContainers.rules.visible = this.activeTab === 'rules';

    for (let i = 0; i < this.payPages.length; i += 1) {
      this.payPages[i].visible = this.activeTab === 'paytable' && i === this.payPageIndex;
    }

    for (let i = 0; i < this.rulesPages.length; i += 1) {
      this.rulesPages[i].visible = this.activeTab === 'rules' && i === this.rulesPageIndex;
    }

    this.settingsPage.visible = this.activeTab === 'settings';

    for (const [tabId, button] of Object.entries(this.tabButtons) as Array<[TabId, TabButton | null]>) {
      button?.setSelected(tabId === this.activeTab);
    }
  }

  private refreshSettingsControls(): void {
    const audioEnabled = this.getSettingBool('audioEnabled', true);
    const gameSoundsEnabled = this.getSettingBool('gameSoundsEnabled', true) && audioEnabled;
    const musicEnabled = this.getSettingBool('musicEnabled', true) && audioEnabled;
    const skipIntro = this.getSettingBool('skipIntro', false);
    const skipScreen = !!this.game?.context?.skipScreen;
    const turboAllowed = this.game?.context?.turboSpinIsEnabled !== false;
    const turboEnabled = !!this.game?.context?.turboGame && turboAllowed;

    this.settingsToggles.soundOn?.setSelected(audioEnabled);
    this.settingsToggles.soundOn?.setEnabled(true);

    this.settingsToggles.gameSounds?.setSelected(gameSoundsEnabled);
    this.settingsToggles.gameSounds?.setEnabled(audioEnabled);
    if (this.settingsToggles.gameSounds) this.settingsToggles.gameSounds.root.alpha = audioEnabled ? 1 : 0.45;

    this.settingsToggles.music?.setSelected(musicEnabled);
    this.settingsToggles.music?.setEnabled(audioEnabled);
    if (this.settingsToggles.music) this.settingsToggles.music.root.alpha = audioEnabled ? 1 : 0.45;

    this.settingsToggles.skipIntro?.setSelected(skipIntro);
    this.settingsToggles.skipScreen?.setSelected(skipScreen);
    this.settingsToggles.turbo?.setSelected(turboEnabled);
    this.settingsToggles.turbo?.setEnabled(turboAllowed);
    if (this.settingsToggles.turbo) this.settingsToggles.turbo.root.alpha = turboAllowed ? 1 : 0.35;

    this.volumeValueText.text = `${this.getVolumePercent()}`;
    this.settingsInfoText.text = getLocalized(this.game, 'settingsTurboSpinTxt', 'Play faster by skipping animations');
    this.settingsInfoText.alpha = turboAllowed ? 1 : 0.35;
    fitPixiTextToBounds(this.settingsInfoText, { maxWidth: 360, minFontSize: 18 });

    const canGoLobby = !!(this.game?.gsLink && typeof this.game.gsLink.onHomeButton === 'function');
    if (this.lobbyButton) {
      this.lobbyButton.root.visible = canGoLobby;
    }
  }

  private refreshRulesFooter(): void {
    const gamePercent = this.game?.context?.gamePercent;
    const gamePercentBuyFree = this.game?.context?.gamePercentBuyFree;
    const gamePercentBuyHold = this.game?.context?.gamePercentBuyHold;

    const rtp = this.normalizePercentValue(gamePercent);
    const rtpBuyFree = this.normalizePercentValue(gamePercentBuyFree);
    const rtpBuyHold = this.normalizePercentValue(gamePercentBuyHold);

    this.rulesRtpText.text = rtp
      ? `${getLocalized(this.game, 'rulesGamePercent', 'The theoretical return percentage, which does not include the jackpot, is:')} ${rtp}`
      : '';
    this.rulesBuyFreeRtpText.text = rtpBuyFree
      ? `${getLocalized(this.game, 'rulesGamePercentBuyFree', "The theoretical return percentage for the 'BUY BONUS FREE GAMES' feature is:")} ${rtpBuyFree}`
      : '';
    this.rulesBuyHoldRtpText.text = rtpBuyHold
      ? `${getLocalized(this.game, 'rulesGamePercentBuyHold', "The theoretical return percentage for the 'BUY BONUS HOLD AND WIN' feature is:")} ${rtpBuyHold}`
      : '';

    const showRulesRtp = this.activeTab === 'rules' && this.rulesPageIndex === 2;
    const showBonusRtp = this.activeTab === 'rules' && this.rulesPageIndex === 3;
    this.rulesRtpText.visible = showRulesRtp && this.rulesRtpText.text.length > 0;
    this.rulesBuyFreeRtpText.visible = showBonusRtp && this.rulesBuyFreeRtpText.text.length > 0;
    this.rulesBuyHoldRtpText.visible = showBonusRtp && this.rulesBuyHoldRtpText.text.length > 0;
  }

  private normalizePercentValue(value: unknown): string {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      return `${value}%`;
    }
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    if (!trimmed || trimmed === '0' || trimmed === '0%') return '';
    return trimmed;
  }

  private selectTab(tab: TabId, force = false): void {
    if (!force && this.activeTab === tab) return;
    this.activeTab = tab;
    if (tab === 'paytable') this.payPageIndex = 0;
    if (tab === 'rules') this.rulesPageIndex = 0;
    this.lastRefreshKey = '';
    this.refresh();
  }

  private changePage(direction: number): void {
    if (this.activeTab === 'settings') return;

    if (this.activeTab === 'paytable') {
      const total = this.payPages.length;
      this.payPageIndex = (this.payPageIndex + direction + total) % total;
    } else {
      const total = this.rulesPages.length;
      this.rulesPageIndex = (this.rulesPageIndex + direction + total) % total;
    }

    this.lastRefreshKey = '';
    this.refresh();
  }

  private buildHoldAndWinPage(): Container {
    const page = new Container();
    const shields = ['mega_blur_01.png', 'major_blur_01.png', 'mini_blur_01.png', 'shield_blur_01.png'];

    for (let i = 0; i < shields.length; i += 1) {
      const sprite = this.createSprite(shields[i], 0, 0);
      if (!sprite) continue;
      sprite.scale.set(0.7);
      this.placeLegacy(sprite, 500 + i * sprite.texture.width * 0.7, 690);
      page.addChild(sprite);
    }

    const text1 = this.createLegacyBodyText(getLocalized(this.game, 'splashTxt', ''), 200, 690, 1580, 30);
    const text2 = this.createLegacyBodyText(getLocalized(this.game, 'splashTxt2', ''), 200, 600, 1580, 30);
    const text3 = this.createLegacyBodyText(getLocalized(this.game, 'splashTxt3', ''), 200, 450, 1580, 30);
    page.addChild(text1);
    page.addChild(text2);
    page.addChild(text3);
    return page;
  }

  private buildFreeGamesPage(): Container {
    const page = new Container();

    const book = this.createSprite('book_blur_01.png', 0, 0);
    if (book) {
      book.scale.set(0.7);
      this.placeLegacy(book, 346, 590);
      page.addChild(book);
    }

    const wildTitle = this.createSectionTitle(getLocalized(this.game, 'splashSecTitleWild', 'SCATTER / WILD'), 391, 0);
    const specialTitle = this.createSectionTitle(getLocalized(this.game, 'splashSecTitleSpecial', 'SPECIAL SYMBOLS'), 1073, 0);
    this.placeLegacy(wildTitle, 391, 870);
    this.placeLegacy(specialTitle, 1073, 870);
    page.addChild(wildTitle);
    page.addChild(specialTitle);

    const specialFrames = ['10_blur_01.png', 'J_blur_01.png', 'Q_blur_01.png', 'K_blur_01.png', 'A_blur_01.png', 'torch_blur_01.png', 'axe_blur_01.png', 'chalice_blur_01.png', 'knight_blur_01.png'];
    for (let i = 0; i < specialFrames.length; i += 1) {
      const sprite = this.createSprite(specialFrames[i], 0, 0);
      if (!sprite) continue;
      sprite.scale.set(0.3);
      sprite.tint = 0xffdc57;
      if (i < 5) {
        this.placeLegacy(sprite, 900 + i * sprite.texture.width * 0.35, 665);
      } else {
        this.placeLegacy(sprite, 900 + 48 + (i % 5) * sprite.texture.width * 0.35, 665 - sprite.texture.height * 0.35);
      }
      page.addChild(sprite);
    }

    const text1 = this.createLegacyBodyText(getLocalized(this.game, 'splashSecTxt', ''), 210, 568, 1520, 30);
    const text2 = this.createLegacyBodyText(getLocalized(this.game, 'splashSecTxt2', ''), 210, 484, 1520, 30);
    const text3 = this.createLegacyBodyText(getLocalized(this.game, 'splashSecTxt3', ''), 210, 400, 1520, 30);
    page.addChild(text1);
    page.addChild(text2);
    page.addChild(text3);
    return page;
  }

  private buildPaytablePage(symbols: PaySymbol[]): Container {
    return symbols === PAYTABLE_PAGE_1
      ? this.buildPrimaryPaytablePage()
      : this.buildGoldPaytablePage();
  }

  private buildPrimaryPaytablePage(): Container {
    const page = new Container();

    const topSymbol = this.createSprite('book_blur_01.png', 0, 0);
    if (topSymbol) {
      topSymbol.scale.set(0.5);
      this.placeLegacy(topSymbol, 660, 800);
      page.addChild(topSymbol);
    }

    const description = this.createLegacyBodyText(getLocalized(this.game, 'paytableScatter', ''), 850, 860, 720, 28);
    page.addChild(description);

    this.addPayoutColumn(page, PAYTABLE_PAGE_1[0].pays, 483, 884, 32, false, true);

    const items = [
      { symbol: PAYTABLE_PAGE_2[4], x: 165, y: 570, paysX: 365, paysY: 674, four: true },
      { symbol: PAYTABLE_PAGE_2[3], x: 575, y: 600, paysX: 745, paysY: 674 },
      { symbol: PAYTABLE_PAGE_2[2], x: 970, y: 600, paysX: 1130, paysY: 674 },
      { symbol: PAYTABLE_PAGE_2[1], x: 1365, y: 600, paysX: 1525, paysY: 674 },
      { symbol: PAYTABLE_PAGE_2[0], x: 110, y: 400, paysX: 260, paysY: 506 },
      { symbol: PAYTABLE_PAGE_1[4], x: 440, y: 400, paysX: 590, paysY: 506 },
      { symbol: PAYTABLE_PAGE_1[3], x: 770, y: 400, paysX: 920, paysY: 506 },
      { symbol: PAYTABLE_PAGE_1[2], x: 1100, y: 400, paysX: 1250, paysY: 506 },
      { symbol: PAYTABLE_PAGE_1[1], x: 1430, y: 400, paysX: 1580, paysY: 506 }
    ];

    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      this.addPaytableSymbolBlock(page, item.symbol, item.x, item.y, false, item.paysX, item.paysY, !!item.four, true);
    }

    return page;
  }

  private buildGoldPaytablePage(): Container {
    const page = new Container();
    const items = [
      { symbol: PAYTABLE_GOLD_PAGE[0], x: 145, y: 671, paysX: 335, paysY: 743, four: true },
      { symbol: PAYTABLE_GOLD_PAGE[1], x: 585, y: 688, paysX: 755, paysY: 743 },
      { symbol: PAYTABLE_GOLD_PAGE[2], x: 990, y: 688, paysX: 1150, paysY: 743 },
      { symbol: PAYTABLE_GOLD_PAGE[3], x: 1410, y: 688, paysX: 1570, paysY: 743 },
      { symbol: PAYTABLE_GOLD_PAGE[4], x: 110, y: 488, paysX: 260, paysY: 558 },
      { symbol: PAYTABLE_GOLD_PAGE[5], x: 450, y: 488, paysX: 600, paysY: 558 },
      { symbol: PAYTABLE_GOLD_PAGE[6], x: 790, y: 488, paysX: 940, paysY: 558 },
      { symbol: PAYTABLE_GOLD_PAGE[7], x: 1130, y: 488, paysX: 1280, paysY: 558 },
      { symbol: PAYTABLE_GOLD_PAGE[8], x: 1470, y: 488, paysX: 1620, paysY: 558 }
    ];

    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      this.addPaytableSymbolBlock(page, item.symbol, item.x, item.y, true, item.paysX, item.paysY, !!item.four, true);
    }

    return page;
  }

  private addPaytableSymbolBlock(
    page: Container,
    symbol: PaySymbol,
    x: number,
    y: number,
    gold: boolean,
    paysX: number,
    paysY: number,
    includeFourRows = false,
    legacyY = false
  ): void {
    const sprite = this.createSprite(symbol.frame, 0, 0);
    if (sprite) {
      sprite.scale.set(gold ? 0.45 : 0.5);
      if (legacyY) {
        this.placeLegacy(sprite, x, y);
      } else {
        sprite.position.set(x, y);
      }
      if (gold) {
        sprite.tint = 0xffdc57;
        const frameX = sprite.x - 6;
        const frameY = sprite.y - 6;
        const frame = new Graphics()
          .rect(frameX, frameY, sprite.width + 12, sprite.height + 12)
          .fill({ color: 0xd19a12, alpha: 0.85 })
          .stroke({ color: 0xffef9f, width: 3, alpha: 1 });
        page.addChild(frame);
      }
      page.addChild(sprite);
    }

    this.addPayoutColumn(page, symbol.pays, paysX, paysY, 32, includeFourRows, legacyY);
  }

  private addPayoutColumn(
    page: Container,
    pays: Array<{ count: number; mult: number }>,
    x: number,
    y: number,
    fontSize: number,
    includeFourRows = false,
    legacyY = false
  ): void {
    for (let i = 0; i < pays.length; i += 1) {
      const pay = pays[i];
      if (!includeFourRows && pay.count < 3) continue;
      const rowY = y + i * (fontSize + 10);
      const countText = this.createText(String(pay.count), x, legacyY ? 0 : rowY, {
        fontSize,
        fill: 0xffc72f,
        anchorX: 0
      });
      const valueText = this.createText('', x + 32, legacyY ? 0 : rowY, {
        fontSize,
        fill: 0xffffff,
        anchorX: 0
      });
      if (legacyY) {
        this.placeLegacy(countText, x, rowY);
        this.placeLegacy(valueText, x + 32, rowY);
      }
      this.paytableValueTexts.push({ text: valueText, count: pay.count, mult: pay.mult });
      page.addChild(countText);
      page.addChild(valueText);
    }
  }

  private buildPaylinesPage(): Container {
    const page = new Container();
    const text = this.createLegacyBodyText(getLocalized(this.game, 'paylinesTxt', ''), 310, 445, 1300, 28, 'center');
    text.anchor.set(0.5, 0);
    text.position.x = HelpMenu.SCREEN_WIDTH / 2;
    page.addChild(text);

    const text2Value = getLocalized(this.game, 'paylinesTxt2', '');
    if (text2Value.trim().length > 0) {
      const text2 = this.createLegacyBodyText(text2Value, 310, 365, 1300, 28, 'center');
      text2.anchor.set(0.5, 0);
      text2.position.x = HelpMenu.SCREEN_WIDTH / 2;
      page.addChild(text2);
    }

    for (let i = 0; i < PAYLINE_PATTERNS.length; i += 1) {
      const preview = this.createPaylinePreview(PAYLINE_PATTERNS[i], i);
      const x = i > 4 ? 500 + (i % 5) * 260 : 500 + i * 260;
      const y = i > 4 ? 650 : 800;
      this.placeLegacy(preview, x, y);
      page.addChild(preview);
    }

    return page;
  }

  private createPaylinePreview(pattern: number[], index: number): Container {
    const preview = new Container();
    const width = 170;
    const height = 93;
    const cellW = 34;
    const cellH = 31;

    const box = new Graphics()
      .roundRect(0, 0, width, height, 4)
      .fill({ color: 0xeceef5, alpha: 1 })
      .stroke({ color: 0x6f7fc2, width: 2, alpha: 1 });
    preview.addChild(box);

    const lane = new Graphics();
    for (let reel = 0; reel < 5; reel += 1) {
      for (let row = 0; row < 3; row += 1) {
        lane.rect(reel * cellW, row * cellH, cellW, cellH);
      }
    }
    lane.stroke({ color: 0x6f7fc2, width: 1, alpha: 1 });
    preview.addChild(lane);

    const marks = new Graphics();
    for (let reel = 0; reel < pattern.length; reel += 1) {
      marks.rect(reel * cellW + 1, pattern[reel] * cellH + 1, cellW - 2, cellH - 2);
    }
    marks.fill({ color: 0xf13716, alpha: 1 });
    preview.addChild(marks);

    const label = new Text({
      text: `${getLocalized(this.game, 'paylinesLine', 'Line')} ${index + 1}`,
      style: new TextStyle({
        fontSize: 26,
        fill: 0xffffff,
        fontWeight: APP_FONT_WEIGHT_REGULAR
      })
    });
    label.anchor.set(0.5);
    label.position.set(width / 2, -14);
    preview.addChild(label);
    return preview;
  }

  private buildRulesHowToPage(): Container {
    const page = new Container();
    const minBet = this.createLegacyBodyText(this.getMinBetLabel(), 0, 910, 920, 28);
    const maxBet = this.createLegacyBodyText(this.getMaxBetLabel(), 0, 950, 920, 28);
    page.addChild(minBet);
    page.addChild(maxBet);

    const iconFrames = [
      ['button_settings_001.png', 210, 750, 0.4],
      ['button_bet_001.png', 210, 685, 0.4],
      ['button_start_001.png', 210, 620, 0.2],
      ['button_autoplay_001.png', 210, 555, 0.4],
      ['button_autoX_001.png', 200, 320, 0.4]
    ];

    for (let i = 0; i < iconFrames.length; i += 1) {
      const [frame, x, y, scale] = iconFrames[i] as [string, number, number, number];
      const sprite = this.createSprite(frame, 0, 0);
      if (sprite) {
        sprite.scale.set(scale);
        this.placeLegacy(sprite, x, y);
        page.addChild(sprite);
      }
    }

    const interfaceText = this.createLegacyBodyText(getLocalized(this.game, 'rulesInterface', ''), 220, 720, 1265, 26);
    const autoplayText = this.createLegacyBodyText(getLocalized(this.game, 'rulesAutoplay', ''), 220, 420, 1265, 26);
    page.addChild(interfaceText);
    page.addChild(autoplayText);

    return page;
  }

  private buildRulesBetSettingsPage(): Container {
    const page = new Container();
    const betMenuText = this.createLegacyBodyText(getLocalized(this.game, 'rulesBetMenu', ''), 220, 760, 1265, 26);
    const settingsText = this.createLegacyBodyText(getLocalized(this.game, 'rulesSettings', ''), 220, 480, 1265, 26);
    page.addChild(betMenuText);
    page.addChild(settingsText);

    const minus = this.createSprite('minus_001.png', 0, 0);
    const plus = this.createSprite('plus_001.png', 0, 0);
    if (minus) {
      minus.scale.set(0.8);
      this.placeLegacy(minus, 190, 760);
      page.addChild(minus);
    }
    if (plus) {
      plus.scale.set(0.8);
      this.placeLegacy(plus, 270, 760);
      page.addChild(plus);
    }

    const maxButton = this.createStaticButton('button_maxbet_001.png', 260, 680, getLocalized(this.game, 'menuBetMaxBet', 'MAX BET'), 0.5, true);
    if (maxButton) page.addChild(maxButton);

    const betButton = this.createStaticButton('button_digit_001.png', 260, 615, formatMoney(this.game?.meters?.getTotalBet?.() || 0, this.game), 0.5, true);
    if (betButton) page.addChild(betButton);

    return page;
  }

  private buildRulesLinesPage(): Container {
    const page = new Container();
    const lines = this.createLegacyBodyText(getLocalized(this.game, 'rulesLines', ''), 220, 700, 1265, 26);
    const lines2Value = getLocalized(this.game, 'rulesLines2', '');
    const unfinished = this.createLegacyBodyText(getLocalized(this.game, 'rulesUnfinished', ''), 220, 420, 1265, 26);
    page.addChild(lines);
    if (lines2Value.trim().length > 0) {
      const lines2 = this.createLegacyBodyText(lines2Value, 220, 590, 1265, 26);
      page.addChild(lines2);
    }
    page.addChild(unfinished);
    page.addChild(this.rulesRtpText);
    this.placeLegacy(this.rulesRtpText, 220, 330);
    return page;
  }

  private buildRulesExtraPage(): Container {
    const page = new Container();
    const maxWin = this.createLegacyBodyText(getLocalized(this.game, 'rulesMaxWin', ''), 220, 790, 1580, 26);
    const buyBonus = this.createLegacyBodyText(getLocalized(this.game, 'rulesBuyBonus', ''), 220, 590, 1580, 26);
    page.addChild(maxWin);
    page.addChild(buyBonus);
    page.addChild(this.rulesBuyFreeRtpText);
    page.addChild(this.rulesBuyHoldRtpText);
    this.placeLegacy(this.rulesBuyFreeRtpText, 220, 360);
    this.placeLegacy(this.rulesBuyHoldRtpText, 220, 315);
    return page;
  }

  private buildRulesAddFreeGamesPage(): Container {
    const page = new Container();
    const addFg = this.createLegacyBodyText(getLocalized(this.game, 'rulesAddFg', ''), 220, 750, 1700, 34);
    page.addChild(addFg);
    return page;
  }

  private buildSettingsPage(): Container {
    const page = new Container();

    const leftColumnX = 357;
    const rightColumnX = 1063;
    const soundY = 812;
    const soundFxY = 658;
    const musicY = 499;
    const volumeY = 345;
    const lobbyY = 812;
    const skipIntroY = 658;
    const turboY = 499;

    this.settingsToggles.soundOn = this.createToggleButton('sound_bg', leftColumnX, soundY, 'settingsSoundOn', 'SOUND ON', () => {
      const next = !this.getSettingBool('audioEnabled', true);
      this.setSettingBool('audioEnabled', next);
      if (!next) {
        this.setSettingBool('gameSoundsEnabled', false);
        this.setSettingBool('musicEnabled', false);
      } else {
        this.setSettingBool('gameSoundsEnabled', true);
        this.setSettingBool('musicEnabled', true);
      }
      this.applyAudioSettings();
      this.forceRefresh();
    });

    this.settingsToggles.gameSounds = this.createToggleButton('soundfx_bg', leftColumnX, soundFxY, 'settingsGameSounds', 'GAME SOUNDS', () => {
      if (!this.getSettingBool('audioEnabled', true)) return;
      this.setSettingBool('gameSoundsEnabled', !this.getSettingBool('gameSoundsEnabled', true));
      this.applyAudioSettings();
      this.forceRefresh();
    });

    this.settingsToggles.music = this.createToggleButton('music_bg', leftColumnX, musicY, 'settingsMusic', 'MUSIC', () => {
      if (!this.getSettingBool('audioEnabled', true)) return;
      this.setSettingBool('musicEnabled', !this.getSettingBool('musicEnabled', true));
      this.applyAudioSettings();
      this.forceRefresh();
    });

    this.settingsToggles.skipIntro = this.createToggleButton('skipscreen_bg', rightColumnX, skipIntroY, 'settingsSkipIntro', 'SKIP INTRO', () => {
      this.setSettingBool('skipIntro', !this.getSettingBool('skipIntro', false));
      this.forceRefresh();
    });

    this.settingsToggles.turbo = this.createToggleButton('turbo_bg', rightColumnX, turboY, 'settingsTurboSpin', 'TURBO SPINS', () => {
      if (this.game?.context?.turboSpinIsEnabled === false) return;
      if (this.game?.context) {
        this.game.context.turboGame = !this.game.context.turboGame;
      }
      this.forceRefresh();
    });

    this.settingsToggles.skipScreen = this.createToggleButton('skipscreen_bg', rightColumnX, 340, 'settingsSkipScreen', 'SKIP SCREENS', () => {
      if (this.game?.context) {
        this.game.context.skipScreen = !this.game.context.skipScreen;
      }
      this.forceRefresh();
    });

    if (this.settingsToggles.soundOn) page.addChild(this.settingsToggles.soundOn.root);
    if (this.settingsToggles.gameSounds) page.addChild(this.settingsToggles.gameSounds.root);
    if (this.settingsToggles.music) page.addChild(this.settingsToggles.music.root);
    if (this.settingsToggles.skipIntro) page.addChild(this.settingsToggles.skipIntro.root);
    if (this.settingsToggles.turbo) page.addChild(this.settingsToggles.turbo.root);

    const volumeBg = this.createSprite('volume_bg.png', 0, 0);
    if (volumeBg) this.placeLegacy(volumeBg, leftColumnX, volumeY);
    if (volumeBg) page.addChild(volumeBg);

    const volumeTitle = this.createText(getLocalized(this.game, 'settingsVolume', 'VOLUME'), 0, 0, {
      fontSize: 34,
      fill: 0xb9c5d3,
      anchorX: 0
    });
    this.placeLegacy(volumeTitle, leftColumnX + 80, 382);
    page.addChild(volumeTitle);
    page.addChild(this.volumeValueText);
    this.placeLegacy(this.volumeValueText, leftColumnX + 295, 382);

    this.volumeMinusButton = this.createButton('minus_001.png', 'minus_002.png', 597, 340, () => {
      this.setVolumeStep(this.getVolumeStep() - 1);
      this.applyAudioSettings();
      this.forceRefresh();
    }, true);
    this.volumePlusButton = this.createButton('plus_001.png', 'plus_002.png', 812, 340, () => {
      this.setVolumeStep(this.getVolumeStep() + 1);
      this.applyAudioSettings();
      this.forceRefresh();
    }, true);
    if (this.volumeMinusButton) page.addChild(this.volumeMinusButton.root);
    if (this.volumePlusButton) page.addChild(this.volumePlusButton.root);

    this.lobbyButton = this.createTextButton(
      'button_menu_home_001.png',
      'button_menu_home_002.png',
      rightColumnX,
      812,
      () => {
        if (this.game?.gsLink && typeof this.game.gsLink.onHomeButton === 'function') {
          this.game.gsLink.onHomeButton();
        }
      },
      {
        key: 'settingsLobby',
        fallback: 'LOBBY',
        fontSize: 38,
        maxWidth: 250
      },
      true
    );
    if (this.lobbyButton) page.addChild(this.lobbyButton.root);
    if (this.lobbyButton) this.placeLegacy(this.lobbyButton.root, rightColumnX, lobbyY);

    page.addChild(this.settingsInfoText);
    this.placeLegacy(this.settingsInfoText, rightColumnX, 430);
    return page;
  }

  private getLineBet(): number {
    const meters = this.game?.meters as any;
    if (!meters) return 0;
    const bet = typeof meters.getBetPerLine === 'function' ? Number(meters.getBetPerLine()) : toNumber(meters.bet, 0);
    const denom = typeof meters.getDenomination === 'function' ? Number(meters.getDenomination()) : toNumber(meters.denomination, 0);
    return Math.max(0, bet * denom);
  }

  private getMinBetLabel(): string {
    const meters = this.game?.meters as any;
    if (!meters) return '';
    const minBet = (toNumber(meters.MIN_BET_PER_LINE, 1) * toNumber(meters.MIN_DENOM, 1) * toNumber(meters.MIN_LINES, 10));
    const currency = typeof meters.getCurrency === 'function' ? meters.getCurrency() : 'FUN';
    return `${getLocalized(this.game, 'rulesMINbet', 'MINIMUM BET:')} ${formatMoney(minBet, this.game)} ${currency}`;
  }

  private getMaxBetLabel(): string {
    const meters = this.game?.meters as any;
    if (!meters) return '';
    const maxBet = (toNumber(meters.MAX_BET_PER_LINE, 1) * toNumber(meters.MAX_DENOM, 1) * toNumber(meters.MAX_LINES, 10));
    const currency = typeof meters.getCurrency === 'function' ? meters.getCurrency() : 'FUN';
    return `${getLocalized(this.game, 'rulesMAXbet', 'MAXIMUM BET:')} ${formatMoney(maxBet, this.game)} ${currency}`;
  }

  private createBodyText(text: string, x: number, y: number, maxWidth: number, fontSize = 28): Text {
    const body = this.createText(text, x, y, {
      fontSize,
      fill: 0xffffff,
      anchorX: 0,
      anchorY: 0,
      align: 'left',
      maxWidth
    });
    body.style.wordWrap = true;
    body.style.wordWrapWidth = maxWidth;
    return body;
  }

  private createLegacyBodyText(
    text: string,
    x: number,
    bottomY: number,
    maxWidth: number,
    fontSize = 28,
    align: 'left' | 'center' | 'right' = 'left'
  ): Text {
    const body = this.createBodyText(text, x, 0, maxWidth, fontSize);
    body.style.align = align;
    this.placeLegacy(body, x, bottomY);
    return body;
  }

  private createSectionTitle(text: string, x: number, y: number): Text {
    return this.createText(text, x, y, {
      fontSize: 34,
      fill: 0xffffff,
      anchorX: 0,
      anchorY: 0,
      align: 'left',
      maxWidth: 320
    });
  }

  private createText(
    text: string,
    x: number,
    y: number,
    options: {
      fontSize?: number;
      fill?: number;
      anchorX?: number;
      anchorY?: number;
      align?: 'left' | 'center' | 'right';
      maxWidth?: number;
    } = {}
  ): Text {
    const display = new Text({
      text,
      style: new TextStyle({
        fontFamily: 'Roboto Condensed',
        fontSize: toNumber(options.fontSize, 32),
        fill: toNumber(options.fill, 0xffffff),
        fontWeight: APP_FONT_WEIGHT_REGULAR,
        align: options.align || 'left',
        wordWrap: false
      })
    });
    display.anchor.set(toNumber(options.anchorX, 0), toNumber(options.anchorY, 0));
    display.position.set(x, y);
    if (toNumber(options.maxWidth, 0) > 0) {
      fitPixiTextToBounds(display, { maxWidth: toNumber(options.maxWidth, 0), minFontSize: 14 });
    }
    return display;
  }

  private createSprite(frame: string, x: number, y: number): Sprite | null {
    const texture = this.getTexture(frame);
    if (!texture) return null;
    const sprite = new Sprite(texture);
    sprite.position.set(x, y);
    return sprite;
  }

  private createResolvedMenuBackground(): Sprite {
    const bg = new Sprite(Texture.WHITE);
    bg.position.set(0, 0);
    bg.width = HelpMenu.SCREEN_WIDTH;
    bg.height = HelpMenu.SCREEN_HEIGHT;
    bg.alpha = 0;
    this.addChild(bg);
    void this.resolveMenuBackground(bg);
    return bg;
  }

  private async resolveMenuBackground(target: Sprite): Promise<void> {
    const candidates = [
      'assets/desktop/ui/bg_menu.png',
      '/assets/desktop/ui/bg_menu.png',
      'assets/desktop/backgrounds/bg_menu.png',
      '/assets/desktop/backgrounds/bg_menu.png',
      'assets/backgrounds/bg_menu.png',
      '/assets/backgrounds/bg_menu.png',
      'assets/ui/bg_menu.png',
      '/assets/ui/bg_menu.png',
      'bg_menu.png'
    ];

    for (let i = 0; i < candidates.length; i += 1) {
      const key = candidates[i];
      let texture = Texture.EMPTY;

      if (Cache.has(key)) {
        texture = Texture.from(key);
      } else {
        try {
          texture = await Assets.load(key);
        } catch {
          texture = Texture.EMPTY;
        }
      }

      if (texture && texture !== Texture.EMPTY) {
        target.texture = texture;
        target.alpha = 1;
        target.width = HelpMenu.SCREEN_WIDTH;
        target.height = HelpMenu.SCREEN_HEIGHT;
        return;
      }
    }
  }

  private createButton(normalFrame: string, pressedFrame: string, x: number, y: number, onTap: () => void, legacyY = false): PushButton | null {
    const normal = this.getTexture(normalFrame);
    if (!normal) return null;
    const pressed = this.getTexture(pressedFrame) || normal;
    const sprite = new Sprite(normal);
    if (legacyY) {
      this.placeLegacy(sprite, x, y);
    } else {
      sprite.position.set(x, y);
    }
    sprite.eventMode = 'static';
    sprite.cursor = 'pointer';
    let enabled = true;

    sprite.on('pointerdown', () => {
      if (!enabled) return;
      sprite.texture = pressed;
    });
    sprite.on('pointerup', () => {
      if (!enabled) return;
      sprite.texture = normal;
      onTap();
    });
    sprite.on('pointerupoutside', () => {
      sprite.texture = normal;
    });
    sprite.on('pointerout', () => {
      sprite.texture = normal;
    });

    this.addChild(sprite);
    return {
      root: sprite,
      setEnabled: (value: boolean) => {
        enabled = !!value;
        sprite.eventMode = enabled ? 'static' : 'none';
        sprite.cursor = enabled ? 'pointer' : 'default';
        sprite.alpha = enabled ? 1 : 0.45;
      }
    };
  }

  private createTextButton(
    normalFrame: string,
    pressedFrame: string,
    x: number,
    y: number,
    onTap: () => void,
    options: { key: string; fallback: string; fontSize?: number; maxWidth?: number },
    legacyY = false
  ): TextButton | null {
    const button = this.createButton(normalFrame, pressedFrame, x, y, onTap, legacyY);
    if (!button) return null;

    const label = new Text({
      text: '',
      style: new TextStyle({
        fontFamily: 'Roboto Condensed',
        fontSize: toNumber(options.fontSize, 38),
        fill: 0xbee1f5,
        fontWeight: APP_FONT_WEIGHT_REGULAR,
        align: 'center'
      })
    });
    label.anchor.set(0.5);
    label.position.set(button.root.width / 2, button.root.height / 2);
    button.root.addChild(label);

    const setText = (value: string) => {
      label.text = value;
      fitPixiTextToBounds(label, { maxWidth: toNumber(options.maxWidth, 240), minFontSize: 18 });
    };

    setText(getLocalized(this.game, options.key, options.fallback));

    return {
      root: button.root,
      label,
      setText,
      setSelected: (_selected: boolean) => undefined
    };
  }

  private createTabButton(base: string, x: number, y: number, key: string, fallback: string, onTap: () => void, legacyY = false): TabButton | null {
    const normal = this.getTexture(`${base}_001.png`);
    if (!normal) return null;
    const selected = this.getTexture(`${base}_002.png`) || normal;
    const disabled = this.getTexture(`${base}_deact.png`) || normal;
    const root = new Sprite(normal);
    if (legacyY) {
      this.placeLegacy(root, x, y);
    } else {
      root.position.set(x, y);
    }
    root.eventMode = 'static';
    root.cursor = 'pointer';
    root.on('pointerdown', () => {
      root.texture = selected;
    });
    root.on('pointerup', () => {
      onTap();
    });
    root.on('pointerupoutside', () => {
      root.texture = normal;
    });
    root.on('pointerout', () => {
      root.texture = normal;
    });

    const label = new Text({
      text: getLocalized(this.game, key, fallback),
      style: new TextStyle({
        fontFamily: 'Roboto Condensed',
        fontSize: 30,
        fill: 0xbee1f5,
        fontWeight: APP_FONT_WEIGHT_REGULAR,
        align: 'center'
      })
    });
    label.anchor.set(0.5);
    label.position.set(root.x + root.width / 2, root.y + root.height + 34);
    fitPixiTextToBounds(label, { maxWidth: 210, minFontSize: 16 });
    this.addChild(root);
    this.addChild(label);

    return {
      root,
      label,
      setSelected: (value: boolean) => {
        root.texture = value ? selected : disabled;
        label.alpha = value ? 1 : 0.65;
      }
    };
  }

  private createToggleButton(base: string, x: number, y: number, key: string, fallback: string, onTap: () => void, legacyY = true): ToggleControl | null {
    const normal = this.getTexture(`${base}_001.png`);
    if (!normal) return null;
    const selected = this.getTexture(`${base}_002.png`) || normal;
    const root = new Sprite(normal);
    if (legacyY) {
      this.placeLegacy(root, x, y);
    } else {
      root.position.set(x, y);
    }
    root.eventMode = 'static';
    root.cursor = 'pointer';
    let enabled = true;
    let isSelected = false;

    root.on('pointerdown', () => {
      if (!enabled) return;
      root.texture = selected;
    });
    root.on('pointerup', () => {
      if (!enabled) return;
      onTap();
    });
    root.on('pointerupoutside', () => {
      root.texture = isSelected ? selected : normal;
    });
    root.on('pointerout', () => {
      root.texture = isSelected ? selected : normal;
    });

    const label = new Text({
      text: getLocalized(this.game, key, fallback),
      style: new TextStyle({
        fontFamily: 'Roboto Condensed',
        fontSize: 32,
        fill: 0xbee1f5,
        fontWeight: APP_FONT_WEIGHT_REGULAR,
        align: 'center'
      })
    });
    label.anchor.set(0.5);
    label.position.set(root.width / 2, root.height / 2);
    fitPixiTextToBounds(label, { maxWidth: 250, minFontSize: 16 });
    root.addChild(label);

    return {
      root,
      label,
      setSelected: (value: boolean) => {
        isSelected = !!value;
        root.texture = isSelected ? selected : normal;
      },
      setEnabled: (value: boolean) => {
        enabled = !!value;
        root.eventMode = enabled ? 'static' : 'none';
        root.cursor = enabled ? 'pointer' : 'default';
      }
    };
  }

  private createStaticButton(frame: string, x: number, y: number, text: string, scale = 1, legacyY = false): Container | null {
    const sprite = this.createSprite(frame, x, y);
    if (!sprite) return null;
    sprite.scale.set(scale);
    const wrap = new Container();
    if (legacyY) {
      this.placeLegacy(sprite, x, y);
      sprite.position.set(0, 0);
      wrap.position.set(x, this.legacyTop(y, sprite.height));
    }
    wrap.addChild(sprite);
    const label = new Text({
      text,
      style: new TextStyle({
        fontFamily: 'Roboto Condensed',
        fontSize: 28,
        fill: 0xbee1f5,
        fontWeight: APP_FONT_WEIGHT_REGULAR,
        align: 'center'
      })
    });
    label.anchor.set(0.5);
    label.position.set((sprite.width * scale) / 2, (sprite.height * scale) / 2);
    fitPixiTextToBounds(label, { maxWidth: sprite.width * scale - 16, minFontSize: 14 });
    wrap.addChild(label);
    return wrap;
  }

  private legacyTop(bottomY: number, height = 0): number {
    return HelpMenu.SCREEN_HEIGHT - bottomY - height;
  }

  private placeLegacy(displayObject: { position: { set: (x: number, y: number) => void }; height: number }, x: number, bottomY: number): void {
    displayObject.position.set(x, this.legacyTop(bottomY, displayObject.height));
  }

  private getTexture(frame: string): Texture | null {
    if (!frame) return null;
    if (this.textureCache.has(frame)) {
      return this.textureCache.get(frame) || null;
    }

    let texture: Texture | null = null;
    try {
      const resolved = Texture.from(frame);
      texture = resolved && resolved !== Texture.EMPTY ? resolved : null;
    } catch {
      texture = null;
    }

    this.textureCache.set(frame, texture);
    return texture;
  }

  private getSettingBool(key: string, fallback: boolean): boolean {
    const store = this.game?.settings;
    const value = store && typeof store.get === 'function' ? store.get<boolean>(key, fallback) : fallback;
    return !!value;
  }

  private setSettingBool(key: string, value: boolean): void {
    const store = this.game?.settings;
    if (!store || typeof store.set !== 'function') return;
    store.set(key, !!value);
  }

  private getVolumeStep(): number {
    const store = this.game?.settings;
    const raw = store && typeof store.get === 'function' ? store.get<number>('volumeStep', 5) : 5;
    const value = Number.isFinite(raw) ? Number(raw) : 5;
    return Math.max(0, Math.min(5, value));
  }

  private setVolumeStep(value: number): void {
    const store = this.game?.settings;
    if (!store || typeof store.set !== 'function') return;
    store.set('volumeStep', Math.max(0, Math.min(5, Math.round(value))));
  }

  private getVolumePercent(): number {
    return this.getVolumeStep() * 20;
  }

  private applyAudioSettings(): void {
    const soundSystem = this.game?.soundSystem;
    if (!soundSystem) return;

    const audioEnabled = this.getSettingBool('audioEnabled', true);
    const volume = this.getVolumePercent() / 100;

    if (typeof soundSystem.setEnabled === 'function') {
      soundSystem.setEnabled(audioEnabled);
    }
    if (typeof (soundSystem as any).setMasterVolume === 'function') {
      (soundSystem as any).setMasterVolume(volume);
    }
  }

  private forceRefresh(): void {
    this.lastRefreshKey = '';
    this.refresh();
  }
}
