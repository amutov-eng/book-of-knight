import BaseGame from '../core/BaseGame';
import LoadingScreen from '../ui/screens/LoadingScreen';
import EventBus from '../core/events/EventBus';
import LifecycleStateMachine, { LifecycleState, type LifecycleStateValue } from '../architecture/state/LifecycleStateMachine';
import DebugOverlay from '../architecture/debug/DebugOverlay';
import GameplayEngine from '../architecture/gameplay/GameplayEngine';
import LocalizationService from '../localization/LocalizationService';
import { LOCALIZATION_CONFIG } from '../config/localizationConfig';
import Timers from '../core/time/Timers';
import createRenderer from './createRenderer';
import { createTicker, type AppTicker } from './createTicker';
import { getAppRuntimeConfig, type AppRuntimeConfig } from './runtimeConfig';
import { debug, warn } from '../core/utils/logger';
import type { AppRuntimeServices, GameRuntime } from './types';
import wireGameModules from './wireGameModules';

const URL_LANG_TO_LOCALE: Record<string, string> = {
  ENG: 'en',
  BG: 'bg',
  ESP: 'es',
  POR: 'pt',
  FRA: 'fr',
  TUR: 'tr',
  PL: 'pl',
  CZE: 'cs',
  RUS: 'ru',
  ENG_SC: 'en',
  HR: 'hr',
  GR: 'el',
  DE: 'de'
};

/**
 * Supports legacy URL language codes from the host integration.
 */
function resolveLocaleFromUrl(defaultLocale: string): string {
  const params = new URLSearchParams(window.location.search || '');
  const raw = String(params.get('lang') || '').trim();
  if (!raw) return defaultLocale;

  const upper = raw.toUpperCase();
  if (URL_LANG_TO_LOCALE[upper]) {
    return URL_LANG_TO_LOCALE[upper];
  }

  const short = raw.toLowerCase();
  return short || defaultLocale;
}

/**
 * Main runtime application shell.
 *
 * Responsibilities:
 * - boot renderer/localization
 * - wire core gameplay modules
 * - drive frame tick and lifecycle transitions
 */
export default class App {
  private readonly baseGame: BaseGame;
  private game: GameRuntime | null;

  private readonly bus: EventBus;
  private readonly flow: LifecycleStateMachine;
  private readonly debugOverlay: any;
  private readonly gameplayEngine: GameplayEngine;
  private readonly timers: Timers;
  private readonly ticker: AppTicker;
  private readonly runtime: AppRuntimeConfig;

  constructor() {
    this.baseGame = new BaseGame();
    this.game = null;

    this.bus = new EventBus();
    this.flow = new LifecycleStateMachine();
    this.debugOverlay = new DebugOverlay();
    this.gameplayEngine = new GameplayEngine(this.baseGame as any, this.bus);
    this.timers = new Timers();
    this.ticker = createTicker((dtMs) => this.tick(dtMs));
    this.runtime = getAppRuntimeConfig();

    this.baseGame.timers = this.timers;

    this.setupDebugToggle();

    if (this.runtime.debugOverlayEnabled) {
      this.debugOverlay.visible = true;
    }
  }

  async init(): Promise<void> {
    this.transition(LifecycleState.PRELOAD);

    await createRenderer(this.baseGame);
    await this.initLocalization();

    this.game = this.buildRuntimeModules();
    this.game.setScreen(new LoadingScreen(this.game));
    this.game.stage.addChild(this.debugOverlay);

    this.transition(LifecycleState.INTRO);
    this.transition(LifecycleState.IDLE);
  }

  start(): void {
    if (!this.game || !this.game.screen || !this.game.renderer) return;
    this.ticker.start();
  }

  stop(): void {
    this.ticker.stop();
    this.timers.clear();
  }

  private buildRuntimeModules(): GameRuntime {
    const services: AppRuntimeServices = {
      bus: this.bus,
      flow: this.flow,
      gameplayEngine: this.gameplayEngine
    };

    const runtime = wireGameModules(this.baseGame, services);
    runtime.gameplayEngine = this.gameplayEngine;
    return runtime;
  }

  private async initLocalization(): Promise<void> {
    const currentLocale = resolveLocaleFromUrl(LOCALIZATION_CONFIG.defaultLocale);

    try {
      this.baseGame.localization = await LocalizationService.loadFromUrl(LOCALIZATION_CONFIG.url, {
        currentLocale,
        fallbackLocale: LOCALIZATION_CONFIG.fallbackLocale
      });
      debug(`Localization loaded: ${this.baseGame.localization.getLocale()}`);
    } catch (error) {
      this.baseGame.localization = new LocalizationService({
        locales: {},
        currentLocale,
        fallbackLocale: LOCALIZATION_CONFIG.fallbackLocale
      });
      const message = error instanceof Error ? error.message : String(error);
      warn(`Localization load failed: ${message}`);
    }
  }

  private tick(dtMs: number): void {
    const game = this.game;
    if (!game) return;

    const dtSeconds = dtMs / 1000;
    this.timers.update(dtMs);

    if (game.screen && game.renderer) {
      this.debugOverlay.update(dtMs, this.flow.state, game.renderer);
      game.screen.act(dtSeconds);
      game.renderer.render(game.screen.stage);
    }
  }

  private setupDebugToggle(): void {
    window.addEventListener('keydown', (event) => {
      if (event.code !== 'Backquote') return;
      this.debugOverlay.toggle();
      this.bus.emit('debug:toggle', { visible: this.debugOverlay.visible });
    });
  }

  private transition(next: LifecycleStateValue): void {
    if (this.flow.state === next) return;
    if (!this.flow.canTransition(next)) return;
    const payload = this.flow.transition(next);
    this.bus.emit('lifecycle:changed', payload);
  }
}
