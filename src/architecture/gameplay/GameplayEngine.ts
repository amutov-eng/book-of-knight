import { GameplayEvent, GameplayState } from './GameplayStateMachine';
import { LifecycleState } from '../state/LifecycleStateMachine';
import type BaseGame from '../../core/BaseGame';
import type EventBus from '../events/EventBus';
import type Controller from '../../game/Controller';
import type GsLink from '../../net/GsLink';
import type LifecycleStateMachine from '../state/LifecycleStateMachine';
import type { GameOutcomeShape } from '../../game/GameOutcome';

const STATE_TO_LIFECYCLE = new Map<string, string>([
  [GameplayState.IDLE.title, LifecycleState.IDLE],
  [GameplayState.START_SPIN.title, LifecycleState.SPIN],
  [GameplayState.REELS_SPINNING.title, LifecycleState.SPIN],
  [GameplayState.REELS_STOPPING.title, LifecycleState.RESOLVE],
  [GameplayState.REELS_STOPPED.title, LifecycleState.RESOLVE],
  [GameplayState.SHOW_WINS.title, LifecycleState.WIN_PRESENTATION],
  [GameplayState.SHOW_ALL_WINNING_LINES.title, LifecycleState.WIN_PRESENTATION],
  [GameplayState.SHOW_LAST_WINS.title, LifecycleState.WIN_PRESENTATION],
  [GameplayState.SPIN_END.title, LifecycleState.RETURN],
  [GameplayState.TAKE_WINS.title, LifecycleState.RETURN],
  [GameplayState.WIN_TO_CREDIT.title, LifecycleState.RETURN]
]);

export default class GameplayEngine {
  private game: BaseGame;
  private bus: EventBus;
  private controller: Controller | null = null;
  private gsLink: GsLink | null = null;
  private flow: LifecycleStateMachine | null = null;
  private spinInFlight = false;
  private isWired = false;
  private detachControllerStateChange: (() => void) | null = null;
  private detachSpinStarted: (() => void) | null = null;
  private detachSpinApplied: (() => void) | null = null;

  constructor(game: BaseGame, bus: EventBus) {
    this.game = game;
    this.bus = bus;
  }

  attachController(controller: Controller): void {
    this.controller = controller;
  }

  attachGsLink(gsLink: GsLink): void {
    this.gsLink = gsLink;
  }

  attachFlow(flow: LifecycleStateMachine): void {
    this.flow = flow;
  }

  wire(): void {
    if (this.isWired || !this.controller || !this.gsLink) return;
    this.isWired = true;

    this.bindControllerStateChanges();
    this.bindSpinStarted();
    this.bindSpinResult();
  }

  update(delta: number): void {
    if (!this.controller) return;
    this.controller.update(delta);
  }

  requestSpin(): boolean {
    if (!this.controller) return false;
    this.controller.event = GameplayEvent.START;
    return true;
  }

  getStateTitle(): string {
    if (!this.controller || !this.controller.state) return 'UNKNOWN';
    return this.controller.state.title;
  }

  private bindControllerStateChanges(): void {
    if (!this.controller) return;
    this.detachControllerStateChange = this.controller.onStateChanged(({ from, to }) => {
      this.bus.emit('gameplay:stateChanged', { from, to });
      this.syncLifecycle(to);
    });
  }

  private bindSpinStarted(): void {
    if (!this.controller) return;
    this.detachSpinStarted = this.controller.onSpinStarted(() => {
      this.spinInFlight = true;
      this.bus.emit('spin:started', { source: 'controller' });
      this.syncLifecycle(GameplayState.REELS_SPINNING.title);
    });
  }

  private bindSpinResult(): void {
    if (!this.gsLink) return;
    this.detachSpinApplied = this.gsLink.onSpinApplied((outcome: GameOutcomeShape) => {
      const totalWin = Number((this.game as BaseGame & { meters?: { win?: number } }).meters?.win ?? 0) || 0;
      this.bus.emit('spin:resultReceived', {
        result: {
          reelStops: Array.isArray(outcome.matrix) ? outcome.matrix : [],
          totalWin,
          hasBonus: !!outcome.hasFreeGames
        }
      });
      this.syncLifecycle(GameplayState.REELS_STOPPING.title);
    });
  }

  private syncLifecycle(controllerStateTitle: string): void {
    const mapped = STATE_TO_LIFECYCLE.get(controllerStateTitle);
    if (!mapped) return;
    this.transitionLifecycle(mapped);
    if (mapped === LifecycleState.IDLE && this.spinInFlight) {
      this.spinInFlight = false;
      this.bus.emit('spin:resolved', { result: null });
    }
  }

  private transitionLifecycle(target: string): void {
    if (!this.flow) return;
    if ((this.flow as any).state === target) return;
    if ((this.flow as any).canTransition(target)) {
      const payload = (this.flow as any).transition(target);
      this.bus.emit('lifecycle:changed', payload);
      return;
    }

    if (target === LifecycleState.IDLE && (this.flow as any).state !== LifecycleState.IDLE) {
      if ((this.flow as any).canTransition(LifecycleState.RETURN)) {
        const ret = (this.flow as any).transition(LifecycleState.RETURN);
        this.bus.emit('lifecycle:changed', ret);
      }
      if ((this.flow as any).canTransition(LifecycleState.IDLE)) {
        const idle = (this.flow as any).transition(LifecycleState.IDLE);
        this.bus.emit('lifecycle:changed', idle);
      }
    }
  }
}
