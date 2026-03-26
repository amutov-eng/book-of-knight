import { GAME_RULES } from '../../config/gameRules';
import { getGameplayConfig } from '../../config/gameplayConfig';
import { collectScatterWins, ensureFreeGamesState, isInFreeGames, shouldEnterFreeBook } from '../../game/FreeGamesController';
import { getLocalizedText } from '../../ui/uiTextFormat';

/**
 * Fallback spin timeout used when the manifest does not provide an override.
 */
function spinTimeout(): number {
  return getGameplayConfig().spinTimeout || GAME_RULES.SPIN_TIMEOUT;
}

function showAllLinesTimeout(): number {
  return getGameplayConfig().showAllLinesTimeout;
}

function showAllLinesStartDelay(): number {
  return getGameplayConfig().showAllLinesStartDelay;
}

function spinEndTimeout(): number {
  return getGameplayConfig().spinEndTimeout;
}

function noWinLastWinsTimeout(): number {
  return getGameplayConfig().noWinLastWinsTimeout;
}

function autoTakeWinTimeout(): number {
  return getGameplayConfig().autoTakeWinTimeout;
}

function takeWinTimeout(): number {
  return getGameplayConfig().takeWinTimeout;
}

function showLastWinsLoopDelay(): number {
  return getGameplayConfig().showLastWinsLoopDelay;
}

/**
 * Controller events consumed by the legacy gameplay state machine.
 */
export const GameplayEvent = {
  NONE: 0,
  START: 1,
  TAKEWIN: 2,
  DOUBLEUP: 3,
  MENU: 4,
  AUTO: 5,
  ENTER_STATS: 6
} as const;

export type GameplayEventValue = (typeof GameplayEvent)[keyof typeof GameplayEvent];

type ControllerLike = {
  game: any;
  state: GameplayStateNode;
  timerCounter: number;
  idleTimerCounter: number;
  lineCounter: number;
  lastReelStopped: number;
  event: GameplayEventValue;
  forceStopRequested: boolean;
  reelsStoppedTimeout: number;
  setNextState(nextState: GameplayStateNode): void;
  startSpin(): boolean;
  processWin(): void;
  showWin(): void;
  showAllWinningLines(): void;
  clearAllLines(): void;
  resetWinPresentationDelay(): void;
  isWinPresentationReady(): boolean;
  reelStopped(): boolean;
  reelsStopped(): boolean;
  beginWinToCredit(): boolean;
  stepWinToCredit(): boolean;
  winPresentationSystem: any;
  winPresentationOrchestrator: any;
};

type GameplayStateNode = {
  title: string;
  entry: (controller: ControllerLike) => void;
  process: (controller: ControllerLike) => void;
  leave: (controller: ControllerLike) => void;
};

const noop = () => undefined;

function createState(
  title: string,
  handlers: {
    entry?: (controller: ControllerLike) => void;
    process?: (controller: ControllerLike) => void;
    leave?: (controller: ControllerLike) => void;
  }
): GameplayStateNode {
  return {
    title,
    entry: handlers.entry || noop,
    process: handlers.process || noop,
    leave: handlers.leave || noop
  };
}

function clearEvent(controller: ControllerLike): void {
  controller.event = GameplayEvent.NONE;
}

function hasWins(controller: ControllerLike): boolean {
  return !!controller.game.context.outcome.hasWin;
}

function outcomeWins(controller: ControllerLike): any[] {
  return controller.game.context.outcome.wins;
}

function scatterWins(controller: ControllerLike): any[] {
  return collectScatterWins(controller.game.context.outcome);
}

function presentedWins(controller: ControllerLike): any[] {
  const wins = outcomeWins(controller);
  if (!controller.game.context.outcome.hasFreeGames) {
    return wins;
  }
  return wins.filter((win) => Number(win?.type) !== 1);
}

function presentedWinIndexes(controller: ControllerLike): number[] {
  const wins = outcomeWins(controller);
  const indexes: number[] = [];
  for (let i = 0; i < wins.length; i += 1) {
    // Legacy Book-style triggers present line wins first and keep scatter/book
    // wins for the dedicated scatter presentation that follows immediately after.
    if (controller.game.context.outcome.hasFreeGames && Number(wins[i]?.type) === 1) {
      continue;
    }
    indexes.push(i);
  }
  return indexes;
}

function processPresentedWin(controller: ControllerLike, presentedIndex: number): void {
  const indexes = presentedWinIndexes(controller);
  const actualIndex = indexes[presentedIndex];
  if (!Number.isFinite(actualIndex)) {
    return;
  }
  const delayFrames = controller.winPresentationSystem.processWinAt(actualIndex);
  controller.winPresentationOrchestrator.startDelay(delayFrames);
}

function toState(controller: ControllerLike, nextState: GameplayStateNode): void {
  controller.setNextState(nextState);
}

function getPressAnywhereText(controller: ControllerLike): string {
  return getLocalizedText(controller.game, 'pressAnywhere', 'PRESS ANYWHERE TO CONTINUE');
}

function getFreeGamesText(controller: ControllerLike): string {
  return getLocalizedText(controller.game, 'freeGameTxt', 'FREE GAMES');
}

function getFreeGamesLeftText(controller: ControllerLike): string {
  return getLocalizedText(controller.game, 'freeGameLeft', 'FREE GAMES LEFT');
}

function getYouWonFreeGamesText(controller: ControllerLike, count: number): string {
  const youWon = getLocalizedText(controller.game, 'youWon', 'YOU WON');
  return `${youWon} ${Math.max(0, count)} ${getFreeGamesText(controller)}!`;
}

function applyBlinkingPrompt(controller: ControllerLike, text: string): void {
  const blinkPhase = controller.timerCounter % 50;
  controller.game.menu.setWinStatus(blinkPhase < 25 ? text : '');
}

/**
 * Registry of controller-facing gameplay states.
 *
 * Each node owns entry/process/leave hooks and reads timing from `gameplayConfig`.
 */
export const GameplayState = {} as Record<string, GameplayStateNode>;

GameplayState.IDLE = createState('IDLE', {
  entry: (controller) => {
    ensureFreeGamesState(controller.game.context);
    if (controller.game.context.autoplay) {
      if (controller.game.context.autoplayCounter > 0) {
        controller.event = GameplayEvent.START;
        controller.game.context.autoplayCounter--;
      } else {
        controller.game.context.autoplay = false;
        controller.game.menu.enableControls();
      }
    } else {
      controller.game.menu.enableControls();
    }

    if (!isInFreeGames(controller.game.context)) {
      controller.game.context.freeGamesCounter = 0;
      controller.game.context.freeGamesWon = 0;
      controller.game.reels.setStripMode('normal');
    }
    controller.game.menu.setWinStatus('');
    if (controller.game.menu && typeof controller.game.menu.refreshIdleStatus === 'function') {
      controller.game.menu.refreshIdleStatus();
    }
  },
  process: (controller) => {
    if (controller.game.menu && typeof controller.game.menu.refreshIdleStatus === 'function') {
      controller.game.menu.refreshIdleStatus();
    }

    if (controller.event === GameplayEvent.START) {
      clearEvent(controller);
      return toState(controller, GameplayState.START_SPIN);
    }

    if (controller.idleTimerCounter < 1000) {
      controller.idleTimerCounter++;
    }
  }
});

GameplayState.START_SPIN = createState('START_SPIN', {
  process: (controller) => {
    controller.reelsStoppedTimeout = 0;
    if (controller.startSpin()) {
      return toState(controller, GameplayState.REELS_SPINNING);
    }

    toState(controller, GameplayState.IDLE);
    controller.game.menu.setStatus('INSERT CREDITS');
  }
});

GameplayState.REELS_SPINNING = createState('REELS_SPINNING', {
  process: (controller) => {
    if (!controller.game.gsLink.spinEnded) {
      clearEvent(controller);
      return;
    }

    if (controller.event === GameplayEvent.START) {
      controller.forceStopRequested = true;
      clearEvent(controller);
      return toState(controller, GameplayState.REELS_STOPPED);
    }

    if (controller.timerCounter > spinTimeout()) {
      toState(controller, GameplayState.REELS_STOPPING);
    }
  }
});

GameplayState.REELS_STOPPING = createState('REELS_STOPPING', {
  entry: (controller) => {
    controller.game.reels.stopReel(0);
  },
  process: (controller) => {
    if (controller.event === GameplayEvent.START) {
      controller.forceStopRequested = true;
      clearEvent(controller);
      return toState(controller, GameplayState.REELS_STOPPED);
    }

    if (controller.reelStopped()) {
      const stoppedReel = controller.lastReelStopped;
      if (stoppedReel >= 0) {
        const nearMissDelay = controller.game.reels.playNearMissOnReel(stoppedReel);
        controller.reelsStoppedTimeout = Math.max(controller.reelsStoppedTimeout, nearMissDelay);
      }
      const nextReel = stoppedReel + 1;
      if (nextReel >= 0 && nextReel < controller.game.reels.NUMBER_OF_REELS) {
        controller.game.reels.stopReel(nextReel);
      }
    }

    if (controller.reelsStopped()) {
      toState(controller, GameplayState.REELS_STOPPED);
    }
  }
});

GameplayState.REELS_STOPPED = createState('REELS_STOPPED', {
  entry: (controller) => {
    controller.game.reels.stopAllReels(!!controller.forceStopRequested);
    controller.forceStopRequested = false;
  },
  process: (controller) => {
    if (controller.timerCounter < controller.reelsStoppedTimeout || !controller.game.reels.allStopped()) {
      return;
    }

    if (!hasWins(controller)) {
      return toState(controller, GameplayState.SPIN_END);
    }

    if (controller.event === GameplayEvent.START) {
      clearEvent(controller);
      return toState(controller, GameplayState.SHOW_ALL_WINNING_LINES);
    }

    toState(controller, GameplayState.SHOW_WINS);
  }
});

GameplayState.SHOW_WINS = createState('SHOW_WINS', {
  entry: (controller) => {
    controller.game.reels.resetLineLayer();
    controller.resetWinPresentationDelay();
    controller.lineCounter = 0;
    controller.game.context.onscreenWinMeter = 0;
    controller.game.menu.setWin(0);
    controller.game.menu.setStatus('');
    controller.game.menu.setWinStatus('');
    const wins = presentedWinIndexes(controller);
    if (wins.length > 0) {
      processPresentedWin(controller, controller.lineCounter);
      controller.lineCounter++;
    }
  },
  process: (controller) => {
    if (controller.event === GameplayEvent.START) {
      if (hasWins(controller)) {
        clearEvent(controller);
        return toState(controller, GameplayState.SHOW_ALL_WINNING_LINES);
      }
      return toState(controller, GameplayState.SPIN_END);
    }

    if (controller.event === GameplayEvent.TAKEWIN) {
      clearEvent(controller);
      return toState(controller, GameplayState.WIN_TO_CREDIT);
    }

    if (!controller.isWinPresentationReady()) {
      return;
    }

    controller.timerCounter = 0;
    const wins = presentedWinIndexes(controller);
    if (controller.lineCounter < wins.length) {
      processPresentedWin(controller, controller.lineCounter);
      controller.lineCounter++;
      return;
    }

    if (controller.game.context.outcome.hasFreeGames) {
      return toState(controller, GameplayState.SPIN_END);
    }

    toState(controller, GameplayState.WIN_TO_CREDIT);
  },
  leave: (controller) => {
    controller.game.reels.unhighlightAll();
  }
});

GameplayState.SHOW_ALL_WINNING_LINES = createState('SHOW_ALL_WINNING_LINES', {
  entry: (controller) => {
    controller.game.reels.setLinesAboveSymbols(true);
    controller.lineCounter = 0;
  },
  process: (controller) => {
    if (controller.lineCounter === 0) {
      if (controller.timerCounter < showAllLinesStartDelay()) {
        return;
      }

      controller.showAllWinningLines();
      controller.game.menu.updateMeters();
      controller.lineCounter = 1;
      controller.timerCounter = 0;
      return;
    }

    if (controller.timerCounter > showAllLinesTimeout()) {
      controller.clearAllLines();
      toState(controller, GameplayState.WIN_TO_CREDIT);
    }
  },
  leave: (controller) => {
    controller.game.reels.resetLineLayer();
  }
});

GameplayState.SHOW_LAST_WINS = createState('SHOW_LAST_WINS', {
  entry: (controller) => {
    controller.lineCounter = 0;
    controller.resetWinPresentationDelay();
    controller.game.menu.enableControls();
    controller.game.reels.resetLineLayer();
  },
  process: (controller) => {
    if (controller.event === GameplayEvent.START) {
      return toState(controller, GameplayState.IDLE);
    }

    if (outcomeWins(controller).length === 0) {
      if (controller.timerCounter > noWinLastWinsTimeout()) {
        return toState(controller, GameplayState.IDLE);
      }
      return;
    }

    if (!controller.isWinPresentationReady()) {
      return;
    }

    controller.timerCounter = 0;
    if (controller.lineCounter < outcomeWins(controller).length) {
      controller.showWin();
      controller.lineCounter++;
      return;
    }

    controller.lineCounter = 0;
    controller.showWin();
    controller.lineCounter = 1;
  },
  leave: (controller) => {
    controller.game.reels.unhighlightAll();
  }
});

GameplayState.TAKE_WINS = createState('TAKE_WINS', {
  process: (controller) => {
    if (controller.event === GameplayEvent.START) {
      return toState(controller, GameplayState.WIN_TO_CREDIT);
    }

    if (controller.game.context.autoplay && controller.timerCounter > autoTakeWinTimeout()) {
      return toState(controller, GameplayState.WIN_TO_CREDIT);
    }

    if (controller.timerCounter > takeWinTimeout()) {
      toState(controller, GameplayState.WIN_TO_CREDIT);
    }
  },
  leave: (controller) => {
    clearEvent(controller);
  }
});

GameplayState.WIN_TO_CREDIT = createState('WIN_TO_CREDIT', {
  entry: (controller) => {
    if (isInFreeGames(controller.game.context) || controller.game.context.outcome.hasFreeGames) {
      controller.game.menu.setWin(
        controller.game.context.outcome.hasFreeGames
          ? Math.max(0, Number(controller.game.meters.win) || 0)
          : Math.max(0, Number(controller.game.meters.fgwin) || 0)
      );
      toState(controller, GameplayState.SPIN_END);
      return;
    }

    if (!controller.beginWinToCredit()) {
      toState(controller, GameplayState.SPIN_END);
    }
  },
  process: (controller) => {
    if (controller.event === GameplayEvent.START || controller.event === GameplayEvent.TAKEWIN) {
      clearEvent(controller);
      return toState(controller, GameplayState.SPIN_END);
    }

    if (!controller.stepWinToCredit()) {
      return;
    }

    toState(controller, GameplayState.SPIN_END);
  }
});

GameplayState.SPIN_END = createState('SPIN_END', {
  entry: (controller) => {
    if (isInFreeGames(controller.game.context)) {
      controller.game.menu.setCredit(controller.game.meters.credit);
      controller.game.menu.setWin(Math.max(0, Number(controller.game.meters.fgwin) || 0));
    } else {
      controller.game.menu.updateMeters();
    }
  },
  process: (controller) => {
    if (controller.timerCounter <= spinEndTimeout()) {
      return;
    }

    controller.game.reels.unhighlightAll();
    if (controller.game.context.outcome.hasFreeGames) {
      return toState(controller, GameplayState.SHOW_SCATTER_WINS);
    }
    if (isInFreeGames(controller.game.context)) {
      if ((Number(controller.game.context.freeGamesCounter) || 0) > 0) {
        return toState(controller, GameplayState.FREE_GAMES_START_SPIN);
      }
      return toState(controller, GameplayState.FREE_GAMES_END);
    }
    toState(controller, GameplayState.SHOW_LAST_WINS);
  }
});

GameplayState.SHOW_SCATTER_WINS = createState('SHOW_SCATTER_WINS', {
  entry: (controller) => {
    controller.game.reels.resetLineLayer();
    controller.resetWinPresentationDelay();
    controller.lineCounter = 0;
    controller.game.menu.setStatus('');
    controller.game.menu.setWinStatus('');
  },
  process: (controller) => {
    const wins = scatterWins(controller);
    if (wins.length === 0) {
      return toState(controller, GameplayState.FREE_GAMES);
    }

    if (controller.lineCounter > 0 && !controller.isWinPresentationReady()) {
      return;
    }

    if (controller.lineCounter >= wins.length) {
      controller.game.menu.setWin(controller.game.meters.win);
      return toState(controller, GameplayState.FREE_GAMES);
    }

    const win = wins[controller.lineCounter];
    controller.game.reels.unhighlightAll();
    const animationMs = controller.game.reels.highlightWin(win, false, true) || 0;
    controller.game.menu.setWinStatus(controller.winPresentationSystem.winningLineToText(win));
    const delayFrames = controller.winPresentationSystem.resolveHighlightDelayFrames(win, animationMs);
    controller.winPresentationOrchestrator.startDelay(delayFrames);
    controller.lineCounter += 1;
  },
  leave: (controller) => {
    controller.game.menu.setWin(controller.game.meters.win);
  }
});

GameplayState.FREE_GAMES = createState('FREE_GAMES', {
  entry: (controller) => {
    // Transitional legacy behavior:
    // delay the FG background/frame/title switch until the old spine overlay is
    // already mounted, otherwise the screen flashes for one frame before intro.
    controller.game.context.freeGamesVisualPrepared = false;
    controller.game.menu.disableControls();
    controller.game.menu.setStatus('');
    controller.game.menu.setWinStatus(getYouWonFreeGamesText(controller, Number(controller.game.context.freeGamesWon) || Number(controller.game.context.freeGamesCounter) || 0));
    void controller.game.gameplaySpineOverlay?.play('freeGamesIntro');
  },
  process: (controller) => {
    if (!controller.game.context.freeGamesVisualPrepared && controller.game.gameplaySpineOverlay?.isReady()) {
      // This block is tied to the current legacy spine intro choreography.
      // When the next games move to the new spine pipeline, this prepare step
      // should disappear and the visuals can switch in one presentation system.
      controller.game.reels.setStripMode('free');
      controller.game.reels.setFreeGames(true);
      controller.game.backgroundLayer?.setFreeGamesAnim?.(true);
      controller.game.menu.setFreeGamesTitleLabelFirst?.(Number(controller.game.context.freeGamesCounter) || 0);
      controller.game.menu.showFreeGamesTitle?.(true);
      controller.game.context.freeGamesVisualPrepared = true;
    }

    if (!controller.game.gameplaySpineOverlay?.isComplete()) {
      return;
    }

    applyBlinkingPrompt(controller, getPressAnywhereText(controller));
    if (controller.event === GameplayEvent.START) {
      clearEvent(controller);
      const shouldShowBook = shouldEnterFreeBook(controller.game.context)
        && !!controller.game.gameplaySpineOverlay?.hasClip?.('freeGamesBook');
      return toState(
        controller,
        shouldShowBook ? GameplayState.FREE_BOOK : GameplayState.FREE_GAMES_START_SPIN
      );
    }
  },
  leave: (controller) => {
    controller.game.context.freeGamesVisualPrepared = false;
    controller.game.gameplaySpineOverlay?.hide();
    controller.game.menu.setWinStatus('');
  }
});

GameplayState.FREE_BOOK = createState('FREE_BOOK', {
  entry: (controller) => {
    controller.game.menu.disableControls();
    controller.game.menu.setStatus('');
    controller.game.menu.setWinStatus('');
    controller.game.context.pendingFreeGamesIntroSource = controller.game.context.FREE_GAMES;
    void controller.game.gameplaySpineOverlay?.play('freeGamesBook');
  },
  process: (controller) => {
    if (!controller.game.gameplaySpineOverlay?.isComplete()) {
      return;
    }

    applyBlinkingPrompt(controller, getPressAnywhereText(controller));
    if (controller.event === GameplayEvent.START) {
      clearEvent(controller);
      return toState(controller, GameplayState.FREE_GAMES_START_SPIN);
    }
  },
  leave: (controller) => {
    controller.game.gameplaySpineOverlay?.hide();
    controller.game.menu.setWinStatus('');
  }
});

GameplayState.FREE_GAMES_START_SPIN = createState('FREE_GAMES_START_SPIN', {
  entry: (controller) => {
    controller.game.reels.setStripMode('free');
    controller.game.reels.setFreeGames(true);
    controller.game.backgroundLayer?.setFreeGamesAnim?.(true);
    controller.game.menu.disableControls();
    const remaining = Math.max(0, (Number(controller.game.context.freeGamesCounter) || 0) - 1);
    controller.game.menu.setFreeGamesTitleLabelFirst?.(remaining);
    controller.game.menu.showFreeGamesTitle?.(true);
    controller.game.menu.setStatus('');
    controller.game.menu.setWinStatus(`${remaining} ${getFreeGamesLeftText(controller)}`);
    controller.game.menu.setWin(Math.max(0, Number(controller.game.meters.fgwin) || 0));
    if (controller.startSpin()) {
      toState(controller, GameplayState.REELS_SPINNING);
      return;
    }
    toState(controller, GameplayState.FREE_GAMES_END);
  },
  leave: (controller) => {
    clearEvent(controller);
  }
});

GameplayState.FREE_GAMES_END = createState('FREE_GAMES_END', {
  entry: (controller) => {
    controller.game.menu.disableControls();
    controller.game.menu.setStatus('');
    controller.game.menu.setWinStatus('');
    if ((Number(controller.game.meters.fgwin) || 0) <= 0) {
      controller.game.menu.showFreeGamesTitle?.(false);
      controller.game.reels.setFreeGames(false);
      controller.game.backgroundLayer?.setFreeGamesAnim?.(false);
      controller.game.reels.setStripMode('normal');
      controller.game.context.gameMode = controller.game.context.MAIN_GAME;
      toState(controller, GameplayState.IDLE);
      return;
    }
    void controller.game.gameplaySpineOverlay?.play('freeGamesCongrats');
  },
  process: (controller) => {
    if (!controller.game.gameplaySpineOverlay?.isComplete()) {
      return;
    }

    applyBlinkingPrompt(controller, getPressAnywhereText(controller));
    if (controller.event === GameplayEvent.START) {
      clearEvent(controller);
      return toState(controller, GameplayState.FREE_GAMES_TAKE_WINS);
    }
  },
  leave: (controller) => {
    controller.game.gameplaySpineOverlay?.hide();
    controller.game.menu.setWinStatus('');
  }
});

GameplayState.FREE_GAMES_TAKE_WINS = createState('FREE_GAMES_TAKE_WINS', {
  entry: (controller) => {
    controller.game.menu.disableControls();
    controller.game.menu.setStatus('');
    controller.game.menu.setWinStatus('');
    controller.game.context.onscreenWinMeter = 0;
    controller.game.context.onscreenCreditMeter = Math.max(0, Number(controller.game.context.freeGamesStartCredit) || 0);
    controller.game.menu.setWin(Math.max(0, Number(controller.game.meters.fgwin) || 0));
    controller.game.menu.setCredit(controller.game.context.onscreenCreditMeter);
    if ((Number(controller.game.meters.fgwin) || 0) > 0) {
      controller.game.soundSystem?.play('coinup' as any, true);
    }
  },
  process: (controller) => {
    const targetCredit = Math.max(
      Number(controller.game.context.finalCreditMeter) || 0,
      Number(controller.game.context.onscreenCreditMeter) || 0
    );
    const totalFgWin = Math.max(0, Number(controller.game.meters.fgwin) || 0);

    if (controller.game.context.onscreenCreditMeter < targetCredit) {
      const remaining = targetCredit - controller.game.context.onscreenCreditMeter;
      const delta = Math.max(1, Math.ceil(remaining / 24));
      controller.game.context.onscreenCreditMeter = Math.min(targetCredit, controller.game.context.onscreenCreditMeter + delta);
      controller.game.context.onscreenWinMeter = Math.min(totalFgWin, controller.game.context.onscreenWinMeter + delta);
      controller.game.menu.setCredit(controller.game.context.onscreenCreditMeter);
      controller.game.menu.setWin(Math.max(0, totalFgWin - controller.game.context.onscreenWinMeter));
      return;
    }

    controller.game.soundSystem?.stop('coinup' as any);
    controller.game.soundSystem?.play('coinend' as any);
    controller.game.meters.credit = targetCredit;
    controller.game.menu.showFreeGamesTitle?.(false);
    controller.game.reels.setFreeGames(false);
    controller.game.backgroundLayer?.setFreeGamesAnim?.(false);
    controller.game.reels.setStripMode('normal');
    controller.game.context.gameMode = controller.game.context.MAIN_GAME;
    controller.game.menu.setCredit(targetCredit);
    controller.game.menu.setWin(0);
    toState(controller, GameplayState.IDLE);
  }
});

GameplayState.TEMPLATE = createState('TEMPLATE', {});
