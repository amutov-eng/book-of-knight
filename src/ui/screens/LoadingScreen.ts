// @ts-nocheck
/**
 * Created by Dimitar on 2/17/2017.
 */
import BaseScreen from "../../core/BaseScreen";
import MainScreen from "../MainScreen";
import { getIntroConfig } from '../../config/assetsConfig';
import { getRuntimeVariant } from '../../config/runtimeConfig';
import LoadingAssetBootstrap from '../../app/boot/LoadingAssetBootstrap';
import IntroSequenceCoordinator from '../../app/boot/IntroSequenceCoordinator';
import { BOOT_INTRO_CONFIG, GAMEPLAY_INTRO_CONFIG } from '../../config/introConfig';
import { restorePixiGlobals } from '../../core/globals';
/** @typedef {import('../../core/BaseGame').default} BaseGame */

export default class LoadingScreen extends BaseScreen {

    /**
     * @param {BaseGame} game
     */
    constructor(game){
        super(game);
        log('LoadingScreen::show', 'debug');

        this.variant = getRuntimeVariant();
        this.assetsManifest = null;
        this.assetBootstrap = new LoadingAssetBootstrap(this.game, this.variant);
        this.introFlow = new IntroSequenceCoordinator(this.game);
        this.loadWithAssets();
    }

    loadProgressHandler(loader, resource) {
        log('loading ' + loader.progress,'debug');
    }

    async loadAssetResources(assetPaths) {
        return this.assetBootstrap.loadAssets(assetPaths, (progress, assetPath) => {
            this.loadProgressHandler({ progress }, { url: assetPath });
        });
    }

    async loadWithAssets() {
        const manifestPlanPromise = this.assetBootstrap.loadManifestPlan();

        await this.introFlow.startBootIntro(this.resolveBootIntroConfig());

        const manifestPlan = await manifestPlanPromise;
        this.assetsManifest = manifestPlan.manifest;
        for (let i = 0; i < manifestPlan.validationErrors.length; i++) {
            log(`LoadingScreen::manifest ${manifestPlan.validationErrors[i]}`, 'warn');
        }

        const resourcesPromise = this.loadAssetResources(manifestPlan.assetPaths);
        const promptAssetsPromise = this.assetBootstrap.preloadPromptAssets();
        const promptSoundsPromise = this.assetBootstrap.preloadPromptSounds();
        const soundsPromise = this.assetBootstrap.preloadGameplaySounds();

        await this.introFlow.waitForBootIntro();
        await Promise.all([promptAssetsPromise, promptSoundsPromise]);
        await this.introFlow.primeBootSoundPrompt(this.stage);
        await this.introFlow.destroyBootIntro();

        restorePixiGlobals();
        await this.waitForNextFrame();
        await this.introFlow.presentBootSoundPrompt(this.stage);

        const [resources] = await Promise.all([resourcesPromise, soundsPromise]);
        this.setup({ resources });
        await this.introFlow.playGameplayIntro(this.resolveGameplayIntroConfig());
    }

    setup(loader) {
        const resources = loader.resources || {};
        if (!this.assetBootstrap.applyLoadedResources(this.assetsManifest, resources)) return;

        this.game.gsLink.connect();
        this.game.setScreen(new MainScreen(this.game));
    }

    async hide() {
        await this.introFlow.destroyAll(this.stage);
    }

    waitForNextFrame() {
        return new Promise((resolve) => {
            window.requestAnimationFrame(() => resolve(undefined));
        });
    }

    resolveBootIntroConfig() {
        const intro = getIntroConfig(this.assetsManifest);
        return {
            ...BOOT_INTRO_CONFIG,
            backgroundColor: Number.isFinite(intro.boot?.backgroundColor) ? Number(intro.boot.backgroundColor) : BOOT_INTRO_CONFIG.backgroundColor,
            layoutMode: typeof intro.boot?.layoutMode === 'string' ? intro.boot.layoutMode : BOOT_INTRO_CONFIG.layoutMode,
            viewport: {
                spine: intro.boot?.spine || BOOT_INTRO_CONFIG.viewport?.spine,
                loadingBar: intro.boot?.loadingBar || BOOT_INTRO_CONFIG.viewport?.loadingBar
            }
        };
    }

    resolveGameplayIntroConfig() {
        const intro = getIntroConfig(this.assetsManifest);
        const skipPromptText = this.game && this.game.localization && typeof this.game.localization.t === 'function'
            ? String(this.game.localization.t('startTap', {}, { defaultValue: 'TAP TO CONTINUE' }))
            : 'TAP TO CONTINUE';
        return {
            ...GAMEPLAY_INTRO_CONFIG,
            backgroundColor: Number.isFinite(intro.gameplay?.backgroundColor) ? Number(intro.gameplay.backgroundColor) : GAMEPLAY_INTRO_CONFIG.backgroundColor,
            backgroundImagePath: typeof intro.gameplay?.backgroundImagePath === 'string' ? intro.gameplay.backgroundImagePath : GAMEPLAY_INTRO_CONFIG.backgroundImagePath,
            layoutMode: typeof intro.gameplay?.layoutMode === 'string' ? intro.gameplay.layoutMode : GAMEPLAY_INTRO_CONFIG.layoutMode,
            viewport: {
                background: intro.gameplay?.background || GAMEPLAY_INTRO_CONFIG.viewport?.background,
                spine: intro.gameplay?.spine || GAMEPLAY_INTRO_CONFIG.viewport?.spine
            },
            skipPrompt: {
                ...(GAMEPLAY_INTRO_CONFIG.skipPrompt || {}),
                ...(intro.gameplay?.skipPrompt || {}),
                text: typeof intro.gameplay?.skipPrompt?.text === 'string' && intro.gameplay.skipPrompt.text.length > 0
                    ? intro.gameplay.skipPrompt.text
                    : skipPromptText
            }
        };
    }
}
