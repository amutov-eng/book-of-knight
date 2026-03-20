import { SOUND_IDS, type SoundId } from '../../config/soundConfig';

export const NEAR_MISS_SCALE_CURVE = Object.freeze([1.0, 1.08, 1.15, 1.08, 1.03, 1.0]);
export const NEAR_MISS_CURVE_KEY_TIMES = Object.freeze([0, 0.16, 0.34, 0.56, 0.78, 1.0]);
export const NEAR_MISS_TOTAL_DURATION_SEC = 0.32;

export const SCATTER_NEAR_MISS_SYMBOL_INDEX = 0;
export const JACKPOT_NEAR_MISS_START_INDEX = 11;

export type NearMissEvaluationInput = {
  symbolIndex: number;
  outcomeHasWin: boolean;
  outcomeHasWild: boolean;
  previousHoldAndWinValue?: number;
};

export function isScatterNearMissSymbol(symbolIndex: number): boolean {
  return symbolIndex === SCATTER_NEAR_MISS_SYMBOL_INDEX;
}

export function isJackpotNearMissSymbol(symbolIndex: number): boolean {
  return symbolIndex >= JACKPOT_NEAR_MISS_START_INDEX;
}

export function shouldAnimateNearMissSymbol(input: NearMissEvaluationInput): boolean {
  if (isScatterNearMissSymbol(input.symbolIndex)) {
    return true;
  }

  if (isJackpotNearMissSymbol(input.symbolIndex)) {
    return Number(input.previousHoldAndWinValue || 0) === 0;
  }

  return false;
}

export function resolveNearMissSoundId(input: NearMissEvaluationInput): SoundId | null {
  if (isScatterNearMissSymbol(input.symbolIndex)) {
    return SOUND_IDS.BEEP_STAR;
  }

  if (isJackpotNearMissSymbol(input.symbolIndex) && Number(input.previousHoldAndWinValue || 0) === 0) {
    return SOUND_IDS.BEEP_SUN;
  }

  return null;
}

export function getNearMissDurationFrames(fps = 60): number {
  const safeFps = Number.isFinite(fps) && fps > 0 ? Number(fps) : 60;
  return Math.max(1, Math.ceil(NEAR_MISS_TOTAL_DURATION_SEC * safeFps));
}
