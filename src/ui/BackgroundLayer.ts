// @ts-nocheck
/** @typedef {import('pixi.js').Sprite} PixiSprite */
/** @typedef {import('pixi.js').Texture} PixiTexture */
import { getBackgroundTextureKey } from '../config/assetsConfig';
import { getRuntimeVariant, isMobileVariant } from '../config/runtimeConfig';
import { getAssetsManifest, getIsLandscape, getTextureCache } from '../core/RuntimeContext';

export default class BackgroundLayer extends PIXI.Container {
    constructor(game) {
        super();

        this.game = game;
        this.variant = getRuntimeVariant();

        this.baseSprite = new PIXI.Sprite(PIXI.Texture.EMPTY);
        this.overlaySprite = new PIXI.Sprite(PIXI.Texture.EMPTY);
        this.currentMode = 'base';
        this.targetMode = 'base';
        this.freeGamesActive = false;
        this.transitionProgress = 1;
        this.transitionFrames = 36;
        this.overlaySprite.alpha = 0;

        this.addChild(this.baseSprite);
        this.addChild(this.overlaySprite);

        if (isMobileVariant(this.variant)) {
            const onResize = () => this.applyBaseTexture();
            window.addEventListener('resize', onResize);
            window.addEventListener('orientationchange', onResize);
        }

        this.applyBaseTexture();
    }

    getTextureKey() {
        const mode = this.freeGamesActive ? 'fg' : 'base';
        return getBackgroundTextureKey(getAssetsManifest(), this.variant, mode, getIsLandscape());
    }

    applyBaseTexture() {
        const textureCache = /** @type {Record<string, PixiTexture>} */ (getTextureCache());
        const normalKey = getBackgroundTextureKey(getAssetsManifest(), this.variant, 'base', getIsLandscape());
        const overlayKey = this.getTextureKey();
        const baseTexture = normalKey ? textureCache[normalKey] : null;
        const overlayTexture = overlayKey ? textureCache[overlayKey] : null;
        if (baseTexture) this.baseSprite.texture = baseTexture;
        if (overlayTexture) this.overlaySprite.texture = overlayTexture;
    }

    setByState(_stateTitle) {
        const nextMode = (() => {
            if (this.freeGamesActive) {
                return 'fg';
            }
            const context = this.game && this.game.context ? this.game.context : null;
            return context && Number(context.gameMode) === Number(context.FREE_GAMES) ? 'fg' : 'base';
        })();
        this.targetMode = nextMode;
        this.applyBaseTexture();
        if (this.currentMode !== this.targetMode) {
            this.transitionProgress = 0;
        } else {
            this.overlaySprite.alpha = this.targetMode === 'base' ? 0 : 1;
        }
    }

    act(delta = 1) {
        if (this.transitionProgress >= 1) return;
        this.transitionProgress = Math.min(1, this.transitionProgress + (Number(delta) || 1) / this.transitionFrames);
        const showingOverlay = this.targetMode !== 'base';
        this.overlaySprite.alpha = showingOverlay ? this.transitionProgress : 1 - this.transitionProgress;
        if (this.transitionProgress >= 1) {
            this.currentMode = this.targetMode;
        }
    }

    setFreeGamesAnim(active) {
        this.freeGamesActive = !!active;
        this.setByState('');
    }
}
