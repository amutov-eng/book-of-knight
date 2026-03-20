export type SymbolSpineRuntime = '3.8' | '4.2';

export type SymbolSpineClipConfig = {
  jsonPath: string;
  atlasPath: string;
  animationName?: string;
  loop?: boolean;
  scale?: number;
  offsetX?: number;
  offsetY?: number;
  runtime?: SymbolSpineRuntime;
};

export type SymbolSpineHandle = {
  stop: () => void;
  setPosition: (x: number, y: number) => void;
  bringToFront: () => void;
  durationMs?: number;
};

export type SymbolSpineGameLike = {
  renderer?: any;
  displayManager?: any;
  reels?: any;
};
