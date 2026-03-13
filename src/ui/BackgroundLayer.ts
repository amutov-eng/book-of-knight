// @ts-nocheck
/** @typedef {import('pixi.js').Sprite} PixiSprite */
/** @typedef {import('pixi.js').Texture} PixiTexture */
import { getBackgroundTextureKey } from '../config/assetsConfig';
import { getRuntimeVariant, isMobileVariant } from '../config/runtimeConfig';
import { getAssetsManifest, getIsLandscape, getTextureCache } from '../core/RuntimeContext';

export default class BackgroundLayer extends PIXI.Container {
    constructor() {
        super();

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
        return getBackgroundTextureKey(getAssetsManifest(), this.variant, 'base', getIsLandscape());
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
