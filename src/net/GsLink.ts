/**
 * Game server adapter:
 * - websocket transport to the game server
 */

import { createGameOutcome, type GameOutcomeShape, type WinLike } from '../game/GameOutcome';
import { getGameplayWinSoundConfig } from '../config/gameplayConfig';
import { Win, WINTYPES } from '../game/Win';
import { getDefaultNumberPattern } from '../utils/numberFormat';
import Pool from '../core/utils/Pool';
import { debug, error as logError } from '../core/utils/logger';
import type BaseGame from '../core/BaseGame';
import { ensureFreeGamesState, markFreeGamesIntroSource } from '../game/FreeGamesController';

const DEFAULT_GAME_ID = 'book-of-knight-demo';
const DEFAULT_WS_PORT = '8703';

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
  addFreeSpinsCnt?: number;
  showAddFreeSpins?: number | boolean;
  hasAddFreeGames?: number | boolean;
  hasAddFreeSpins?: number | boolean;
  bonusCashActive?: number | boolean;
  bonusCashSpins?: number;
  bonusCashWin?: number;
  minDenom?: number;
  MIN_DENOM?: number;
  minBetPerLine?: number;
  MIN_BET_PER_LINE?: number;
  minLines?: number;
  MIN_LINES?: number;
  denom?: number;
  betPerLine?: number;
  linesSelected?: number;
  maxDenom?: number;
  MAX_DENOM?: number;
  maxBetPerLine?: number;
  MAX_BET_PER_LINE?: number;
  maxLines?: number;
  MAX_LINES?: number;
  currency?: string;
  locked?: number | boolean;
  hasTurboSpins?: number | boolean;
  hasBuyFeature?: number | boolean;
  hasReloadButton?: number | boolean;
  hasHomeButton?: number | boolean;
  hasHistoryButton?: number | boolean;
  hasHistory?: number | boolean;
  hasLobbyButton?: number | boolean;
  gamePercent?: number | string;
  gamePercentBuyFree?: number | string;
  gamePercentBuyHold?: number | string;
  buyFreeGamesMult?: number;
  buyHoldAndWinMult?: number;
  GRAND_JACKPOT_VALUE?: number;
  MAJOR_JACKPOT_VALUE?: number;
  MINOR_JACKPOT_VALUE?: number;
  grandJackpotValue?: number;
  majorJackpotValue?: number;
  minorJackpotValue?: number;
  pattern?: string;
  sessionUID?: string;
  skipIntro?: number | boolean;
  skipScreen?: number | boolean;
  turboGame?: number | boolean;
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
type ConnectionResult = { ok: true } | { ok: false; message: string };
type ConnectionResultListener = (result: ConnectionResult) => void;

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
  win.sound = undefined;
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

function resolveWinSound(win: WinLike): WinLike['sound'] {
  const config = getGameplayWinSoundConfig();

  if (win.type === WINTYPES.SCATTER) {
    return config.scatter;
  }

  if (win.type === WINTYPES.LINE) {
    return config.lineBySymbol[win.symbol] || config.lineDefault;
  }

  return undefined;
}

function readRuntimeNumericGlobal(name: string, fallback: number): number {
  if (typeof window === 'undefined') return fallback;
  const runtimeGlobals = window as unknown as Record<string, unknown>;
  const rawValue = runtimeGlobals[name];
  const parsed = Number(rawValue);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function resolveJackpotMultiplierParam(
  params: Record<string, unknown>,
  names: string[],
  fallback: number
): number {
  for (let i = 0; i < names.length; i += 1) {
    const value = Number(params[names[i]]);
    if (Number.isFinite(value)) {
      return value;
    }
  }

  return fallback;
}

function readServerText(value: unknown, fallback = ''): string {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return fallback;
}

function readServerNumber(params: Record<string, unknown>, names: string[], fallback: number): number {
  for (let i = 0; i < names.length; i += 1) {
    const value = Number(params[names[i]]);
    if (Number.isFinite(value)) {
      return value;
    }
  }

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

const ALEA_GAME_ID = 'book-of-knight-alea';

function hasActiveServerError(game: any): boolean {
  const serverError = game?.context?.serverError;
  return !!(
    serverError &&
    serverError.visible &&
    typeof serverError.message === 'string' &&
    serverError.message.trim().length > 0
  );
}

function isDevServerTraceEnabled(): boolean {
  return !!import.meta.env?.DEV;
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
  private readonly connectionResultListeners: Set<ConnectionResultListener>;

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
    this.connectionResultListeners = new Set();
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
      this.gameId = ALEA_GAME_ID;
    } else {
      this.token = 'demo';
      this.gameId = DEFAULT_GAME_ID;
    }

    if (sessionId) {
      this.sessionId = decodeURIComponent(sessionId);
      this.gameId = ALEA_GAME_ID;
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

    const params = rawParams as LoginParams & Record<string, unknown>;

    const meters = this.game?.meters;
    if (meters) {
      meters.setMinDenom(readServerNumber(params, ['minDenom', 'MIN_DENOM'], meters.MIN_DENOM));
      meters.setMinBetPerLine(readServerNumber(params, ['minBetPerLine', 'MIN_BET_PER_LINE'], meters.MIN_BET_PER_LINE));
      meters.setMinLines(readServerNumber(params, ['minLines', 'MIN_LINES'], meters.MIN_LINES));

      meters.setMaxDenom(readServerNumber(params, ['maxDenom', 'MAX_DENOM'], meters.MAX_DENOM));
      meters.setMaxBetPerLine(readServerNumber(params, ['maxBetPerLine', 'MAX_BET_PER_LINE'], meters.MAX_BET_PER_LINE));
      meters.setMaxLines(readServerNumber(params, ['maxLines', 'MAX_LINES'], meters.MAX_LINES));

      meters.setDenom(readServerNumber(params, ['denom'], meters.getDenomination()));
      meters.setBetPerLine(readServerNumber(params, ['betPerLine'], meters.getBetPerLine()));
      meters.setLines(readServerNumber(params, ['linesSelected'], meters.getLines()));

      if (typeof params.currency === 'string' && params.currency.trim().length > 0) {
        meters.setCurrency(params.currency.trim());
        this.currency = meters.getCurrency();
      }
    }

    const context = this.game?.context;
    if (context) {
      context.addFreeSpinsCnt = readServerNumber(params, ['addFreeGamesCnt', 'addFreeSpinsCnt'], 0);
      context.showAddFreeSpins = toBoolFlag(params.showAddFreeSpins, false);
      context.hasAddFreeSpins = toBoolFlag(params.hasAddFreeGames, toBoolFlag(params.hasAddFreeSpins, false));
      context.bonusCashActive = toBoolFlag(params.bonusCashActive, context.bonusCashActive);
      context.bonusCashSpins = toInt(params.bonusCashSpins, context.bonusCashSpins || 0);
      context.bonusCashWin = toInt(params.bonusCashWin, context.bonusCashWin || 0);

      context.turboSpinIsEnabled = toBoolFlag(params.hasTurboSpins, context.turboSpinIsEnabled);
      context.skipIntro = toBoolFlag(params.skipIntro, context.skipIntro);
      context.skipScreen = toBoolFlag(params.skipScreen, context.skipScreen);
      context.turboGame = toBoolFlag(params.turboGame, context.turboGame);
      context.hasBuyFeature = toBoolFlag(params.hasBuyFeature, context.hasBuyFeature);
      context.buyFeatureConfigured = true;
      context.hasReloadButton = toBoolFlag(params.hasReloadButton, false);
      context.hasHomeButton = toBoolFlag(params.hasHomeButton, false);
      context.hasHistoryButton = toBoolFlag(params.hasHistoryButton, toBoolFlag(params.hasHistory, false));
      context.hasLobbyButton = toBoolFlag(params.hasLobbyButton, false);

      context.gamePercent = readServerText(params.gamePercent, context.gamePercent || '');
      context.gamePercentBuyFree = readServerText(params.gamePercentBuyFree, context.gamePercentBuyFree || '');
      context.gamePercentBuyHold = readServerText(params.gamePercentBuyHold, context.gamePercentBuyHold || '');

      context.buyFreeGamesMult = toInt(params.buyFreeGamesMult, context.buyFreeGamesMult || 0);
      context.buyHoldAndWinMult = toInt(params.buyHoldAndWinMult, context.buyHoldAndWinMult || 0);

      context.jackpotMultipliers.GRAND_JACKPOT_VALUE = resolveJackpotMultiplierParam(
        params,
        ['GRAND_JACKPOT_VALUE', 'grandJackpotValue'],
        readRuntimeNumericGlobal('GRAND_JACKPOT_VALUE', context.jackpotMultipliers.GRAND_JACKPOT_VALUE || 1000)
      );
      context.jackpotMultipliers.MAJOR_JACKPOT_VALUE = resolveJackpotMultiplierParam(
        params,
        ['MAJOR_JACKPOT_VALUE', 'majorJackpotValue'],
        readRuntimeNumericGlobal('MAJOR_JACKPOT_VALUE', context.jackpotMultipliers.MAJOR_JACKPOT_VALUE || 100)
      );
      context.jackpotMultipliers.MINOR_JACKPOT_VALUE = resolveJackpotMultiplierParam(
        params,
        ['MINOR_JACKPOT_VALUE', 'minorJackpotValue'],
        readRuntimeNumericGlobal('MINOR_JACKPOT_VALUE', context.jackpotMultipliers.MINOR_JACKPOT_VALUE || 20)
      );
    }

    if (typeof params.sessionUID === 'string' && params.sessionUID.trim().length > 0) {
      this.sessionUID = params.sessionUID;
    }

    this.hasLobby = toBoolFlag(params.hasLobbyButton, this.hasLobby);
    this.updateNumberPatternFromSource(params);
    (this.game as any).locked = toBoolFlag(params.locked, false);
    if (this.game?.settings?.set) {
      this.game.settings.set('skipIntro', toBoolFlag(params.skipIntro, this.game.settings.get('skipIntro', false)));
    }
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

  waitForConnectionResult(timeoutMs = 10000): Promise<ConnectionResult> {
    if (this.isFullyConnected()) {
      return Promise.resolve({ ok: true });
    }

    const serverErrorMessage = this.game?.context?.serverError?.message;
    if (this.hasVisibleServerError() && typeof serverErrorMessage === 'string' && serverErrorMessage.trim().length > 0) {
      return Promise.resolve({ ok: false, message: serverErrorMessage });
    }

    return new Promise((resolve) => {
      let settled = false;
      const finish = (result: ConnectionResult) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        this.connectionResultListeners.delete(handleResult);
        resolve(result);
      };

      const handleResult = (result: ConnectionResult) => {
        finish(result);
      };

      const timeoutId = window.setTimeout(() => {
        finish({ ok: false, message: 'Unable to connect with server.\nCheck your connection and try again' });
      }, timeoutMs);

      this.connectionResultListeners.add(handleResult);
    });
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

    this.traceServer('send', message);
    this.connection.send(JSON.stringify(message));
    return true;
  }

  private login(): void {
    if (!this.isConnected) return;
    this.configureSessionFromQuery();

    const message: Record<string, unknown> = {
      cmd: 'login',
      token: this.token,
      sessionId: this.sessionId,
      game: this.gameId,
      comment: 'Token auth',
      version: 0,
      site: this.lobbyUrl
    };

    if (typeof this.userId === 'string' && this.userId.trim().length > 0) {
      message.userId = this.userId;
    }

    if (typeof this.currency === 'string' && this.currency.trim().length > 0) {
      message.currency = this.currency;
    }

    this.send(message);
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
    this.traceServer('open', { serverAddress: this.serverAddress });
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
    this.traceServer('close', { serverAddress: this.serverAddress });
    this.clearPendingTimers();
    this.releaseActiveWins();
    this.isConnected = false;
    this.isLoggedIn = false;
    this.emitConnectionResult({ ok: false, message: 'Unable to connect with server.\nCheck your connection and try again' });
    if (!this.hasVisibleServerError()) {
      this.pushServerError('Unable to connect with server.\nCheck your connection and try again');
    }
  }

  onSpin(outcome: unknown): void {
    debug('GsLink::onSpin');
    debug(`GsLink::onSpin raw ${JSON.stringify(outcome)}`);

    const serverOutcome = normalizeServerOutcome(outcome);
    ensureFreeGamesState(this.game.context);
    this.releaseActiveWins();

    const mappedOutcome = createGameOutcome();
    mappedOutcome.matrix = serverOutcome.matrix;
    mappedOutcome.hasFreeGames = serverOutcome.hasFreeGames;

    const previousMode = Number(this.game.context.gameMode);
    const finalBalance = toInt(serverOutcome.balance, this.game.meters.credit);
    const inFreeGamesMode = previousMode === Number(this.game.context.FREE_GAMES)
      || Number(serverOutcome.mode) === Number(this.game.context.FREE_GAMES);
    const stagedBalance = inFreeGamesMode
      ? Math.max(0, finalBalance - toInt(serverOutcome.fgWin, 0))
      : Math.max(0, finalBalance - toInt(serverOutcome.win, 0));
    this.game.context.prevGameMode = previousMode;
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
      win.sound = resolveWinSound(win);

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
    const previousServer = this.game.context.server && typeof this.game.context.server === 'object'
      ? this.game.context.server
      : {};
    const previousHoldAndWin = Array.isArray((previousServer as any).matrixHoldAndWin)
      ? normalizeMatrix((previousServer as any).matrixHoldAndWin, 3, 5)
      : normalizeMatrix((previousServer as any).prevMatrixHoldAndWin, 3, 5);

    this.game.context.server = {
      mode: serverOutcome.mode,
      roundId: serverOutcome.roundId,
      freeGamesCnt: serverOutcome.freeGamesCnt,
      allFreeGamesCnt: serverOutcome.allFreeGamesCnt,
      specialSymbol: serverOutcome.specialSymbol,
      hasHoldAndWin: serverOutcome.hasHoldAndWin,
      holdAndWinCnt: serverOutcome.holdAndWinCnt,
      holdAndWinWin: serverOutcome.holdAndWinWin,
      prevMatrixHoldAndWin: previousHoldAndWin,
      matrixHoldAndWin: serverOutcome.matrixHoldAndWin,
      matrixHoldAndWinValues: serverOutcome.matrixHoldAndWinValues,
      buyFreeGamesMult: serverOutcome.buyFreeGamesMult,
      buyHoldAndWinMult: serverOutcome.buyHoldAndWinMult,
      pattern: this.getNumberPattern()
    };
    this.game.context.gameMode = serverOutcome.mode;
    this.game.context.freeGamesCounter = serverOutcome.freeGamesCnt;
    this.game.context.freeGamesWon = serverOutcome.allFreeGamesCnt || serverOutcome.freeGamesCnt;
    if (serverOutcome.hasFreeGames) {
      markFreeGamesIntroSource(this.game.context, previousMode);
      if (previousMode !== this.game.context.FREE_GAMES) {
        this.game.context.freeGamesStartCredit = this.game.context.finalCreditMeter;
      }
    }
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
    this.traceServer('message:raw', event.data);
    let response: any;
    try {
      response = JSON.parse(event.data);
    } catch {
      this.onError(`Invalid server message: ${event.data}`);
      return;
    }

    this.traceServer('message:parsed', response);

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
          this.emitConnectionResult({ ok: true });
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
    this.traceServer('error', error);
    this.pushServerError(this.errorTxt);
    this.emitConnectionResult({ ok: false, message: this.errorTxt });
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

  private emitConnectionResult(result: ConnectionResult): void {
    for (const listener of this.connectionResultListeners) {
      listener(result);
    }

    if (result.ok || this.connectionResultListeners.size === 0) {
      this.connectionResultListeners.clear();
    }
  }

  private traceServer(stage: string, payload: unknown): void {
    if (!isDevServerTraceEnabled() || typeof window === 'undefined') return;

    const prefix = `[GsLink:${stage}]`;
    if (stage === 'error') {
      console.error(prefix, payload);
      return;
    }

    console.log(prefix, payload);
  }
}








