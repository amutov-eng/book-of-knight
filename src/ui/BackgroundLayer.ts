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

        /** @type {PixiSprite} */
        this.baseSprite = new PIXI.Sprite(PIXI.Texture.EMPTY);

        this.addChild(this.baseSprite);

        if (isMobileVariant(this.variant)) {
            const onResize = () => this.applyBaseTexture();
            window.addEventListener('resize', onResize);
            window.addEventListener('orientationchange', onResize);
        }

        this.applyBaseTexture();
    }

    getTextureKey() {
        const context = this.game && this.game.context ? this.game.context : null;
        const mode = context && Number(context.gameMode) === Number(context.FREE_GAMES) ? 'fg' : 'base';
        return getBackgroundTextureKey(getAssetsManifest(), this.variant, mode, getIsLandscape());
    }

    applyBaseTexture() {
        const textureCache = /** @type {Record<string, PixiTexture>} */ (getTextureCache());
        const baseKey = this.getTextureKey();
        const baseTexture = baseKey ? textureCache[baseKey] : null;
        if (baseTexture) {
            this.baseSprite.texture = baseTexture;
        }
    }

    setByState(_stateTitle) {
        this.applyBaseTexture();
    }

    act() {}
}
