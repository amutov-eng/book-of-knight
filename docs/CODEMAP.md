# Code Map

This file is a practical map for developers who are new to the project.

## Runtime Entry

- `src/app.ts`: browser entry point
- `src/app/bootstrap.ts`: boot sequence (`App.init()` + `App.start()`)
- `src/app/App.ts`: top-level runtime shell

## App Wiring Layer

- `src/app/wireGameModules.ts`: central place where gameplay modules are instantiated and wired
- `src/app/types.ts`: runtime composition types used by app bootstrap
- `src/app/createRenderer.ts`: renderer bootstrap through `BaseGame`
- `src/app/createTicker.ts`: single ticker ownership

## Core Layer

- `src/core/BaseGame.ts`: renderer/stage and screen switching shell
- `src/core/BaseScreen.ts`: screen abstraction
- `src/core/BaseReel.ts`: low-level reel spin/stop math and rendering behavior
- `src/core/events/EventBus.ts`: typed event bus
- `src/core/time/Timers.ts`: frame-driven timer utility
- `src/core/assets/*`: atlas/asset management

## Gameplay Orchestration

- `src/game/Controller.ts`: gameplay coordinator
- `src/architecture/gameplay/GameplayStateMachine.ts`: spin lifecycle states and transitions
- `src/architecture/gameplay/GameplayEngine.ts`: controller + server + lifecycle bridge

## Reel Stack

- `src/game/Reels.ts`: reels orchestration
- `src/game/ReelSymbol.ts`: symbol display unit
- `src/core/BaseReel.ts`: movement, stop behavior, strip stepping
- `src/config/reelConfig.ts` + manifest layout: reel config source

## UI Layer

- `src/ui/MainScreen.ts`: main visual scene assembly
- `src/ui/Menu.ts`: HUD buttons/meters/start-stop/autoplay stop badge
- `src/ui/BetMenu.ts`: bet selection modal
- `src/ui/AutoPlayMenu.ts`: autoplay selection modal
- `src/ui/ServerErrorModal.ts`: connection/protocol error modal

## Network / Outcome Mapping

- `src/net/GsLink.ts`: websocket lifecycle, protocol parsing, session messages
- `src/game/GameOutcome.ts`: outcome data model consumed by gameplay/reels

## Config Layer

- `src/config/assetsConfig.ts`: manifest loading/validation/resolvers
- `src/config/displayConfig.ts`: stage/display targets
- `src/config/gameRules.ts`: gameplay constants
- `src/config/stripsConfig.ts`: sensitive strip sets (not in assets)
- `src/config/localizationConfig.ts`: localization source and defaults

## Assets / Data Source of Truth

- `assets/common/assets-manifest.common.json`
- `assets/desktop/assets-manifest.desktop.json`
- `assets/mobile/assets-manifest.mobile.json`
- `assets/common/localization/translations.json`

## Legacy Reference (Read-Only)

- `old-java-project/*` contains original LibGDX implementation for parity checks.
- Do not copy architecture patterns 1:1; use it as behavior reference only.
