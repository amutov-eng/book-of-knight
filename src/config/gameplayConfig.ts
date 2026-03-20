import { getAssetsManifest } from '../core/RuntimeContext';
import { SOUND_IDS, type SoundId } from './soundConfig';

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

export interface GameplayWinSoundConfig {
  lineDefault: SoundId;
  lineBySymbol: Record<number, SoundId>;
  scatter: SoundId;
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

const DEFAULT_WIN_SOUND_CONFIG: GameplayWinSoundConfig = Object.freeze({
  lineDefault: SOUND_IDS.LOW_WIN,
  lineBySymbol: Object.freeze({
    9: SOUND_IDS.HIGH_WIN
  }),
  scatter: SOUND_IDS.SCATTER
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

function asSoundId(value: unknown, fallback: SoundId): SoundId {
  return typeof value === 'string' && value.length > 0 ? value as SoundId : fallback;
}

export function getGameplayWinSoundConfig(): GameplayWinSoundConfig {
  const manifest = getAssetsManifest<any>();
  const gameplay = manifest && typeof manifest === 'object' && manifest.gameplay && typeof manifest.gameplay === 'object'
    ? manifest.gameplay
    : {};
  const sounds = gameplay.sounds && typeof gameplay.sounds === 'object' ? gameplay.sounds : {};
  const wins = sounds.wins && typeof sounds.wins === 'object' ? sounds.wins : {};
  const line = wins.line && typeof wins.line === 'object' ? wins.line : {};
  const lineBySymbolSource = line.bySymbol && typeof line.bySymbol === 'object' ? line.bySymbol : {};
  const lineBySymbol: Record<number, SoundId> = {};

  for (const [symbol, soundId] of Object.entries(lineBySymbolSource)) {
    const symbolIndex = Number(symbol);
    if (!Number.isInteger(symbolIndex)) continue;
    lineBySymbol[symbolIndex] = asSoundId(soundId, DEFAULT_WIN_SOUND_CONFIG.lineDefault);
  }

  return {
    lineDefault: asSoundId(line.default, DEFAULT_WIN_SOUND_CONFIG.lineDefault),
    lineBySymbol: {
      ...DEFAULT_WIN_SOUND_CONFIG.lineBySymbol,
      ...lineBySymbol
    },
    scatter: asSoundId(wins.scatter, DEFAULT_WIN_SOUND_CONFIG.scatter)
  };
}
