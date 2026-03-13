# Performance Guide

## Core Principles

- Keep the frame loop predictable.
- Keep render-critical code separate from business logic.
- Reuse objects whenever possible.
- Avoid allocations inside per-frame reel updates.

## Rendering Rules

- `App` should own the only render call per frame.
- Avoid unnecessary child reordering during active spins.
- Avoid adding extra nested containers unless they carry a clear visual/layering purpose.
- Treat masks, alpha changes, filters, and texture swaps as expensive until proven otherwise.

## Reel Rules

- Reuse reel symbols; do not recreate them every spin.
- Keep stop-symbol application outside the per-frame update loop.
- Use shared frame timers or deterministic state transitions for stop orchestration.
- Prefer direct indexed access over repeated array transforms in reel paths.

## Object Pooling Rules

- Pool win objects, effect objects, and transient overlays.
- Reset pooled instances fully before reuse.
- Cap pool size to realistic production limits.
- If an effect is short-lived and frequently recreated, it should be a pooling candidate.

## Animation / Update Loop Rules

- Avoid hidden timers in gameplay hot paths.
- Clamp long frame gaps before simulation work.
- Keep per-frame logic branch-light and allocation-free where possible.
- Update only the actors that actually need updates.

## Anti-Patterns To Avoid

- Raw `setTimeout` chains for core spin flow
- create/destroy loops for symbols or win FX
- server adapters directly mutating presentation objects
- UI code deciding gameplay state transitions
- gameplay code calling renderer methods directly

## Mobile/Web Production Notes

- Assume lower GPU/CPU headroom than desktop.
- Keep draw-call pressure low by avoiding unnecessary layers and state changes.
- Prefer stable display trees over frequent display-list churn.
- Test forced-stop and win-presentation behavior on slower devices, not only desktop Chrome.
