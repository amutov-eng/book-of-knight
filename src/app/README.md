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

Keep this layer orchestration-only. Gameplay rules and UI details should stay in their own modules.
