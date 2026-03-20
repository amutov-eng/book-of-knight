'use strict';

import { Point, type Container as PixiContainer, type Texture } from 'pixi.js';
import Sprite from '../ui/Sprite';
import type { ReelSymbolAnimationContext } from '../types/reels';

interface SymbolOffset {
  x: number;
  y: number;
}

interface TexturesLike {
  regions: Array<Array<Texture>>;
  symbolOffsets?: SymbolOffset[];
  symbolWinProfiles?: string[];
  symbolSpineConfigs?: Array<Record<string, SymbolSpineClipConfig> | null>;
  symbolWinAnimations?: Record<string, { scale?: number[]; rotate?: number[] }>;
  winFrames?: Array<Texture>;
}

interface SymbolSpineClipConfig {
  jsonPath: string;
  atlasPath: string;
  animationName?: string;
  loop?: boolean;
  scale?: number;
  offsetX?: number;
  offsetY?: number;
}

interface ReelGameLike {
  textures: TexturesLike;
  symbolSpineOverlay?: {
    play: (clip: SymbolSpineClipConfig, x: number, y: number) => {
      stop: () => void;
      setPosition: (x: number, y: number) => void;
      bringToFront: () => void;
      durationMs?: number;
    } | null;
  };
}

const DEFAULT_SYMBOL_ANIMATION_DT = 1 / 60;
const OVERLAY_FRAME_STEP_SEC = 1 / 25;
export default class ReelSymbol extends Sprite {
  private readonly game: ReelGameLike;
  private readonly reel: PixiContainer | null;
  private readonly winOverlay: Sprite | null;
  private anim: boolean;
  isWinning: boolean;
  private highlight: boolean;
  private index: number;
  private blurIndex: number;
  private logicalX: number;
  private logicalY: number;
  private offsetX: number;
  private offsetY: number;
  looping: boolean;
  isLong: boolean;
  animationFrameCnt: number;
  delayAnimation: number;
  totalFrames: number;
  private winProfile: string;
  private transformFrameProgress: number;
  private activeSpineConfig: SymbolSpineClipConfig | null;
  private usingSpineAnimation: boolean;
  private overlaySpineHandle: {
    stop: () => void;
    setPosition: (x: number, y: number) => void;
    bringToFront: () => void;
  } | null;

  constructor(game: ReelGameLike, reel: unknown, index: number) {
    super(game.textures.regions[index][0]);
    this.game = game;
    this.reel = reel as PixiContainer | null;
    this.anim = false;
    this.isWinning = false;
    this.highlight = false;
    this.index = index;
    this.blurIndex = 0;
    this.logicalX = 0;
    this.logicalY = 0;
    this.offsetX = 0;
    this.offsetY = 0;
    this.looping = false;
    this.isLong = false;
    this.animationFrameCnt = 0;
    this.delayAnimation = 0;
    this.totalFrames = 0;
    this.winProfile = 'normal';
    this.transformFrameProgress = 0;
    this.activeSpineConfig = null;
    this.usingSpineAnimation = false;
    this.overlaySpineHandle = null;

    this.anchor.set(0.5);
    this.blendMode = 'normal' as never;
    const overlayFrames = Array.isArray(this.game?.textures?.winFrames) ? this.game.textures.winFrames : [];
    this.winOverlay = overlayFrames.length > 0 ? new Sprite(overlayFrames[0]) : null;
    if (this.winOverlay) {
      this.winOverlay.anchor.set(0.5);
      this.winOverlay.visible = false;
      this.winOverlay.eventMode = 'none';
      if (this.reel) {
        this.reel.addChild(this.winOverlay);
      }
    }
    this.applySymbolOffset(this.index);
    this.updateWinProfile(this.index);
  }

  setIndex(index: number): void {
    if (this.index === index) {
      return;
    }
    this.hideActiveSpine();
    const prevLogicalX = this.logicalX;
    const prevLogicalY = this.logicalY;
    this.index = index;
    this.texture = this.game.textures.regions[this.index][this.blurIndex];
    this.applySymbolOffset(this.index);
    this.updateWinProfile(this.index);
    this.logicalX = prevLogicalX;
    this.logicalY = prevLogicalY;
    this.applyVisualPosition();
  }

  setPosition(x: number, y: number): void {
    this.logicalX = x;
    this.logicalY = y;
    this.applyVisualPosition();
  }

  setLogicalY(y: number): void {
    this.logicalY = y;
    this.applyVisualPosition();
  }

  getLogicalY(): number {
    return this.logicalY;
  }

  private applySymbolOffset(index: number): void {
    const offsets = this.game?.textures?.symbolOffsets;
    const offset = Array.isArray(offsets) ? offsets[index] : null;
    this.offsetX = offset && Number.isFinite(offset.x) ? offset.x : 0;
    this.offsetY = offset && Number.isFinite(offset.y) ? offset.y : 0;
  }

  private applyVisualPosition(): void {
    this.x = this.logicalX + this.offsetX;
    this.y = this.logicalY + this.offsetY;
    if (this.winOverlay) {
      this.winOverlay.x = this.x;
      this.winOverlay.y = this.y;
      this.winOverlay.zIndex = this.y + 10000;
    }
    if (this.usingSpineAnimation) {
      this.applyOverlaySpinePosition();
    }
  }

  private getStagePosition(): Point {
    return this.getGlobalPosition(new Point());
  }

  animate(animate: boolean, looping: boolean, isLong: boolean, context?: ReelSymbolAnimationContext): number {
    this.anim = animate;
    this.looping = looping;
    this.isLong = isLong;
    this.animationFrameCnt = 0;
    this.delayAnimation = 0;
    this.totalFrames = this.getCurveLength();
    this.transformFrameProgress = 0;
    if (!animate) {
      this.resetWinAnimation();
      return 0;
    } else {
      const spineDurationMs = this.tryPlaySpineAnimation(context, looping);
      if (spineDurationMs > 0) {
        return spineDurationMs;
      }
      if (this.winOverlay && this.reel && this.winOverlay.parent !== this.reel) {
        this.reel.addChild(this.winOverlay);
      }
      this.applyWinAnimationFrame(0, 0);
    }
    return 0;
  }

  setBlurFrame(index: number): void {
    const frames = this.game.textures.regions[this.index] || [];
    if (frames.length === 0) return;
    const safeIndex = Math.max(0, Math.min(index, frames.length - 1));
    if (this.blurIndex === safeIndex) return;
    this.blurIndex = safeIndex;
    this.texture = frames[this.blurIndex];
  }

  getIndex(): number {
    return this.index;
  }

  bringToFront(): void {
    if (!this.parent) return;
    const parent = this.parent as PixiContainer;
    const idx = parent.children.indexOf(this);
    if (idx < 0) return;
    parent.children.splice(idx, 1);
    parent.children.push(this);
    if (this.usingSpineAnimation && this.overlaySpineHandle) {
      this.overlaySpineHandle.bringToFront();
    }
  }

  act(delta?: number): void {
    if (!this.anim) return;
    if (this.usingSpineAnimation) return;

    const totalFrames = this.getCurveLength();
    if (totalFrames <= 0) {
      this.resetWinAnimation();
      this.anim = false;
      return;
    }

    const dt = Number.isFinite(delta) && Number(delta) > 0 ? Number(delta) : DEFAULT_SYMBOL_ANIMATION_DT;

    this.delayAnimation += dt;
    while (this.delayAnimation >= OVERLAY_FRAME_STEP_SEC) {
      this.delayAnimation -= OVERLAY_FRAME_STEP_SEC;
      this.animationFrameCnt++;
    }

    this.transformFrameProgress = Math.min(
      this.animationFrameCnt + (this.delayAnimation / OVERLAY_FRAME_STEP_SEC),
      totalFrames - 1
    );

    const overlayFrameIndex = Math.max(0, Math.min(this.animationFrameCnt, totalFrames - 1));
    this.applyWinAnimationFrame(overlayFrameIndex, this.transformFrameProgress);

    if (this.animationFrameCnt < totalFrames) {
      return;
    }

    if (this.looping) {
      this.animationFrameCnt = 0;
      return;
    }

    this.anim = false;
    this.animationFrameCnt = 0;
    this.transformFrameProgress = 0;
    this.delayAnimation = 0;
    this.resetWinAnimation();
  }

  private updateWinProfile(index: number): void {
    const profiles = this.game?.textures?.symbolWinProfiles;
    const configured = Array.isArray(profiles) ? profiles[index] : null;
    if (typeof configured === 'string' && configured.length > 0) {
      this.winProfile = configured;
      return;
    }
    this.winProfile = index < 6 ? 'normal' : 'high';
  }

  private getWinFrames(): Array<Texture> {
    return Array.isArray(this.game?.textures?.winFrames) ? this.game.textures.winFrames : [];
  }

  private getWinAnimationProfile(): { scale: number[]; rotate: number[] } {
    const allProfiles = this.game?.textures?.symbolWinAnimations || {};
    const configured = allProfiles[this.winProfile];
    if (configured && Array.isArray(configured.scale) && configured.scale.length > 0) {
      return {
        scale: configured.scale,
        rotate: Array.isArray(configured.rotate) && configured.rotate.length > 0
          ? configured.rotate
          : new Array(configured.scale.length).fill(0)
      };
    }

    const fallback = allProfiles.normal;
    if (fallback && Array.isArray(fallback.scale) && fallback.scale.length > 0) {
      return {
        scale: fallback.scale,
        rotate: Array.isArray(fallback.rotate) && fallback.rotate.length > 0
          ? fallback.rotate
          : new Array(fallback.scale.length).fill(0)
      };
    }

    return {
      scale: [100],
      rotate: [0]
    };
  }

  private getCurveLength(): number {
    return this.getWinAnimationProfile().scale.length;
  }

  private applyWinAnimationFrame(frameIndex: number, transformFrameProgress: number): void {
    const winFrames = this.getWinFrames();
    if (this.winOverlay && winFrames.length > 0) {
      const overlayFrame = winFrames[Math.min(frameIndex, winFrames.length - 1)];
      if (overlayFrame) {
        this.winOverlay.texture = overlayFrame;
        this.winOverlay.visible = true;
      }
    }

    const animationProfile = this.getWinAnimationProfile();
    const scale = this.sampleCurve(animationProfile.scale, transformFrameProgress) / 100;
    this.scale.set(scale);

    const rotation = this.sampleCurve(animationProfile.rotate, transformFrameProgress);
    this.rotation = rotation * (Math.PI / 180);
  }

  private sampleCurve(curve: number[], frameProgress: number): number {
    if (!Array.isArray(curve) || curve.length === 0) {
      return 0;
    }

    const clamped = Math.max(0, Math.min(frameProgress, curve.length - 1));
    const leftIndex = Math.floor(clamped);
    const rightIndex = Math.min(leftIndex + 1, curve.length - 1);
    const mix = clamped - leftIndex;
    const left = Number(curve[leftIndex] ?? curve[0] ?? 0);
    const right = Number(curve[rightIndex] ?? left);
    return left + (right - left) * mix;
  }

  private resetWinAnimation(): void {
    this.hideActiveSpine();
    this.scale.set(1);
    this.rotation = 0;
    this.visible = true;
    if (this.winOverlay) {
      this.winOverlay.visible = false;
    }
  }

  private tryPlaySpineAnimation(context: ReelSymbolAnimationContext | undefined, looping: boolean): number {
    const clip = this.resolveSpineClip(context);
    const overlay = this.game?.symbolSpineOverlay;
    if (!clip || !overlay || typeof overlay.play !== 'function') {
      this.hideActiveSpine();
      return 0;
    }

    const stagePosition = this.getStagePosition();
    const handle = overlay.play({
      ...clip,
      loop: clip.loop === true || looping
    }, stagePosition.x, stagePosition.y);
    if (!handle) {
      this.hideActiveSpine();
      return 0;
    }

    this.hideActiveSpine();
    this.activeSpineConfig = clip;
    this.usingSpineAnimation = true;
    this.overlaySpineHandle = handle;
    this.visible = false;
    this.scale.set(1);
    this.rotation = 0;
    if (this.winOverlay) {
      this.winOverlay.visible = false;
    }
    return Number.isFinite(handle.durationMs) ? Number(handle.durationMs) : 0;
  }

  private resolveSpineClip(context?: ReelSymbolAnimationContext): SymbolSpineClipConfig | null {
    const allConfigs = this.game?.textures?.symbolSpineConfigs;
    const config = Array.isArray(allConfigs) ? allConfigs[this.index] : null;
    if (!config || typeof config !== 'object') {
      return null;
    }

    const trigger = context && typeof context.trigger === 'string' ? context.trigger : 'win';
    return config[trigger] || config.default || (trigger !== 'win' ? config.win : null) || null;
  }

  private applyOverlaySpinePosition(): void {
    if (!this.overlaySpineHandle) return;
    const stagePosition = this.getStagePosition();
    this.overlaySpineHandle.setPosition(stagePosition.x, stagePosition.y);
  }

  private hideActiveSpine(): void {
    if (this.overlaySpineHandle) {
      this.overlaySpineHandle.stop();
    }
    this.activeSpineConfig = null;
    this.usingSpineAnimation = false;
    this.overlaySpineHandle = null;
  }
}
