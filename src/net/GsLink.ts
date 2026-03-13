/**
 * Game server adapter:
 * - websocket transport to the game server
 */

import { createGameOutcome, type GameOutcomeShape, type WinLike } from '../game/GameOutcome';
import { Win, WINTYPES } from '../game/Win';
import { getDefaultNumberPattern } from '../utils/numberFormat';
import Pool from '../core/utils/Pool';
import { debug, error as logError } from '../core/utils/logger';
import type BaseGame from '../core/BaseGame';

const DEFAULT_GAME_ID = 'book-of-knight-alea';
const DEFAULT_WS_PORT = '8081';

type ServerWin = {
  winningLine?: number;
  bet?: number;
  symbol?: number;
  cnt?: number;
  mult?: number;
  hasWild?: boolean;
  type?: number;
  highlight?: number[][];
};


type LoginParams = {
  addFreeGamesCnt?: number;
  showAddFreeSpins?: number | boolean;
  hasAddFreeGames?: number | boolean;
  minDenom?: number;
  minBetPerLine?: number;
  minLines?: number;
  denom?: number;
  betPerLine?: number;
  linesSelected?: number;
  maxDenom?: number;
  maxBetPerLine?: number;
  maxLines?: number;
  currency?: string;
  locked?: number | boolean;
  hasTurboSpins?: number | boolean;
  hasBuyFeature?: number | boolean;
  hasReloadButton?: number | boolean;
  hasHomeButton?: number | boolean;
  hasHistoryButton?: number | boolean;
  hasLobbyButton?: number | boolean;
  gamePercent?: number;
  gamePercentBuyFree?: number;
  gamePercentBuyHold?: number;
  buyFreeGamesMult?: number;
  buyHoldAndWinMult?: number;
  pattern?: string;
  sessionUID?: string;
};

type ServerOutcome = {
  matrix?: number[][];
  wins?: ServerWin[];
  bet?: number;
  win?: number;
  balance?: number;
  hasFreeGames?: boolean;
  freeGamesCnt?: number;
  specialSymbol?: number;
  hasHoldAndWin?: boolean;
  matrixHoldAndWinValues?: number[][];
  matrixHoldAndWin?: number[][];
  holdAndWinCnt?: number;
  mode?: number;
  allFreeGamesCnt?: number;
  fgWin?: number;
  holdAndWinWin?: number;
  buyFreeGamesMult?: number;
  buyHoldAndWinMult?: number;
  roundId?: number;
  pattern?: string;
};

type SpinAppliedListener = (outcome: GameOutcomeShape) => void;

function toInt(value: unknown, fallback = 0): number {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function cloneHighlightMatrix(source: unknown): number[][] {
  if (!Array.isArray(source)) {
    return [
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0]
    ];
  }

  return source.map((row) => (Array.isArray(row) ? [...row] : [0, 0, 0, 0, 0]));
}

function normalizeMatrix(source: unknown, rows = 3, cols = 5): number[][] {
  const matrix: number[][] = [];
  for (let row = 0; row < rows; row++) {
    const srcRow = Array.isArray((source as number[][])?.[row]) ? (source as number[][])[row] : [];
    const line: number[] = [];
    for (let col = 0; col < cols; col++) {
      line.push(toInt(srcRow[col], 0));
    }
    matrix.push(line);
  }
  return matrix;
}

function normalizeServerOutcome(source: unknown): Required<ServerOutcome> {
  const outcome = (source && typeof source === 'object' ? source : {}) as ServerOutcome;
  return {
    matrix: normalizeMatrix(outcome.matrix, 3, 5),
    wins: Array.isArray(outcome.wins) ? outcome.wins : [],
    bet: toInt(outcome.bet, 0),
    win: toInt(outcome.win, 0),
    balance: toInt(outcome.balance, 0),
    hasFreeGames: !!outcome.hasFreeGames,
    freeGamesCnt: toInt(outcome.freeGamesCnt, 0),
    specialSymbol: toInt(outcome.specialSymbol, -1),
    hasHoldAndWin: !!outcome.hasHoldAndWin,
    matrixHoldAndWinValues: normalizeMatrix(outcome.matrixHoldAndWinValues, 3, 5),
    matrixHoldAndWin: normalizeMatrix(outcome.matrixHoldAndWin, 3, 5),
    holdAndWinCnt: toInt(outcome.holdAndWinCnt, 0),
    mode: toInt(outcome.mode, 0),
    allFreeGamesCnt: toInt(outcome.allFreeGamesCnt, 0),
    fgWin: toInt(outcome.fgWin, 0),
    holdAndWinWin: toInt(outcome.holdAndWinWin, 0),
    buyFreeGamesMult: toInt(outcome.buyFreeGamesMult, 0),
    buyHoldAndWinMult: toInt(outcome.buyHoldAndWinMult, 0),
    roundId: toInt(outcome.roundId, 0),
    pattern: typeof outcome.pattern === 'string' ? outcome.pattern.trim() : ''
  };
}

function resetPooledWin(win: WinLike): void {
  if (!win || typeof win !== 'object') return;
  win.winningLine = 0;
  win.bet = 0;
  win.symbol = -1;
  win.cnt = 0;
  win.mult = 0;
  win.hasWild = false;
  win.type = WINTYPES.NEAR_MISS;
  win.highlightTimeout = 0;
  win.highlight = [
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0]
  ];
}

function mapServerWinType(serverType: number): number {
  switch (serverType) {
    case 0: return WINTYPES.LINE;
    case 1: return WINTYPES.NEAR_MISS_WILD;
    case 2: return WINTYPES.SCATTER;
    case 3: return WINTYPES.NEAR_MISS;
    default: return WINTYPES.NEAR_MISS;
  }
}

function formatServerError(response: any, fallback: string): string {
  const code = toInt(response && response.err, 0);
  const errMsg = response && typeof response.errMsg === 'string' ? response.errMsg.trim() : '';
  const base = errMsg || fallback || 'Server error';
  const withCode = code > 0 ? `[${code}] ${base}` : base;
  return `${withCode}\nPlease reload the game!`;
}


function toBoolFlag(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1') return true;
  if (value === 0 || value === '0') return false;
  return fallback;
}
function normalizeWsAddress(rawValue: string): string {
  if (!rawValue || typeof rawValue !== 'string') return '';
  const decoded = decodeURIComponent(rawValue).trim();
  if (!decoded) return '';

  const withScheme = /^wss?:\/\//i.test(decoded) ? decoded : `ws://${decoded}`;

  try {
    const url = new URL(withScheme);
    if (!url.port) {
      url.port = DEFAULT_WS_PORT;
    }
    return url.toString().replace(/\/$/, '');
  } catch {
    return withScheme;
  }
}

function hasActiveServerError(game: any): boolean {
  const serverError = game?.context?.serverError;
  return !!(
    serverError &&
    serverError.visible &&
    typeof serverError.message === 'string' &&
    serverError.message.trim().length > 0
  );
}

export default class GsLink {
  private game: any;
  private params: URLSearchParams;
  serverAddress: string;
  private connection: WebSocket | null;
  private isConnected: boolean;
  private isLoggedIn: boolean;
  spinEnded: boolean;

  private sessionId: string;
  private token: string;
  private userId: string;
  currency: string;
  private gameId: string;
  private lobbyUrl: string;
  private lang: string;
  private errorTxt: string;
  private sessionUID: string;
  private hasLobby: boolean;
  private device: string;
  private currentURL: string;
  private operator: string;

  private gameParams: { betPerLine: number; linesSelected: number; credits: number; denom: number; hasBuyBonus: boolean; buyBonusType: number };

  private numberPattern: string;
  private numberPatternLocked: boolean;
  private pendingLoginTimerId: number;
  private winPool: Pool<WinLike>;
  private activePooledWins: WinLike[];
  private balance = 0;
  private readonly spinAppliedListeners: Set<SpinAppliedListener>;

  constructor(game: BaseGame) {
    this.game = game as any;

    this.params = new URLSearchParams(window.location.search || '');
    this.serverAddress = this.resolveServerAddress();

    this.connection = null;
    this.isConnected = false;
    this.isLoggedIn = false;
    this.spinEnded = false;

    this.sessionId = '';
    this.token = '';
    this.userId = '';
    this.currency = '';
    this.gameId = DEFAULT_GAME_ID;
    this.lobbyUrl = 'http://www.felixgaming.com';
    this.lang = 'ENG';
    this.errorTxt = '';
    this.sessionUID = '';
    this.hasLobby = false;
    this.device = 'MOBILE';
    this.currentURL = '';
    this.operator = '';

    this.gameParams = {
      betPerLine: 1,
      linesSelected: 20,
      credits: 0,
      denom: 1,
      hasBuyBonus: false,
      buyBonusType: -1
    };

    this.numberPattern = getDefaultNumberPattern();
    this.numberPatternLocked = false;
    this.pendingLoginTimerId = 0;
    this.spinAppliedListeners = new Set();
    this.winPool = new Pool<WinLike>({
      create: () => Object.assign({}, Win),
      reset: resetPooledWin,
      maxSize: 128
    });
    this.activePooledWins = [];
    this.configureSessionFromQuery();

    debug(`GsLink::serverAddress ${this.serverAddress || '[missing]'}`);
    debug('GsLink::constructor');
  }

  private resolveServerAddress(): string {
    const explicitWs = this.params.get('ws');
    if (explicitWs) {
      return normalizeWsAddress(explicitWs);
    }

    const port = this.params.get('p');
    if (port) {
      return `wss://sgb-dev.gamingdevices.co.uk:${decodeURIComponent(port)}`;
    }

    return '';
  }

  private configureSessionFromQuery(): void {
    const lobbyUrl = this.params.get('lobbyUrl');
    const userId = this.params.get('userId');
    const currency = this.params.get('currency');
    const token = this.params.get('token');
    const sessionId = this.params.get('sessionId');
    const lang = this.params.get('lang');
    const device = this.params.get('device');
    const currentUrl = this.params.get('currentUrl') || this.params.get('currentURL');
    const operator = this.params.get('operator') || this.params.get('oprator');

    if (lobbyUrl) this.lobbyUrl = decodeURIComponent(lobbyUrl);
    if (userId) this.userId = decodeURIComponent(userId);
    if (currency) this.currency = decodeURIComponent(currency);

    if (token) {
      this.token = decodeURIComponent(token);
    }

    if (sessionId) {
      this.sessionId = decodeURIComponent(sessionId);
      this.gameId = DEFAULT_GAME_ID;
    }

    if (lang) {
      this.lang = decodeURIComponent(lang).trim().toUpperCase() || 'ENG';
    }
    if (device) {
      this.device = decodeURIComponent(device).trim().toUpperCase() || this.device;
    }
    if (currentUrl) {
      this.currentURL = decodeURIComponent(currentUrl).trim();
    }
    if (operator) {
      this.operator = decodeURIComponent(operator).trim();
    }
  }

  private updateNumberPatternFromSource(source: any): void {
    if (!source || typeof source !== 'object') return;
    const pattern = typeof source.pattern === 'string' ? source.pattern.trim() : '';
    if (pattern) {
      this.numberPattern = pattern;
    }
  }

  getNumberPattern(): string {
    return this.numberPattern || getDefaultNumberPattern();
  }

  private clearPendingTimers(): void {
    if (!this.game || !this.game.timers || typeof this.game.timers.cancel !== 'function') {
      this.pendingLoginTimerId = 0;
      return;
    }

    if (this.pendingLoginTimerId) {
      this.game.timers.cancel(this.pendingLoginTimerId);
      this.pendingLoginTimerId = 0;
    }
  }

  private releaseActiveWins(): void {
    if (!this.winPool || !this.activePooledWins || this.activePooledWins.length === 0) return;
    this.winPool.releaseMany(this.activePooledWins);
    this.activePooledWins = [];
  }

  private captureInitialPatternFromLogin(response: any): void {
    if (this.numberPatternLocked) return;
    if (!response || typeof response !== 'object') return;

    const params = response.params && typeof response.params === 'object' ? response.params : null;
    if (params) this.updateNumberPatternFromSource(params);
    this.updateNumberPatternFromSource(response);
    this.numberPatternLocked = true;
  }


  private applyLoginParams(rawParams: unknown): void {
    if (!rawParams || typeof rawParams !== 'object') return;

    const params = rawParams as LoginParams;

    const meters = this.game?.meters;
    if (meters) {
      if (Number.isFinite(params.minDenom)) meters.setMinDenom(toInt(params.minDenom, meters.MIN_DENOM));
      if (Number.isFinite(params.minBetPerLine)) meters.setMinBetPerLine(toInt(params.minBetPerLine, meters.MIN_BET_PER_LINE));
      if (Number.isFinite(params.minLines)) meters.setMinLines(toInt(params.minLines, meters.MIN_LINES));

      if (Number.isFinite(params.maxDenom)) meters.setMaxDenom(toInt(params.maxDenom, meters.MAX_DENOM));
      if (Number.isFinite(params.maxBetPerLine)) meters.setMaxBetPerLine(toInt(params.maxBetPerLine, meters.MAX_BET_PER_LINE));
      if (Number.isFinite(params.maxLines)) meters.setMaxLines(toInt(params.maxLines, meters.MAX_LINES));

      if (Number.isFinite(params.denom)) meters.setDenom(toInt(params.denom, meters.getDenomination()));
      if (Number.isFinite(params.betPerLine)) meters.setBetPerLine(toInt(params.betPerLine, meters.getBetPerLine()));
      if (Number.isFinite(params.linesSelected)) meters.setLines(toInt(params.linesSelected, meters.getLines()));

      if (typeof params.currency === 'string' && params.currency.trim().length > 0) {
        meters.setCurrency(params.currency.trim());
        this.currency = meters.getCurrency();
      }
    }

    const context = this.game?.context;
    if (context) {
      context.addFreeSpinsCnt = toInt(params.addFreeGamesCnt, 0);
      context.showAddFreeSpins = toBoolFlag(params.showAddFreeSpins, false);
      context.hasAddFreeSpins = toBoolFlag(params.hasAddFreeGames, false);

      context.turboSpinIsEnabled = toBoolFlag(params.hasTurboSpins, context.turboSpinIsEnabled);
      context.hasBuyFeature = toBoolFlag(params.hasBuyFeature, context.hasBuyFeature);
      context.buyFeatureConfigured = true;
      context.hasReloadButton = toBoolFlag(params.hasReloadButton, false);
      context.hasHomeButton = toBoolFlag(params.hasHomeButton, false);
      context.hasHistoryButton = toBoolFlag(params.hasHistoryButton, false);
      context.hasLobbyButton = toBoolFlag(params.hasLobbyButton, false);

      context.gamePercent = toInt(params.gamePercent, 0);
      context.gamePercentBuyFree = toInt(params.gamePercentBuyFree, 0);
      context.gamePercentBuyHold = toInt(params.gamePercentBuyHold, 0);

      context.buyFreeGamesMult = toInt(params.buyFreeGamesMult, context.buyFreeGamesMult || 0);
      context.buyHoldAndWinMult = toInt(params.buyHoldAndWinMult, context.buyHoldAndWinMult || 0);
    }

    if (typeof params.sessionUID === 'string' && params.sessionUID.trim().length > 0) {
      this.sessionUID = params.sessionUID;
    }

    this.hasLobby = toBoolFlag(params.hasLobbyButton, this.hasLobby);
    this.updateNumberPatternFromSource(params);
    (this.game as any).locked = toBoolFlag(params.locked, false);
  }
  setParams(): { betPerLine: number; linesSelected: number; credits: number; denom: number; hasBuyBonus: boolean; buyBonusType: number } {
    this.gameParams.betPerLine = this.game.meters.getBetPerLine();
    this.gameParams.linesSelected = this.game.meters.getLines();
    this.gameParams.denom = this.game.meters.getDenomination();
    this.gameParams.hasBuyBonus = !!(this.game && this.game.context && this.game.context.hasBuyBonus);
    this.gameParams.buyBonusType = Number(this.game && this.game.context ? this.game.context.buyBonusType : -1);
    if (!Number.isFinite(this.gameParams.buyBonusType)) {
      this.gameParams.buyBonusType = -1;
    }
    return { ...this.gameParams };
  }

  connect(): void {
    if (this.isConnected) return;
    if (!this.serverAddress) {
      this.onError('Missing server address');
      return;
    }

    this.spinEnded = false;
    this.isLoggedIn = false;
    this.clearPendingTimers();

    this.connection = new WebSocket(this.serverAddress);
    this.connection.addEventListener('open', () => this.onOpen());
    this.connection.addEventListener('close', () => this.onClose());
    this.connection.addEventListener('message', (event) => this.onMessage(event));
    this.connection.addEventListener('error', (event) => this.onError(event));
  }

  disconnect(): void {
    if (!this.isConnected) {
      debug('game not connected');
      return;
    }

    if (this.connection) {
      this.connection.close();
    }
    this.clearPendingTimers();
    this.releaseActiveWins();
    this.connection = null;
    this.isConnected = false;
    this.isLoggedIn = false;
    debug('GsLink::disconnect');
  }

  private send(message: Record<string, unknown>): boolean {
    if (!this.connection || this.connection.readyState !== WebSocket.OPEN) {
      this.onError('WebSocket is not open');
      return false;
    }

    this.connection.send(JSON.stringify(message));
    return true;
  }

  private login(): void {
    if (!this.isConnected) return;

    this.send({
      cmd: 'login',
      token: this.token,
      sessionId: this.sessionId,
      game: this.gameId,
      userId: this.userId,
      comment: 'Token auth',
      version: 1,
      currency: this.currency,
      site: this.lobbyUrl,
      lang: this.lang
    });
  }

  getBalance(): void {
    if (!this.isConnected) {
      this.onError('client not connected');
      return;
    }

    this.send({ cmd: 'balance' });
    debug('GsLink::getBalance');
  }

  spin(): void {
    debug('GsLink::spin');
    this.spinEnded = false;

    if (!this.isConnected) {
      this.onError('game not connected');
      this.spinEnded = true;
      return;
    }

    this.setParams();
    this.send({ cmd: 'spin', params: this.gameParams });
  }

  private onOpen(): void {
    debug('Connection open!');
    this.isConnected = true;
    this.clearServerError();
    if (this.game?.timers?.after) {
      this.pendingLoginTimerId = this.game.timers.after(250, () => {
        this.login();
        this.pendingLoginTimerId = 0;
      });
    } else {
      setTimeout(() => this.login(), 250);
    }
  }

  private onClose(): void {
    debug('Connection closed');
    this.clearPendingTimers();
    this.releaseActiveWins();
    this.isConnected = false;
    this.isLoggedIn = false;
    if (!this.hasVisibleServerError()) {
      this.pushServerError('Unable to connect with server.\nCheck your connection and try again');
    }
  }

  onSpin(outcome: unknown): void {
    debug('GsLink::onSpin');
    debug(`GsLink::onSpin raw ${JSON.stringify(outcome)}`);

    const serverOutcome = normalizeServerOutcome(outcome);
    this.releaseActiveWins();

    const mappedOutcome = createGameOutcome();
    mappedOutcome.matrix = serverOutcome.matrix;
    mappedOutcome.hasFreeGames = serverOutcome.hasFreeGames;

    const finalBalance = toInt(serverOutcome.balance, this.game.meters.credit);
    const stagedBalance = Math.max(0, finalBalance - toInt(serverOutcome.win, 0));
    this.game.context.finalCreditMeter = finalBalance;
    this.game.meters.credit = stagedBalance;
    this.game.meters.win = serverOutcome.win;
    this.game.meters.fgwin = serverOutcome.fgWin;
    this.game.reels.matrix = mappedOutcome.matrix;

    const serverWins = serverOutcome.wins;
    for (let i = 0; i < serverWins.length; i++) {
      const serverWin = serverWins[i];
      const win = this.winPool.acquire();
      win.winningLine = toInt(serverWin.winningLine, 0);
      win.bet = toInt(serverWin.bet, serverOutcome.bet);
      win.symbol = toInt(serverWin.symbol, -1);
      win.cnt = toInt(serverWin.cnt, 0);
      win.mult = toInt(serverWin.mult, 0);
      win.hasWild = !!serverWin.hasWild;
      win.highlightTimeout = 100;
      win.type = mapServerWinType(toInt(serverWin.type, 0));

      if (win.type === WINTYPES.LINE) {
        win.highlightTimeout = win.hasWild ? 140 : (win.cnt > 3 ? 120 : 50);
        mappedOutcome.hasLineWins = true;
        mappedOutcome.hasWin = true;
      } else if (win.type === WINTYPES.SCATTER) {
        win.highlightTimeout = 140;
        mappedOutcome.hasWin = true;
      } else if (win.type === WINTYPES.NEAR_MISS_WILD) {
        mappedOutcome.hasLineWins = true;
        mappedOutcome.hasWin = true;
      }

      win.highlight = cloneHighlightMatrix(serverWin.highlight);

      if (win.type !== WINTYPES.NEAR_MISS) {
        mappedOutcome.wins.push(win as any);
      } else {
        this.winPool.release(win);
      }
    }

    this.activePooledWins = mappedOutcome.wins.slice() as WinLike[];
    this.game.context.outcome = mappedOutcome;
    this.game.context.server = {
      mode: serverOutcome.mode,
      roundId: serverOutcome.roundId,
      freeGamesCnt: serverOutcome.freeGamesCnt,
      allFreeGamesCnt: serverOutcome.allFreeGamesCnt,
      specialSymbol: serverOutcome.specialSymbol,
      hasHoldAndWin: serverOutcome.hasHoldAndWin,
      holdAndWinCnt: serverOutcome.holdAndWinCnt,
      holdAndWinWin: serverOutcome.holdAndWinWin,
      matrixHoldAndWin: serverOutcome.matrixHoldAndWin,
      matrixHoldAndWinValues: serverOutcome.matrixHoldAndWinValues,
      buyFreeGamesMult: serverOutcome.buyFreeGamesMult,
      buyHoldAndWinMult: serverOutcome.buyHoldAndWinMult,
      pattern: this.getNumberPattern()
    };
    this.game.context.buyFreeGamesMult = serverOutcome.buyFreeGamesMult;
    this.game.context.buyHoldAndWinMult = serverOutcome.buyHoldAndWinMult;
    if (!this.game.context.buyFeatureConfigured) {
      this.game.context.hasBuyFeature = serverOutcome.buyFreeGamesMult > 0 || serverOutcome.buyHoldAndWinMult > 0;
    }
    if (!this.game.context.hasBuyBonus) {
      this.game.context.buyBonusType = -1;
    }
    this.game.reels.updateStopSymbols();
    this.game.controller.updateMeters();
    this.emitSpinApplied(mappedOutcome);
  }

  private onLogin(balance: number, demo: boolean): void {
    this.game.meters.credit = toInt(balance, this.game.meters.credit);
    this.game.context.finalCreditMeter = this.game.meters.credit;
    this.game.DEMO_MODE = !!demo;
    this.clearServerError();
    if (this.game.controller?.updateMeters) {
      this.game.controller.updateMeters();
    }
    debug(`Logged in. Balance: ${this.game.meters.credit}`);
  }

  private onMessage(event: MessageEvent<string>): void {
    let response: any;
    try {
      response = JSON.parse(event.data);
    } catch {
      this.onError(`Invalid server message: ${event.data}`);
      return;
    }

    if (toInt(response && response.err, 0) > 0) {
      this.isLoggedIn = false;
      this.spinEnded = true;
      this.onError(formatServerError(response, 'Server validation error'));
      return;
    }

    switch (response.cmd) {
      case 'login':
        if (response.success === true) {
          this.spinEnded = true;
          this.isLoggedIn = true;
          this.captureInitialPatternFromLogin(response);
          if (response.params && typeof response.params === 'object') {
            this.applyLoginParams(response.params);
          }
          this.onLogin(response.balance, response.demo);
        } else {
          this.isLoggedIn = false;
          this.onError(response.err || 'Login failed');
        }
        break;

      case 'spin':
        if (response.success === true) {
          this.onSpin(response.outcome || {});
          this.spinEnded = true;
        } else {
          this.onError(response.err || 'Spin failed');
          this.spinEnded = true;
        }
        this.isLoggedIn = response.isLoggedIn !== false;
        break;

      case 'balance':
        this.balance = toInt(response.balance, this.game.meters.credit);
        this.game.meters.credit = this.balance;
        this.game.context.finalCreditMeter = this.balance;
        break;

      default:
        if (response && Array.isArray(response.matrix)) {
          this.onSpin(response);
          this.spinEnded = true;
          this.isLoggedIn = true;
          break;
        }
        this.onError(formatServerError(response, `Unknown message: ${event.data}`));
        break;
    }
  }

  onError(error: unknown): void {
    this.errorTxt = typeof error === 'string' ? error : 'GsLink::onError';
    this.pushServerError(this.errorTxt);
    logError(this.errorTxt);
  }

  isFullyConnected(): boolean {
    return this.isConnected && this.isLoggedIn;
  }

  onHomeButton(): void {
    if (this.hasLobby) {
      const iframeHistory = document.getElementById('iframeHistory') as HTMLIFrameElement | null;
      const iframeLobby = document.getElementById('iframeLobby') as HTMLIFrameElement | null;
      const parent = document.getElementById('parent') as HTMLElement | null;
      const overlay = document.getElementById('overlay') as HTMLElement | null;

      if (!iframeLobby) {
        window.location.replace(this.lobbyUrl);
        return;
      }

      const timestamp = Date.now();
      const session = this.sessionId;
      const gameId = 'bookofknightholdandwin';
      const credit = this.game?.meters?.credit ?? 0;
      const hasEmbeddedLobbyRoute = !!this.currentURL && !!this.operator;
      const embeddedLobbyUrl = hasEmbeddedLobbyRoute
        ? `https://${this.currentURL}/lobby-${this.operator}`
        : this.lobbyUrl;
      const sessionUrl = hasEmbeddedLobbyRoute
        ? `https://${this.currentURL}/lobby-${this.operator}` +
          `?sessionId=${encodeURIComponent(session)}` +
          `&device=${encodeURIComponent(this.device)}` +
          `&credit=${encodeURIComponent(String(credit))}` +
          `&gameId=${encodeURIComponent(gameId)}` +
          `&lang=${encodeURIComponent(this.lang)}` +
          `&currency=${encodeURIComponent(this.currency)}` +
          `&lobbyUrl=${encodeURIComponent(embeddedLobbyUrl)}` +
          `&t=${encodeURIComponent(String(timestamp))}` +
          `&operator=${encodeURIComponent(this.operator)}` +
          `&currentURL=${encodeURIComponent(this.currentURL)}`
        : this.lobbyUrl;

      if (iframeHistory) iframeHistory.style.display = 'none';
      iframeLobby.style.display = 'block';

      setTimeout(() => {
        iframeLobby.onload = () => {
          if (parent) parent.style.display = 'block';
          if (overlay) overlay.style.display = 'block';
          iframeLobby.style.display = 'block';
        };

        if (iframeLobby.contentWindow) {
          iframeLobby.contentWindow.location.replace(sessionUrl);
        } else {
          iframeLobby.src = sessionUrl;
        }

        setTimeout(() => {
          if (parent) parent.style.display = 'block';
          if (overlay) overlay.style.display = 'block';
          iframeLobby.style.display = 'block';
        }, 1000);
      }, 100);

      return;
    }

    window.location.replace(this.lobbyUrl);
  }

  private pushServerError(message: string): void {
    if (!this.game || !this.game.context) return;
    if (!this.game.context.serverError) {
      this.game.context.serverError = { visible: false, message: '' };
    }
    this.game.context.serverError.visible = true;
    this.game.context.serverError.message = message || 'Unable to connect with server.\nCheck your connection and try again';
  }

  private clearServerError(): void {
    if (!this.game || !this.game.context || !this.game.context.serverError) return;
    this.game.context.serverError.visible = false;
    this.game.context.serverError.message = '';
  }

  private hasVisibleServerError(): boolean {
    return hasActiveServerError(this.game);
  }

  onSpinApplied(listener: SpinAppliedListener): () => void {
    this.spinAppliedListeners.add(listener);
    return () => {
      this.spinAppliedListeners.delete(listener);
    };
  }

  private emitSpinApplied(outcome: GameOutcomeShape): void {
    for (const listener of this.spinAppliedListeners) {
      listener(outcome);
    }
  }
}








