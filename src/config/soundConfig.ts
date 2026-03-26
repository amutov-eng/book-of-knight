export const SOUND_IDS = {
  SPIN_BACKGROUND: 'spinBackground',
  COINUP: 'coinup',
  COINEND: 'coinend',
  REEL_STOP: 'reelStop',
  KNOCK: 'knock',
  BEEP_STAR: 'beepStar',
  BEEP_SUN: 'beepSun',
  LOW_WIN: 'lowWin',
  HIGH_WIN: 'highWin',
  SCATTER: 'scatter',
  FREE_GAMES: 'freeGames',
  CONGRATS: 'congrats',
  OPEN_BOOK: 'openBook'
} as const;

export type SoundId = (typeof SOUND_IDS)[keyof typeof SOUND_IDS];

export interface SoundDefinition {
  id: SoundId;
  path: string;
  volume: number;
}

export const SOUND_DEFINITIONS: ReadonlyArray<SoundDefinition> = Object.freeze([
  { id: SOUND_IDS.SPIN_BACKGROUND, path: 'assets/sounds/spin.mp3', volume: 1 },
  { id: SOUND_IDS.COINUP, path: 'assets/sounds/coinup.mp3', volume: 1 },
  { id: SOUND_IDS.COINEND, path: 'assets/sounds/coinupend.mp3', volume: 1 },
  { id: SOUND_IDS.REEL_STOP, path: 'assets/sounds/stop.mp3', volume: 1 },
  { id: SOUND_IDS.KNOCK, path: 'assets/sounds/knock.mp3', volume: 1 },
  { id: SOUND_IDS.BEEP_STAR, path: 'assets/sounds/beep_star.mp3', volume: 1 },
  { id: SOUND_IDS.BEEP_SUN, path: 'assets/sounds/beep_sun.mp3', volume: 1 },
  { id: SOUND_IDS.LOW_WIN, path: 'assets/sounds/lowWin.mp3', volume: 1 },
  { id: SOUND_IDS.HIGH_WIN, path: 'assets/sounds/highWin.mp3', volume: 1 },
  { id: SOUND_IDS.SCATTER, path: 'assets/sounds/scatter.mp3', volume: 1 },
  { id: SOUND_IDS.FREE_GAMES, path: 'assets/sounds/free_games.mp3', volume: 1 },
  { id: SOUND_IDS.CONGRATS, path: 'assets/sounds/congrats.mp3', volume: 1 },
  { id: SOUND_IDS.OPEN_BOOK, path: 'assets/sounds/open_book.mp3', volume: 1 }
]);
