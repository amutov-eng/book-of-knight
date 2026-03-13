export interface IntroPlayer {
  start(): Promise<void>;
  destroy(): Promise<void>;
}
