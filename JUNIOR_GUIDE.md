# Junior Guide

## Read This First

This is a slot game. The risky parts are not the buttons or labels. The risky parts are:

- spin lifecycle
- reel stopping
- server outcome application
- win presentation
- credit/win meter updates

If you change those areas carelessly, the game may still render but will behave incorrectly.

## Simple Map

- `src/app/`
  Starts the game.
- `src/architecture/`
  Controls high-level flow.
- `src/game/`
  Contains actual slot logic.
- `src/ui/`
  Draws menus, overlays, and screens.
- `src/net/GsLink.ts`
  Talks to the server.

## Most Important Files

- `src/app/App.ts`
  Main app loop.
- `src/architecture/gameplay/GameplayStateMachine.ts`
  The spin flow rules.
- `src/game/Controller.ts`
  The gameplay coordinator.
- `src/game/Reels.ts`
  Manages all reels together.
- `src/core/BaseReel.ts`
  Low-level reel movement and symbol recycling.
- `src/net/GsLink.ts`
  Applies server results to game state.

## How Not To Break The Game

- Do not change `Controller.state` directly. Use the existing state machine flow.
- Do not apply server outcome data inside UI components.
- Do not call `renderer.render()` from feature code.
- Do not add raw `setTimeout()` in gameplay or reel flow unless there is no timer service available.
- Do not create/destroy symbols every spin. Reuse existing reel symbols.

## Safe Small Feature Example

If you need to add a small HUD label:

1. Add the display object in `src/ui/Menu.ts`.
2. Read any text/config from `src/config/` or localization.
3. Update it from existing menu update methods.
4. Run:

```bash
npm run typecheck
npm run test:smoke
```

## Safe Debugging Workflow

1. Start with `src/architecture/gameplay/GameplayStateMachine.ts`.
2. Confirm the current controller state.
3. Check `src/net/GsLink.ts` to see if the outcome was applied.
4. Check `src/game/Reels.ts` and `src/core/BaseReel.ts` if visuals do not match the result.
5. Use `?debugOverlay=1` when you need lifecycle visibility.

## Critical Areas

- `BaseReel.ts`
  Hot path. Small mistakes here can cause visual glitches or performance regressions.
- `GsLink.ts`
  Wrong mapping here causes wrong wins, meters, or stuck spins.
- `GameplayStateMachine.ts`
  Wrong transition logic can soft-lock the game.

## Rule Of Thumb

If a change affects spin start, reel stop, win count, or credit balance, test a full spin cycle manually after the code change.
