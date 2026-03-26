import { Assets, BitmapText, Cache, Container, Graphics, Rectangle, Sprite, Text, TextStyle, Texture } from 'pixi.js';
import type BaseGame from '../core/BaseGame';
import { APP_FONT_WEIGHT_LIGHT, APP_FONT_WEIGHT_REGULAR } from '../config/fontConfig';
import { BITMAP_FONT_ROBOTO_CONDENSED_MEDIUM } from '../config/bitmapFontConfig';
import { fitBitmapTextToBounds, fitPixiTextToBounds } from './utils/fitText';
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

function getCurrentLocale(game: any): string {
  if (game && game.localization && typeof game.localization.getLocale === 'function') {
    return String(game.localization.getLocale() || 'en').toLowerCase();
  }
  return 'en';
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

function getByPath(root: any, path: Array<string | number> | undefined): any {
  if (!root || !Array.isArray(path)) return undefined;
  let current = root;
  for (let i = 0; i < path.length; i += 1) {
    if (current == null || typeof current !== 'object') return undefined;
    current = current[path[i] as any];
  }
  return current;
}

function resolveLayoutForLocale<T extends LegacyTextLayout>(game: any, config: T | undefined, defaults: Partial<T> = {}): T {
  const locale = getCurrentLocale(game);
  const base = { ...(defaults || {}), ...(config || {}) } as T;
  const locales = config && typeof config === 'object' && config.locales && typeof config.locales === 'object'
    ? config.locales
    : undefined;
  const localeOverrides = locales ? (locales[locale] || locales.en || {}) : {};
  return { ...base, ...(localeOverrides || {}) } as T;
}

type LegacyTextLayout = {
  key?: string;
  fallback?: string;
  x?: number;
  y?: number;
  bottomY?: number;
  width?: number;
  height?: number;
  maxWidth?: number;
  fontSize?: number;
  align?: 'left' | 'center' | 'right';
  fill?: number;
  color?: number;
  locales?: Record<string, Partial<LegacyTextLayout>>;
};

type EditorPageDef = {
  id?: string;
  title?: string;
  group?: 'paytable' | 'rules' | 'shell';
  manifestPath?: Array<string | number>;
  templateId?: string;
};

type PageEntry = {
  id: string;
  titleKey: string;
  titleFallback: string;
  container: Container;
};

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
  private readonly config: Record<string, any>;
  private readonly textureCache = new Map<string, Texture | null>();

  private readonly overlay: Graphics;
  private readonly panel: Sprite | null;
  private readonly titleText: Text;
  private readonly pageText: Text;
  private readonly footerBar: Container;
  private readonly footerCreditLabel: BitmapText;
  private readonly footerCreditValue: BitmapText;
  private readonly footerBetLabel: BitmapText;
  private readonly footerBetValue: BitmapText;
  private readonly logoSprite: Sprite | null;
  private readonly historyButton: TabButton | null;
  private readonly closeButton: PushButton | null;
  private readonly prevButton: PushButton | null;
  private readonly nextButton: PushButton | null;

  private readonly tabButtons: Record<TabId, TabButton | null>;
  private readonly pageContainers: Record<TabId, Container>;

  private readonly payPages: PageEntry[];
  private readonly rulesPages: PageEntry[];
  private readonly settingsPage: Container;
  private readonly paytableValueTexts: Array<{ text: Text; mult: number; source: 'lineBet' | 'totalBet' }>;

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

  constructor(game: BaseGame, onClose: () => void, hudConfig?: Record<string, any>) {
    super();

    this.game = game as BaseGame & Record<string, any>;
    this.onClose = onClose;
    this.config = hudConfig && typeof hudConfig.helpMenu === 'object' ? hudConfig.helpMenu : {};

    const overlayCfg = this.config.overlay || {};
    this.overlay = new Graphics()
      .rect(0, 0, HelpMenu.SCREEN_WIDTH, HelpMenu.SCREEN_HEIGHT)
      .fill({ color: toNumber(overlayCfg.color, 0x000000), alpha: toNumber(overlayCfg.alpha, 0.08) });
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

    const titleCfg = resolveLayoutForLocale(this.game, this.config.title || {}, { x: 960, y: 98, fontSize: 58, color: 0x93a7bf });
    const pageCfg = resolveLayoutForLocale(this.game, this.config.page || {}, { x: 1745, y: 925, fontSize: 28, color: 0xffffff });
    this.titleText = this.createText('', toNumber(titleCfg.x, 960), toNumber(titleCfg.y, 98), {
      fontSize: toNumber(titleCfg.fontSize, 58),
      fill: toNumber(titleCfg.color ?? titleCfg.fill, 0x93a7bf),
      anchorX: 0.5
    });
    this.pageText = this.createText('', toNumber(pageCfg.x, 1745), toNumber(pageCfg.y, 925), {
      fontSize: toNumber(pageCfg.fontSize, 28),
      fill: toNumber(pageCfg.color ?? pageCfg.fill, 0xffffff),
      anchorX: 0.5
    });
    this.footerBar = new Container();
    const footerBgCfg = this.config.footer?.background || {};
    const footerBg = this.createSprite(String(footerBgCfg.frame || 'bottom_bg.png'), toNumber(footerBgCfg.x, 0), toNumber(footerBgCfg.y, 1034));
    if (footerBg) {
      this.footerBar.addChild(footerBg);
    } else {
      const fallbackBar = new Graphics()
        .rect(0, 1000, HelpMenu.SCREEN_WIDTH, 80)
        .fill({ color: 0x0a0d12, alpha: 0.82 });
      this.footerBar.addChild(fallbackBar);
    }
    const creditFooterCfg = this.config.footer?.credit || {};
    const totalBetFooterCfg = this.config.footer?.totalBet || {};
    this.footerCreditLabel = this.createBitmapLabel('', toNumber(creditFooterCfg.x, 220), toNumber(creditFooterCfg.y, 1039), toNumber(creditFooterCfg.fontSize, 34), toNumber(creditFooterCfg.labelColor, 0xffc600));
    this.footerCreditValue = this.createBitmapLabel('', toNumber(creditFooterCfg.x, 220), toNumber(creditFooterCfg.y, 1039), toNumber(creditFooterCfg.fontSize, 34), toNumber(creditFooterCfg.valueColor, 0xf3f9f9));
    this.footerBetLabel = this.createBitmapLabel('', toNumber(totalBetFooterCfg.x, 1490), toNumber(totalBetFooterCfg.y, 1039), toNumber(totalBetFooterCfg.fontSize, 34), toNumber(totalBetFooterCfg.labelColor, 0xffc600));
    this.footerBetValue = this.createBitmapLabel('', toNumber(totalBetFooterCfg.x, 1490), toNumber(totalBetFooterCfg.y, 1039), toNumber(totalBetFooterCfg.fontSize, 34), toNumber(totalBetFooterCfg.valueColor, 0xf3f9f9));
    const logoCfg = this.config.logo || {};
    this.logoSprite = this.createSprite(String(logoCfg.frame || 'logo.png'), toNumber(logoCfg.x, 18), 0);
    if (this.logoSprite) {
      this.logoSprite.scale.set(toNumber(logoCfg.scale, 0.76));
      this.logoSprite.position.set(toNumber(logoCfg.x, 18), toNumber(logoCfg.y, 8));
      this.addChild(this.logoSprite);
    }

    const navCfg = this.config.navigation || {};
    const closeCfg = navCfg.close || {};
    const prevCfg = navCfg.prev || {};
    const nextCfg = navCfg.next || {};
    const historyCfg = this.config.tabs?.history || {};
    this.closeButton = this.createButton(String(closeCfg.normal || 'button_close_001.png'), String(closeCfg.pressed || 'button_close_002.png'), toNumber(closeCfg.x, 1711), toNumber(closeCfg.y, 928), () => this.hide(), closeCfg.legacyY !== false);
    this.prevButton = this.createButton(String(prevCfg.normal || 'button_arrow_l_001.png'), String(prevCfg.pressed || 'button_arrow_l_002.png'), toNumber(prevCfg.x, 1660), toNumber(prevCfg.y, 150), () => this.changePage(-1), prevCfg.legacyY !== false);
    this.nextButton = this.createButton(String(nextCfg.normal || 'button_arrow_r_001.png'), String(nextCfg.pressed || 'button_arrow_r_002.png'), toNumber(nextCfg.x, 1760), toNumber(nextCfg.y, 150), () => this.changePage(1), nextCfg.legacyY !== false);
    this.historyButton = this.createTabButton(String(historyCfg.base || 'button_history'), toNumber(historyCfg.x, 1394), toNumber(historyCfg.y, 140), String(historyCfg.key || 'helpHistory'), String(historyCfg.fallback || 'HISTORY'), () => undefined, historyCfg.legacyY !== false);

    const payTabCfg = this.config.tabs?.paytable || {};
    const settingsTabCfg = this.config.tabs?.settings || {};
    const rulesTabCfg = this.config.tabs?.rules || {};
    this.tabButtons = {
      paytable: this.createTabButton(String(payTabCfg.base || 'button_pay'), toNumber(payTabCfg.x, 354), toNumber(payTabCfg.y, 140), String(payTabCfg.key || 'helpPay'), String(payTabCfg.fallback || 'PAYTABLE'), () => this.selectTab('paytable'), payTabCfg.legacyY !== false),
      settings: this.createTabButton(String(settingsTabCfg.base || 'button_sett'), toNumber(settingsTabCfg.x, 874), toNumber(settingsTabCfg.y, 140), String(settingsTabCfg.key || 'helpSettings'), String(settingsTabCfg.fallback || 'SETTINGS'), () => this.selectTab('settings'), settingsTabCfg.legacyY !== false),
      rules: this.createTabButton(String(rulesTabCfg.base || 'button_rules'), toNumber(rulesTabCfg.x, 1394), toNumber(rulesTabCfg.y, 140), String(rulesTabCfg.key || 'helpRules'), String(rulesTabCfg.fallback || 'RULES'), () => this.selectTab('rules'), rulesTabCfg.legacyY !== false)
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
    this.addChild(this.titleText);
    this.addChild(this.pageText);
    this.addChild(this.footerBar);
    this.addChild(this.footerCreditLabel);
    this.addChild(this.footerCreditValue);
    this.addChild(this.footerBetLabel);
    this.addChild(this.footerBetValue);

    this.payPages = this.buildConfiguredPayPages();

    this.rulesPages = this.buildConfiguredRulesPages();

    this.settingsPage = this.buildSettingsPage();

    for (const page of this.payPages) {
      page.container.visible = false;
      this.pageContainers.paytable.addChild(page.container);
    }

    for (const page of this.rulesPages) {
      page.container.visible = false;
      this.pageContainers.rules.addChild(page.container);
    }

    this.settingsPage.visible = false;
    this.pageContainers.settings.addChild(this.settingsPage);

    this.visible = false;
  }

  isOpen(): boolean {
    return this.visible;
  }

  private buildConfiguredPayPages(): PageEntry[] {
    const base: PageEntry[] = [
      { id: 'paytable-hold', titleKey: 'splashTitle', titleFallback: 'HOLD AND WIN', container: this.buildHoldAndWinPage(this.config.paytablePages?.holdAndWin || {}) },
      { id: 'paytable-free', titleKey: 'splashSecTitle', titleFallback: 'FREE GAMES', container: this.buildFreeGamesPage(this.config.paytablePages?.freeGames || {}) },
      { id: 'paytable-primary', titleKey: 'paytableTitle', titleFallback: 'PAYTABLE', container: this.buildPaytablePage(PAYTABLE_PAGE_1, this.config.paytablePages?.primary || {}) },
      { id: 'paytable-gold', titleKey: 'paytableTitle', titleFallback: 'PAYTABLE', container: this.buildGoldPaytablePage(this.config.paytablePages?.gold || {}) },
      { id: 'paytable-lines', titleKey: 'paylinesTitle', titleFallback: 'PAYLINES', container: this.buildPaylinesPage(this.config.paytablePages?.paylines || {}) }
    ];
    const custom = Array.isArray(this.config.editorPageDefs?.paytable) ? this.config.editorPageDefs.paytable as EditorPageDef[] : [];
    return this.orderConfiguredPages([...base, ...this.buildCustomPages(custom, 'paytable')], 'paytable');
  }

  private buildConfiguredRulesPages(): PageEntry[] {
    const base: PageEntry[] = [
      { id: 'rules-howto', titleKey: 'rulesTitle', titleFallback: 'RULES', container: this.buildRulesHowToPage(this.config.rulesPages?.howTo || {}) },
      { id: 'rules-bet', titleKey: 'rulesTitle', titleFallback: 'RULES', container: this.buildRulesBetSettingsPage(this.config.rulesPages?.betSettings || {}) },
      { id: 'rules-lines', titleKey: 'rulesTitle', titleFallback: 'RULES', container: this.buildRulesLinesPage(this.config.rulesPages?.lines || {}) },
      { id: 'rules-extra', titleKey: 'rulesTitle', titleFallback: 'RULES', container: this.buildRulesExtraPage(this.config.rulesPages?.extra || {}) },
      { id: 'rules-fg', titleKey: 'rulesTitle', titleFallback: 'RULES', container: this.buildRulesAddFreeGamesPage(this.config.rulesPages?.addFreeGames || {}) }
    ];
    const custom = Array.isArray(this.config.editorPageDefs?.rules) ? this.config.editorPageDefs.rules as EditorPageDef[] : [];
    return this.orderConfiguredPages([...base, ...this.buildCustomPages(custom, 'rules')], 'rules');
  }

  private orderConfiguredPages(entries: PageEntry[], group: 'paytable' | 'rules'): PageEntry[] {
    const order = Array.isArray(this.config.editorPageOrder?.[group]) ? this.config.editorPageOrder[group] as string[] : [];
    if (order.length === 0) return entries;
    const ranked = order.filter((id) => entries.some((entry) => entry.id === id));
    const missing = entries.map((entry) => entry.id).filter((id) => !ranked.includes(id));
    const finalOrder = [...ranked, ...missing];
    return [...entries].sort((a, b) => finalOrder.indexOf(a.id) - finalOrder.indexOf(b.id));
  }

  private buildCustomPages(defs: EditorPageDef[], group: 'paytable' | 'rules'): PageEntry[] {
    const result: PageEntry[] = [];
    for (let i = 0; i < defs.length; i += 1) {
      const def = defs[i];
      if (!def || def.group !== group || !Array.isArray(def.manifestPath)) continue;
      const pageCfg = getByPath(this.config, def.manifestPath.slice(3)) || {};
      const templateId = String(def.templateId || '');
      const title = this.getTitleInfoForPage(templateId || String(def.id || ''), group);
      let container: Container | null = null;
      if (group === 'paytable') {
        if (templateId === 'paytable-hold') container = this.buildHoldAndWinPage(pageCfg);
        else if (templateId === 'paytable-free') container = this.buildFreeGamesPage(pageCfg);
        else if (templateId === 'paytable-primary') container = this.buildPaytablePage(PAYTABLE_PAGE_1, pageCfg);
        else if (templateId === 'paytable-gold') container = this.buildGoldPaytablePage(pageCfg);
        else if (templateId === 'paytable-lines') container = this.buildPaylinesPage(pageCfg);
      } else {
        if (templateId === 'rules-howto') container = this.buildRulesHowToPage(pageCfg);
        else if (templateId === 'rules-bet') container = this.buildRulesBetSettingsPage(pageCfg);
        else if (templateId === 'rules-lines') container = this.buildRulesLinesPage(pageCfg);
        else if (templateId === 'rules-extra') container = this.buildRulesExtraPage(pageCfg);
        else if (templateId === 'rules-fg') container = this.buildRulesAddFreeGamesPage(pageCfg);
      }
      if (!container) continue;
      result.push({
        id: String(def.id || `${group}-custom-${i}`),
        titleKey: title.titleKey,
        titleFallback: title.titleFallback,
        container
      });
    }
    return result;
  }

  private getTitleInfoForPage(id: string, group: 'paytable' | 'rules'): { titleKey: string; titleFallback: string } {
    if (group === 'rules') return { titleKey: 'rulesTitle', titleFallback: 'RULES' };
    if (id === 'paytable-hold') return { titleKey: 'splashTitle', titleFallback: 'HOLD AND WIN' };
    if (id === 'paytable-free') return { titleKey: 'splashSecTitle', titleFallback: 'FREE GAMES' };
    if (id === 'paytable-lines') return { titleKey: 'paylinesTitle', titleFallback: 'PAYLINES' };
    return { titleKey: 'paytableTitle', titleFallback: 'PAYTABLE' };
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
      this.getCreditAmount(),
      this.getTotalBetAmount(),
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
    this.refreshFooterBar();
  }

  private refreshPaytableAmounts(): void {
    for (let i = 0; i < this.paytableValueTexts.length; i += 1) {
      const item = this.paytableValueTexts[i];
      const stake = item.source === 'totalBet' ? this.getTotalBetAmount() : this.getLineBet();
      item.text.text = `${formatMoney(item.mult * stake, this.game)}`;
    }
  }

  private refreshTitles(): void {
    let title = '';
    if (this.activeTab === 'settings') {
      title = getLocalized(this.game, 'settingsTitle', 'SETTINGS');
    } else if (this.activeTab === 'rules') {
      const page = this.rulesPages[this.rulesPageIndex];
      title = getLocalized(this.game, page?.titleKey || 'rulesTitle', page?.titleFallback || 'RULES');
    } else {
      const page = this.payPages[this.payPageIndex];
      title = getLocalized(this.game, page?.titleKey || 'paytableTitle', page?.titleFallback || 'PAYTABLE');
    }

    const titleCfg = resolveLayoutForLocale(this.game, this.config.title || {}, { x: 960, y: 98, fontSize: 58, color: 0x93a7bf });
    this.titleText.text = title;
    this.titleText.style.fontSize = toNumber(titleCfg.fontSize, 58);
    this.titleText.style.fill = toNumber(titleCfg.color ?? titleCfg.fill, 0x93a7bf);
    this.titleText.position.set(toNumber(titleCfg.x, 960), toNumber(titleCfg.y, 98));

    const pagePrefix = getLocalized(this.game, 'helpPages', 'PAGE');
    if (this.activeTab === 'settings') {
      this.pageText.visible = false;
      if (this.prevButton) this.prevButton.root.visible = false;
      if (this.nextButton) this.nextButton.root.visible = false;
      return;
    }

    const pageIndex = this.activeTab === 'rules' ? this.rulesPageIndex : this.payPageIndex;
    const totalPages = this.activeTab === 'rules' ? this.rulesPages.length : this.payPages.length;
    const pageCfg = resolveLayoutForLocale(this.game, this.config.page || {}, { x: 1750, y: 925, fontSize: 28, color: 0xffffff });
    this.pageText.visible = true;
    this.pageText.text = `${pagePrefix} ${pageIndex + 1}/${totalPages}`;
    this.pageText.style.fontSize = toNumber(pageCfg.fontSize, 28);
    this.pageText.style.fill = toNumber(pageCfg.color ?? pageCfg.fill, 0xffffff);
    this.pageText.position.set(toNumber(pageCfg.x, 1750), toNumber(pageCfg.y, 925));
    if (this.prevButton) this.prevButton.root.visible = true;
    if (this.nextButton) this.nextButton.root.visible = true;
  }

  private refreshPageVisibility(): void {
    this.pageContainers.paytable.visible = this.activeTab === 'paytable';
    this.pageContainers.settings.visible = this.activeTab === 'settings';
    this.pageContainers.rules.visible = this.activeTab === 'rules';

    for (let i = 0; i < this.payPages.length; i += 1) {
      this.payPages[i].container.visible = this.activeTab === 'paytable' && i === this.payPageIndex;
    }

    for (let i = 0; i < this.rulesPages.length; i += 1) {
      this.rulesPages[i].container.visible = this.activeTab === 'rules' && i === this.rulesPageIndex;
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
    const linesCfg = this.config.rulesPages?.lines || {};
    const extraCfg = this.config.rulesPages?.extra || {};

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

    this.applyLegacyTextConfig(this.rulesRtpText, linesCfg.gamePercent, {
      x: 220,
      bottomY: 330,
      width: 1265,
      height: 80,
      fontSize: 28
    });
    this.applyLegacyTextConfig(this.rulesBuyFreeRtpText, extraCfg.buyFreeRtp, {
      x: 220,
      bottomY: 360,
      width: 1580,
      height: 60,
      fontSize: 28
    });
    this.applyLegacyTextConfig(this.rulesBuyHoldRtpText, extraCfg.buyHoldRtp, {
      x: 220,
      bottomY: 315,
      width: 1580,
      height: 60,
      fontSize: 28
    });

    const showRulesRtp = this.activeTab === 'rules' && this.rulesPageIndex === 2;
    const showBonusRtp = this.activeTab === 'rules' && this.rulesPageIndex === 3;
    this.rulesRtpText.visible = showRulesRtp && this.rulesRtpText.text.length > 0;
    this.rulesBuyFreeRtpText.visible = showBonusRtp && this.rulesBuyFreeRtpText.text.length > 0;
    this.rulesBuyHoldRtpText.visible = showBonusRtp && this.rulesBuyHoldRtpText.text.length > 0;
  }

  private refreshFooterBar(): void {
    const currency = this.getCurrency();
    const creditPrefix = getLocalized(this.game, 'balanceDemo', 'DEMO PLAY :');
    const betPrefix = getLocalized(this.game, 'bet', 'BET :');
    const credit = this.getCreditAmount();
    const totalBet = this.getTotalBetAmount();
    const creditFooterCfg = this.config.footer?.credit || {};
    const totalBetFooterCfg = this.config.footer?.totalBet || {};

    this.footerCreditLabel.text = creditPrefix;
    this.footerCreditValue.text = ` ${formatMoney(credit, this.game)} ${currency}`;
    fitBitmapTextToBounds(this.footerCreditLabel, { maxWidth: toNumber(creditFooterCfg.labelMaxWidth, 260), maxHeight: toNumber(creditFooterCfg.fontSize, 34), minScale: 0.7 });
    fitBitmapTextToBounds(this.footerCreditValue, { maxWidth: toNumber(creditFooterCfg.valueMaxWidth, 360), maxHeight: toNumber(creditFooterCfg.fontSize, 34), minScale: 0.7 });
    this.footerCreditValue.position.x = this.footerCreditLabel.x + this.footerCreditLabel.width;
    this.footerCreditLabel.position.y = this.getFooterTextY(this.footerCreditLabel);
    this.footerCreditValue.position.y = this.getFooterTextY(this.footerCreditValue);

    this.footerBetLabel.text = betPrefix;
    this.footerBetValue.text = ` ${formatMoney(totalBet, this.game)} ${currency}`;
    fitBitmapTextToBounds(this.footerBetLabel, { maxWidth: toNumber(totalBetFooterCfg.labelMaxWidth, 160), maxHeight: toNumber(totalBetFooterCfg.fontSize, 34), minScale: 0.7 });
    fitBitmapTextToBounds(this.footerBetValue, { maxWidth: toNumber(totalBetFooterCfg.valueMaxWidth, 260), maxHeight: toNumber(totalBetFooterCfg.fontSize, 34), minScale: 0.7 });
    this.footerBetValue.position.x = this.footerBetLabel.x + this.footerBetLabel.width;
    this.footerBetLabel.position.y = this.getFooterTextY(this.footerBetLabel);
    this.footerBetValue.position.y = this.getFooterTextY(this.footerBetValue);
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

  private buildHoldAndWinPage(pageCfg: any = this.config.paytablePages?.holdAndWin || {}): Container {
    const page = new Container();
    const imageItems = Array.isArray(pageCfg.items) ? pageCfg.items : [];
    const symbolCfg = pageCfg.symbols || {};
    if (imageItems.length > 0) {
      for (let i = 0; i < imageItems.length; i += 1) {
        const imageCfg = imageItems[i];
        const sprite = this.createSprite(String(imageCfg.frame || ''), 0, 0);
        if (!sprite) continue;
        const scale = toNumber(imageCfg.scale, 0.7);
        sprite.scale.set(scale);
        sprite.alpha = toNumber(imageCfg.alpha, 1);
        if (Number.isFinite(imageCfg.tint)) {
          sprite.tint = Number(imageCfg.tint);
        }
        this.placeLegacy(sprite, toNumber(imageCfg.x, 0), toNumber(imageCfg.bottomY, 0));
        page.addChild(sprite);
      }
    } else {
      const shields = Array.isArray(symbolCfg.frames) && symbolCfg.frames.length > 0 ? symbolCfg.frames : ['mega_blur_01.png', 'major_blur_01.png', 'mini_blur_01.png', 'shield_blur_01.png'];
      for (let i = 0; i < shields.length; i += 1) {
        const sprite = this.createSprite(shields[i], 0, 0);
        if (!sprite) continue;
        const scale = toNumber(symbolCfg.scale, 0.7);
        sprite.scale.set(scale);
        this.placeLegacy(sprite, toNumber(symbolCfg.startX, 500) + i * sprite.texture.width * toNumber(symbolCfg.stepMultiplier, scale), toNumber(symbolCfg.bottomY, 690));
        page.addChild(sprite);
      }
    }

    const textDefaults = [
      { x: 200, bottomY: 690, width: 1580, fontSize: 30, key: 'splashTxt' }
    ];
    const texts = Array.isArray(pageCfg.texts) && pageCfg.texts.length > 0 ? pageCfg.texts : textDefaults;
    for (let i = 0; i < texts.length; i += 1) {
      page.addChild(this.createLocalizedLegacyText(texts[i], {
        x: 200,
        bottomY: 690,
        width: 1580,
        height: 300,
        fontSize: 30,
        key: 'splashTxt'
      }));
    }
    return page;
  }

  private buildFreeGamesPage(pageCfg: any = this.config.paytablePages?.freeGames || {}): Container {
    const page = new Container();
    const imageItems = Array.isArray(pageCfg.items) ? pageCfg.items : [];
    const bookCfg = pageCfg.book || {};
    const titleCfg = pageCfg.titles || {};
    const specialCfg = pageCfg.specialSymbols || {};

    if (imageItems.length > 0) {
      for (let i = 0; i < imageItems.length; i += 1) {
        const imageCfg = imageItems[i];
        const sprite = this.createSprite(String(imageCfg.frame || ''), 0, 0);
        if (!sprite) continue;
        const scale = toNumber(imageCfg.scale, 0.7);
        sprite.scale.set(scale);
        sprite.alpha = toNumber(imageCfg.alpha, 1);
        if (Number.isFinite(imageCfg.tint)) {
          sprite.tint = Number(imageCfg.tint);
        }
        this.placeLegacy(sprite, toNumber(imageCfg.x, 0), toNumber(imageCfg.bottomY, 0));
        page.addChild(sprite);
      }
    } else {
      const book = this.createSprite(String(bookCfg.frame || 'book_blur_01.png'), 0, 0);
      if (book) {
        book.scale.set(toNumber(bookCfg.scale, 0.7));
        this.placeLegacy(book, toNumber(bookCfg.x, 346), toNumber(bookCfg.bottomY, 590));
        page.addChild(book);
      }

      const specialFrames = Array.isArray(specialCfg.frames) && specialCfg.frames.length > 0 ? specialCfg.frames : ['10_blur_01.png', 'J_blur_01.png', 'Q_blur_01.png', 'K_blur_01.png', 'A_blur_01.png', 'torch_blur_01.png', 'axe_blur_01.png', 'chalice_blur_01.png', 'knight_blur_01.png'];
      for (let i = 0; i < specialFrames.length; i += 1) {
        const sprite = this.createSprite(specialFrames[i], 0, 0);
        if (!sprite) continue;
        const scale = toNumber(specialCfg.scale, 0.3);
        sprite.scale.set(scale);
        sprite.tint = toNumber(specialCfg.tint, 0xffdc57);
        if (i < 5) {
          this.placeLegacy(sprite, toNumber(specialCfg.topRowX, 900) + i * sprite.texture.width * toNumber(specialCfg.stepMultiplier, 0.35), toNumber(specialCfg.bottomY, 665));
        } else {
          this.placeLegacy(sprite, toNumber(specialCfg.secondRowX, 948) + (i % 5) * sprite.texture.width * toNumber(specialCfg.stepMultiplier, 0.35), toNumber(specialCfg.bottomY, 665) - sprite.texture.height * toNumber(specialCfg.stepMultiplier, 0.35));
        }
        page.addChild(sprite);
      }
    }

    const wildCfg = titleCfg.wild || {};
    const specialTitleCfg = titleCfg.special || {};
    const wildTitle = this.createSectionTitle(getLocalized(this.game, String(wildCfg.key || 'splashSecTitleWild'), String(wildCfg.fallback || 'SCATTER / WILD')), toNumber(wildCfg.x, 391), 0);
    const specialTitle = this.createSectionTitle(getLocalized(this.game, String(specialTitleCfg.key || 'splashSecTitleSpecial'), String(specialTitleCfg.fallback || 'SPECIAL SYMBOLS')), toNumber(specialTitleCfg.x, 1073), 0);
    this.placeLegacy(wildTitle, toNumber(wildCfg.x, 391), toNumber(wildCfg.bottomY, 870));
    this.placeLegacy(specialTitle, toNumber(specialTitleCfg.x, 1073), toNumber(specialTitleCfg.bottomY, 870));
    page.addChild(wildTitle);
    page.addChild(specialTitle);

    const textDefaults = [
      { x: 210, bottomY: 568, width: 1520, fontSize: 30, key: 'splashSecTxt' }
    ];
    const texts = Array.isArray(pageCfg.texts) && pageCfg.texts.length > 0 ? pageCfg.texts : textDefaults;
    for (let i = 0; i < texts.length; i += 1) {
      page.addChild(this.createLocalizedLegacyText(texts[i], {
        x: 210,
        bottomY: 568,
        width: 1520,
        height: 240,
        fontSize: 30,
        key: 'splashSecTxt'
      }));
    }
    return page;
  }

  private buildPaytablePage(symbols: PaySymbol[], pageCfg?: any): Container {
    return symbols === PAYTABLE_PAGE_1
      ? this.buildPrimaryPaytablePage(pageCfg)
      : this.buildGoldPaytablePage(pageCfg);
  }

  private buildPrimaryPaytablePage(pageCfg: any = this.config.paytablePages?.primary || {}): Container {
    const page = new Container();
    const scatterCfg = pageCfg.scatter || {};
    const localizedScatterCfg = resolveLayoutForLocale(this.game, scatterCfg, {});
    const topSymbolCfg = pageCfg.topSymbol || scatterCfg || {};
    const descriptionCfg = pageCfg.description || scatterCfg.description || {};
    const scatterDescriptionCfg = {
      ...descriptionCfg,
      ...(scatterCfg.description || {}),
      x: toNumber((localizedScatterCfg as any).descriptionX, toNumber((scatterCfg.description || {}).x, toNumber(descriptionCfg.x, 850))),
      bottomY: toNumber((localizedScatterCfg as any).descriptionBottomY, toNumber((scatterCfg.description || {}).bottomY, toNumber(descriptionCfg.bottomY, 860))),
      width: toNumber((localizedScatterCfg as any).descriptionWidth, toNumber((scatterCfg.description || {}).width, toNumber(descriptionCfg.width, 720))),
      height: toNumber((localizedScatterCfg as any).descriptionHeight, toNumber((scatterCfg.description || {}).height, toNumber(descriptionCfg.height, 160))),
      fontSize: toNumber((localizedScatterCfg as any).descriptionFontSize, toNumber((scatterCfg.description || {}).fontSize, toNumber(descriptionCfg.fontSize, 28))),
      align: String((localizedScatterCfg as any).descriptionAlign || (scatterCfg.description || {}).align || descriptionCfg.align || 'left')
    };
    const scatterPaysCfg = pageCfg.scatterPays || scatterCfg || {};
    const scatterSymbol: PaySymbol = {
      frame: String(scatterCfg.frame || topSymbolCfg.frame || 'book_blur_01.png'),
      descriptionKey: String(scatterCfg.descriptionKey || descriptionCfg.key || 'paytableScatter'),
      descriptionFallback: String(scatterCfg.descriptionFallback || descriptionCfg.fallback || 'This symbol is both WILD and SCATTER.'),
      pays: Array.isArray(scatterCfg.pays) && scatterCfg.pays.length > 0 ? scatterCfg.pays : PAYTABLE_PAGE_1[0].pays
    };

    const topSymbol = this.createSprite(scatterSymbol.frame, 0, 0);
    if (topSymbol) {
      topSymbol.scale.set(toNumber(scatterCfg.scale, toNumber(topSymbolCfg.scale, 0.5)));
      this.placeLegacy(topSymbol, toNumber(scatterCfg.x, toNumber(topSymbolCfg.x, 660)), toNumber(scatterCfg.bottomY, toNumber(topSymbolCfg.bottomY, 800)));
      page.addChild(topSymbol);
    }

    const description = this.createLocalizedLegacyText(scatterDescriptionCfg, {
      x: toNumber(scatterDescriptionCfg.x, 850),
      bottomY: toNumber(scatterDescriptionCfg.bottomY, 860),
      width: toNumber(scatterDescriptionCfg.width, 720),
      height: toNumber(scatterDescriptionCfg.height, 160),
      fontSize: toNumber(scatterDescriptionCfg.fontSize, 28),
      key: scatterSymbol.descriptionKey,
      fallback: scatterSymbol.descriptionFallback,
      align: scatterDescriptionCfg.align as 'left' | 'center' | 'right'
    });
    page.addChild(description);

    this.addPayoutColumn(
      page,
      scatterSymbol.pays,
      toNumber(scatterCfg.paysX, toNumber(scatterPaysCfg.x, 483)),
      toNumber(scatterCfg.paysBottomY, toNumber(scatterPaysCfg.bottomY, 884)),
      toNumber(scatterCfg.paysFontSize, toNumber(scatterPaysCfg.fontSize, 32)),
      false,
      true,
      String(scatterCfg.multiplierSource || 'totalBet') === 'lineBet' ? 'lineBet' : 'totalBet'
    );

    const items = Array.isArray(pageCfg.symbols) && pageCfg.symbols.length > 0 ? pageCfg.symbols : Array.isArray(pageCfg.items) && pageCfg.items.length > 0 ? pageCfg.items : [
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
      const localizedItem = resolveLayoutForLocale(this.game, item as any, {});
      const symbol = Array.isArray((item as any).pays) && String((item as any).frame || '').length > 0
        ? {
            frame: String((item as any).frame || ''),
            descriptionKey: typeof (item as any).descriptionKey === 'string' ? String((item as any).descriptionKey) : undefined,
            descriptionFallback: typeof (item as any).descriptionFallback === 'string' ? String((item as any).descriptionFallback) : undefined,
            pays: (item as any).pays
          } as PaySymbol
        : (item as any).symbol || this.resolvePaySymbolByFrame(String((item as any).frame || ''));
      if (!symbol) continue;
      this.addPaytableSymbolBlock(
        page,
        symbol,
        toNumber((item as any).x, 0),
        toNumber((item as any).y ?? (item as any).bottomY, 0),
        false,
        toNumber((item as any).paysX, 0),
        toNumber((item as any).paysY, 0),
        !!((item as any).four ?? (item as any).includeFourRows),
        true,
        String((item as any).multiplierSource || 'lineBet') === 'totalBet' ? 'totalBet' : 'lineBet',
        toNumber((item as any).scale, 0.5),
        toNumber((item as any).paysFontSize, 32)
      );
      const itemDescriptionCfg = {
        ...(((item as any).description && typeof (item as any).description === 'object') ? (item as any).description : {}),
        x: toNumber((localizedItem as any).descriptionX, toNumber(((item as any).description || {}).x, 0)),
        bottomY: toNumber((localizedItem as any).descriptionBottomY, toNumber(((item as any).description || {}).bottomY, 0)),
        width: toNumber((localizedItem as any).descriptionWidth, toNumber(((item as any).description || {}).width, 300)),
        height: toNumber((localizedItem as any).descriptionHeight, toNumber(((item as any).description || {}).height, 120)),
        fontSize: toNumber((localizedItem as any).descriptionFontSize, toNumber(((item as any).description || {}).fontSize, 24)),
        align: String((localizedItem as any).descriptionAlign || ((item as any).description || {}).align || 'left')
      };
      if (
        String((item as any).descriptionKey || symbol.descriptionKey || '').length > 0 ||
        String((item as any).descriptionFallback || symbol.descriptionFallback || '').length > 0
      ) {
        page.addChild(this.createLocalizedLegacyText(itemDescriptionCfg, {
          x: toNumber(itemDescriptionCfg.x, 0),
          bottomY: toNumber(itemDescriptionCfg.bottomY, 0),
          width: toNumber(itemDescriptionCfg.width, 300),
          height: toNumber(itemDescriptionCfg.height, 120),
          fontSize: toNumber(itemDescriptionCfg.fontSize, 24),
          key: String((item as any).descriptionKey || symbol.descriptionKey || ''),
          fallback: String((item as any).descriptionFallback || symbol.descriptionFallback || ''),
          align: itemDescriptionCfg.align as 'left' | 'center' | 'right'
        }));
      }
    }

    return page;
  }

  private buildGoldPaytablePage(pageCfg: any = this.config.paytablePages?.gold || {}): Container {
    const page = new Container();
    const items = Array.isArray(pageCfg.symbols) && pageCfg.symbols.length > 0
      ? pageCfg.symbols
      : Array.isArray(pageCfg.items) && pageCfg.items.length > 0
        ? pageCfg.items
        : [
            { symbol: PAYTABLE_GOLD_PAGE[0], x: 145, y: 671, paysX: 335, paysY: 743, four: true, scale: 0.45, multiplierSource: 'lineBet' },
            { symbol: PAYTABLE_GOLD_PAGE[1], x: 585, y: 688, paysX: 755, paysY: 743, scale: 0.45, multiplierSource: 'lineBet' },
            { symbol: PAYTABLE_GOLD_PAGE[2], x: 990, y: 688, paysX: 1150, paysY: 743, scale: 0.45, multiplierSource: 'lineBet' },
            { symbol: PAYTABLE_GOLD_PAGE[3], x: 1410, y: 688, paysX: 1570, paysY: 743, scale: 0.45, multiplierSource: 'lineBet' },
            { symbol: PAYTABLE_GOLD_PAGE[4], x: 110, y: 488, paysX: 260, paysY: 558, scale: 0.45, multiplierSource: 'lineBet' },
            { symbol: PAYTABLE_GOLD_PAGE[5], x: 450, y: 488, paysX: 600, paysY: 558, scale: 0.45, multiplierSource: 'lineBet' },
            { symbol: PAYTABLE_GOLD_PAGE[6], x: 790, y: 488, paysX: 940, paysY: 558, scale: 0.45, multiplierSource: 'lineBet' },
            { symbol: PAYTABLE_GOLD_PAGE[7], x: 1130, y: 488, paysX: 1280, paysY: 558, scale: 0.45, multiplierSource: 'lineBet' },
            { symbol: PAYTABLE_GOLD_PAGE[8], x: 1470, y: 488, paysX: 1620, paysY: 558, scale: 0.45, multiplierSource: 'lineBet' }
          ];

    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      const localizedItem = resolveLayoutForLocale(this.game, item as any, {});
      const symbol = Array.isArray((item as any).pays) && String((item as any).frame || '').length > 0
        ? {
            frame: String((item as any).frame || ''),
            descriptionKey: typeof (item as any).descriptionKey === 'string' ? String((item as any).descriptionKey) : undefined,
            descriptionFallback: typeof (item as any).descriptionFallback === 'string' ? String((item as any).descriptionFallback) : undefined,
            pays: (item as any).pays
          } as PaySymbol
        : (item as any).symbol || this.resolvePaySymbolByFrame(String((item as any).frame || ''));
      if (!symbol) continue;
      this.addPaytableSymbolBlock(
        page,
        symbol,
        toNumber((item as any).x, 0),
        toNumber((item as any).y ?? (item as any).bottomY, 0),
        false,
        toNumber((item as any).paysX, 0),
        toNumber((item as any).paysY, 0),
        !!((item as any).four ?? (item as any).includeFourRows),
        true,
        String((item as any).multiplierSource || 'lineBet') === 'totalBet' ? 'totalBet' : 'lineBet',
        toNumber((item as any).scale, 0.45),
        toNumber((item as any).paysFontSize, 32)
      );
      const itemDescriptionCfg = {
        ...(((item as any).description && typeof (item as any).description === 'object') ? (item as any).description : {}),
        x: toNumber((localizedItem as any).descriptionX, toNumber(((item as any).description || {}).x, 0)),
        bottomY: toNumber((localizedItem as any).descriptionBottomY, toNumber(((item as any).description || {}).bottomY, 0)),
        width: toNumber((localizedItem as any).descriptionWidth, toNumber(((item as any).description || {}).width, 300)),
        height: toNumber((localizedItem as any).descriptionHeight, toNumber(((item as any).description || {}).height, 120)),
        fontSize: toNumber((localizedItem as any).descriptionFontSize, toNumber(((item as any).description || {}).fontSize, 24)),
        align: String((localizedItem as any).descriptionAlign || ((item as any).description || {}).align || 'left')
      };
      if (
        String((item as any).descriptionKey || symbol.descriptionKey || '').length > 0 ||
        String((item as any).descriptionFallback || symbol.descriptionFallback || '').length > 0
      ) {
        page.addChild(this.createLocalizedLegacyText(itemDescriptionCfg, {
          x: toNumber(itemDescriptionCfg.x, 0),
          bottomY: toNumber(itemDescriptionCfg.bottomY, 0),
          width: toNumber(itemDescriptionCfg.width, 300),
          height: toNumber(itemDescriptionCfg.height, 120),
          fontSize: toNumber(itemDescriptionCfg.fontSize, 24),
          key: String((item as any).descriptionKey || symbol.descriptionKey || ''),
          fallback: String((item as any).descriptionFallback || symbol.descriptionFallback || ''),
          align: itemDescriptionCfg.align as 'left' | 'center' | 'right'
        }));
      }
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
    legacyY = false,
    source: 'lineBet' | 'totalBet' = 'lineBet',
    scaleOverride?: number,
    fontSizeOverride?: number
  ): void {
    const sprite = this.createSprite(symbol.frame, 0, 0);
    if (sprite) {
      sprite.scale.set(toNumber(scaleOverride, gold ? 0.45 : 0.5));
      if (legacyY) {
        this.placeLegacy(sprite, x, y);
      } else {
        sprite.position.set(x, y);
      }
      if (gold) {
        const goldCfg = this.config.paytablePages?.gold || {};
        sprite.tint = toNumber(goldCfg.tint, 0xffdc57);
        const frameX = sprite.x - 6;
        const frameY = sprite.y - 6;
        const frame = new Graphics()
          .rect(frameX, frameY, sprite.width + 12, sprite.height + 12)
          .fill({ color: toNumber(goldCfg.frameFill, 0xd19a12), alpha: 0.85 })
          .stroke({ color: toNumber(goldCfg.frameStroke, 0xffef9f), width: 3, alpha: 1 });
        page.addChild(frame);
      }
      page.addChild(sprite);
    }

    this.addPayoutColumn(page, symbol.pays, paysX, paysY, toNumber(fontSizeOverride, 32), includeFourRows, legacyY, source);
  }

  private addPayoutColumn(
    page: Container,
    pays: Array<{ count: number; mult: number }>,
    x: number,
    y: number,
    fontSize: number,
    includeFourRows = false,
    legacyY = false,
    source: 'lineBet' | 'totalBet' = 'lineBet'
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
      this.paytableValueTexts.push({ text: valueText, mult: pay.mult, source });
      page.addChild(countText);
      page.addChild(valueText);
    }
  }

  private buildPaylinesPage(pageCfg: any = this.config.paytablePages?.paylines || {}): Container {
    const page = new Container();
    const text1Cfg = pageCfg.text1 || {};
    const gridCfg = pageCfg.grid || {};
    const patterns = Array.isArray(pageCfg.lines) && pageCfg.lines.length > 0
      ? pageCfg.lines.filter((row: unknown) => Array.isArray(row) && row.length === 5).map((row: any) => row.map((value: unknown) => Number(value)))
      : PAYLINE_PATTERNS;
    const columnsPerRow = Math.max(1, toNumber(gridCfg.columnsPerRow, 5));
    const rowBottomYStep = toNumber(gridCfg.rowBottomYStep, 150);
    const previewScale = toNumber(gridCfg.scale, 1);
    const text = this.createLocalizedLegacyText(text1Cfg, {
      x: 310,
      bottomY: 445,
      width: 1300,
      height: 220,
      fontSize: 28,
      key: 'paylinesTxt',
      align: 'center'
    });
    text.anchor.set(0.5, 0);
    text.position.x = HelpMenu.SCREEN_WIDTH / 2;
    page.addChild(text);

    for (let i = 0; i < patterns.length; i += 1) {
      const preview = this.createPaylinePreview(patterns[i], i, previewScale);
      const row = Math.floor(i / columnsPerRow);
      const col = i % columnsPerRow;
      const x = toNumber(gridCfg.startX, 500) + col * toNumber(gridCfg.stepX, 260);
      const y = toNumber(gridCfg.topRowBottomY, 800) - row * rowBottomYStep;
      this.placeLegacy(preview, x, y);
      page.addChild(preview);
    }

    return page;
  }

  private createPaylinePreview(pattern: number[], index: number, scale = 1): Container {
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
    preview.scale.set(scale);
    return preview;
  }

  private buildRulesHowToPage(pageCfg: any = this.config.rulesPages?.howTo || {}): Container {
    const page = new Container();
    const minBet = this.createLegacyBodyText(
      this.getMinBetLabel(),
      toNumber(pageCfg.minBet?.x, 0),
      toNumber(pageCfg.minBet?.bottomY, 910),
      toNumber(pageCfg.minBet?.width, 920),
      toNumber(pageCfg.minBet?.fontSize, 28),
      'left',
      toNumber(pageCfg.minBet?.height, 40)
    );
    const maxBet = this.createLegacyBodyText(
      this.getMaxBetLabel(),
      toNumber(pageCfg.maxBet?.x, 0),
      toNumber(pageCfg.maxBet?.bottomY, 950),
      toNumber(pageCfg.maxBet?.width, 920),
      toNumber(pageCfg.maxBet?.fontSize, 28),
      'left',
      toNumber(pageCfg.maxBet?.height, 40)
    );
    page.addChild(minBet);
    page.addChild(maxBet);

    const iconItems = Array.isArray(pageCfg.items) && pageCfg.items.length > 0
      ? pageCfg.items
      : [
        { id: 'settingsButton', frame: 'button_settings_001.png', x: 210, bottomY: 750, scale: 0.4 },
        { id: 'betButton', frame: 'button_bet_001.png', x: 210, bottomY: 685, scale: 0.4 },
        { id: 'startButton', frame: 'button_start_001.png', x: 210, bottomY: 620, scale: 0.2 },
        { id: 'autoplayButton', frame: 'button_autoplay_001.png', x: 210, bottomY: 555, scale: 0.4 },
        { id: 'stopAutoplayButton', frame: 'button_autoX_001.png', x: 200, bottomY: 320, scale: 0.4 }
      ];

    for (let i = 0; i < iconItems.length; i += 1) {
      const item = iconItems[i];
      const sprite = this.createSprite(String(item.frame || ''), 0, 0);
      if (sprite) {
        sprite.scale.set(toNumber(item.scale, 1));
        this.placeLegacy(sprite, toNumber(item.x, 0), toNumber(item.bottomY, toNumber(item.y, 0)));
        page.addChild(sprite);
      }
    }

    const interfaceText = this.createLocalizedLegacyText(pageCfg.interfaceText, {
      x: 220,
      bottomY: 720,
      width: 1265,
      height: 220,
      fontSize: 26,
      key: 'rulesInterface'
    });
    const autoplayText = this.createLocalizedLegacyText(pageCfg.autoplayText, {
      x: 220,
      bottomY: 420,
      width: 1265,
      height: 180,
      fontSize: 26,
      key: 'rulesAutoplay'
    });
    page.addChild(interfaceText);
    page.addChild(autoplayText);

    return page;
  }

  private buildRulesBetSettingsPage(pageCfg: any = this.config.rulesPages?.betSettings || {}): Container {
    const page = new Container();
    const betMenuText = this.createLocalizedLegacyText(pageCfg.betMenuText, {
      x: 220,
      bottomY: 760,
      width: 1265,
      height: 220,
      fontSize: 26,
      key: 'rulesBetMenu'
    });
    const settingsText = this.createLocalizedLegacyText(pageCfg.settingsText, {
      x: 220,
      bottomY: 480,
      width: 1265,
      height: 220,
      fontSize: 26,
      key: 'rulesSettings'
    });
    page.addChild(betMenuText);
    page.addChild(settingsText);

    const defaultItems = [
      { id: 'minusButton', frame: 'minus_001.png', x: 190, bottomY: 760, scale: 0.8 },
      { id: 'plusButton', frame: 'plus_001.png', x: 270, bottomY: 760, scale: 0.8 },
      { id: 'maxBetButton', frame: 'button_maxbet_001.png', x: 260, bottomY: 680, scale: 0.5 },
      { id: 'betValueButton', frame: 'button_digit_001.png', x: 260, bottomY: 615, scale: 0.5 }
    ];
    const itemMap = new Map<string, any>();
    const pageItems = Array.isArray(pageCfg.items) && pageCfg.items.length > 0 ? pageCfg.items : defaultItems;
    for (let i = 0; i < pageItems.length; i += 1) {
      const item = pageItems[i];
      if (item && item.id) itemMap.set(String(item.id), item);
    }

    const minusCfg = itemMap.get('minusButton') || defaultItems[0];
    const plusCfg = itemMap.get('plusButton') || defaultItems[1];
    const maxButtonCfg = itemMap.get('maxBetButton') || defaultItems[2];
    const betValueCfg = itemMap.get('betValueButton') || defaultItems[3];

    const minus = this.createSprite(String(minusCfg.frame || 'minus_001.png'), 0, 0);
    const plus = this.createSprite(String(plusCfg.frame || 'plus_001.png'), 0, 0);
    if (minus) {
      minus.scale.set(toNumber(minusCfg.scale, 0.8));
      this.placeLegacy(minus, toNumber(minusCfg.x, 190), toNumber(minusCfg.bottomY, 760));
      page.addChild(minus);
    }
    if (plus) {
      plus.scale.set(toNumber(plusCfg.scale, 0.8));
      this.placeLegacy(plus, toNumber(plusCfg.x, 270), toNumber(plusCfg.bottomY, 760));
      page.addChild(plus);
    }

    const maxButton = this.createStaticButton(
      String(maxButtonCfg.frame || 'button_maxbet_001.png'),
      toNumber(maxButtonCfg.x, 260),
      toNumber(maxButtonCfg.bottomY, 680),
      getLocalized(this.game, 'menuBetMaxBet', 'MAX BET'),
      toNumber(maxButtonCfg.scale, 0.5),
      true
    );
    if (maxButton) page.addChild(maxButton);

    const betButton = this.createStaticButton(
      String(betValueCfg.frame || 'button_digit_001.png'),
      toNumber(betValueCfg.x, 260),
      toNumber(betValueCfg.bottomY, 615),
      formatMoney(this.game?.meters?.getTotalBet?.() || 0, this.game),
      toNumber(betValueCfg.scale, 0.5),
      true
    );
    if (betButton) page.addChild(betButton);

    return page;
  }

  private buildRulesLinesPage(pageCfg: any = this.config.rulesPages?.lines || {}): Container {
    const page = new Container();
    const lines = this.createLocalizedLegacyText(pageCfg.linesText, {
      x: 220,
      bottomY: 700,
      width: 1265,
      height: 250,
      fontSize: 26,
      key: 'rulesLines'
    });
    const unfinished = this.createLocalizedLegacyText(pageCfg.unfinishedText, {
      x: 220,
      bottomY: 420,
      width: 1265,
      height: 140,
      fontSize: 26,
      key: 'rulesUnfinished'
    });
    page.addChild(lines);
    page.addChild(unfinished);
    page.addChild(this.rulesRtpText);
    this.placeLegacy(this.rulesRtpText, toNumber(pageCfg.gamePercent?.x, 220), toNumber(pageCfg.gamePercent?.bottomY, 330));
    return page;
  }

  private buildRulesExtraPage(pageCfg: any = this.config.rulesPages?.extra || {}): Container {
    const page = new Container();
    const maxWin = this.createLocalizedLegacyText(pageCfg.maxWinText, {
      x: 220,
      bottomY: 790,
      width: 1580,
      height: 140,
      fontSize: 26,
      key: 'rulesMaxWin'
    });
    const buyBonus = this.createLocalizedLegacyText(pageCfg.buyBonusText, {
      x: 220,
      bottomY: 590,
      width: 1580,
      height: 190,
      fontSize: 26,
      key: 'rulesBuyBonus'
    });
    page.addChild(maxWin);
    page.addChild(buyBonus);
    page.addChild(this.rulesBuyFreeRtpText);
    page.addChild(this.rulesBuyHoldRtpText);
    this.placeLegacy(this.rulesBuyFreeRtpText, toNumber(pageCfg.buyFreeRtp?.x, 220), toNumber(pageCfg.buyFreeRtp?.bottomY, 360));
    this.placeLegacy(this.rulesBuyHoldRtpText, toNumber(pageCfg.buyHoldRtp?.x, 220), toNumber(pageCfg.buyHoldRtp?.bottomY, 315));
    return page;
  }

  private buildRulesAddFreeGamesPage(pageCfg: any = this.config.rulesPages?.addFreeGames || {}): Container {
    const page = new Container();
    const addFg = this.createLocalizedLegacyText(pageCfg.addFreeGamesText, {
      x: 220,
      bottomY: 750,
      width: 1700,
      height: 180,
      fontSize: 34,
      key: 'rulesAddFg'
    });
    page.addChild(addFg);
    return page;
  }

  private buildSettingsPage(): Container {
    const page = new Container();
    const pageCfg = this.config.settingsPage || {};
    const columnsCfg = pageCfg.columns || {};
    const rowsCfg = pageCfg.rows || {};
    const leftColumnX = toNumber(columnsCfg.leftX, 357);
    const rightColumnX = toNumber(columnsCfg.rightX, 1063);
    const soundY = toNumber(rowsCfg.sound, 812);
    const soundFxY = toNumber(rowsCfg.soundFx, 658);
    const musicY = toNumber(rowsCfg.music, 499);
    const volumeY = toNumber(rowsCfg.volume, 345);
    const lobbyY = toNumber(rowsCfg.lobby, 812);
    const skipIntroY = toNumber(rowsCfg.skipIntro, 658);
    const turboY = toNumber(rowsCfg.turbo, 499);

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

    this.settingsToggles.skipScreen = this.createToggleButton('skipscreen_bg', rightColumnX, toNumber(rowsCfg.skipScreen, 340), 'settingsSkipScreen', 'SKIP SCREENS', () => {
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

    const volumeTitleCfg = pageCfg.volumeTitle || {};
    const volumeValueCfg = pageCfg.volumeValue || {};
    const infoTextCfg = pageCfg.infoText || {};
    const volumeTitle = this.createText(getLocalized(this.game, 'settingsVolume', 'VOLUME'), 0, 0, {
      fontSize: toNumber(volumeTitleCfg.fontSize, 34),
      fill: toNumber(volumeTitleCfg.color, 0xb9c5d3),
      anchorX: 0
    });
    this.placeLegacy(volumeTitle, leftColumnX + toNumber(volumeTitleCfg.offsetX, 80), toNumber(volumeTitleCfg.bottomY, 382));
    page.addChild(volumeTitle);
    page.addChild(this.volumeValueText);
    this.placeLegacy(this.volumeValueText, leftColumnX + toNumber(volumeValueCfg.offsetX, 295), toNumber(volumeValueCfg.bottomY, 382));

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
    this.placeLegacy(this.settingsInfoText, toNumber(infoTextCfg.x, rightColumnX), toNumber(infoTextCfg.bottomY, 430));
    return page;
  }

  private getLineBet(): number {
    const meters = this.game?.meters as any;
    if (!meters) return 0;
    const bet = typeof meters.getBetPerLine === 'function' ? Number(meters.getBetPerLine()) : toNumber(meters.bet, 0);
    const denom = typeof meters.getDenomination === 'function' ? Number(meters.getDenomination()) : toNumber(meters.denomination, 0);
    return Math.max(0, bet * denom);
  }

  private getTotalBetAmount(): number {
    const meters = this.game?.meters as any;
    if (!meters) return 0;
    if (typeof meters.getTotalBet === 'function') {
      return Math.max(0, Number(meters.getTotalBet()) || 0);
    }
    return Math.max(0, toNumber(meters.totalBet, 0));
  }

  private getCreditAmount(): number {
    const meters = this.game?.meters as any;
    if (!meters) return 0;
    if (typeof meters.getCredit === 'function') {
      return Math.max(0, Number(meters.getCredit()) || 0);
    }
    return Math.max(0, toNumber(meters.credit, 0));
  }

  private getCurrency(): string {
    const meters = this.game?.meters as any;
    if (!meters) return 'FUN';
    return typeof meters.getCurrency === 'function' ? String(meters.getCurrency() || 'FUN') : String(meters.currency || 'FUN');
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

  private resolvePaySymbolByFrame(frame: string): PaySymbol | null {
    const pages = [PAYTABLE_PAGE_1, PAYTABLE_PAGE_2, PAYTABLE_GOLD_PAGE];
    for (let i = 0; i < pages.length; i += 1) {
      const set = pages[i];
      for (let j = 0; j < set.length; j += 1) {
        if (set[j].frame === frame) return set[j];
      }
    }
    return null;
  }

  private createBodyText(
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    fontSize = 28,
    maxHeight = 0,
    align: 'left' | 'center' | 'right' = 'left',
    autoFit = true
  ): Text {
    const body = this.createText(text, x, y, {
      fontSize,
      fill: 0xffffff,
      anchorX: 0,
      anchorY: 0,
      align,
      autoFit: false
    });
    body.style.wordWrap = true;
    body.style.wordWrapWidth = maxWidth;
    body.style.align = align;
    body.style.fontSize = fontSize;
    body.style.lineHeight = Math.max(16, Math.round(fontSize * 1.02));
    if (autoFit) {
      fitPixiTextToBounds(body, {
        maxWidth,
        maxHeight,
        minFontSize: Math.max(14, Math.round(fontSize * 0.82))
      });
    }
    return body;
  }

  private createBitmapLabel(text: string, x: number, y: number, fontSize: number, fill: number): BitmapText {
    const label = new BitmapText({
      text,
      style: {
        fontFamily: BITMAP_FONT_ROBOTO_CONDENSED_MEDIUM,
        fontSize,
        fill,
        align: 'left'
      }
    });
    label.roundPixels = true;
    label.position.set(x, y);
    return label;
  }

  private getFooterTextY(text: { height: number }): number {
    const footerSprite = this.footerBar.children[0] as { y?: number; height?: number } | undefined;
    const footerY = Number(footerSprite?.y ?? 1034);
    const footerHeight = Number(footerSprite?.height ?? 46);
    return Math.round(footerY + (footerHeight - text.height) / 2);
  }

  private createLegacyBodyText(
    text: string,
    x: number,
    bottomY: number,
    maxWidth: number,
    fontSize = 28,
    align: 'left' | 'center' | 'right' = 'left',
    maxHeight = 0,
    autoFit = true
  ): Text {
    const body = this.createBodyText(text, x, 0, maxWidth, fontSize, maxHeight, align, autoFit);
    this.placeLegacy(body, x, bottomY);
    return body;
  }

  private shouldAutoFitLocalizedText(): boolean {
    return false;
  }

  private createLocalizedLegacyText(config: LegacyTextLayout | undefined, defaults: LegacyTextLayout): Text {
    const merged = resolveLayoutForLocale(this.game, config, defaults);
    const text = getLocalized(this.game, String(merged.key || ''), String(merged.fallback || ''));
    return this.createLegacyBodyText(
      text,
      toNumber(merged.x, 0),
      toNumber(merged.bottomY, 0),
      toNumber(merged.width, 0),
      toNumber(merged.fontSize, 28),
      (merged.align || 'left') as 'left' | 'center' | 'right',
      toNumber(merged.height, 0),
      false
    );
  }

  private applyLegacyTextConfig(display: Text, config: LegacyTextLayout | undefined, defaults: LegacyTextLayout): void {
    const merged = resolveLayoutForLocale(this.game, config, defaults);
    const fontSize = toNumber(merged.fontSize, Number(display.style.fontSize) || 28);
    display.style.fontSize = fontSize;
    display.style.lineHeight = Math.max(16, Math.round(fontSize * 1.02));
    display.style.align = (merged.align || 'left') as 'left' | 'center' | 'right';
    display.style.wordWrap = toNumber(merged.width, 0) > 0;
    display.style.wordWrapWidth = toNumber(merged.width, 0);
    this.placeLegacy(display, toNumber(merged.x, 0), toNumber(merged.bottomY, 0));
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
      maxHeight?: number;
      autoFit?: boolean;
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
    const autoFit = options.autoFit !== false;
    if (autoFit && (toNumber(options.maxWidth, 0) > 0 || toNumber(options.maxHeight, 0) > 0)) {
      fitPixiTextToBounds(display, {
        maxWidth: toNumber(options.maxWidth, 0),
        maxHeight: toNumber(options.maxHeight, 0),
        minFontSize: 14
      });
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
    let selectedState = false;
    root.on('pointerdown', () => {
      root.texture = selected;
    });
    root.on('pointerup', () => {
      root.texture = selectedState ? selected : normal;
      onTap();
    });
    root.on('pointerupoutside', () => {
      root.texture = selectedState ? selected : normal;
    });
    root.on('pointerout', () => {
      root.texture = selectedState ? selected : normal;
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
        selectedState = value;
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
