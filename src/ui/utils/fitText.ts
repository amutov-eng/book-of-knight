type TextFitOptions = {
  maxWidth?: number;
  maxHeight?: number;
  minFontSize?: number;
  minScale?: number;
};

function toPositiveNumber(value: unknown, fallback = 0): number {
  return Number.isFinite(value) && Number(value) > 0 ? Number(value) : fallback;
}

function exceedsBounds(displayObject: { width: number; height: number }, maxWidth: number, maxHeight: number): boolean {
  if (maxWidth > 0 && displayObject.width > maxWidth) return true;
  if (maxHeight > 0 && displayObject.height > maxHeight) return true;
  return false;
}

export function fitPixiTextToBounds(
  text: { width: number; height: number; scale: { set: (x: number, y?: number) => void }; style: { fontSize: number | string; lineHeight?: number | string } },
  options: TextFitOptions = {}
): void {
  if (!text || !text.style) return;

  const maxWidth = toPositiveNumber(options.maxWidth, 0);
  const maxHeight = toPositiveNumber(options.maxHeight, 0);
  if (maxWidth <= 0 && maxHeight <= 0) return;

  const baseFontSize = Math.max(1, Math.floor(Number(text.style.fontSize) || 0));
  const minFontSize = Math.max(8, Math.floor(toPositiveNumber(options.minFontSize, baseFontSize)));
  const applyFontSize = (fontSize: number): void => {
    text.style.fontSize = fontSize;
    if ('lineHeight' in text.style) {
      text.style.lineHeight = Math.max(10, Math.round(fontSize * 1.02));
    }
  };

  text.scale.set(1);
  applyFontSize(baseFontSize);

  while (Number(text.style.fontSize) > minFontSize && exceedsBounds(text, maxWidth, maxHeight)) {
    applyFontSize(Number(text.style.fontSize) - 1);
  }
}

export function fitBitmapTextToBounds(
  text: { width: number; height: number; scale: { set: (x: number, y?: number) => void } },
  options: TextFitOptions = {}
): void {
  if (!text || !text.scale) return;

  const maxWidth = toPositiveNumber(options.maxWidth, 0);
  const maxHeight = toPositiveNumber(options.maxHeight, 0);
  if (maxWidth <= 0 && maxHeight <= 0) return;

  const minScale = Math.max(0.1, toPositiveNumber(options.minScale, 0.55));
  text.scale.set(1);
  if (!exceedsBounds(text, maxWidth, maxHeight)) return;

  const widthScale = maxWidth > 0 ? maxWidth / Math.max(1, text.width) : 1;
  const heightScale = maxHeight > 0 ? maxHeight / Math.max(1, text.height) : 1;
  const fittedScale = Math.max(minScale, Math.min(widthScale, heightScale, 1));
  text.scale.set(fittedScale);
}
