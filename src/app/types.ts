import type BaseGame from '../core/BaseGame';
import type { Container, Renderer } from 'pixi.js';
import type Textures from '../game/Textures';
import type Reels from '../game/Reels';
import type Menu from '../ui/Menu';
import type Controller from '../game/Controller';
import type Meters from '../game/Meters';
import type Context from '../game/Context';
import type Messages from '../ui/Messages';
import type GsLink from '../net/GsLink';
import type GameplayEngine from '../architecture/gameplay/GameplayEngine';
import type LocalizationService from '../localization/LocalizationService';
import type Timers from '../core/time/Timers';
import type LifecycleStateMachine from '../architecture/state/LifecycleStateMachine';
import type EventBus from '../core/events/EventBus';
import type SoundSystem from '../game/systems/SoundSystem';
import type SettingsStore from '../engine/settings/SettingsStore';

/**
 * Minimal screen contract consumed by the app ticker and renderer.
 */
export type RuntimeScreen = {
  stage: Container;
  act(delta: number): void;
};

/**
 * `BaseGame` enriched with the runtime modules created during app boot.
 */
export type GameRuntime = BaseGame & {
  textures: Textures;
  reels: Reels;
  menu: Menu;
  messages: Messages;
  context: Context;
  meters: Meters;
  controller: Controller;
  gsLink: GsLink;
  gameplayEngine: GameplayEngine;
  localization: LocalizationService;
  timers: Timers;
  soundSystem: SoundSystem;
  settings: SettingsStore;
  screen?: RuntimeScreen;
  renderer?: Renderer;
};

/**
 * Cross-cutting services created once in `App` and shared during module wiring.
 */
export type AppRuntimeServices = {
  bus: EventBus;
  flow: LifecycleStateMachine;
  gameplayEngine: GameplayEngine;
};
