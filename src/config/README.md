# config/

Centralized runtime configuration readers and static defaults.

## What Lives Here

- environment and variant resolution
- assets-manifest loading and validation
- display/layout/gameplay defaults
- static domain constants such as strips and game rules

## Expected Flow

1. Resolve `desktop` or `mobile` via `runtimeConfig.ts`.
2. Load and merge `assets/assets-manifest.common.json` with `assets/assets-manifest.<variant>.json`.
3. Read variant/layout-specific branches through config helpers instead of hardcoding values in UI or gameplay modules.

## Runtime Knobs

- App shell URL params live in `src/app/runtimeConfig.ts`.
  Current flag: `?debugOverlay=1`
- Shared gameplay timing lives in `assets/common/assets-manifest.common.json`.
- Variant-only layout and visual tuning stays in `assets/<variant>/assets-manifest.<variant>.json`.

Prefer adding new knobs to manifests or config helpers before introducing inline constants elsewhere.
