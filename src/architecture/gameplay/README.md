# gameplay/

Runtime spin orchestration lives here.

## Main Flow

1. UI or keyboard input raises `GameplayEvent.START`.
2. `GameplayStateMachine.ts` advances through spin, stop, win presentation, and credit transfer states.
3. `systems/SpinSystem.ts` starts the server spin and reel motion.
4. `systems/WinPresentationSystem.ts` highlights wins, updates line rendering, and formats win text.
5. `systems/MeterTransferSystem.ts` moves the on-screen win into credits.

## Timing Source

- Gameplay timing is manifest-driven through `src/config/gameplayConfig.ts`.
- Shared values live in `assets/common/assets-manifest.common.json`.
- Timing values are frame ticks, not seconds.

## Important Interrupts

- `REELS_SPINNING` / `REELS_STOPPING`: `START` force-stops reels.
- `SHOW_WINS`: `START` skips single-line enumeration and enters `SHOW_ALL_WINNING_LINES`.
- `SHOW_ALL_WINNING_LINES`: lines are temporarily rendered above symbols, then the normal layer order is restored on exit.

## Ownership Split

- `GameplayStateMachine.ts` owns controller-facing state nodes and timing guards.
- `GameplayEngine.ts` mirrors controller state changes onto lifecycle/debug events for the app shell.
- `systems/` contains focused helpers for spin start, win presentation, and meter transfer.
