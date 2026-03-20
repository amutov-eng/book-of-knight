# AI Agent Guide

## Primary Rule

Preserve deterministic slot flow. Do not trade correctness for shorter code.

## Safe Change Rules

- Inspect before editing. Do not assume the new architecture fully replaced the legacy one.
- Treat `src/app/wireGameModules.ts` as the composition root.
- Keep `App` as the only owner of the frame loop and render call.
- Keep startup asset orchestration inside `src/app/boot/`, not inside random screens or UI components.
- Keep `GameplayEngine` as the bridge between legacy gameplay flow and lifecycle/events.
- Keep `GsLink` focused on transport/result mapping, not presentation.
- Keep `Reels` focused on reel display aggregation, not business-state decisions.

## Architectural Boundaries To Respect

- Do not monkey-patch `Controller` or `GsLink` from random modules.
- Do not move server outcome application into UI.
- Do not add network logic to reel classes.
- Do not mix intro flow, sound prompt flow, and asset cache population inside one screen when a boot helper can own it.
- Do not put feature-specific timers in render-critical classes when `Timers` can be used.
- Do not mix old and new flow abstractions in the same file without deleting the redundant path.
- Keep symbol Spine runtime choice in the manifest, not hardcoded in reel logic.
- Keep reel viewport/mask ownership in `src/game/reels/ReelViewportMask.ts`, not inside unrelated reel state or UI code.
- Keep HUD drawing logic in `src/ui/hud/*` and keep `src/ui/Menu.ts` as a coordinator.
- Keep line-presentation timing in `WinPresentationOrchestrator`, not in generic controller counters.

## Naming Conventions

- Prefer explicit nouns for managers/coordinators: `GameplayEngine`, `ReelSpinScheduler`.
- Prefer verbs for single actions: `startSpin`, `stopReel`, `updateStopSymbols`.
- Use `*Config` for config readers and static definitions.
- Use `*StateMachine` only for deterministic transition owners.

## Refactor Rules

- Prefer extraction over in-place growth.
- Remove dead legacy code when replacing it.
- Replace hidden coupling with explicit subscriptions or typed payloads.
- Keep file roles narrow and clear.
- Avoid introducing new `any` paths unless surrounding legacy code forces it.

## Performance Rules

- Avoid per-frame allocations in reel/symbol/update paths.
- Prefer pooling or reuse for win objects, symbols, transient visuals.
- Avoid repeated `setTimeout`/`setInterval` in gameplay loops; prefer frame timers.
- Avoid unnecessary container nesting and child reordering during active spins.
- Do not trigger expensive texture/filter/mask changes every frame unless required.
- Treat reel mask rebuilds as expensive. Reuse mask objects and only switch viewport mode when the reel state changes.
- Avoid scattering win-presentation delay logic across state-machine branches; centralize it in the orchestrator.

## Symbol Spine Rules

- Configure symbol Spine clips under `symbols.frames[].spine.<variant>`.
- Use `runtime: "3.8"` for legacy Spine 3.8 assets and `runtime: "4.2"` for newer Pixi 8 compatible exports.
- Do not assume one Spine runtime fits all games; keep playback versioned per clip.

## How To Add A Feature Safely

1. Map where the feature belongs: `app`, `architecture`, `game`, `ui`, or `net`.
2. If the feature affects startup or pre-game flow, prefer `src/app/boot/`.
3. Add data/config first if the feature is configuration-driven.
4. Extend the gameplay state machine only if lifecycle changes are required.
5. Keep new rendering code out of server adapters.
6. Validate with:

```bash
npm run typecheck
npm run test:config
npm run test:smoke
```

## High-Risk Files

- `src/core/BaseReel.ts`
- `src/net/GsLink.ts`
- `src/architecture/gameplay/GameplayStateMachine.ts`
- `src/ui/Menu.ts`
- `src/ui/screens/LoadingScreen.ts`

Changes there require extra care and a full spin-cycle sanity check.
