import type { ReelDisplayLike, ReelViewLike, ReelStopRow, ReelSymbolAnimationContext, ReelSymbolLike } from '../../types/reels';

export default class ReelController {
  private readonly reelView: ReelViewLike;
  private readonly reel: ReelDisplayLike;

  constructor(reelView: ReelViewLike) {
    this.reelView = reelView;
    this.reel = reelView.getDisplayObject();
  }

  startSpin(): void {
    this.reel.startSpin();
  }

  stop(): void {
    this.reel.stop();
  }

  forceStop(): void {
    if (typeof this.reel.forceStop === 'function') {
      this.reel.forceStop();
      return;
    }
    if (typeof this.reel.skillStop === 'function') {
      this.reel.skillStop();
      return;
    }
    this.reel.stop();
  }

  isStopped(): boolean {
    return this.reel.isReelStopped();
  }

  setStopSymbols(symbols: ReelStopRow): void {
    this.reel.stopSymbols[0] = symbols[0];
    this.reel.stopSymbols[1] = symbols[1];
    this.reel.stopSymbols[2] = symbols[2];
  }

  setReelStrip(strip: number[]): void {
    if (typeof this.reel.setReelStrip === 'function') {
      this.reel.setReelStrip(strip);
    }
  }

  highlightScatters(): void {
    this.reel.highlightScatters();
  }

  highlightSymbolAtStop(stop: number, looping: boolean, isLong: boolean, context?: ReelSymbolAnimationContext): number {
    return this.reel.highlightSymbolAtStop(stop, looping, isLong, context);
  }

  playNearMissAtStop(stop: number): void {
    if (typeof this.reel.playNearMissAtStop === 'function') {
      this.reel.playNearMissAtStop(stop);
    }
  }
 
  getSymbolAtStop(stop: number): ReelSymbolLike | null {
    return this.reel.getReelSymbolAtStop(stop);
  }

  removeHighlight(): void {
    this.reel.removeHighlight();
  }

  highlight(iterations: number): void {
    this.reel.highlight(iterations);
  }
}

