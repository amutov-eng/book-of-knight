import { Container, autoDetectRenderer, type Renderer } from 'pixi.js';
import DisplayManager from './display/DisplayManager';
import { getRuntimeVariant } from '../config/runtimeConfig';
import type Reels from '../game/Reels';
import type Menu from '../ui/Menu';
import type Controller from '../game/Controller';
import type Meters from '../game/Meters';
import type Context from '../game/Context';
import type Messages from '../ui/Messages';
import type GsLink from '../net/GsLink';
import type Textures from '../game/Textures';
import type BackgroundLayer from '../ui/BackgroundLayer';
import type ReelsFrameLayer from '../ui/ReelsFrameLayer';
import type BaseScreen from './BaseScreen';
import type GameplayEngine from '../architecture/gameplay/GameplayEngine';
import type LocalizationService from '../localization/LocalizationService';
import type Timers from './time/Timers';
import type SoundSystem from '../game/systems/SoundSystem';
import type SymbolSpineOverlay from '../game/systems/SymbolSpineOverlay';
import type SettingsStore from '../engine/settings/SettingsStore';

export default class BaseGame {
  stage: Container;
  renderer: Renderer | null;
  variant: string;
  displayManager: DisplayManager;

  screen: BaseScreen | null;
  currentScreen: BaseScreen | null;

  textures: Textures | null;
  reels: Reels | null;
  menu: Menu | null;
  controller: Controller | null;
  meters: Meters | null;
  context: Context | null;
  messages: Messages | null;
  gsLink: GsLink | null;
  backgroundLayer: BackgroundLayer | null;
  reelsFrameLayer: ReelsFrameLayer | null;
  gameplayEngine: GameplayEngine | null;
  localization: LocalizationService | null;
  timers: Timers | null;
  soundSystem: SoundSystem | null;
  symbolSpineOverlay: SymbolSpineOverlay | null;
  settings: SettingsStore | null;

  constructor() {
    this.stage = new Container();
    this.renderer = null;
    this.variant = getRuntimeVariant();
    this.displayManager = new DisplayManager(this.variant);

    this.screen = null;
    this.currentScreen = null;

    this.textures = null;
    this.reels = null;
    this.menu = null;
    this.controller = null;
    this.meters = null;
    this.context = null;
    this.messages = null;
    this.gsLink = null;
    this.backgroundLayer = null;
    this.reelsFrameLayer = null;
    this.gameplayEngine = null;
    this.localization = null;
    this.timers = null;
    this.soundSystem = null;
    this.symbolSpineOverlay = null;
    this.settings = null;
  }

  async initRenderer(): Promise<void> {
    const { width, height } = this.displayManager.getTargetResolution();
    this.renderer = await autoDetectRenderer({
      width,
      height,
      backgroundColor: 0x000000
    });

    const view = (this.renderer as any).canvas || (this.renderer as any).view;
    if (view) {
      document.body.appendChild(view);
    }

    this.displayManager.attachResizeHandling(this.renderer);
  }

  setScreen(screen: BaseScreen): void {
    if (this.screen) {
      this.screen.hide();
      this.stage.removeChild(this.screen.stage);
    }

    this.screen = screen;
    this.currentScreen = screen;
    this.stage.addChild(screen.stage);

    if ((this.screen as any).show) {
      (this.screen as any).show();
    }
  }
}
