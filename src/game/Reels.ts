import { Container, type Texture } from 'pixi.js';
import ReelView from '../architecture/reels/ReelView';
import ReelController from '../architecture/reels/ReelController';
import ReelSpinScheduler from './reels/ReelSpinScheduler';
import LineRender from '../ui/LineRender';
import Sprite from '../ui/Sprite';
import { WINTYPES } from './Win';
import { debug } from '../core/utils/logger';
import { getReelTextureKey, getReelsLayoutConfig, getReelStripsConfig, getDefaultStripMode } from '../config/assetsConfig';
import { getRuntimeVariant } from '../config/runtimeConfig';
import { getAssetsManifest, getIsLandscape, getTextureCache } from '../core/RuntimeContext';
import { GAME_RULES } from '../config/gameRules';
import { SOUND_IDS } from '../config/soundConfig';
import type BaseGame from '../core/BaseGame';
import type { ReelStopRow, ReelSymbolAnimationContext } from '../types/reels';
import { getNearMissDurationFrames, resolveNearMissSoundId, shouldAnimateNearMissSymbol } from './reels/nearMissRules';

type Matrix3xN = number[][];

interface WinLike {
  highlight: number[][];
  type: number;
  cnt: number;
  symbol: number;
  hasWild?: boolean;
}

export default class Reels extends Container {
  private readonly game: BaseGame & { variant?: string; screen: { stage: Container } };
  public NUMBER_OF_REELS: number;
  private REELS_SPACING = 162;
  private REELS_POSITION_X = 105;
  private REELS_POSITION_Y = 65;
  private BG_POSITION_X = 0;
  private BG_POSITION_Y = 0;
  private REEL_WIDTH = 162;
  private REEL_HEIGHT = 440;
  private REEL_STRIP: number[] = [1, 5, 6, 4, 5];
  private REEL_STRIPS: number[][] = [];
  private forcedReelStrip: number[] = [];
  private FORCE_SYMBOL_INDEX: number | null = null;
  private TITLE_POSITION_X = 0;
  private TITLE_POSITION_Y = 0;
  private defaultLinesAboveSymbols = true;
  private linesAboveSymbolsOverride: boolean | null = null;
  private variant: string;
  private stripMode: 'normal' | 'free' | 'holdAndWin' = 'normal';
  private reels: Container[] = [];
  private reelViews: ReelView[] = [];
  private reelControllers: ReelController[] = [];
  private readonly spinScheduler: ReelSpinScheduler;
  matrix: Matrix3xN;
  private readonly VISIBLE_ROWS: number;
  private isBuilt = false;
  public lineRenderer: LineRender | null = null;
  private reelsBackground: Sprite | null = null;

  constructor(game: BaseGame) {
    super();
    this.game = game as BaseGame & { variant?: string; screen: { stage: Container } };
    debug('Reels::constructor');

    this.NUMBER_OF_REELS = GAME_RULES.REELS;
    this.variant = this.game && this.game.variant ? this.game.variant : getRuntimeVariant();

    this.matrix = this.createEmptyMatrix(GAME_RULES.SYMBOLS, GAME_RULES.REELS);
    this.VISIBLE_ROWS = this.matrix.length;
    this.spinScheduler = new ReelSpinScheduler(this.game.timers ?? null);
  }

  private createEmptyMatrix(rows: number, cols: number): Matrix3xN {
    const matrix: number[][] = [];
    for (let r = 0; r < rows; r++) {
      const row: number[] = [];
      for (let c = 0; c < cols; c++) row.push(0);
      matrix.push(row);
    }
    return matrix;
  }

  private getReelController(index: number): ReelController | null {
    if (index < 0 || index >= this.reelControllers.length) return null;
    return this.reelControllers[index] || null;
  }

  private getStripForReel(index: number): number[] {
    const strip = this.REEL_STRIPS[index] || this.REEL_STRIP;
    if (this.FORCE_SYMBOL_INDEX == null) return strip;
    if (this.forcedReelStrip.length !== strip.length) {
      this.forcedReelStrip = new Array(strip.length);
    }

    for (let i = 0; i < strip.length; i++) {
      this.forcedReelStrip[i] = this.FORCE_SYMBOL_INDEX;
    }

    return this.forcedReelStrip;
  }

  private updateLayoutFromManifest(): void {
    const manifest = getAssetsManifest();
    const isLandscape = getIsLandscape();

    if (this.stripMode === 'normal') {
      this.stripMode = getDefaultStripMode(manifest) as typeof this.stripMode;
    }

    const layout = getReelsLayoutConfig(manifest, this.variant, isLandscape);
    this.NUMBER_OF_REELS = layout.reels.count;

    if (!Array.isArray(this.matrix) || this.matrix.length !== GAME_RULES.SYMBOLS || !Array.isArray(this.matrix[0]) || this.matrix[0].length !== this.NUMBER_OF_REELS) {
      this.matrix = this.createEmptyMatrix(GAME_RULES.SYMBOLS, this.NUMBER_OF_REELS);
    }

    this.REELS_SPACING = layout.reels.spacing;
    this.REELS_POSITION_X = layout.reels.x;
    this.REELS_POSITION_Y = layout.reels.y;
    this.REEL_WIDTH = layout.reels.width;
    this.REEL_HEIGHT = layout.reels.height;
    this.REEL_STRIP = layout.reels.strip;
    this.REEL_STRIPS = getReelStripsConfig(manifest, this.variant, isLandscape, this.stripMode);
    this.FORCE_SYMBOL_INDEX = layout.reels.forceSymbolIndex;
    this.forcedReelStrip.length = 0;
    this.BG_POSITION_X = layout.layers.reelsBgX;
    this.BG_POSITION_Y = layout.layers.reelsBgY;
    this.TITLE_POSITION_X = layout.layers.titleX;
    this.TITLE_POSITION_Y = layout.layers.titleY;
    this.defaultLinesAboveSymbols = layout.layers.linesAboveSymbols !== false;
    this.applyLineRendererLayer();
  }

  show(): void {
    this.position.set(0, 0);
    this.updateLayoutFromManifest();

    if (!this.parent) {
      this.game.screen.stage.addChild(this);
    }

    if (!this.isBuilt) {
      this.drawReelLayers();
      this.buildReels();
      this.isBuilt = true;
    }

    if (!this.lineRenderer) {
      this.lineRenderer = new LineRender();
      if (this.lineRenderer.hasAssets()) {
        this.addChild(this.lineRenderer);
        this.applyLineRendererLayer();
      } else {
        this.lineRenderer = null;
      }
    }
    debug('Reels');
  }

  private buildReels(): void {
    for (let i = 0; i < this.NUMBER_OF_REELS; i++) {
      const reelView = new ReelView(this.game, {
        x: this.REELS_POSITION_X + i * this.REELS_SPACING,
        y: this.REELS_POSITION_Y,
        width: this.REEL_WIDTH,
        height: this.REEL_HEIGHT,
        strip: this.getStripForReel(i)
      });

      const reelController = new ReelController(reelView);
      const reelDisplayObject = reelView.getDisplayObject() as unknown as Container;

      this.reelViews.push(reelView);
      this.reelControllers.push(reelController);
      this.reels.push(reelDisplayObject);
      this.addChild(reelDisplayObject);

      reelView.onStopped(() => {
        this.game.soundSystem?.play(SOUND_IDS.REEL_STOP);
      });
    }
  }

  setStripMode(mode: 'normal' | 'free' | 'holdAndWin'): void {
    const normalized = mode === 'free' || mode === 'holdAndWin' ? mode : 'normal';
    this.stripMode = normalized;
    this.updateLayoutFromManifest();
    if (this.reelControllers.length === 0) return;

    for (let i = 0; i < this.reelControllers.length; i++) {
      this.reelControllers[i].setReelStrip(this.getStripForReel(i));
    }
  }

  private drawReelLayers(): void {
    const textureCache = getTextureCache() as Record<string, Texture>;
    const manifest = getAssetsManifest();

    const bgKey = getReelTextureKey(manifest, 'background', 'base');
    const bgTexture = bgKey ? textureCache[bgKey] : null;
    if (!bgTexture) return;

    if (this.reelsBackground) {
      this.reelsBackground.texture = bgTexture;
      this.reelsBackground.position.set(this.BG_POSITION_X, this.BG_POSITION_Y);
      return;
    }

    this.reelsBackground = new Sprite(bgTexture);
    this.reelsBackground.position.set(this.BG_POSITION_X, this.BG_POSITION_Y);
    this.addChild(this.reelsBackground);
  }

  private applyLineRendererLayer(): void {
    if (!this.lineRenderer || this.lineRenderer.parent !== this || this.reels.length === 0) {
      return;
    }

    const linesAboveSymbols = this.linesAboveSymbolsOverride == null
      ? this.defaultLinesAboveSymbols
      : this.linesAboveSymbolsOverride;

    let firstReelIndex = Number.POSITIVE_INFINITY;
    let lastReelIndex = -1;
    for (let i = 0; i < this.reels.length; i++) {
      const reel = this.reels[i];
      if (!reel || reel.parent !== this) continue;
      const childIndex = this.getChildIndex(reel);
      if (childIndex < firstReelIndex) firstReelIndex = childIndex;
      if (childIndex > lastReelIndex) lastReelIndex = childIndex;
    }

    if (!Number.isFinite(firstReelIndex) || lastReelIndex < 0) {
      return;
    }

    if (linesAboveSymbols) {
      const targetIndex = Math.min(lastReelIndex + 1, this.children.length - 1);
      this.setChildIndex(this.lineRenderer, targetIndex);
      return;
    }

    this.setChildIndex(this.lineRenderer, firstReelIndex);
  }

  setLinesAboveSymbols(enabled: boolean): void {
    this.linesAboveSymbolsOverride = !!enabled;
    this.applyLineRendererLayer();
  }

  resetLineLayer(): void {
    this.linesAboveSymbolsOverride = null;
    this.applyLineRendererLayer();
  }

  act(delta: number): void {
    const views = this.reelViews;
    for (let i = 0; i < views.length; i++) {
      views[i].update(delta);
    }
  }

  startSpin(): void {
    this.spinScheduler.cancel();
    for (let i = 0; i < this.reelControllers.length; i++) {
      this.reelControllers[i].startSpin();
    }
    this.spinScheduler.scheduleStops(this.reelControllers.length, (reelIndex) => {
      const target = this.getReelController(reelIndex);
      if (target) {
        target.stop();
      }
    });
  }

  updateStopSymbols(): void {
    for (let index = 0; index < this.NUMBER_OF_REELS; index++) {
      const reelController = this.getReelController(index);
      if (!reelController) continue;

      if (this.FORCE_SYMBOL_INDEX != null) {
        reelController.setStopSymbols([
          this.FORCE_SYMBOL_INDEX,
          this.FORCE_SYMBOL_INDEX,
          this.FORCE_SYMBOL_INDEX
        ] as ReelStopRow);
        continue;
      }

      reelController.setStopSymbols([
        this.matrix[0][index],
        this.matrix[1][index],
        this.matrix[2][index]
      ] as ReelStopRow);
    }
  }

  spinReel(reel: number): void {
    const reelController = this.getReelController(reel);
    if (!reelController) return;
    reelController.startSpin();
  }

  stopReel(index: number): void {
    const reelController = this.getReelController(index);
    if (!reelController) return;
    reelController.stop();
  }

  playNearMissOnReel(reelIndex: number): number {
    const reelController = this.getReelController(reelIndex);
    const context = this.game?.context as Record<string, any> | null;
    const outcome = context && context.outcome ? context.outcome : null;
    const server = context && context.server ? context.server : null;
    const previousHoldAndWin = Array.isArray(server?.prevMatrixHoldAndWin) ? server.prevMatrixHoldAndWin : [];
    let maxDelayFrames = 0;
    if (!reelController || !outcome) {
      return 0;
    }

    for (let row = 0; row < this.VISIBLE_ROWS; row++) {
      const symbolIndex = Number(this.matrix?.[row]?.[reelIndex] ?? -1);
      const previousHoldAndWinValue = Number(previousHoldAndWin?.[row]?.[reelIndex] ?? 0);
      const evaluation = {
        symbolIndex,
        outcomeHasWin: !!outcome.hasWin,
        outcomeHasWild: !!outcome.hasWild,
        previousHoldAndWinValue
      };

      if (!shouldAnimateNearMissSymbol(evaluation)) {
        continue;
      }

      reelController.playNearMissAtStop(row);
      maxDelayFrames = Math.max(maxDelayFrames, getNearMissDurationFrames());
      const soundId = resolveNearMissSoundId(evaluation);
      if (soundId) {
        this.game.soundSystem?.play(soundId);
      }
    }

    return maxDelayFrames;
  }

  highlightScattersOnReel(reelIndex: number, win: WinLike | null): void {
    const reelController = this.getReelController(reelIndex);
    if (!reelController) return;

    if (!win || !win.highlight) {
      reelController.highlightScatters();
      return;
    }

    for (let row = 0; row < this.VISIBLE_ROWS; row++) {
      if (win.highlight[row][reelIndex] === 1) {
        this.highlightSymbol(reelIndex, row, false, true, { trigger: 'scatter' });
      }
    }
  }

  highlightSymbol(reel: number, stop: number, looping: boolean, isLong: boolean, context?: ReelSymbolAnimationContext): number {
    const reelController = this.getReelController(reel);
    if (!reelController) return 0;
    return reelController.highlightSymbolAtStop(stop, looping, isLong, context) || 0;
  }

  highlightWin(win: WinLike, looping: boolean, _overlay: unknown): number {
    let maxAnimationMs = 0;
    for (let row = 0; row < this.VISIBLE_ROWS; row++) {
      for (let reel = 0; reel < this.NUMBER_OF_REELS; reel++) {
        if (win.highlight[row][reel] === 1) {
          const animationMs = this.highlightSymbol(
            reel,
            row,
            looping,
            (win.cnt > 3 || win.symbol === 0),
            this.resolveAnimationContext(win, reel, row)
          );
          if (animationMs > maxAnimationMs) {
            maxAnimationMs = animationMs;
          }
        } else if (win.type !== WINTYPES.NEAR_MISS && win.type !== WINTYPES.NEAR_MISS_WILD) {
          this.dimSymbol(reel, row, 0.20);
        }
      }
    }
    return maxAnimationMs;
  }

  private resolveAnimationContext(win: WinLike, reelIndex: number, rowIndex: number): ReelSymbolAnimationContext {
    const reelController = this.getReelController(reelIndex);
    const symbol = reelController ? reelController.getSymbolAtStop(rowIndex) : null;
    const symbolIndex = symbol && typeof symbol.getIndex === 'function' ? symbol.getIndex() : -1;

    if (win.type === WINTYPES.SCATTER && symbolIndex === 0) {
      return { trigger: 'scatter' };
    }

    if (symbolIndex === 0 && win.hasWild) {
      return { trigger: 'wild' };
    }

    return { trigger: 'win' };
  }

  private dimSymbol(reel: number, stop: number, alpha: number): void {
    const reelController = this.getReelController(reel);
    if (!reelController) return;
    const symbol = reelController.getSymbolAtStop(stop);
    if (symbol) symbol.alpha = alpha;
  }

  highlightReel(reel: number, iterations: number): void {
    const reelController = this.getReelController(reel);
    if (!reelController) return;
    reelController.highlight(iterations);
  }

  unhighlightAll(): void {
    for (let i = 0; i < this.reelControllers.length; i++) {
      this.reelControllers[i].removeHighlight();
    }
    this.lineRenderer?.clear();
    this.resetLineLayer();
  }

  stopAllReels(force = false): void {
    for (let i = 0; i < this.reelControllers.length; i++) {
      const reelController = this.reelControllers[i];
      if (force) {
        reelController.forceStop();
      } else {
        reelController.stop();
      }
    }
    this.spinScheduler.cancel();
  }

  reelStopped(reel: number): boolean {
    const reelController = this.getReelController(reel);
    if (!reelController) return false;
    return reelController.isStopped();
  }

  allStopped(): boolean {
    if (this.reelControllers.length === 0) return false;
    for (let i = 0; i < this.reelControllers.length; i++) {
      if (!this.reelControllers[i].isStopped()) {
        return false;
      }
    }
    return true;
  }
}


