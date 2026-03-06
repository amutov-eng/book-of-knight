import { Container } from 'pixi.js';
import Sprite from './Sprite';
import { getTextureCache } from '../core/RuntimeContext';

const LINE_FRAME_PATTERN = /^line_\d{2}\.png$/i;

export default class LineRender extends Container {
    private readonly lineSprites: Sprite[] = [];

    constructor() {
        super();

        const textureCache = getTextureCache();
        const lineFrameNames = Object.keys(textureCache)
            .filter((name) => LINE_FRAME_PATTERN.test(name))
            .sort();

        for (let i = 0; i < lineFrameNames.length; i++) {
            const texture = textureCache[lineFrameNames[i]];
            if (!texture) continue;

            const sprite = new Sprite(texture);
            sprite.visible = false;
            sprite.alpha = 0.95;
            sprite.eventMode = 'none';
            this.lineSprites.push(sprite);
            this.addChild(sprite);
        }

        this.eventMode = 'none';
        this.visible = this.lineSprites.length > 0;
    }

    addLine(line: number): void {
        if (!Number.isInteger(line) || line < 0 || line >= this.lineSprites.length) {
            return;
        }

        this.lineSprites[line].visible = true;
    }

    clear(): void {
        for (let i = 0; i < this.lineSprites.length; i++) {
            this.lineSprites[i].visible = false;
        }
    }

    hasAssets(): boolean {
        return this.lineSprites.length > 0;
    }
}
