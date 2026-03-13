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
    getSymbolWinAnimationProfiles,
    getIntroConfig
} from '../../config/assetsConfig';
import { getRuntimeVariant } from '../../config/runtimeConfig';
import AssetManager from '../../core/assets/AssetManager';
import { restorePixiGlobals } from '../../core/globals';
import { getTextureCache, setAssetsManifest, setAssetManager } from '../../core/RuntimeContext';
import { getMaxStripSymbolIndex } from '../../config/stripsConfig';
import createBootIntroPlayer from '../../intro/createIntroPlayer';
import { BOOT_INTRO_CONFIG, GAMEPLAY_INTRO_CONFIG } from '../../config/introConfig';
import { SOUND_IDS } from '../../config/soundConfig';
import BootSoundPrompt from '../boot/BootSoundPrompt';
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
        this.gameplayIntroPlayer = null;
        this.bootSoundPrompt = null;
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
        let resourcesPromise = null;
        let soundsPromise = null;

        try {
            this.bootIntroPlayer = createBootIntroPlayer(this.resolveBootIntroConfig());
            await this.bootIntroPlayer.start();
        } catch (error) {
            log(`LoadingScreen::bootIntroFailed ${error instanceof Error ? error.message : String(error)}`, 'warn');
            this.bootIntroPlayer = null;
        }

        await this.loadManifestAndValidate();
        resourcesPromise = this.loadAssetResources(this.assetsToLoad);
        const promptAssetsPromise = this.loadAssetResources(['assets/ui/menu_buttons-0.json']);
        const promptSoundsPromise = this.game.soundSystem
            ? this.game.soundSystem.preload([SOUND_IDS.SPIN_BACKGROUND, SOUND_IDS.KNOCK])
            : Promise.resolve();
        soundsPromise = this.game.soundSystem
            ? this.game.soundSystem.preload([SOUND_IDS.SPIN_BACKGROUND, SOUND_IDS.COINUP, SOUND_IDS.COINEND, SOUND_IDS.REEL_STOP, SOUND_IDS.KNOCK])
            : Promise.resolve();

        await this.waitForBootIntro();
        await Promise.all([promptAssetsPromise, promptSoundsPromise]);
        await this.primeBootSoundPrompt();
        if (this.bootIntroPlayer && this.bootIntroPlayer.destroy) {
            await this.bootIntroPlayer.destroy();
            this.bootIntroPlayer = null;
        }
        restorePixiGlobals();
        await this.waitForNextFrame();
        await this.presentBootSoundPrompt();

        const [resources] = await Promise.all([resourcesPromise, soundsPromise]);
        this.setup({ resources });
        await this.playGameplayIntro();
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
        if (this.bootSoundPrompt) {
            this.stage.removeChild(this.bootSoundPrompt);
            this.bootSoundPrompt.destroy({ children: true });
            this.bootSoundPrompt = null;
        }
        if (this.gameplayIntroPlayer && this.gameplayIntroPlayer.destroy) {
            this.gameplayIntroPlayer.destroy();
            this.gameplayIntroPlayer = null;
        }
        if (this.bootIntroPlayer && this.bootIntroPlayer.destroy) {
            this.bootIntroPlayer.destroy();
            this.bootIntroPlayer = null;
        }
    }

    async presentBootSoundPrompt() {
        if (!this.bootSoundPrompt) {
            this.bootSoundPrompt = new BootSoundPrompt(this.game);
            this.stage.addChild(this.bootSoundPrompt);
        }
        await this.bootSoundPrompt.present();
    }

    async primeBootSoundPrompt() {
        if (this.bootSoundPrompt) return;
        this.bootSoundPrompt = new BootSoundPrompt(this.game);
        this.stage.addChild(this.bootSoundPrompt);
        this.bootSoundPrompt.visible = true;
        this.bootSoundPrompt.interactiveChildren = false;
        if (this.game.renderer) {
            this.game.renderer.render(this.stage);
        }
    }

    async waitForBootIntro() {
        if (!this.bootIntroPlayer || typeof this.bootIntroPlayer.waitForCompletion !== 'function') {
            return;
        }

        try {
            await this.bootIntroPlayer.waitForCompletion();
        } catch (error) {
            log(`LoadingScreen::bootIntroWaitFailed ${error instanceof Error ? error.message : String(error)}`, 'warn');
        }
    }

    waitForNextFrame() {
        return new Promise((resolve) => {
            window.requestAnimationFrame(() => resolve(undefined));
        });
    }

    async playGameplayIntro() {
        try {
            this.gameplayIntroPlayer = createBootIntroPlayer(this.resolveGameplayIntroConfig());
            await this.gameplayIntroPlayer.start();
            if (typeof this.gameplayIntroPlayer.waitForCompletion === 'function') {
                await this.gameplayIntroPlayer.waitForCompletion();
            }
        } catch (error) {
            log(`LoadingScreen::gameplayIntroFailed ${error instanceof Error ? error.message : String(error)}`, 'warn');
        } finally {
            if (this.gameplayIntroPlayer && this.gameplayIntroPlayer.destroy) {
                await this.gameplayIntroPlayer.destroy();
                this.gameplayIntroPlayer = null;
            }
            restorePixiGlobals();
        }
    }

    resolveBootIntroConfig() {
        const intro = getIntroConfig(this.assetsManifest);
        return {
            ...BOOT_INTRO_CONFIG,
            backgroundColor: Number.isFinite(intro.boot?.backgroundColor) ? Number(intro.boot.backgroundColor) : BOOT_INTRO_CONFIG.backgroundColor,
            layoutMode: typeof intro.boot?.layoutMode === 'string' ? intro.boot.layoutMode : BOOT_INTRO_CONFIG.layoutMode
        };
    }

    resolveGameplayIntroConfig() {
        const intro = getIntroConfig(this.assetsManifest);
        return {
            ...GAMEPLAY_INTRO_CONFIG,
            backgroundColor: Number.isFinite(intro.gameplay?.backgroundColor) ? Number(intro.gameplay.backgroundColor) : GAMEPLAY_INTRO_CONFIG.backgroundColor,
            backgroundImagePath: typeof intro.gameplay?.backgroundImagePath === 'string' ? intro.gameplay.backgroundImagePath : GAMEPLAY_INTRO_CONFIG.backgroundImagePath,
            layoutMode: typeof intro.gameplay?.layoutMode === 'string' ? intro.gameplay.layoutMode : GAMEPLAY_INTRO_CONFIG.layoutMode,
            viewport: {
                background: intro.gameplay?.background || GAMEPLAY_INTRO_CONFIG.viewport?.background,
                spine: intro.gameplay?.spine || GAMEPLAY_INTRO_CONFIG.viewport?.spine
            }
        };
    }
}
