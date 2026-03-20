import '@fontsource/roboto/latin-300.css';
import '@fontsource/roboto/latin-ext-300.css';
import '@fontsource/roboto/cyrillic-300.css';
import '@fontsource/roboto/cyrillic-ext-300.css';
import '@fontsource/roboto/greek-300.css';
import '@fontsource/roboto/greek-ext-300.css';
import '@fontsource/roboto/latin-400.css';
import '@fontsource/roboto/latin-ext-400.css';
import '@fontsource/roboto/cyrillic-400.css';
import '@fontsource/roboto/cyrillic-ext-400.css';
import '@fontsource/roboto/greek-400.css';
import '@fontsource/roboto/greek-ext-400.css';
import '@fontsource/roboto/latin-500.css';
import '@fontsource/roboto/latin-ext-500.css';
import '@fontsource/roboto/cyrillic-500.css';
import '@fontsource/roboto/cyrillic-ext-500.css';
import '@fontsource/roboto/greek-500.css';
import '@fontsource/roboto/greek-ext-500.css';
import '@fontsource/roboto/latin-900.css';
import '@fontsource/roboto/latin-ext-900.css';
import '@fontsource/roboto/cyrillic-900.css';
import '@fontsource/roboto/cyrillic-ext-900.css';
import '@fontsource/roboto/greek-900.css';
import '@fontsource/roboto/greek-ext-900.css';

export const APP_FONT_FAMILY = 'Roboto';
export const APP_FONT_WEIGHT_LIGHT = '300';
export const APP_FONT_WEIGHT_REGULAR = '400';
export const APP_FONT_WEIGHT_MEDIUM = '500';
export const APP_FONT_WEIGHT_BLACK = '900';

const PRELOAD_WEIGHTS = [
  APP_FONT_WEIGHT_LIGHT,
  APP_FONT_WEIGHT_REGULAR,
  APP_FONT_WEIGHT_MEDIUM,
  APP_FONT_WEIGHT_BLACK
] as const;
const PRELOAD_SAMPLE_TEXT = 'AÀÁČĞŻ БВГДЖЙКЛМНОПРСТУФХЦЧШЩЪЬЮЯ ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ';
const FONT_PRELOAD_TIMEOUT_MS = 1500;

export async function preloadAppFonts(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;

  const preloadTask = Promise.all(
    PRELOAD_WEIGHTS.map((weight) => document.fonts.load(`${weight} 16px "${APP_FONT_FAMILY}"`, PRELOAD_SAMPLE_TEXT))
  ).then(() => undefined);

  const timeoutTask = new Promise<void>((resolve) => {
    window.setTimeout(resolve, FONT_PRELOAD_TIMEOUT_MS);
  });

  try {
    await Promise.race([preloadTask, timeoutTask]);
  } catch {
    // Font preload is a progressive enhancement and must never block boot.
  }
}
