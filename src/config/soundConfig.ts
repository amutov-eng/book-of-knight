export const SOUND_IDS = {
  SPIN_BACKGROUND: 'spinBackground',
  COINUP: 'coinup',
  COINEND: 'coinend',
  REEL_STOP: 'reelStop',
  KNOCK: 'knock'
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
  { id: SOUND_IDS.KNOCK, path: 'assets/sounds/knock.mp3', volume: 1 }
]);
