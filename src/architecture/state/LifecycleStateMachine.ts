/**
 * Coarse app-shell runtime phases used by boot, gameplay orchestration, and debug tooling.
 */
export const LifecycleState = {
  BOOT: 'boot',
  PRELOAD: 'preload',
  INTRO: 'intro',
  IDLE: 'idle',
  SPIN: 'spin',
  RESOLVE: 'resolve',
  WIN_PRESENTATION: 'winPresentation',
  BONUS: 'bonus',
  RETURN: 'return'
} as const;

export type LifecycleStateValue = (typeof LifecycleState)[keyof typeof LifecycleState];

const TRANSITIONS: Record<LifecycleStateValue, LifecycleStateValue[]> = {
  [LifecycleState.BOOT]: [LifecycleState.PRELOAD],
  [LifecycleState.PRELOAD]: [LifecycleState.INTRO, LifecycleState.IDLE],
  [LifecycleState.INTRO]: [LifecycleState.IDLE],
  [LifecycleState.IDLE]: [LifecycleState.SPIN],
  [LifecycleState.SPIN]: [LifecycleState.RESOLVE],
  [LifecycleState.RESOLVE]: [LifecycleState.WIN_PRESENTATION, LifecycleState.BONUS, LifecycleState.RETURN],
  [LifecycleState.WIN_PRESENTATION]: [LifecycleState.BONUS, LifecycleState.RETURN],
  [LifecycleState.BONUS]: [LifecycleState.RETURN],
  [LifecycleState.RETURN]: [LifecycleState.IDLE]
};

/**
 * Guards legal transitions between coarse runtime phases.
 */
export default class LifecycleStateMachine {
  state: LifecycleStateValue = LifecycleState.BOOT;

  canTransition(next: LifecycleStateValue): boolean {
    const allowed = TRANSITIONS[this.state] || [];
    return allowed.includes(next);
  }

  transition(next: LifecycleStateValue): { from: LifecycleStateValue; to: LifecycleStateValue } {
    if (!this.canTransition(next)) {
      throw new Error(`Invalid lifecycle transition: ${this.state} -> ${next}`);
    }
    const from = this.state;
    this.state = next;
    return { from, to: next };
  }
}
