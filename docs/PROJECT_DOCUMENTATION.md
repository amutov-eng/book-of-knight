# Project Documentation

## Runtime Summary

- Entry: `src/app.ts`
- App shell: `src/app/App.ts`
- Build: Vite (`vite.config.ts`)
- Language: TypeScript (`.ts` in `src/`)

## Build and Run

```bash
npm install
npm run dev:desktop
npm run dev:mobile
npm run build:desktop
npm run build:mobile
```

## Validation Commands

```bash
npm run typecheck
npm run test:config
npm run test:smoke
```

## Directory Summary

- `src/app`: bootstrap/composition
- `src/core`: reusable runtime primitives
- `src/architecture`: lifecycle/gameplay orchestration
- `src/game`: gameplay domain modules
- `src/ui`: screens and menus
- `src/net`: websocket/server integration
- `src/config`: manifest and config resolvers
- `src/types`: shared domain/event types
- `assets`: variant assets/manifests/localization

## Manifest System

Primary manifests:

- `assets/common/assets-manifest.common.json`
- `assets/desktop/assets-manifest.desktop.json`
- `assets/mobile/assets-manifest.mobile.json`

Resolved by:

- `src/config/assetsConfig.ts`

Manifest should control:

- Shared gameplay timing and runtime tuning
- UI positions/sizes/colors/fonts
- Reel geometry values
- Atlas lists and symbol offsets

## Key Flows

### Spin flow

- UI/Controller triggers spin event
- `GameplayStateMachine` transitions across spin states
- `GsLink` receives server outcome
- `Reels` and `Menu` update visuals/meters

### Error flow

- Connection/protocol error in `GsLink`
- UI shows `ServerErrorModal`
- Gameplay input is blocked until recovery/reload

## Dev References

- `docs/START_HERE.md`
- `docs/CODEMAP.md`
- `docs/FEATURE_WORKFLOW.md`
- `docs/REELS_TROUBLESHOOTING.md`
