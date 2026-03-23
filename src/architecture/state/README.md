# state/

App-level lifecycle state machines live here.

## Purpose

- keep startup, spin, resolve, and return phases explicit
- guard legal transitions between shell states
- provide a stable lifecycle signal for overlays, telemetry, and orchestration code

## Current Machine

- `LifecycleStateMachine.ts` is the app-shell lifecycle.
- `GameplayEngine.ts` maps legacy controller states onto these lifecycle states.

Use this layer for coarse runtime phases, not detailed reel or win logic.
