## App Font Setup

The project uses self-hosted `Roboto` fonts for production builds.

- Source package for regular UI text: `@fontsource/roboto`
- Local TTF sources for MSDF atlases: `assets/common/fonts/*.ttf`
- License: `SIL Open Font License 1.1`
- Local license copy: `assets/common/fonts/Roboto-OFL-1.1.txt`
- Covered scripts for the current localization set: Latin, Cyrillic, Greek, Georgian

Current role mapping:
- `Arial Bold` replacement: `Roboto Bold`
- `Arial Black` replacement: `Roboto Black`
- `Credit balance`: `Roboto Condensed Medium` via MSDF `BitmapText`
- `WIN` line-by-line text: `Roboto Condensed Medium` via MSDF `BitmapText`
- Main `WIN` value: `Roboto Black` via MSDF `BitmapText`

Generated MSDF atlases live in `assets/common/fonts/bitmap/` and are preloaded during app boot.
