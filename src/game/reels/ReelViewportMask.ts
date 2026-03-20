import { Graphics, type Container } from 'pixi.js';
import {
  calculateReelViewportOverflow,
  getHiddenServiceSymbolIndices,
  getNormalViewportBounds,
  getSpinViewportBounds,
  type ReelViewportMaskOptions
} from './reelViewportMath';

type ReelViewportSymbolLike = {
  visible: boolean;
  mask: Graphics | null;
};

export default class ReelViewportMask {
  readonly normalMask: Graphics;
  readonly spinMask: Graphics;

  private readonly owner: Container;
  private readonly horizontalOverflow: number;
  private readonly verticalOverflow: number;
  private currentMask: Graphics | null = null;
  private hiddenTopSymbolIndex = -1;
  private hiddenBottomSymbolIndex = -1;

  constructor(owner: Container, options: ReelViewportMaskOptions) {
    this.owner = owner;
    const overflow = calculateReelViewportOverflow(options);
    this.horizontalOverflow = overflow.horizontal;
    this.verticalOverflow = overflow.vertical;
    const normalBounds = getNormalViewportBounds(options);
    const spinBounds = getSpinViewportBounds(options);

    this.normalMask = new Graphics()
      .rect(normalBounds.x, normalBounds.y, normalBounds.width, normalBounds.height)
      .fill(0xff0000);
    this.normalMask.alpha = 0;
    this.normalMask.visible = true;
    this.owner.addChild(this.normalMask);

    this.spinMask = new Graphics()
      .rect(spinBounds.x, spinBounds.y, spinBounds.width, spinBounds.height)
      .fill(0x00ff00);
    this.spinMask.alpha = 0;
    this.spinMask.visible = true;
    this.owner.addChild(this.spinMask);
  }

  applyNormal(symbols: ReelViewportSymbolLike[], spriteOffset: number, totalSymbols: number): void {
    this.applyMask(symbols, this.normalMask);
    this.hideServiceSymbols(symbols, spriteOffset, totalSymbols);
  }

  applySpin(symbols: ReelViewportSymbolLike[]): void {
    this.applyMask(symbols, this.spinMask);
  }

  clear(symbols: ReelViewportSymbolLike[]): void {
    this.applyMask(symbols, null);
    this.hideServiceSymbols(symbols, -1, 0);
  }

  private applyMask(symbols: ReelViewportSymbolLike[], mask: Graphics | null): void {
    this.restoreHiddenSymbols(symbols);

    if (this.currentMask === mask) {
      return;
    }

    for (let i = 0; i < symbols.length; i += 1) {
      symbols[i].mask = null;
    }

    this.owner.mask = mask;
    this.currentMask = mask;
  }

  private hideServiceSymbols(symbols: ReelViewportSymbolLike[], spriteOffset: number, totalSymbols: number): void {
    const indices = getHiddenServiceSymbolIndices(spriteOffset, totalSymbols);
    if (!indices) {
      return;
    }

    this.hiddenTopSymbolIndex = indices.top;
    this.hiddenBottomSymbolIndex = indices.bottom;

    if (symbols[this.hiddenTopSymbolIndex]) {
      symbols[this.hiddenTopSymbolIndex].visible = false;
    }
    if (symbols[this.hiddenBottomSymbolIndex]) {
      symbols[this.hiddenBottomSymbolIndex].visible = false;
    }
  }

  private restoreHiddenSymbols(symbols: ReelViewportSymbolLike[]): void {
    if (this.hiddenTopSymbolIndex >= 0 && symbols[this.hiddenTopSymbolIndex]) {
      symbols[this.hiddenTopSymbolIndex].visible = true;
    }
    if (this.hiddenBottomSymbolIndex >= 0 && symbols[this.hiddenBottomSymbolIndex]) {
      symbols[this.hiddenBottomSymbolIndex].visible = true;
    }
    this.hiddenTopSymbolIndex = -1;
    this.hiddenBottomSymbolIndex = -1;
  }
}
