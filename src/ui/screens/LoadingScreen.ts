// @ts-nocheck
/**
 * Created by Dimitar on 2/17/2017.
 */
import BaseScreen from "../../core/BaseScreen";
import MainScreen from "../MainScreen";
import {
    loadAssetsManifest,
    getManifestValidationErrors,
    getLoadingManifest,
    getBackgroundKeys,
    getReelLayerKeys,
    getSymbolAtlases,
    getSymbolFrameDefsByIndex,
    getAnimationAtlases,
    getSymbolWinAnimationProfiles
} from '../../config/assetsConfig';
import { getRuntimeVariant } from '../../config/runtimeConfig';
import AssetManager from '../../core/assets/AssetManager';
import { restorePixiGlobals } from '../../core/globals';
import { getTextureCache, setAssetsManifest, setAssetManager } from '../../core/RuntimeContext';
import { getMaxStripSymbolIndex } from '../../config/stripsConfig';
import createBootIntroPlayer from '../../intro/createIntroPlayer';
/** @typedef {import('pixi.js').Texture} PixiTexture */
/** @typedef {import('../../core/BaseGame').default} BaseGame */

export default class LoadingScreen extends BaseScreen {

    /**
     * @param {BaseGame} game
     */
    constructor(game){
        super(game);
        log('LoadingScreen::show', 'debug');

        this.variant = getRuntimeVariant();
        this.assetsToLoad = [];
        this.assetsManifest = null;
        this.assetManager = new AssetManager({ textureCache: getTextureCache() });
        this.bootIntroPlayer = null;
        setAssetManager(this.assetManager);
        this.loadWithAssets();
    }

    loadProgressHandler(loader, resource) {
        log('loading ' + loader.progress,'debug');
    }

    async loadManifestAndValidate() {
        this.assetsManifest = await loadAssetsManifest(this.variant);
        const validationErrors = getManifestValidationErrors();
        for (let i = 0; i < validationErrors.length; i++) {
            log(`LoadingScreen::manifest ${validationErrors[i]}`, 'warn');
        }
        this.assetsToLoad = getLoadingManifest(this.assetsManifest);
    }

    async loadAssetResources(assetPaths) {
        return this.assetManager.loadAll(assetPaths, (progress, assetPath) => {
            this.loadProgressHandler({ progress }, { url: assetPath });
        });
    }

    cacheAtlasTextures(resources, textureCache) {
        const symbolAtlases = getSymbolAtlases(this.assetsManifest);
        const animationAtlases = getAnimationAtlases(this.assetsManifest);
        const atlasPaths = [...symbolAtlases, ...animationAtlases];
        for (let i = 0; i < atlasPaths.length; i++) {
            const atlasPath = atlasPaths[i];
            if (resources[atlasPath] && resources[atlasPath].textures) {
                Object.assign(textureCache, resources[atlasPath].textures);
            }
        }
    }

    cacheTextureIfExists(resources, textureCache, textureKey) {
        if (!textureKey) return;
        if (resources[textureKey] && resources[textureKey].texture) {
            textureCache[textureKey] = resources[textureKey].texture;
        }
    }

    cacheBackgroundTextures(resources, textureCache) {
        const backgroundKeys = getBackgroundKeys(this.assetsManifest);
        const reelLayerKeys = getReelLayerKeys(this.assetsManifest);
        const allBackgroundKeys = [...new Set([...backgroundKeys, ...reelLayerKeys])];
        for (let i = 0; i < allBackgroundKeys.length; i++) {
            this.cacheTextureIfExists(resources, textureCache, allBackgroundKeys[i]);
        }
    }

    initializeSymbolRegions() {
        const symbolDefs = getSymbolFrameDefsByIndex(this.assetsManifest);
        if (symbolDefs.length === 0) {
            log('LoadingScreen::symbols not configured (missing assets manifest or symbols.frames).', 'warn');
            return false;
        }
        this.game.textures.regions = [];
        this.game.textures.symbolOffsets = [];
        this.game.textures.symbolWinProfiles = [];
        this.game.textures.symbolWinAnimations = getSymbolWinAnimationProfiles(this.assetsManifest);
        for (let i = 0; i < symbolDefs.length; i++) {
            this.game.textures.regions.push(this.game.textures.findFrames(symbolDefs[i].prefix, symbolDefs[i].atlas));
            this.game.textures.symbolOffsets.push({
                x: Number.isFinite(symbolDefs[i].offsetX) ? symbolDefs[i].offsetX : 0,
                y: Number.isFinite(symbolDefs[i].offsetY) ? symbolDefs[i].offsetY : 0
            });
            this.game.textures.symbolWinProfiles.push(symbolDefs[i].winProfile || 'normal');
        }
        this.game.textures.winFrames = this.game.textures.findFrames('frame_', 'assets/animations/win-0.json');
        const maxStripIndex = getMaxStripSymbolIndex();
        if (maxStripIndex >= this.game.textures.regions.length) {
            log(`LoadingScreen::symbol index map too short for strips (max strip index: ${maxStripIndex}, loaded: ${this.game.textures.regions.length})`, 'warn');
            return false;
        }
        for (let i = 0; i <= maxStripIndex; i++) {
            const regionFrames = this.game.textures.regions[i];
            if (!regionFrames || regionFrames.length === 0) {
                log(`LoadingScreen::missing symbol frames for index ${i}`, 'warn');
                return false;
            }
        }
        return true;
    }

    async loadWithAssets() {
        try {
            this.bootIntroPlayer = createBootIntroPlayer();
            await this.bootIntroPlayer.start();
        } catch (error) {
            log(`LoadingScreen::bootIntroFailed ${error instanceof Error ? error.message : String(error)}`, 'warn');
            this.bootIntroPlayer = null;
        }

        await this.loadManifestAndValidate();
        const resources = await this.loadAssetResources(this.assetsToLoad);
        if (this.bootIntroPlayer && this.bootIntroPlayer.destroy) {
            await this.bootIntroPlayer.destroy();
            this.bootIntroPlayer = null;
        }
        restorePixiGlobals();
        this.setup({ resources });
    }

    setup(loader) {
        const resources = loader.resources || {};
        setAssetsManifest(this.assetsManifest);
        const textureCache = /** @type {Record<string, PixiTexture>} */ (getTextureCache());
        this.cacheAtlasTextures(resources, textureCache);
        this.cacheBackgroundTextures(resources, textureCache);
        if (!this.initializeSymbolRegions()) return;

        this.game.gsLink.connect();
        this.game.setScreen(new MainScreen(this.game));
    }

    hide() {
        if (this.bootIntroPlayer && this.bootIntroPlayer.destroy) {
            this.bootIntroPlayer.destroy();
            this.bootIntroPlayer = null;
        }
    }
}
