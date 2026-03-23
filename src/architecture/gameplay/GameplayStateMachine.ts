import { GAME_RULES } from '../../config/gameRules';
import { getGameplayConfig } from '../../config/gameplayConfig';

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

function toState(controller: ControllerLike, nextState: GameplayStateNode): void {
  controller.setNextState(nextState);
}

/**
 * Registry of controller-facing gameplay states.
 *
 * Each node owns entry/process/leave hooks and reads timing from `gameplayConfig`.
 */
export const GameplayState = {} as Record<string, GameplayStateNode>;

GameplayState.IDLE = createState('IDLE', {
  entry: (controller) => {
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

    controller.game.context.freeGamesCounter = 0;
    controller.game.context.freeGamesWon = 0;
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
    controller.processWin();
    controller.lineCounter++;
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
    if (controller.lineCounter < outcomeWins(controller).length) {
      controller.processWin();
      controller.lineCounter++;
      return;
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
    controller.game.menu.updateMeters();
  },
  process: (controller) => {
    if (controller.timerCounter <= spinEndTimeout()) {
      return;
    }

    controller.game.reels.unhighlightAll();
    toState(controller, GameplayState.SHOW_LAST_WINS);
  }
});

GameplayState.TEMPLATE = createState('TEMPLATE', {});
