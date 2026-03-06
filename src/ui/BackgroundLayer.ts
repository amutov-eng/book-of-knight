// @ts-nocheck
/** @typedef {import('pixi.js').Sprite} PixiSprite */
/** @typedef {import('pixi.js').Texture} PixiTexture */
import { getBackgroundTextureKey } from '../config/assetsConfig';
import { getRuntimeVariant, isMobileVariant } from '../config/runtimeConfig';
import { getAssetsManifest, getIsLandscape, getTextureCache } from '../core/RuntimeContext';

const HAW_STATES = new Set(['REELS_SPINNING', 'REELS_STOPPING']);
const FG_STATES = new Set(['SHOW_WINS', 'SHOW_ALL_WINNING_LINES', 'TAKE_WINS', 'WIN_TO_CREDIT']);
const FADE_DURATION_MS = 600;

export default class BackgroundLayer extends PIXI.Container {
    constructor() {
        super();

        this.variant = getRuntimeVariant();
        this.mode = 'base';

        /** @type {PixiSprite} */
        this.baseSprite = new PIXI.Sprite(PIXI.Texture.EMPTY);
        /** @type {PixiSprite} */
        this.overlaySprite = new PIXI.Sprite(PIXI.Texture.EMPTY);
        this.overlaySprite.alpha = 0;
        this.overlaySprite.visible = false;

        this.addChild(this.baseSprite);
        this.addChild(this.overlaySprite);

        this.animFrom = 0;
        this.animTo = 0;
        this.animStartMs = 0;
        this.animating = false;

        if (isMobileVariant(this.variant)) {
            const onResize = () => this.applyCurrentModeImmediately();
            window.addEventListener('resize', onResize);
            window.addEventListener('orientationchange', onResize);
        }

        this.applyCurrentModeImmediately();
    }

    getTextureKey(mode) {
        return getBackgroundTextureKey(getAssetsManifest(), this.variant, mode, getIsLandscape());
    }

    applyCurrentModeImmediately() {
        const textureCache = /** @type {Record<string, PixiTexture>} */ (getTextureCache());
        const baseKey = this.getTextureKey('base');
        const baseTexture = baseKey ? textureCache[baseKey] : null;
        if (baseTexture) {
            this.baseSprite.texture = baseTexture;
        }

        if (this.mode === 'base') {
            this.overlaySprite.alpha = 0;
            this.overlaySprite.visible = false;
            return;
        }

        const overlayKey = this.getTextureKey(this.mode);
        const overlayTexture = overlayKey ? textureCache[overlayKey] : null;
        if (overlayTexture) {
            this.overlaySprite.texture = overlayTexture;
            this.overlaySprite.alpha = 1;
            this.overlaySprite.visible = true;
        }
    }

    animateOverlayTo(targetAlpha) {
        this.animFrom = this.overlaySprite.alpha;
        this.animTo = targetAlpha;
        this.animStartMs = performance.now();
        this.animating = true;
    }

    transitionToBase() {
        this.mode = 'base';
        this.animateOverlayTo(0);
    }

    transitionToFg() {
        const textureCache = /** @type {Record<string, PixiTexture>} */ (getTextureCache());
        const fgKey = this.getTextureKey('fg');
        const overlayTexture = fgKey ? textureCache[fgKey] : null;
        if (!overlayTexture) return;

        this.mode = 'fg';
        this.overlaySprite.texture = overlayTexture;
        this.overlaySprite.visible = true;
        this.animateOverlayTo(1);
    }

    transitionToHaw() {
        const textureCache = /** @type {Record<string, PixiTexture>} */ (getTextureCache());
        const hawKey = this.getTextureKey('haw');
        const overlayTexture = hawKey ? textureCache[hawKey] : null;
        if (!overlayTexture) return;

        this.mode = 'haw';
        this.overlaySprite.texture = overlayTexture;
        this.overlaySprite.visible = true;
        this.animateOverlayTo(1);
    }

    // Thin wrapper for existing state-driven flow.
    setByState(stateTitle) {
        if (HAW_STATES.has(stateTitle)) {
            this.transitionToHaw();
            return;
        }
        if (FG_STATES.has(stateTitle)) {
            this.transitionToFg();
            return;
        }
        this.transitionToBase();
    }

    act() {
        if (!this.animating) return;

        const t = Math.min((performance.now() - this.animStartMs) / FADE_DURATION_MS, 1);
        this.overlaySprite.alpha = this.animFrom + (this.animTo - this.animFrom) * t;

        if (t >= 1) {
            this.animating = false;
            if (this.animTo <= 0) {
                this.overlaySprite.visible = false;
                this.overlaySprite.alpha = 0;
            }
        }
    }
}
