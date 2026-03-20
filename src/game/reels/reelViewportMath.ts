export type ReelViewportMaskOptions = {
  width: number;
  height: number;
  symbolWidth: number;
  symbolHeight: number;
  pitch: number;
  trimTopY: number;
  trimBottomY: number;
};

export function calculateReelViewportOverflow(options: ReelViewportMaskOptions): { horizontal: number; vertical: number } {
  return {
    horizontal: Math.max(120, Math.round(options.symbolWidth * 0.55)),
    vertical: Math.max(36, Math.round(Math.max(0, options.symbolHeight - options.pitch) * 0.5) + 24)
  };
}

export function getNormalViewportBounds(options: ReelViewportMaskOptions): { x: number; y: number; width: number; height: number } {
  const overflow = calculateReelViewportOverflow(options);
  return {
    x: -overflow.horizontal,
    y: -overflow.vertical,
    width: options.width + overflow.horizontal * 2,
    height: options.height + overflow.vertical * 2
  };
}

export function getSpinViewportBounds(options: ReelViewportMaskOptions): { x: number; y: number; width: number; height: number } {
  const overflow = calculateReelViewportOverflow(options);
  return {
    x: -overflow.horizontal,
    y: -options.trimTopY,
    width: options.width + overflow.horizontal * 2,
    height: options.height + options.trimTopY + options.trimBottomY
  };
}

export function getHiddenServiceSymbolIndices(spriteOffset: number, totalSymbols: number): { top: number; bottom: number } | null {
  if (spriteOffset < 0 || totalSymbols <= 0) {
    return null;
  }

  return {
    top: (spriteOffset + 3) % totalSymbols,
    bottom: (spriteOffset + 4) % totalSymbols
  };
}
