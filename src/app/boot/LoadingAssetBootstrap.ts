import type BaseGame from '../../core/BaseGame';
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
  winFrames: PixiTexture[];
};

export type ManifestLoadResult = {
  manifest: unknown;
  assetPaths: string[];
  validationErrors: string[];
};

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

  async loadManifestPlan(): Promise<ManifestLoadResult> {
    const manifest = await loadAssetsManifest(this.variant as any);

    return {
      manifest,
      assetPaths: getLoadingManifest(manifest),
      validationErrors: getManifestValidationErrors()
    };
  }

  async loadAssets(
    assetPaths: string[],
    onProgress?: (progress: number, assetPath: string) => void
  ): Promise<Record<string, AssetResource>> {
    return this.assetManager.loadAll(assetPaths, onProgress);
  }

  async preloadPromptAssets(): Promise<Record<string, AssetResource>> {
    return this.loadAssets(['assets/ui/menu_buttons-0.json']);
  }

  async preloadPromptSounds(): Promise<void> {
    if (!this.game.soundSystem) return;
    await this.game.soundSystem.preload([SOUND_IDS.SPIN_BACKGROUND, SOUND_IDS.KNOCK]);
  }

  async preloadGameplaySounds(): Promise<void> {
    if (!this.game.soundSystem) return;
    await this.game.soundSystem.preload([
      SOUND_IDS.SPIN_BACKGROUND,
      SOUND_IDS.COINUP,
      SOUND_IDS.COINEND,
      SOUND_IDS.REEL_STOP,
      SOUND_IDS.KNOCK
    ]);
  }

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

    for (let i = 0; i < symbolDefs.length; i += 1) {
      const symbolDef = symbolDefs[i];
      textures.regions.push(textures.findFrames(symbolDef.prefix, symbolDef.atlas));
      textures.symbolOffsets.push({
        x: Number.isFinite(symbolDef.offsetX) ? symbolDef.offsetX : 0,
        y: Number.isFinite(symbolDef.offsetY) ? symbolDef.offsetY : 0
      });
      textures.symbolWinProfiles.push(symbolDef.winProfile || 'normal');
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
}
