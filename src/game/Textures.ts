// @ts-nocheck
/**
 * Created by Dimitar on 2/17/2017.
 */
import { getTextureCache, getAtlasRegistry } from '../core/RuntimeContext';
/** @typedef {import('pixi.js').Texture} PixiTexture */
export default class Textures {
    constructor() {
        this.regions = [];
        this.symbolOffsets = [];
        this.symbolWinProfiles = [];
        this.symbolWinAnimations = {};
        this.winFrames = [];
    }

    findFrames(id, atlas) { // alternative to libgdx findAtlasRegions
        const textureCache = /** @type {Record<string, PixiTexture>} */ (getTextureCache());
        const registry = getAtlasRegistry();
        const frames = [];

        if (registry && atlas) {
            const atlasFrames = registry.getFrames(atlas);
            const matched = atlasFrames
                .filter((name) => typeof name === 'string' && name.startsWith(id) && name.endsWith('.png'))
                .sort();

            for (let i = 0; i < matched.length; i++) {
                const texture = textureCache[matched[i]];
                if (texture) {
                    frames.push(texture);
                }
            }

            if (frames.length > 0) {
                return frames;
            }
        }

        for(let i = 1; i < 100; i++) {
            const frame2Digit = `${id}${String(i).padStart(2, '0')}.png`;
            const frame3Digit = `${id}${String(i).padStart(3, '0')}.png`;

            if (Object.prototype.hasOwnProperty.call(textureCache, frame2Digit)) {
                frames.push(textureCache[frame2Digit]);
                continue;
            }

            if (Object.prototype.hasOwnProperty.call(textureCache, frame3Digit)) {
                frames.push(textureCache[frame3Digit]);
            }
        }
        return frames;
    }
}
