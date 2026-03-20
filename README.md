# Book of Knight

Production-oriented PixiJS slot runtime with TypeScript and Vite. The project keeps legacy slot logic alive while progressively moving orchestration, lifecycle, configuration, and rendering ownership into clearer studio-grade modules.

## What This Project Is

- Browser slot game runtime built on PixiJS 8
- Variant-aware desktop/mobile build pipeline
- Manifest-driven asset/layout configuration
- Explicit gameplay lifecycle layered over legacy controller/reels flow

## Requirements

- Node.js 20+
- npm 10+

## Start

```bash
npm install
npm run dev:desktop
```

Mobile variant:

```bash
npm run dev:mobile
```

Builds:

```bash
npm run build:desktop
npm run build:mobile
```

## Dev Workflow

1. Run `npm run dev:desktop` or `npm run dev:mobile`.
2. Change code under `src/`.
3. Validate before merge:

```bash
npm run typecheck
npm run test:config
npm run test:smoke
```

Useful helpers:

```bash
npm run mock:server
npm run localization:build
```

## Runtime Notes

- `scripts/prepare-assets.mjs` prepares `public/assets` before dev/build.
- `VITE_VARIANT=desktop|mobile` selects manifest/layout branch.
- `?lang=ENG|BG|ESP|...` overrides locale.
- `?debugOverlay=1` enables the in-game debug overlay.

## Project Structure

```text
src/
  app/            bootstrap, renderer, ticker, module wiring
    boot/         startup asset bootstrap and intro/prompt flow
  architecture/   lifecycle, gameplay orchestration, reel adapters
  config/         manifest-driven config readers and constants
  core/           base runtime primitives and shared utilities
  game/           slot domain logic, reels, controller, outcome model
  localization/   localization loading/service
  net/            websocket transport and server outcome mapping
  ui/             HUD, overlays, menus, screen composition
  types/          shared contracts and event payloads
```

## Core Modules

- `src/app/App.ts`: app shell, boot sequence, ticker, render loop
- `src/app/boot/LoadingAssetBootstrap.ts`: manifest planning, startup asset loading, texture registration, symbol-region bootstrap
- `src/app/boot/IntroSequenceCoordinator.ts`: boot intro, sound prompt, gameplay intro sequencing
- `src/app/wireGameModules.ts`: composition root for runtime modules
- `src/architecture/gameplay/GameplayEngine.ts`: bridges controller/gameplay states into lifecycle events
- `src/architecture/gameplay/GameplayStateMachine.ts`: deterministic spin lifecycle state machine
- `src/game/Controller.ts`: legacy gameplay coordinator with explicit state-change hooks
- `src/game/Reels.ts`: reel aggregation, line layer, stop-symbol application
- `src/core/BaseReel.ts`: reel motion and symbol recycling hot path
- `src/net/GsLink.ts`: server protocol mapping and pooled win objects

## Documentation

- [ARCHITECTURE.md](/home/amutov/projects/book-of-knight/trunk/ARCHITECTURE.md)
- [JUNIOR_GUIDE.md](/home/amutov/projects/book-of-knight/trunk/JUNIOR_GUIDE.md)
- [AI_AGENT_GUIDE.md](/home/amutov/projects/book-of-knight/trunk/AI_AGENT_GUIDE.md)
- [REFACTOR_NOTES.md](/home/amutov/projects/book-of-knight/trunk/REFACTOR_NOTES.md)
- [PERFORMANCE_GUIDE.md](/home/amutov/projects/book-of-knight/trunk/PERFORMANCE_GUIDE.md)

The legacy `docs/` folder is still useful for deeper background and migration history.

## Current Refactor Focus

The latest production pass tightened the startup path:

- `LoadingScreen` is now an orchestration shell instead of a mixed asset/introduction God object
- asset bootstrap responsibilities live in `src/app/boot/LoadingAssetBootstrap.ts`
- intro and boot prompt responsibilities live in `src/app/boot/IntroSequenceCoordinator.ts`
- HUD bitmap font ownership is manifest-driven for the main production text surfaces
