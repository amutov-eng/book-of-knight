export default class WinPresentationOrchestrator {
  private delayFramesRemaining = 0;

  reset(): void {
    this.delayFramesRemaining = 0;
  }

  startDelay(frames: number): void {
    const safeFrames = Number.isFinite(frames) ? Math.max(0, Math.ceil(Number(frames))) : 0;
    this.delayFramesRemaining = safeFrames;
  }

  tick(deltaFrames = 1): void {
    if (this.delayFramesRemaining <= 0) {
      return;
    }

    const step = Number.isFinite(deltaFrames) && deltaFrames > 0 ? Number(deltaFrames) : 1;
    this.delayFramesRemaining = Math.max(0, this.delayFramesRemaining - step);
  }

  isReady(): boolean {
    return this.delayFramesRemaining <= 0;
  }
}
