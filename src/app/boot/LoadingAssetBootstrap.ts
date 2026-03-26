import type BaseGame from '../../core/BaseGame';
import { Assets } from 'pixi.js';
import '@pixi-spine/all-3.8';
import AssetManager from '../../core/assets/AssetManager';
import {
  getAnimationAtlases,
  getBackgroundKeys,
  getLoadingManifest,
  getManifestValidationErrors,
  getReelLayerKeys,
  getSymbolAtlases,
  getSymbolFrameDefsByIndex,
  getSymbolWinAnimationProfiles,
  loadAssetsManifest
} from '../../config/assetsConfig';
import { getTextureCache, setAssetManager, setAssetsManifest } from '../../core/RuntimeContext';
import { getMaxStripSymbolIndex } from '../../config/stripsConfig';
import { SOUND_IDS } from '../../config/soundConfig';
import { warn } from '../../core/utils/logger';
import type Textures from '../../game/Textures';

type PixiTexture = import('pixi.js').Texture;
type AssetResource = {
  texture?: PixiTexture;
  textures?: Record<string, PixiTexture>;
};

type LoadingGame = BaseGame & Record<string, any>;
type RuntimeTextures = Textures & {
  regions: PixiTexture[][];
  symbolOffsets: Array<{ x: number; y: number }>;
  symbolWinProfiles: string[];
  symbolWinAnimations: Record<string, unknown>;
  symbolSpineConfigs: Array<Record<string, unknown> | null>;
  symbolSpineResources: Record<string, unknown>;
  winFrames: PixiTexture[];
};

export type ManifestLoadResult = {
  manifest: unknown;
  assetPaths: string[];
  validationErrors: string[];
};

/**
 * Owns startup-only asset work required before `MainScreen` can take over.
 *
 * This class resolves the manifest, preloads startup assets, warms sound bundles,
 * and populates the runtime texture/symbol caches consumed by the legacy game modules.
 */
export default class LoadingAssetBootstrap {
  private readonly game: LoadingGame;
  private readonly variant: string;
  private readonly assetManager: AssetManager;

  constructor(game: LoadingGame, variant: string) {
    this.game = game;
    this.variant = variant;
    this.assetManager = new AssetManager({ textureCache: getTextureCache() });
    setAssetManager(this.assetManager);
  }

  /**
   * Loads the active assets manifest and derives the startup asset list from it.
   */
  async loadManifestPlan(): Promise<ManifestLoadResult> {
    const manifest = await loadAssetsManifest(this.variant as any);

    return {
      manifest,
      assetPaths: getLoadingManifest(manifest),
      validationErrors: getManifestValidationErrors()
    };
  }

  /**
   * Loads startup assets and eagerly preloads manifest-driven symbol spine clips.
   */
  async loadAssets(
    assetPaths: string[],
    onProgress?: (progress: number, assetPath: string) => void,
    manifest?: unknown
  ): Promise<Record<string, AssetResource>> {
    const resources = await this.assetManager.loadAll(assetPaths, onProgress);
    await this.preloadSymbolSpineAssets(manifest);
    if (this.game.gameplaySpineOverlay && typeof this.game.gameplaySpineOverlay.preload === 'function') {
      await this.game.gameplaySpineOverlay.preload();
    }
    return resources;
  }

  /**
   * Loads the minimal atlas set needed by the boot sound prompt UI.
   */
  async preloadPromptAssets(): Promise<Record<string, AssetResource>> {
    return this.loadAssets(['assets/ui/menu_buttons-0.json']);
  }

  /**
   * Preloads only the sounds that may play before the main game screen appears.
   */
  async preloadPromptSounds(): Promise<void> {
    if (!this.game.soundSystem) return;
    await this.game.soundSystem.preload([SOUND_IDS.SPIN_BACKGROUND, SOUND_IDS.KNOCK]);
  }

  /**
   * Preloads the main gameplay sound bundle while boot UI continues in parallel.
   */
  async preloadGameplaySounds(): Promise<void> {
    if (!this.game.soundSystem) return;
    await this.game.soundSystem.preload([
      SOUND_IDS.SPIN_BACKGROUND,
      SOUND_IDS.COINUP,
      SOUND_IDS.COINEND,
      SOUND_IDS.REEL_STOP,
      SOUND_IDS.KNOCK,
      SOUND_IDS.BEEP_STAR,
      SOUND_IDS.BEEP_SUN,
      SOUND_IDS.LOW_WIN,
      SOUND_IDS.HIGH_WIN,
      SOUND_IDS.SCATTER
    ]);
  }

  /**
   * Registers loaded textures and rebuilds symbol metadata required by reels/wins.
   *
   * Returns `false` when the manifest is incomplete for the currently configured strips.
   */
  applyLoadedResources(manifest: unknown, resources: Record<string, AssetResource>): boolean {
    setAssetsManifest(manifest);
    const textureCache = getTextureCache() as Record<string, PixiTexture>;

    this.cacheAtlasTextures(manifest, resources, textureCache);
    this.cacheBackgroundTextures(manifest, resources, textureCache);

    return this.initializeSymbolRegions(manifest);
  }

  private cacheAtlasTextures(
    manifest: unknown,
    resources: Record<string, AssetResource>,
    textureCache: Record<string, PixiTexture>
  ): void {
    const atlasPaths = [...getSymbolAtlases(manifest), ...getAnimationAtlases(manifest)];

    for (let i = 0; i < atlasPaths.length; i += 1) {
      const atlasPath = atlasPaths[i];
      if (resources[atlasPath] && resources[atlasPath].textures) {
        Object.assign(textureCache, resources[atlasPath].textures);
      }
    }
  }

  private cacheBackgroundTextures(
    manifest: unknown,
    resources: Record<string, AssetResource>,
    textureCache: Record<string, PixiTexture>
  ): void {
    const allBackgroundKeys = [...new Set([...getBackgroundKeys(manifest), ...getReelLayerKeys(manifest)])];

    for (let i = 0; i < allBackgroundKeys.length; i += 1) {
      const textureKey = allBackgroundKeys[i];
      if (!textureKey) continue;
      if (resources[textureKey] && resources[textureKey].texture) {
        textureCache[textureKey] = resources[textureKey].texture as PixiTexture;
      }
    }
  }

  private initializeSymbolRegions(manifest: unknown): boolean {
    const symbolDefs = getSymbolFrameDefsByIndex(manifest);

    if (symbolDefs.length === 0) {
      warn('LoadingAssetBootstrap::symbols not configured (missing assets manifest or symbols.frames).');
      return false;
    }

    const textures = this.game.textures as RuntimeTextures;

    textures.regions = [];
    textures.symbolOffsets = [];
    textures.symbolWinProfiles = [];
    textures.symbolWinAnimations = getSymbolWinAnimationProfiles(manifest);
    textures.symbolSpineConfigs = [];
    textures.symbolSpineResources = textures.symbolSpineResources || {};

    for (let i = 0; i < symbolDefs.length; i += 1) {
      const symbolDef = symbolDefs[i];
      textures.regions.push(textures.findFrames(symbolDef.prefix, symbolDef.atlas));
      textures.symbolOffsets.push({
        x: Number.isFinite(symbolDef.offsetX) ? symbolDef.offsetX : 0,
        y: Number.isFinite(symbolDef.offsetY) ? symbolDef.offsetY : 0
      });
      textures.symbolWinProfiles.push(symbolDef.winProfile || 'normal');
      textures.symbolSpineConfigs.push(symbolDef.spine || null);
    }

    textures.winFrames = textures.findFrames('frame_', 'assets/animations/win-0.json');

    const maxStripIndex = getMaxStripSymbolIndex();
    if (maxStripIndex >= textures.regions.length) {
      warn(`LoadingAssetBootstrap::symbol index map too short for strips (max strip index: ${maxStripIndex}, loaded: ${textures.regions.length})`);
      return false;
    }

    for (let i = 0; i <= maxStripIndex; i += 1) {
      const regionFrames = textures.regions[i];
      if (!regionFrames || regionFrames.length === 0) {
        warn(`LoadingAssetBootstrap::missing symbol frames for index ${i}`);
        return false;
      }
    }

    return true;
  }

  /**
   * Preloads optional symbol-specific Spine assets declared in the manifest.
   *
   * The runtime prefers delegating this to `symbolSpineOverlay` when available so the
   * active overlay implementation can own resource format details.
   */
  private async preloadSymbolSpineAssets(manifest: unknown): Promise<void> {
    if (this.game.symbolSpineOverlay && typeof this.game.symbolSpineOverlay.preloadFromManifest === 'function') {
      await this.game.symbolSpineOverlay.preloadFromManifest(manifest);
      return;
    }

    const symbolDefs = getSymbolFrameDefsByIndex(manifest);
    const pending = new Map<string, { jsonPath: string; atlasPath: string }>();

    for (let i = 0; i < symbolDefs.length; i += 1) {
      const spineConfig = symbolDefs[i] && symbolDefs[i].spine ? symbolDefs[i].spine : null;
      if (!spineConfig || typeof spineConfig !== 'object') continue;

      const variantKeys = Object.keys(spineConfig);
      for (let keyIndex = 0; keyIndex < variantKeys.length; keyIndex += 1) {
        const key = variantKeys[keyIndex];
        const clip = spineConfig[key];
        if (!clip || typeof clip !== 'object') continue;
        if (typeof clip.jsonPath !== 'string' || typeof clip.atlasPath !== 'string') continue;
        pending.set(`${clip.jsonPath}|${clip.atlasPath}`, {
          jsonPath: clip.jsonPath,
          atlasPath: clip.atlasPath
        });
      }
    }

    const clips = [...pending.values()];
    for (let i = 0; i < clips.length; i += 1) {
      const clip = clips[i];
      try {
        const resource = await Assets.load({
          src: clip.jsonPath,
          data: {
            spineAtlasFile: clip.atlasPath
          }
        });
        const textures = this.game.textures as RuntimeTextures;
        if (textures && textures.symbolSpineResources) {
          textures.symbolSpineResources[`${clip.jsonPath}|${clip.atlasPath}`] = resource;
        }
      } catch (_error) {
        warn(`LoadingAssetBootstrap::skipMissingSymbolSpine ${clip.jsonPath}`);
      }
    }
  }
}
