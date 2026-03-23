# Font Setup Guide

Този файл описва откъде се управляват шрифтовете в проекта и кои места се пипат при бъдещи промени.

## 1. Къде са font файловете

Папка:

- `assets/common/fonts/`

Тук стоят:

- `.ttf` файловете на Roboto
- лицензът: `Roboto-OFL-1.1.txt`
- bitmap atlas файловете в `assets/common/fonts/bitmap/`

## 2. Къде са MSDF / BitmapText файловете

Папка:

- `assets/common/fonts/bitmap/`

Тук стоят:

- `Roboto-Bold.fnt`
- `Roboto-Black.fnt`
- `Roboto_Condensed-Medium.fnt`
- съответните `.png` atlas файлове

Тези файлове се ползват от `PIXI.BitmapText`.

## 3. Къде се preload-ват font-овете

### Обикновени web fonts

Файл:

- `src/config/fontConfig.ts`

Тук се държат:

- `APP_FONT_FAMILY`
- weight константите
- preload на стандартните Roboto web fonts

### Bitmap / MSDF fonts

Файл:

- `src/config/bitmapFontConfig.ts`

Тук се държат:

- имената на bitmap font family-тата
- пътищата към `.fnt` файловете
- preload на MSDF atlas-ите

## 4. Къде се връзват при boot

Файл:

- `src/app/App.ts`

Тук при `init()` се извикват:

- `preloadAppFonts()`
- `preloadBitmapFonts()`

## 5. Къде се сменят font-овете за HUD

Основен файл:

- `src/ui/Menu.ts`

Тук са вързани:

- `DEMO PLAY / CREDIT`
- `BET`
- `WIN`
- `line-by-line win text`

В момента:

- `credit` / `BET` / `winStatus` ползват bitmap font от manifest
- `WIN` ползва bitmap font от manifest

## 6. Къде се управляват от manifest

Fallback конфигурация:

- `src/config/assetsConfig.ts`

Реални manifest файлове:

- `assets/desktop/assets-manifest.desktop.json`
- `assets/desktop/assets-manifest.mobile.json`
- `assets/mobile/assets-manifest.desktop.json`
- `assets/mobile/assets-manifest.mobile.json`

## 7. Кои manifest ключове управляват HUD font-овете

В `ui.hud.fonts`:

- `creditLabelBitmap`
- `creditValueBitmap`
- `totalBetLabelBitmap`
- `totalBetValueBitmap`
- `winStatusBitmap`
- `winBitmap`

Пример:

```json
"fonts": {
  "creditLabelBitmap": "Roboto_Condensed-Medium",
  "creditValueBitmap": "Roboto_Condensed-Medium",
  "totalBetLabelBitmap": "Roboto_Condensed-Medium",
  "totalBetValueBitmap": "Roboto_Condensed-Medium",
  "winStatusBitmap": "Roboto_Condensed-Medium",
  "winBitmap": "Roboto-Black"
}
```

## 8. Кои manifest ключове управляват размера и позицията

В `ui.hud.texts`:

- `credit`
- `totalBet`
- `status`
- `winStatus`
- `win`

Пример:

```json
"texts": {
  "credit": { "x": 220, "y": 1039, "fontSize": 34, "align": "left" },
  "totalBet": { "x": 1490, "y": 1039, "fontSize": 34, "align": "left" },
  "winStatus": { "x": 960, "y": 990, "fontSize": 34, "align": "center" },
  "win": { "x": 960, "y": 953, "fontSize": 36, "align": "center" }
}
```

## 9. Ако се сменя font в бъдеще

Обичайният ред е:

1. Качваш новите `.ttf` файлове в `assets/common/fonts/`
2. Генерираш нови `.fnt` + `.png` MSDF atlas-и в `assets/common/fonts/bitmap/`
3. Най-лесният начин е:

```bash
npm run fonts:generate
```

Текущите параметри за генерация са:

- `fontSize: 72`
- `textureSize: 2048x1024`
- `distanceRange: 6`
- `padding: 2`
- `border: 2`

Скриптът е:

- `scripts/generate-msdf-fonts.mjs`

и ползва charset файла:

- `assets/common/fonts/bitmap/charset.txt`

4. Добавяш новия font в `src/config/bitmapFontConfig.ts`
5. Сменяш името му в manifest-а
6. Ако трябва, коригираш `fontSize` и `x/y` в manifest-а

## 10. Важно за desktop/mobile

Проектът копира asset-ите в:

- `public/assets`

Това става през:

- `scripts/prepare-assets.mjs`

Ако последно е пускан mobile build/dev, после desktop може да гледа грешен overlay. При съмнение:

- `npm run dev:desktop`
- `npm run dev:mobile`

или ръчно:

- `node scripts/prepare-assets.mjs desktop`
- `node scripts/prepare-assets.mjs mobile`
