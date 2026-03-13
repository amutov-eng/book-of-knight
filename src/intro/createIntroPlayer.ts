import { BOOT_INTRO_CONFIG, type SpineIntroConfig } from '../config/introConfig';
import LegacySpine38IntroPlayer from './LegacySpine38IntroPlayer';
import type { IntroPlayer } from './types';

export function createBootIntroPlayer(config: SpineIntroConfig = BOOT_INTRO_CONFIG): IntroPlayer {
  switch (config.kind) {
    case 'legacy-spine-3.8':
    default:
      return new LegacySpine38IntroPlayer(config);
  }
}

export default createBootIntroPlayer;
