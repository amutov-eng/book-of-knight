'use strict';

import type { Container as PixiContainer, Texture } from 'pixi.js';
import Sprite from '../ui/Sprite';

interface SymbolOffset {
  x: number;
  y: number;
}

interface TexturesLike {
  regions: Array<Array<Texture>>;
  symbolOffsets?: SymbolOffset[];
  symbolWinProfiles?: string[];
  symbolWinAnimations?: Record<string, { scale?: number[]; rotate?: number[] }>;
  winFrames?: Array<Texture>;
}

interface ReelGameLike {
  textures: TexturesLike;
}

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
  }

  animate(animate: boolean, looping: boolean, isLong: boolean): void {
    this.anim = animate;
    this.looping = looping;
    this.isLong = isLong;
    this.animationFrameCnt = 0;
    this.delayAnimation = 0;
    this.totalFrames = this.getCurveLength();
    if (!animate) {
      this.resetWinAnimation();
    } else {
      if (this.winOverlay && this.reel && this.winOverlay.parent !== this.reel) {
        this.reel.addChild(this.winOverlay);
      }
      this.applyWinAnimationFrame(0);
    }
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
  }

  act(_delta?: number): void {
    if (!this.anim) return;

    const totalFrames = this.getCurveLength();
    if (totalFrames <= 0) {
      this.resetWinAnimation();
      this.anim = false;
      return;
    }

    const frameIndex = Math.max(0, Math.min(this.animationFrameCnt, totalFrames - 1));
    this.applyWinAnimationFrame(frameIndex);
    this.animationFrameCnt++;

    if (this.animationFrameCnt < totalFrames) {
      return;
    }

    if (this.looping) {
      this.animationFrameCnt = 0;
      return;
    }

    this.anim = false;
    this.animationFrameCnt = 0;
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

  private applyWinAnimationFrame(frameIndex: number): void {
    const winFrames = this.getWinFrames();
    if (this.winOverlay && winFrames.length > 0) {
      const overlayFrame = winFrames[Math.min(frameIndex, winFrames.length - 1)];
      if (overlayFrame) {
        this.winOverlay.texture = overlayFrame;
        this.winOverlay.visible = true;
      }
    }

    const animationProfile = this.getWinAnimationProfile();
    const scaleCurve = animationProfile.scale;
    const scale = (scaleCurve[Math.min(frameIndex, scaleCurve.length - 1)] || 100) / 100;
    this.scale.set(scale);

    const rotateCurve = animationProfile.rotate;
    const rotation = rotateCurve[Math.min(frameIndex, rotateCurve.length - 1)] || 0;
    this.rotation = rotation * (Math.PI / 180);
  }

  private resetWinAnimation(): void {
    this.scale.set(1);
    this.rotation = 0;
    if (this.winOverlay) {
      this.winOverlay.visible = false;
    }
  }
}
