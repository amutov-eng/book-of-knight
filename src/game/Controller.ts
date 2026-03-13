import { GameplayEvent as Event, GameplayState as State } from '../architecture/gameplay/GameplayStateMachine';
import SpinSystem from '../architecture/gameplay/systems/SpinSystem';
import WinPresentationSystem from '../architecture/gameplay/systems/WinPresentationSystem';
import MeterTransferSystem from '../architecture/gameplay/systems/MeterTransferSystem';
import { debug } from '../core/utils/logger';
import type BaseGame from '../core/BaseGame';

type StateChangeListener = (payload: { from: string; to: string }) => void;
type SpinStartedListener = () => void;

export default class Controller {
  game: BaseGame & Record<string, any>;
  state: any;
  timerCounter = 0;
  reelCounter = 0;
  reelStopTimer = 0;
  nextReelToStop = 0;
  idleTimerCounter = 0;
  lineCounter = 0;
  lastReelStopped = 0;
  highlightTimeout = 80;
  event: number = Event.NONE;
  w2cSpeed = 1;
  forceStopRequested = false;
  reelsStoppedTimeout = 0;

  spinSystem: SpinSystem;
  winPresentationSystem: WinPresentationSystem;
  meterTransferSystem: MeterTransferSystem;

  private boundKeyDownHandler: ((event: KeyboardEvent) => void) | null;
  private readonly stateChangeListeners: Set<StateChangeListener>;
  private readonly spinStartedListeners: Set<SpinStartedListener>;

  constructor(game: BaseGame) {
    this.game = game as BaseGame & Record<string, any>;
    this.state = State.IDLE;

    this.spinSystem = new SpinSystem(this.game);
    this.winPresentationSystem = new WinPresentationSystem(this.game);
    this.meterTransferSystem = new MeterTransferSystem(this.game);

    this.boundKeyDownHandler = this.handleKeyDownEvent.bind(this);
    this.stateChangeListeners = new Set();
    this.spinStartedListeners = new Set();
    window.addEventListener('keydown', this.boundKeyDownHandler);
  }

  touchDown(): boolean {
    return true;
  }

  keyDown(code: string): boolean {
    if (code === 'Space') {
      const startHandler = this.game?.menu && typeof this.game.menu.onStartPressed === 'function'
        ? this.game.menu.onStartPressed.bind(this.game.menu)
        : null;

      if (startHandler) {
        startHandler();
      } else if (this.state === State.IDLE) {
        this.event = Event.START;
      }
    }
    return true;
  }

  setNextState(nextState: any): void {
    const previousTitle = this.state && this.state.title ? this.state.title : 'UNKNOWN';
    const nextTitle = nextState && nextState.title ? nextState.title : 'UNKNOWN';
    debug(`Controller::setNextState ${previousTitle} > ${nextTitle}, timerCounter: ${this.timerCounter}`);
    this.state.leave(this);
    this.state = nextState;
    this.state.entry(this);
    this.syncBackgroundLayerWithState();
    this.timerCounter = 0;
    this.idleTimerCounter = 0;
    this.emitStateChanged(previousTitle, nextTitle);
  }

  update(_delta?: number): void {
    this.timerCounter++;
    this.state.process(this);
  }

  startSpin(): boolean {
    const started = this.spinSystem.startSpin(this);
    if (started) {
      this.emitSpinStarted();
    }
    return started;
  }

  processWin(): void {
    this.highlightTimeout = this.winPresentationSystem.processWinAt(this.lineCounter);
  }

  showWin(): void {
    this.winPresentationSystem.showWinAt(this.lineCounter);
  }

  showAllWinningLines(): void {
    this.winPresentationSystem.showAllWinningLines();
  }

  clearAllLines(): void {
    this.winPresentationSystem.clearAllLines();
  }

  reelStopped(): boolean {
    const result = this.spinSystem.getLastStoppedReel(this.lastReelStopped);
    if (result.changed) {
      this.lastReelStopped = result.lastReel;
      return true;
    }
    return false;
  }

  reelsStopped(): boolean {
    return this.spinSystem.areAllReelsStopped();
  }

  updateMeters(): void {
    if (this.game?.menu?.updateMeters) {
      this.game.menu.updateMeters();
    }
  }

  beginWinToCredit(): boolean {
    return this.meterTransferSystem.beginWinToCredit(this);
  }

  stepWinToCredit(): boolean {
    return this.meterTransferSystem.stepWinToCredit(this);
  }

  private handleKeyDownEvent(event: KeyboardEvent): void {
    if (event.code === 'Space') {
      event.preventDefault();
    }
    this.keyDown(event.code);
  }

  private syncBackgroundLayerWithState(): void {
    const bgLayer = this.game.backgroundLayer;
    if (bgLayer && bgLayer.setByState) {
      bgLayer.setByState(this.state.title);
    }

    const reelsFrameLayer = this.game.reelsFrameLayer;
    if (reelsFrameLayer && reelsFrameLayer.setByState) {
      reelsFrameLayer.setByState(this.state.title);
    }
  }

  destroy(): void {
    if (this.boundKeyDownHandler) {
      window.removeEventListener('keydown', this.boundKeyDownHandler);
      this.boundKeyDownHandler = null;
    }
  }

  onStateChanged(listener: StateChangeListener): () => void {
    this.stateChangeListeners.add(listener);
    return () => {
      this.stateChangeListeners.delete(listener);
    };
  }

  onSpinStarted(listener: SpinStartedListener): () => void {
    this.spinStartedListeners.add(listener);
    return () => {
      this.spinStartedListeners.delete(listener);
    };
  }

  private emitStateChanged(from: string, to: string): void {
    for (const listener of this.stateChangeListeners) {
      listener({ from, to });
    }
  }

  private emitSpinStarted(): void {
    for (const listener of this.spinStartedListeners) {
      listener();
    }
  }
}

