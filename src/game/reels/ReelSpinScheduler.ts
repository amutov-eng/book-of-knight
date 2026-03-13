import type Timers from '../../core/time/Timers';

export interface ReelStopSchedule {
  initialDelayMs: number;
  intervalDelayMs: number;
}

const DEFAULT_STOP_SCHEDULE: ReelStopSchedule = Object.freeze({
  initialDelayMs: 100,
  intervalDelayMs: 400
});

export default class ReelSpinScheduler {
  private readonly timers: Timers | null;
  private readonly schedule: ReelStopSchedule;
  private readonly timerIds: number[] = [];

  constructor(timers: Timers | null, schedule: Partial<ReelStopSchedule> = {}) {
    this.timers = timers;
    this.schedule = {
      initialDelayMs: Number.isFinite(schedule.initialDelayMs) ? Number(schedule.initialDelayMs) : DEFAULT_STOP_SCHEDULE.initialDelayMs,
      intervalDelayMs: Number.isFinite(schedule.intervalDelayMs) ? Number(schedule.intervalDelayMs) : DEFAULT_STOP_SCHEDULE.intervalDelayMs
    };
  }

  scheduleStops(reelCount: number, onStop: (reelIndex: number) => void): void {
    this.cancel();
    if (!this.timers || reelCount <= 0) return;

    for (let reelIndex = 0; reelIndex < reelCount; reelIndex++) {
      const delayMs = this.schedule.initialDelayMs + this.schedule.intervalDelayMs * reelIndex;
      const timerId = this.timers.after(delayMs, () => {
        onStop(reelIndex);
      });
      this.timerIds.push(timerId);
    }
  }

  cancel(): void {
    if (!this.timers || this.timerIds.length === 0) {
      this.timerIds.length = 0;
      return;
    }

    for (let index = 0; index < this.timerIds.length; index++) {
      this.timers.cancel(this.timerIds[index]);
    }
    this.timerIds.length = 0;
  }
}
