# boot/

Startup-only helpers used by `LoadingScreen`.

## Responsibilities

- resolve the asset manifest and startup asset list
- preload prompt/gameplay sounds needed during boot
- populate runtime texture caches and symbol-region metadata
- coordinate the boot intro, sound prompt, and gameplay intro

## Main Flow

1. `LoadingAssetBootstrap.loadManifestPlan()` resolves the manifest and loading asset list.
2. `LoadingScreen` starts the boot intro while assets load in parallel.
3. `IntroSequenceCoordinator` primes and presents the sound prompt once the boot intro is done.
4. `LoadingAssetBootstrap.applyLoadedResources()` registers textures and symbol metadata.
5. `LoadingScreen` switches to `MainScreen` and optionally plays the gameplay intro.

Keep this folder limited to startup orchestration. Gameplay-time systems belong outside boot.
