export type Variant = 'desktop' | 'mobile';

export type ReelIndex = number;
export type SymbolId = number;

export type Matrix3x5 = [
  [SymbolId, SymbolId, SymbolId, SymbolId, SymbolId],
  [SymbolId, SymbolId, SymbolId, SymbolId, SymbolId],
  [SymbolId, SymbolId, SymbolId, SymbolId, SymbolId]
];

export interface WinLine {
  type: number;
  winningLine: number;
  symbol: SymbolId;
  cnt: number;
  mult: number;
  hasWild: boolean;
  highlight: number[][];
}

export interface SpinResult {
  matrix: Matrix3x5;
  wins: WinLine[];
  bet: number;
  win: number;
  balance: number;
}

export interface GameOutcome {
  matrix: number[][];
  wins: unknown[];
  hasWin: boolean;
  hasLineWins: boolean;
  hasFreeGames: boolean;
}

export interface RuntimeConfig {
  variant: Variant;
}

export interface AssetsManifest {
  backgrounds?: Record<string, unknown>;
  reels?: Record<string, unknown>;
  lines?: Record<string, unknown>;
  layout?: Record<string, unknown>;
  symbols?: Record<string, unknown>;
  ui?: Record<string, unknown>;
  math?: Record<string, unknown>;
}
