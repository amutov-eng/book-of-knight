# app/

Runtime composition layer.

## Responsibilities

- bootstrap the browser app entry point
- create renderer and RAF ticker
- resolve URL-driven runtime flags and locale
- wire gameplay services onto `BaseGame`
- own boot-time lifecycle transitions while gameplay runtime emits `spin:started`, `spin:resultReceived`, and `spin:resolved`

## Main Files

- `bootstrap.ts`: smallest entry point used by `src/app.ts`
- `App.ts`: orchestration shell for init/start/stop and lifecycle transitions
- `runtimeConfig.ts`: query-string driven app flags such as `debugOverlay`
- `wireGameModules.ts`: centralized module construction order
- `types.ts`: shared runtime shapes passed across app/gameplay layers

## Boot Sequence

1. `bootstrap.ts` creates `App`.
2. `App.init()` preloads fonts, creates the Pixi renderer, and resolves localization from `?lang=...`.
3. `wireGameModules.ts` attaches the legacy gameplay modules onto `BaseGame`.
4. `LoadingScreen` delegates startup loading to `boot/LoadingAssetBootstrap.ts`.
5. `LoadingScreen` delegates intro/sound-prompt flow to `boot/IntroSequenceCoordinator.ts`.

## Runtime Params

- `?lang=ENG|BG|ESP|...` maps legacy host locale codes to the runtime locale.
- `?debugOverlay=1` enables the debug overlay; the backquote key still toggles visibility at runtime.

Keep this layer orchestration-only. Gameplay rules and UI details should stay in their own modules.
