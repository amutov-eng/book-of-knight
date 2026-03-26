// @ts-nocheck
import { getUiHudConfig } from '../config/assetsConfig';
import { getAssetsManifest } from '../core/RuntimeContext';

function getTexture(frameName) {
    if (!frameName) return PIXI.Texture.EMPTY;
    try {
        return PIXI.Texture.from(frameName);
    } catch {
        return PIXI.Texture.EMPTY;
    }
}

function createDigitSprite() {
    const sprite = new PIXI.Sprite(PIXI.Texture.EMPTY);
    sprite.visible = false;
    return sprite;
}

export default class FreeGamesInfoPanel extends PIXI.Container {
    constructor(game) {
        super();
        this.game = game;
        this.panelVisible = false;
        this.remainingCount = 0;
        this.background = null;
        this.leftDigit = null;
        this.rightDigit = null;
        this.layoutCfg = {};
    }

    build() {
        if (this.background) {
            return;
        }

        const hudConfig = getUiHudConfig(getAssetsManifest());
        this.layoutCfg = hudConfig && hudConfig.freeGamesTitle ? hudConfig.freeGamesTitle : {};
        this.position.set(0, 0);
        this.visible = false;

        this.background = new PIXI.Sprite(getTexture('fgleft.png'));
        this.background.position.set(Number(this.layoutCfg.panelX ?? -7), Number(this.layoutCfg.panelY ?? 362));
        this.addChild(this.background);

        this.leftDigit = createDigitSprite();
        this.leftDigit.position.set(Number(this.layoutCfg.twoDigitLeftX ?? 27), Number(this.layoutCfg.digitY ?? 512));
        this.addChild(this.leftDigit);

        this.rightDigit = createDigitSprite();
        this.rightDigit.position.set(Number(this.layoutCfg.twoDigitRightX ?? 111), Number(this.layoutCfg.digitY ?? 512));
        this.addChild(this.rightDigit);
    }

    act() {
        this.visible = this.panelVisible;
        if (!this.panelVisible) {
            return;
        }

        const value = Math.max(0, Math.min(99, Number(this.remainingCount) || 0));
        const text = String(value);
        if (text.length <= 1) {
            this.leftDigit.visible = false;
            this.rightDigit.visible = true;
            this.rightDigit.texture = getTexture(`fgleft_digit${text}.png`);
            this.rightDigit.position.set(Number(this.layoutCfg.singleDigitX ?? 64), Number(this.layoutCfg.digitY ?? 512));
            return;
        }

        this.leftDigit.visible = true;
        this.rightDigit.visible = true;
        this.leftDigit.texture = getTexture(`fgleft_digit${text[0]}.png`);
        this.rightDigit.texture = getTexture(`fgleft_digit${text[1]}.png`);
        this.leftDigit.position.set(Number(this.layoutCfg.twoDigitLeftX ?? 27), Number(this.layoutCfg.digitY ?? 512));
        this.rightDigit.position.set(Number(this.layoutCfg.twoDigitRightX ?? 111), Number(this.layoutCfg.digitY ?? 512));
    }

    setRemainingCount(value) {
        this.remainingCount = Math.max(0, Number(value) || 0);
    }

    setPanelVisible(visible) {
        this.panelVisible = !!visible;
    }
}
