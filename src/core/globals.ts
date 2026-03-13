import * as PIXI from 'pixi.js';
import { log as importedLog } from '../../log.js';

declare global {
  interface Window {
    PIXI?: typeof PIXI;
    Container?: typeof PIXI.Container;
    Sprite?: typeof PIXI.Sprite;
    Application?: typeof PIXI.Application;
    Texture?: typeof PIXI.Texture;
    Graphics?: typeof PIXI.Graphics;
    Text?: typeof PIXI.Text;
    TextureCache?: Record<string, PIXI.Texture>;
    log?: (message: unknown, level?: string) => void;
  }
}

const runtime = window;

export function restorePixiGlobals(): void {
  runtime.PIXI = PIXI;
  runtime.Container = PIXI.Container;
  runtime.Sprite = PIXI.Sprite;
  runtime.Application = PIXI.Application;
  runtime.Texture = PIXI.Texture;
  runtime.Graphics = PIXI.Graphics;
  (runtime as any).Text = PIXI.Text;
  runtime.TextureCache = runtime.TextureCache || {};
  runtime.log = importedLog;
}

restorePixiGlobals();

export {};

