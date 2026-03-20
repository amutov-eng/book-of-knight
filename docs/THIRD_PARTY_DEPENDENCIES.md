# Third-Party Dependencies

## Install Rule

Use `npm ci`, not `npm install`, when setting up the project on a new machine.

Why:

- `npm ci` installs exactly what is locked in `package-lock.json`
- all developers and CI get the same dependency tree
- production builds stay reproducible

## Spine Runtime Policy

This project intentionally supports two Spine runtime families at the same time.

- Legacy game assets exported from Spine `3.8.x` use `@pixi-spine/all-3.8`
- New game assets exported for the Pixi 8 compatible runtime use `@esotericsoftware/spine-pixi-v8`

Manifest rule:

- `symbols.frames[].spine.<variant>.runtime = "3.8"` -> legacy symbol Spine runtime
- `symbols.frames[].spine.<variant>.runtime = "4.2"` -> new Pixi 8 compatible Spine runtime

If `runtime` is omitted, the project falls back to `"3.8"` for backward compatibility with older games.

## Why These Packages Are Not Vendored In `libs/`

By default we keep these dependencies in `package.json` + `package-lock.json` instead of copying them into `libs/`.

This is the preferred production setup here because it gives us:

- exact reproducible installs
- simpler CI/CD
- easier security and dependency auditing
- less manual maintenance

## When To Vendor A Dependency

Move a third-party runtime into `libs/` or `vendor/` only if at least one of these is true:

- the team maintains a patched fork
- the package must be frozen independently from npm
- the build must work from a fully offline internal artifact set
- a supplier/regulatory requirement requires vendored source/binaries

## Current Locked Spine Versions

- `@pixi-spine/all-3.8`: `4.0.6`
- `@esotericsoftware/spine-pixi-v8`: `4.2.107`

Keep these versions pinned unless there is a planned migration pass with runtime validation on actual game assets.
