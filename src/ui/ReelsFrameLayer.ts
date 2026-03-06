// @ts-nocheck
import { getReelTextureKey } from '../config/assetsConfig';
import { getAssetsManifest, getTextureCache } from '../core/RuntimeContext';

export default class ReelsFrameLayer extends PIXI.Container {
    constructor() {
        super();

        this.baseSprite = new PIXI.Sprite(PIXI.Texture.EMPTY);
        this.baseSprite.visible = true;

        this.addChild(this.baseSprite);

        this.applyBaseTexture();
        this.setByState('IDLE');
    }

    getTextureKey(mode) {
        return getReelTextureKey(getAssetsManifest(), 'frame', mode);
    }

    applyBaseTexture() {
        const textureCache = getTextureCache();
        const textureKey = this.getTextureKey('base');
        const texture = textureKey ? textureCache[textureKey] : null;
        if (!texture) return;

        this.baseSprite.texture = texture;
        this.baseSprite.position.set(0, 0);
    }

    setByState(_stateTitle) {
        this.applyBaseTexture();
    }
}
