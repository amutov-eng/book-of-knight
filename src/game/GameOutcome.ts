import type { SoundId } from '../config/soundConfig';

export interface WinLike {
  winningLine: number;
  bet: number;
  symbol: number;
  cnt: number;
  mult: number;
  hasWild: boolean;
  type: number;
  sound?: SoundId;
  highlightTimeout?: number;
  highlight: number[][];
}

export interface GameOutcomeShape {
  matrix: number[][];
  stopNextReelTimeout: number[];
  highlightReel: number[];
  hasWin: boolean;
  hasFreeGames: boolean;
  hasLineWins: boolean;
  hasWild: boolean;
  wins: WinLike[];
}

export const GameOutcome: GameOutcomeShape = {
  matrix: [
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0]
  ],
  stopNextReelTimeout: [0, 9, 9, 9, 9],
  highlightReel: [0, 0, 0, 0, 0],
  hasWin: false,
  hasFreeGames: false,
  hasLineWins: false,
  hasWild: false,
  wins: []
};

export function createGameOutcome(): GameOutcomeShape {
  return {
    matrix: [
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0]
    ],
    stopNextReelTimeout: [...GameOutcome.stopNextReelTimeout],
    highlightReel: [...GameOutcome.highlightReel],
    hasWin: false,
    hasFreeGames: false,
    hasLineWins: false,
    hasWild: false,
    wins: []
  };
}
