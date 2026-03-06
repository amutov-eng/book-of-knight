import { getAssetsManifest } from '../core/RuntimeContext';

export interface GameplayConfig {
  spinTimeout: number;
  showAllLinesStartDelay: number;
  showAllLinesTimeout: number;
  spinEndTimeout: number;
  noWinLastWinsTimeout: number;
  autoTakeWinTimeout: number;
  takeWinTimeout: number;
  showLastWinsLoopDelay: number;
  winToCreditStep: number;
}

const DEFAULT_GAMEPLAY_CONFIG = Object.freeze({
  spinTimeout: 11,
  showAllLinesStartDelay: 8,
  showAllLinesTimeout: 35,
  spinEndTimeout: 0,
  noWinLastWinsTimeout: 16,
  autoTakeWinTimeout: 10,
  takeWinTimeout: 100,
  showLastWinsLoopDelay: 16,
  winToCreditStep: 200
});

function asFiniteNumber(value: unknown, fallback: number): number {
  return Number.isFinite(value) ? Number(value) : fallback;
}

/**
 * Reads gameplay timing knobs from the merged assets manifest.
 *
 * Source of truth: `assets/common/assets-manifest.common.json`.
 * Values are frame ticks consumed by the gameplay state machine, not seconds.
 */
export function getGameplayConfig(): GameplayConfig {
  const manifest = getAssetsManifest<any>();
  const gameplay = manifest && typeof manifest === 'object' && manifest.gameplay && typeof manifest.gameplay === 'object'
    ? manifest.gameplay
    : {};
  const timings = gameplay.timings && typeof gameplay.timings === 'object' ? gameplay.timings : {};

  return {
    spinTimeout: asFiniteNumber(timings.spinTimeout, DEFAULT_GAMEPLAY_CONFIG.spinTimeout),
    showAllLinesStartDelay: asFiniteNumber(timings.showAllLinesStartDelay, DEFAULT_GAMEPLAY_CONFIG.showAllLinesStartDelay),
    showAllLinesTimeout: asFiniteNumber(timings.showAllLinesTimeout, DEFAULT_GAMEPLAY_CONFIG.showAllLinesTimeout),
    spinEndTimeout: asFiniteNumber(timings.spinEndTimeout, DEFAULT_GAMEPLAY_CONFIG.spinEndTimeout),
    noWinLastWinsTimeout: asFiniteNumber(timings.noWinLastWinsTimeout, DEFAULT_GAMEPLAY_CONFIG.noWinLastWinsTimeout),
    autoTakeWinTimeout: asFiniteNumber(timings.autoTakeWinTimeout, DEFAULT_GAMEPLAY_CONFIG.autoTakeWinTimeout),
    takeWinTimeout: asFiniteNumber(timings.takeWinTimeout, DEFAULT_GAMEPLAY_CONFIG.takeWinTimeout),
    showLastWinsLoopDelay: asFiniteNumber(timings.showLastWinsLoopDelay, DEFAULT_GAMEPLAY_CONFIG.showLastWinsLoopDelay),
    winToCreditStep: asFiniteNumber(timings.winToCreditStep, DEFAULT_GAMEPLAY_CONFIG.winToCreditStep)
  };
}
