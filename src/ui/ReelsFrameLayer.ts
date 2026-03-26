// @ts-nocheck
import { getReelTextureKey } from '../config/assetsConfig';
import { getAssetsManifest, getTextureCache } from '../core/RuntimeContext';

export default class ReelsFrameLayer extends PIXI.Container {
    constructor(game) {
        super();

        this.game = game;
        this.freeGamesActive = false;
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
        const context = this.game && this.game.context ? this.game.context : null;
        const mode = this.freeGamesActive || (context && Number(context.gameMode) === Number(context.FREE_GAMES)) ? 'fg' : 'base';
        const textureKey = this.getTextureKey(mode);
        const texture = textureKey ? textureCache[textureKey] : null;
        if (!texture) return;

        this.baseSprite.texture = texture;
        this.baseSprite.position.set(0, 0);
    }

    setByState(_stateTitle) {
        this.applyBaseTexture();
    }

    setFreeGamesAnim(active) {
        this.freeGamesActive = !!active;
        this.applyBaseTexture();
    }
}
