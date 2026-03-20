# Architecture

## High-Level

The runtime is split into five practical layers:

1. `app`
   Bootstraps renderer, localization, timers, ticker, and module composition.
   The `app/boot` slice owns startup asset planning and intro/prompt sequencing.
2. `architecture`
   Owns lifecycle state, gameplay orchestration, and reel-facing adapters.
3. `game`
   Owns slot-domain behavior: controller, reels, symbols, outcomes, meters.
4. `ui`
   Owns HUD, menus, overlays, and top-level screens.
5. `net`
   Owns websocket communication and server-response mapping.

## Module Responsibilities

- `src/app/App.ts`
  Owns startup order, frame loop, renderer calls, and top-level lifecycle transitions during boot.
- `src/app/wireGameModules.ts`
  Composition root. Instantiate new runtime modules here instead of scattering constructors across the app.
- `src/app/boot/LoadingAssetBootstrap.ts`
  Boot asset planning and texture bootstrap. Owns manifest load, startup asset lists, texture-cache population, and symbol-region registration.
- `src/app/boot/IntroSequenceCoordinator.ts`
  Boot presentation coordinator. Owns boot intro, pre-sound prompt priming, prompt presentation, and gameplay intro playback.
- `src/architecture/state/LifecycleStateMachine.ts`
  Canonical app/game lifecycle: `boot -> preload -> intro -> idle -> spin -> resolve -> winPresentation -> return -> idle`.
- `src/architecture/gameplay/GameplayEngine.ts`
  Bridges legacy `Controller` and `GsLink` into explicit lifecycle/events using subscriptions instead of runtime monkey-patching.
- `src/architecture/gameplay/GameplayStateMachine.ts`
  Spin flow state machine.
- `src/game/Controller.ts`
  Frame-driven gameplay coordinator. Emits state-change and spin-start hooks.
- `src/game/Reels.ts`
  Reel aggregate, reel-view/controller registry, line-layer ownership, stop-symbol application.
- `src/game/reels/ReelSpinScheduler.ts`
  Frame-driven reel auto-stop scheduling built on shared app timers.
- `src/core/BaseReel.ts`
  Render-critical symbol recycling, stop alignment, blur frames, trimming, and highlight plumbing.
- `src/net/GsLink.ts`
  Server outcome normalization, pooled win creation, meter updates, and result publication.

## Data Flow

1. `Menu` or keyboard sets `Controller.event = START`.
2. `GameplayStateMachine` moves from `IDLE` to `START_SPIN`.
3. `Controller.startSpin()` delegates to `SpinSystem`.
4. `SpinSystem` validates balance/connection, starts reels, triggers server spin, updates HUD state.
5. `GsLink` receives the server outcome, normalizes it, updates meters/context, pools win objects, and publishes result application.
6. `GameplayEngine` receives controller and result events, then synchronizes lifecycle state and emits typed runtime events.
7. `GameplayStateMachine` drives stop, win presentation, win-to-credit, and return-to-idle flow.

Boot flow before gameplay:

1. `App` enters preload and creates `LoadingScreen`.
2. `LoadingScreen` requests a manifest plan from `LoadingAssetBootstrap`.
3. `IntroSequenceCoordinator` starts the boot intro in parallel.
4. Prompt assets and prompt audio are preloaded while the intro is running.
5. The sound prompt is primed, presented, and resolved.
6. Main gameplay assets are applied to texture cache and symbol regions.
7. `MainScreen` becomes active and gameplay intro runs.

## Rendering Flow

1. `App.tick()` updates shared timers.
2. `MainScreen.act()` updates gameplay first, then display actors.
3. `Reels.act()` updates each reel view.
4. `BaseReel.act()` advances reel motion, recycles symbols, updates blur/highlight state.
5. `App` renders the active screen stage exactly once per frame.

Critical rule:
Business logic should not trigger arbitrary render calls or browser timers from inside the reel path.

## Spin Lifecycle

1. `idle`
2. `bet update`
3. `spin start`
4. `reels spinning`
5. `reels stopping`
6. `result applied`
7. `win presentation`
8. `feature trigger`
9. `return`
10. `idle`

The current project fully supports the base lifecycle. Bonus/free-spin/hold-and-win hooks are partially present in outcome/context data and should plug in after `resolve`.

## Event Flow

Key typed events live in `src/types/events.ts`.

- `gameplay:stateChanged`
- `spin:started`
- `spin:resultReceived`
- `spin:resolved`
- `lifecycle:changed`

Use these for orchestration and debugging. Do not wire new features by monkey-patching `Controller` or `GsLink`.

## Where To Add Features

- New bonus/free-spin state:
  extend `GameplayStateMachine.ts`, keep lifecycle transitions valid, map server data in `GsLink.ts`.
- New symbol/effect behavior:
  prefer `Reels.ts`, `BaseReel.ts`, or dedicated `game/reels/*` helpers.
- New HUD controls:
  add in `ui/Menu.ts` or dedicated child menu components.
- New config-driven timing/layout:
  add a config reader under `src/config/` and consume it from the owning module.

## Current Architectural Boundaries

- `App` owns startup and frame loop.
- `LoadingAssetBootstrap` owns startup asset registration, not `LoadingScreen`.
- `IntroSequenceCoordinator` owns intro/prompt presentation, not `LoadingScreen`.
- `GameplayEngine` owns lifecycle synchronization.
- `Controller` owns gameplay-state progression.
- `GsLink` owns server mapping, not screen rendering.
- `Reels` owns reel display aggregation, not business decisions.
