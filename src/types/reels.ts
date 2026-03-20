export type ReelStopRow = [number, number, number];
export type ReelSymbolAnimationTrigger = 'win' | 'scatter' | 'wild';
export type ReelSymbolAnimationContext = {
  trigger?: ReelSymbolAnimationTrigger;
};

export interface ReelBuildConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  strip: number[];
}

export interface ReelSymbolLike {
  alpha: number;
  getIndex?(): number;
  animate(active: boolean, looping: boolean, isLong: boolean, context?: ReelSymbolAnimationContext): number;
}

export interface ReelDisplayLike {
  stopSymbols: ReelStopRow;
  startSpin(): void;
  stop(): void;
  forceStop?(): void;
  skillStop?(): void;
  isReelStopped(): boolean;
  setReelStrip?(strip: number[]): void;
  highlightScatters(): boolean;
  highlightSymbolAtStop(stop: number, looping: boolean, isLong: boolean, context?: ReelSymbolAnimationContext): number;
  getReelSymbolAtStop(stop: number): ReelSymbolLike | null;
  removeHighlight(): void;
  highlight(iterations: number): void;
  registerCallback(callback: () => void): void;
  act(delta: number): void;
}

export interface ReelViewLike {
  getDisplayObject(): ReelDisplayLike;
  update(delta: number): void;
  onStopped(callback: () => void): void;
}
