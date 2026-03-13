export interface IntroPlayer {
  start(): Promise<void>;
  waitForCompletion?(): Promise<void>;
  destroy(): Promise<void>;
}
