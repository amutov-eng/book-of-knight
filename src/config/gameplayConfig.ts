import { getAssetsManifest } from '../core/RuntimeContext';

const DEFAULT_GAMEPLAY_CONFIG = Object.freeze({
  spinTimeout: 11,
  showAllLinesStartDelay: 8,
  showAllLinesTimeout: 11135,
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
 * Reads timing-related gameplay knobs from the assets manifest with safe defaults.
 *
 * Values are in seconds unless a downstream consumer documents otherwise.
 */
export function getGameplayConfig() {
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
