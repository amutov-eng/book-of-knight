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

/**
 * Coordinates the optional startup presentation flow around loading:
 * boot intro, sound prompt, and gameplay intro cleanup.
 */
export default class IntroSequenceCoordinator {
  private readonly game: LoadingGame;
  private bootIntroPlayer: IntroPlayer | null = null;
  private gameplayIntroPlayer: IntroPlayer | null = null;
  private bootSoundPrompt: BootSoundPrompt | null = null;

  constructor(game: LoadingGame) {
    this.game = game;
  }

  /**
   * Starts the boot intro animation but leaves waiting/cleanup to the caller.
   */
  async startBootIntro(config: SpineIntroConfig): Promise<void> {
    try {
      this.bootIntroPlayer = createBootIntroPlayer(config);
      await this.bootIntroPlayer.start?.();
    } catch (error) {
      warn(`IntroSequenceCoordinator::bootIntroFailed ${error instanceof Error ? error.message : String(error)}`);
      this.bootIntroPlayer = null;
    }
  }

  /**
   * Waits for the currently running boot intro, if one was created successfully.
   */
  async waitForBootIntro(): Promise<void> {
    if (!this.bootIntroPlayer?.waitForCompletion) return;

    try {
      await this.bootIntroPlayer.waitForCompletion();
    } catch (error) {
      warn(`IntroSequenceCoordinator::bootIntroWaitFailed ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Destroys the boot intro player once the prompt or loading flow is ready to continue.
   */
  async destroyBootIntro(): Promise<void> {
    if (!this.bootIntroPlayer?.destroy) return;
    await this.bootIntroPlayer.destroy();
    this.bootIntroPlayer = null;
  }

  /**
   * Creates the sound prompt off the main boot path so its assets can be shown immediately.
   */
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

  /**
   * Presents the boot sound prompt and resolves with the user's decision.
   */
  async presentBootSoundPrompt(stage: Container): Promise<boolean> {
    if (!this.bootSoundPrompt) {
      this.bootSoundPrompt = new BootSoundPrompt(this.game);
      stage.addChild(this.bootSoundPrompt);
    }

    return this.bootSoundPrompt.present();
  }

  /**
   * Plays the optional post-load intro and always restores Pixi globals afterwards.
   */
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

  /**
   * Best-effort cleanup used when `LoadingScreen` is replaced or hidden mid-flow.
   */
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
