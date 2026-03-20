/* eslint-disable no-console */
import { WebSocket, WebSocketServer } from 'ws';

const PORT = Number(process.env.MOCK_WS_PORT || 8081);
const HOST = process.env.MOCK_WS_HOST || '127.0.0.1';

/** asd
 * ==========================================================
 * EDIT HERE: Local mock spin behavior
 * ==========================================================
 *
 * npm run mock:server

 * http://localhost:3000/?ws=127.0.0.1

 * MOCK_SPIN_MODE:
 * - 'fixed'  -> always returns FIXED_OUTCOME_TEMPLATE
 * - 'matrix' -> returns MATRIX_INPUT and auto-calculates wins/win/highlights
 * - 'random' -> generates random matrix/wins
 */
const MOCK_SPIN_MODE = process.env.MOCK_SPIN_MODE || 'matrix';
const LOGIN_PATTERN = process.env.MOCK_LOGIN_PATTERN || '#,###.00';
const SPIN_PATTERN = process.env.MOCK_SPIN_PATTERN || '#,###.00';
const INITIAL_BALANCE = Number(process.env.MOCK_INITIAL_BALANCE || 1_000_000);

const MOCK_LOGIN_PARAMS = {
  addFreeGamesCnt: Number(process.env.MOCK_ADD_FREE_GAMES_CNT || 0),
  showAddFreeSpins: Number(process.env.MOCK_SHOW_ADD_FREE_SPINS || 0),
  hasAddFreeGames: Number(process.env.MOCK_HAS_ADD_FREE_GAMES || 0),

  minDenom: Number(process.env.MOCK_MIN_DENOM || 1),
  minBetPerLine: Number(process.env.MOCK_MIN_BET_PER_LINE || 1),
  minLines: Number(process.env.MOCK_MIN_LINES || 10),

  denom: Number(process.env.MOCK_DENOM || 10),
  betPerLine: Number(process.env.MOCK_BET_PER_LINE || 1),
  linesSelected: Number(process.env.MOCK_LINES_SELECTED || 10),

  maxDenom: Number(process.env.MOCK_MAX_DENOM || 10),
  maxBetPerLine: Number(process.env.MOCK_MAX_BET_PER_LINE || 1000),
  maxLines: Number(process.env.MOCK_MAX_LINES || 10),

  currency: String(process.env.MOCK_CURRENCY || 'FUN'),

  locked: Number(process.env.MOCK_LOCKED || 0),
  hasTurboSpins: Number(process.env.MOCK_HAS_TURBO_SPINS || 1),
  hasBuyFeature: Number(process.env.MOCK_HAS_BUY_FEATURE || 1),
  hasReloadButton: Number(process.env.MOCK_HAS_RELOAD_BUTTON || 1),
  hasHomeButton: Number(process.env.MOCK_HAS_HOME_BUTTON || 1),
  hasHistoryButton: Number(process.env.MOCK_HAS_HISTORY_BUTTON || 1),
  hasLobbyButton: Number(process.env.MOCK_HAS_LOBBY_BUTTON || 1),

  gamePercent: Number(process.env.MOCK_GAME_PERCENT || 96),
  gamePercentBuyFree: Number(process.env.MOCK_GAME_PERCENT_BUY_FREE || 96),
  gamePercentBuyHold: Number(process.env.MOCK_GAME_PERCENT_BUY_HOLD || 96),

  buyFreeGamesMult: Number(process.env.MOCK_BUY_FREE_GAMES_MULT || 50),
  buyHoldAndWinMult: Number(process.env.MOCK_BUY_HOLD_AND_WIN_MULT || 65)
};

const REELS = 5;
const SYMBOLS = 3;
const WILD = 0;
const SCATTER = 0;
const FREE_GAMES_COUNT = 12;

const PAYLINES = [
  [1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0],
  [2, 2, 2, 2, 2],
  [0, 1, 2, 1, 0],
  [2, 1, 0, 1, 2],
  [1, 2, 2, 2, 1],
  [1, 0, 0, 0, 1],
  [2, 2, 1, 0, 0],
  [0, 0, 1, 2, 2],
  [2, 1, 1, 1, 0]
];

const PAYTABLE = [
  [1, 3, 5], [1, 4, 20], [1, 5, 100],
  [2, 3, 5], [2, 4, 20], [2, 5, 100],
  [3, 3, 5], [3, 4, 20], [3, 5, 100],
  [4, 3, 5], [4, 4, 30], [4, 5, 150],
  [5, 3, 5], [5, 4, 30], [5, 5, 150],
  [6, 3, 20], [6, 4, 100], [6, 5, 750],
  [7, 3, 20], [7, 4, 100], [7, 5, 750],
  [8, 3, 30], [8, 4, 400], [8, 5, 2000],
  [9, 2, 5], [9, 3, 100], [9, 4, 1000], [9, 5, 5000]
];

const SCATTER_PAYTABLE = new Map([
  [3, 2],
  [4, 40],
  [5, 1000]
]);

const PAYTABLE_BY_SYMBOL = (() => {
  const map = new Map();
  for (let i = 0; i < PAYTABLE.length; i++) {
    const [symbol, count, mult] = PAYTABLE[i];
    if (!map.has(symbol)) map.set(symbol, new Map());
    map.get(symbol).set(count, mult);
  }
  return map;
})();

/**
 * Easy editable matrix:
 * matrix = [
 *   [1, 2, 3, 4, 5],
 *   [1, 2, 3, 4, 5],
 *   [1, 2, 3, 4, 5]
 * ];
 */
const MATRIX_INPUT = [
  [1, 2, 3, 4, 0],
  [9, 9, 9, 4, 5],
  [1, 2, 3, 4, 5]
];

const FIXED_OUTCOME_TEMPLATE = {
  matrix: [
    [1, 2, 3, 4, 5],
    [1, 1, 1, 4, 5],
    [1, 2, 3, 4, 5]
  ],
  wins: [
    {
      type: 0,
      winningLine: 0,
      symbol: 1,
      cnt: 3,
      mult: 5,
      hasWild: false,
      hasMagician: false,
      highlight: [
        [0, 0, 0, 0, 0],
        [1, 1, 1, 0, 0],
        [0, 0, 0, 0, 0]
      ],
      highlightMagician: [0, 0, 0, 0, 0],
      betPerLine: 5,
      denom: 1
    },
  ],
  bet: 50,
  win: 25,
  hasFreeGames: false,
  freeGamesCnt: 0,
  specialSymbol: -1,
  hasHoldAndWin: false,
  matrixHoldAndWinValues: [
    [2, 1, 2, 12, 1],
    [1, 2, 4, 3, 1],
    [3, 7, 13, 1, 1]
  ],
  matrixHoldAndWin: [
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0]
  ],
  holdAndWinCnt: 0,
  mode: 0,
  allFreeGamesCnt: 0,
  fgWin: 25,
  holdAndWinWin: 0,
  buyFreeGamesMult: MOCK_LOGIN_PARAMS.buyFreeGamesMult,
  buyHoldAndWinMult: MOCK_LOGIN_PARAMS.buyHoldAndWinMult
};

function toInt(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function getRequestedStake(requestParams) {
  const denom = Math.max(1, toInt(requestParams && requestParams.denom, MOCK_LOGIN_PARAMS.denom));
  const requestedLines = Math.max(1, toInt(requestParams && requestParams.linesSelected, MOCK_LOGIN_PARAMS.linesSelected));
  const linesSelected = Math.max(1, Math.min(requestedLines, PAYLINES.length));
  const betPerLine = Math.max(1, toInt(requestParams && requestParams.betPerLine, MOCK_LOGIN_PARAMS.betPerLine));
  const bet = betPerLine * linesSelected * denom;

  return {
    denom,
    requestedLines,
    linesSelected,
    betPerLine,
    bet
  };
}

function getWinPayout(win, stake) {
  if (!win || typeof win !== 'object') return 0;

  if (toInt(win.type, 0) === 2) {
    return Math.max(0, toInt(win.mult, 0)) * stake.betPerLine * stake.linesSelected * stake.denom;
  }

  return Math.max(0, toInt(win.mult, 0)) * stake.betPerLine * stake.denom;
}

function applyRoundBalance(state, bet, win) {
  state.balance = Math.max(0, state.balance - bet + win);
  state.roundId += 1;
  return {
    balance: state.balance,
    roundId: state.roundId
  };
}

function normalizeServerWinForStake(serverWin, stake) {
  const win = clone(serverWin || {});
  win.bet = stake.betPerLine;
  win.betPerLine = stake.betPerLine;
  win.denom = stake.denom;
  return win;
}

function createMatrix(rows = 3, cols = 5, maxSymbol = 7) {
  const matrix = [];
  for (let row = 0; row < rows; row++) {
    const line = [];
    for (let col = 0; col < cols; col++) {
      line.push(Math.floor(Math.random() * (maxSymbol + 1)));
    }
    matrix.push(line);
  }
  return matrix;
}

function emptyMatrix(rows = 3, cols = 5) {
  const matrix = [];
  for (let row = 0; row < rows; row++) {
    const line = [];
    for (let col = 0; col < cols; col++) line.push(0);
    matrix.push(line);
  }
  return matrix;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeMatrixInput(matrix) {
  const result = [];
  for (let row = 0; row < SYMBOLS; row++) {
    const sourceRow = Array.isArray(matrix && matrix[row]) ? matrix[row] : [];
    const line = [];
    for (let reel = 0; reel < REELS; reel++) {
      line.push(toInt(sourceRow[reel], 0));
    }
    result.push(line);
  }
  return result;
}

function createEmptyHighlight() {
  return [
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0]
  ];
}

function evaluateLineWins(matrix, betPerLine, denom, linesSelected) {
  const wins = [];
  let totalWin = 0;
  const activeLines = Math.max(1, Math.min(linesSelected, PAYLINES.length));

  for (let lineIndex = 0; lineIndex < activeLines; lineIndex++) {
    const line = PAYLINES[lineIndex];
    let best = null;

    for (const [symbol, multByCount] of PAYTABLE_BY_SYMBOL.entries()) {
      let count = 0;
      let hasWild = false;

      for (let reel = 0; reel < REELS; reel++) {
        const row = line[reel];
        const matrixSymbol = matrix[row][reel];
        if (matrixSymbol === symbol || matrixSymbol === WILD) {
          if (matrixSymbol === WILD) hasWild = true;
          count++;
        } else {
          break;
        }
      }

      const mult = multByCount.get(count);
      if (!mult) continue;
      const payout = mult * betPerLine * denom;
      if (!best || payout > best.payout) {
        best = { symbol, count, mult, hasWild, payout };
      }
    }

    if (!best) continue;

    const highlight = createEmptyHighlight();
    for (let reel = 0; reel < best.count; reel++) {
      const row = line[reel];
      highlight[row][reel] = 1;
    }

    wins.push({
      type: 0,
      winningLine: lineIndex,
      symbol: best.symbol,
      cnt: best.count,
      mult: best.mult,
      hasWild: best.hasWild,
      hasMagician: false,
      highlight,
      highlightMagician: [0, 0, 0, 0, 0],
      betPerLine,
      denom
    });
    totalWin += best.payout;
  }

  return { wins, totalWin };
}

function evaluateScatterWin(matrix, betPerLine, denom, linesSelected) {
  let scatterCount = 0;
  const highlight = createEmptyHighlight();

  for (let row = 0; row < SYMBOLS; row++) {
    for (let reel = 0; reel < REELS; reel++) {
      if (matrix[row][reel] === SCATTER) {
        scatterCount++;
        highlight[row][reel] = 1;
      }
    }
  }

  const mult = SCATTER_PAYTABLE.get(scatterCount) || 0;
  if (!mult) {
    return { win: null, payout: 0, hasFreeGames: false, freeGamesCnt: 0 };
  }

  const payout = mult * betPerLine * linesSelected * denom;
  return {
    win: {
      type: 2,
      winningLine: 0,
      symbol: SCATTER,
      cnt: scatterCount,
      mult,
      hasWild: false,
      hasMagician: false,
      highlight,
      highlightMagician: [0, 0, 0, 0, 0],
      betPerLine,
      denom
    },
    payout,
    hasFreeGames: true,
    freeGamesCnt: FREE_GAMES_COUNT
  };
}

function createSpinOutcomeFromMatrix(state, requestParams, matrixInput) {
  const stake = getRequestedStake(requestParams);
  const matrix = normalizeMatrixInput(matrixInput);

  const lineResult = evaluateLineWins(matrix, stake.betPerLine, stake.denom, stake.linesSelected);
  const scatterResult = evaluateScatterWin(matrix, stake.betPerLine, stake.denom, stake.linesSelected);
  const wins = [...lineResult.wins];
  if (scatterResult.win) wins.push(scatterResult.win);

  const win = lineResult.totalWin + scatterResult.payout;
  const roundState = applyRoundBalance(state, stake.bet, win);

  return {
    matrix,
    wins,
    bet: stake.bet,
    win,
    hasFreeGames: scatterResult.hasFreeGames,
    freeGamesCnt: scatterResult.freeGamesCnt,
    specialSymbol: -1,
    hasHoldAndWin: false,
    matrixHoldAndWinValues: emptyMatrix(3, 5),
    matrixHoldAndWin: emptyMatrix(3, 5),
    holdAndWinCnt: 0,
    balance: roundState.balance,
    mode: 0,
    allFreeGamesCnt: 0,
    fgWin: win,
    holdAndWinWin: 0,
    buyFreeGamesMult: MOCK_LOGIN_PARAMS.buyFreeGamesMult,
    buyHoldAndWinMult: MOCK_LOGIN_PARAMS.buyHoldAndWinMult,
    roundId: roundState.roundId
  };
}

function createSpinOutcomeFromTemplate(state, requestParams, template) {
  const stake = getRequestedStake(requestParams);

  const outcome = clone(template);
  const wins = Array.isArray(outcome.wins) ? outcome.wins.map((entry) => normalizeServerWinForStake(entry, stake)) : [];
  const calculatedWin = wins.reduce((sum, entry) => sum + getWinPayout(entry, stake), 0);

  outcome.wins = wins;
  outcome.bet = stake.bet;
  outcome.win = calculatedWin;
  outcome.fgWin = toInt(outcome.mode, 0) === 1 ? calculatedWin : 0;
  outcome.holdAndWinWin = toInt(outcome.mode, 0) === 2 ? calculatedWin : 0;

  const roundState = applyRoundBalance(state, outcome.bet, outcome.win);
  outcome.balance = roundState.balance;
  outcome.roundId = roundState.roundId;
  return outcome;
}

function createSpinOutcome(state, requestParams) {
  if (MOCK_SPIN_MODE === 'matrix') {
    return createSpinOutcomeFromMatrix(state, requestParams, MATRIX_INPUT);
  }

  if (MOCK_SPIN_MODE === 'fixed') {
    return createSpinOutcomeFromTemplate(state, requestParams, FIXED_OUTCOME_TEMPLATE);
  }

  const stake = getRequestedStake(requestParams);

  const matrix = createMatrix(3, 5, 7);

  const lineWin = Math.random() < 0.25;
  const mult = lineWin ? (Math.random() < 0.5 ? 2 : 5) : 0;
  const win = lineWin ? stake.betPerLine * stake.denom * mult : 0;
  const roundState = applyRoundBalance(state, stake.bet, win);

  const wins = [];
  if (lineWin) {
    wins.push({
      winningLine: 0,
      bet: stake.betPerLine,
      symbol: matrix[1][0],
      cnt: 3,
      mult,
      hasWild: false,
      type: 0,
      highlight: [
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0]
      ]
    });
  }

  return {
    matrix,
    wins,
    bet: stake.bet,
    win,
    hasFreeGames: false,
    freeGamesCnt: 0,
    specialSymbol: -1,
    hasHoldAndWin: false,
    matrixHoldAndWinValues: emptyMatrix(3, 5),
    matrixHoldAndWin: emptyMatrix(3, 5),
    holdAndWinCnt: 0,
    balance: roundState.balance,
    mode: 0,
    allFreeGamesCnt: 0,
    fgWin: 0,
    holdAndWinWin: 0,
    buyFreeGamesMult: MOCK_LOGIN_PARAMS.buyFreeGamesMult,
    buyHoldAndWinMult: MOCK_LOGIN_PARAMS.buyHoldAndWinMult,
    roundId: roundState.roundId
  };
}

function sendJson(socket, payload) {
  if (socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify(payload));
}

const wss = new WebSocketServer({ host: HOST, port: PORT });

wss.on('connection', (socket) => {
  const state = {
    balance: INITIAL_BALANCE,
    roundId: 0,
    isLoggedIn: false
  };

  socket.on('message', (raw) => {
    let message;
    try {
      message = JSON.parse(String(raw));
    } catch (error) {
      sendJson(socket, { err: 1, errMsg: 'Invalid JSON', success: false });
      return;
    }

    const cmd = message && message.cmd;
    switch (cmd) {
      case 'login':
        state.isLoggedIn = true;
        sendJson(socket, {
          cmd: 'login',
          success: true,
          balance: state.balance,
          params: {
            ...MOCK_LOGIN_PARAMS,
            sessionUID: `local-${Date.now()}`,
            pattern: LOGIN_PATTERN
          },
          isLoggedIn: true
        });
        break;

      case 'balance':
        sendJson(socket, {
          cmd: 'balance',
          success: true,
          balance: state.balance,
          isLoggedIn: state.isLoggedIn
        });
        break;

      case 'spin':
        if (!state.isLoggedIn) {
          sendJson(socket, {
            cmd: 'spin',
            success: false,
            err: 401,
            errMsg: 'Not logged in',
            isLoggedIn: false
          });
          break;
        }
        sendJson(socket, {
          cmd: 'spin',
          success: true,
          outcome: {
            ...createSpinOutcome(state, message.params),
            pattern: SPIN_PATTERN
          },
          isLoggedIn: true
        });
        break;

      default:
        sendJson(socket, {
          cmd: String(cmd || ''),
          success: false,
          err: 400,
          errMsg: `Unsupported command: ${String(cmd || 'undefined')}`,
          isLoggedIn: state.isLoggedIn
        });
        break;
    }
  });
});

console.log(`Mock WS server listening on ws://${HOST}:${PORT}`);
console.log(`Mock spin mode: ${MOCK_SPIN_MODE}`);



