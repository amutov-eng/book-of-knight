import BaseGame from '../core/BaseGame';
import Textures from '../game/Textures';
import Reels from '../game/Reels';
import Menu from '../ui/Menu';
import Controller from '../game/Controller';
import Meters from '../game/Meters';
import Context from '../game/Context';
import Messages from '../ui/Messages';
import GsLink from '../net/GsLink';
import SoundSystem from '../game/systems/SoundSystem';
import SymbolSpineOverlay from '../game/systems/SymbolSpineOverlay';
import SettingsStore from '../engine/settings/SettingsStore';
import type { AppRuntimeServices, GameRuntime } from './types';

/**
 * Instantiates and wires gameplay/runtime modules in one place.
 *
 * Keep constructor order stable to preserve existing behavior and side effects.
 */
export function wireGameModules(baseGame: BaseGame, services: AppRuntimeServices): GameRuntime {
  const game = baseGame as GameRuntime;

  game.textures = new Textures();
  game.reels = new Reels(game);
  game.menu = new Menu(game);
  game.messages = new Messages(game);
  game.context = new Context();
  game.meters = new Meters();
  game.soundSystem = new SoundSystem();
  game.symbolSpineOverlay = new SymbolSpineOverlay(game);
  game.settings = new SettingsStore({ audioEnabled: true }, 'book-of-knight.settings');
  game.controller = new Controller(game);
  game.gsLink = new GsLink(game);

  services.gameplayEngine.attachController(game.controller);
  services.gameplayEngine.attachGsLink(game.gsLink);
  services.gameplayEngine.attachFlow(services.flow);
  services.gameplayEngine.wire();
  game.gameplayEngine = services.gameplayEngine;

  return game;
}

export default wireGameModules;
