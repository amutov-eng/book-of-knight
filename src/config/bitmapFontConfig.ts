export const BITMAP_FONT_ROBOTO_BOLD = 'Roboto-Bold';
export const BITMAP_FONT_ROBOTO_BLACK = 'Roboto-Black';
export const BITMAP_FONT_ROBOTO_CONDENSED_MEDIUM = 'Roboto_Condensed-Medium';

const BITMAP_FONT_ASSET_PATHS = [
  'assets/fonts/bitmap/Roboto-Bold.fnt',
  'assets/fonts/bitmap/Roboto-Black.fnt',
  'assets/fonts/bitmap/Roboto_Condensed-Medium.fnt'
] as const;

let bitmapFontsPreloadPromise: Promise<void> | null = null;

export function preloadBitmapFonts(): Promise<void> {
  if (bitmapFontsPreloadPromise) {
    return bitmapFontsPreloadPromise;
  }

  bitmapFontsPreloadPromise = (async () => {
    if (typeof window === 'undefined') return;

    const pixi = (window as Window & { PIXI?: { Assets?: { load: (assets: string[]) => Promise<unknown> } } }).PIXI;
    if (!pixi || !pixi.Assets) return;

    await pixi.Assets.load([...BITMAP_FONT_ASSET_PATHS]);
  })();

  return bitmapFontsPreloadPromise;
}
