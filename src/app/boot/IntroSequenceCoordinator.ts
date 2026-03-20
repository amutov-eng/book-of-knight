import type { Container } from 'pixi.js';
import type BaseGame from '../../core/BaseGame';
import { restorePixiGlobals } from '../../core/globals';
import createBootIntroPlayer from '../../intro/createIntroPlayer';
import type { SpineIntroConfig } from '../../config/introConfig';
import BootSoundPrompt from '../../ui/boot/BootSoundPrompt';
import { warn } from '../../core/utils/logger';

type IntroPlayer = {
  start?: () => Promise<void>;
  destroy?: () => Promise<void> | void;
  waitForCompletion?: () => Promise<void>;
};

type LoadingGame = BaseGame & Record<string, any>;

export default class IntroSequenceCoordinator {
  private readonly game: LoadingGame;
  private bootIntroPlayer: IntroPlayer | null = null;
  private gameplayIntroPlayer: IntroPlayer | null = null;
  private bootSoundPrompt: BootSoundPrompt | null = null;

  constructor(game: LoadingGame) {
    this.game = game;
  }

  async startBootIntro(config: SpineIntroConfig): Promise<void> {
    try {
      this.bootIntroPlayer = createBootIntroPlayer(config);
      await this.bootIntroPlayer.start?.();
    } catch (error) {
      warn(`IntroSequenceCoordinator::bootIntroFailed ${error instanceof Error ? error.message : String(error)}`);
      this.bootIntroPlayer = null;
    }
  }

  async waitForBootIntro(): Promise<void> {
    if (!this.bootIntroPlayer?.waitForCompletion) return;

    try {
      await this.bootIntroPlayer.waitForCompletion();
    } catch (error) {
      warn(`IntroSequenceCoordinator::bootIntroWaitFailed ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async destroyBootIntro(): Promise<void> {
    if (!this.bootIntroPlayer?.destroy) return;
    await this.bootIntroPlayer.destroy();
    this.bootIntroPlayer = null;
  }

  async primeBootSoundPrompt(stage: Container): Promise<void> {
    if (this.bootSoundPrompt) return;

    this.bootSoundPrompt = new BootSoundPrompt(this.game);
    stage.addChild(this.bootSoundPrompt);
    this.bootSoundPrompt.visible = true;
    this.bootSoundPrompt.interactiveChildren = false;

    if (this.game.renderer) {
      this.game.renderer.render(stage);
    }
  }

  async presentBootSoundPrompt(stage: Container): Promise<boolean> {
    if (!this.bootSoundPrompt) {
      this.bootSoundPrompt = new BootSoundPrompt(this.game);
      stage.addChild(this.bootSoundPrompt);
    }

    return this.bootSoundPrompt.present();
  }

  async playGameplayIntro(config: SpineIntroConfig): Promise<void> {
    try {
      this.gameplayIntroPlayer = createBootIntroPlayer(config);
      await this.gameplayIntroPlayer.start?.();
      if (this.gameplayIntroPlayer.waitForCompletion) {
        await this.gameplayIntroPlayer.waitForCompletion();
      }
    } catch (error) {
      warn(`IntroSequenceCoordinator::gameplayIntroFailed ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      if (this.gameplayIntroPlayer?.destroy) {
        await this.gameplayIntroPlayer.destroy();
      }
      this.gameplayIntroPlayer = null;
      restorePixiGlobals();
    }
  }

  async destroyAll(stage: Container): Promise<void> {
    if (this.bootSoundPrompt) {
      stage.removeChild(this.bootSoundPrompt);
      this.bootSoundPrompt.destroy({ children: true });
      this.bootSoundPrompt = null;
    }

    if (this.gameplayIntroPlayer?.destroy) {
      await this.gameplayIntroPlayer.destroy();
      this.gameplayIntroPlayer = null;
    }

    if (this.bootIntroPlayer?.destroy) {
      await this.bootIntroPlayer.destroy();
      this.bootIntroPlayer = null;
    }
  }
}
