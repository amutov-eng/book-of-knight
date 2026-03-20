# Refactor Notes

## Audit Summary

### Architectural Problems Found

- Runtime contained both new orchestration modules and legacy control flow, with unclear ownership boundaries.
- `GameplayEngine` relied on monkey-patching `Controller` and `GsLink` methods at runtime.
- `App` duplicated gameplay-to-lifecycle bridging already implied by gameplay orchestration.
- Reel timing logic was split between state-machine logic and browser timers.

### Rendering / Performance Problems Found

- Reel auto-stop scheduling used raw `setTimeout`, outside the shared frame-timer pipeline.
- Hot-path ownership was spread across `Reels`, `Controller`, and `GsLink` without explicit event contracts.
- Legacy `BaseReel.ts` remains `ts-nocheck` and still carries old Pixi/global assumptions.

### Maintainability Problems Found

- Many files still use legacy naming and implicit coupling.
- Docs existed, but not in the requested handoff format for juniors and AI agents.
- Event semantics around spin start/result were under-specified.

## What Changed

- Added explicit `Controller` hooks for:
  - state changes
  - successful spin start
- Added explicit `GsLink` hook for:
  - outcome application completion
- Refactored `GameplayEngine` to subscribe to those hooks instead of monkey-patching methods.
- Removed redundant app-level event bridge from `App.ts`.
- Added `ReelSpinScheduler` to move reel auto-stop scheduling onto shared frame-driven timers.
- Added typed event payloads for gameplay/lifecycle events.
- Added requested root-level documentation files.
- Extracted startup responsibilities out of `LoadingScreen` into:
  - `src/app/boot/LoadingAssetBootstrap.ts`
  - `src/app/boot/IntroSequenceCoordinator.ts`
- Reduced `LoadingScreen` to a startup orchestration shell.
- Centralized startup manifest planning, prompt preload, intro flow, and symbol-region bootstrap behind narrower modules.

## Why It Changed

- Explicit subscriptions are easier to reason about than hidden runtime method overrides.
- Frame-driven timers are more predictable in slot-game flow than ad-hoc browser timers.
- Typed event payloads reduce accidental coupling and make debugging easier.
- Better documentation lowers onboarding cost for junior engineers and coding agents.

## Legacy Pieces Still Present

- `src/core/BaseReel.ts` is still legacy-heavy and `ts-nocheck`.
- Several UI modules remain `ts-nocheck`.
- The current `Controller` still drives a large part of the gameplay flow directly.
- Feature hooks for free spins / hold-and-win exist in data but are not yet split into dedicated feature modules.
- `src/ui/MainScreen.ts` still mixes scene composition and per-frame update ownership and is a good candidate for a future split.

## Remaining Technical Debt

- Strictly type `BaseReel`, `Menu`, and `LocalizationService`.
- Split `GsLink.ts` into transport, response mapping, and session/config responsibilities.
- Break `Menu.ts` into smaller HUD/button/panel modules.
- Move reel stop timings into manifest/config instead of local defaults.
- Add dedicated feature modules for bonus/free-spins/hold-and-win flow.

## Recommended Next Improvements

1. Replace legacy global Pixi usage inside `BaseReel.ts` with typed Pixi imports.
2. Extract a dedicated `SpinResultPipeline` from `GsLink.ts`.
3. Split `MainScreen.ts` into composition plus runtime presenter/update delegates.
4. Add dedicated effect pools for transient win overlays and symbol FX.
5. Add automated tests for:
   - failed spin start
   - forced stop
   - no-win resolve
   - win presentation to return-to-idle flow
