// @ts-nocheck
import { APP_FONT_FAMILY, APP_FONT_WEIGHT_REGULAR } from '../config/fontConfig';

export default class ServerErrorModal extends PIXI.Container {
    constructor(onReload) {
        super();
        this.onReload = typeof onReload === 'function' ? onReload : () => window.location.reload();
        this.eventMode = 'static';
        this.visible = false;
        this.messageText = null;
        this.shade = null;
        this.panel = null;
        this.button = null;
        this.build(1920, 1080);
    }

    build(width, height) {
        this.removeChildren();

        this.shade = new PIXI.Graphics();
        this.shade.rect(0, 0, width, height).fill({ color: 0x000000, alpha: 0.35 });
        this.addChild(this.shade);

        const reloadNormal = this.getTexture('b_reload_001.png');
        const reloadPressed = this.getTexture('b_reload_002.png') || reloadNormal;
        const reloadHover = this.getTexture('b_reload_hover.png') || reloadNormal;

        const panelWidth = 500;
        const panelHeight = 320;
        const panelX = (width - panelWidth) / 2;
        const panelY = (height - panelHeight) / 2;

        this.panel = new PIXI.Graphics();
        this.panel.roundRect(panelX, panelY, panelWidth, panelHeight, 28).fill({ color: 0x09061c, alpha: 0.92 }).stroke({ width: 3, color: 0x4f3e86, alpha: 0.95 });
        this.addChild(this.panel);

        this.messageText = new PIXI.Text({
            text: 'Unable to connect with server.\nCheck your connection and try again',
            style: {
                fill: 0xffffff,
                fontSize: 26,
                fontFamily: APP_FONT_FAMILY,
                fontWeight: APP_FONT_WEIGHT_REGULAR,
                align: 'center',
                wordWrap: true,
                wordWrapWidth: panelWidth - 72,
                lineHeight: 34
            }
        });
        this.messageText.anchor.set(0.5, 0.5);
        this.messageText.position.set(width / 2, panelY + 120);
        this.addChild(this.messageText);

        if (reloadNormal) {
            this.button = new PIXI.Sprite(reloadNormal);
            this.button.position.set(panelX + Math.round((panelWidth - reloadNormal.width) / 2), panelY + panelHeight - 44 - reloadNormal.height);
            this.button.eventMode = 'static';
            this.button.cursor = 'pointer';
            this.button.on('pointerover', () => { this.button.texture = reloadHover; });
            this.button.on('pointerout', () => { this.button.texture = reloadNormal; });
            this.button.on('pointerdown', () => { this.button.texture = reloadPressed; });
            this.button.on('pointerup', () => {
                this.button.texture = reloadHover;
                this.onReload();
            });
            this.button.on('pointerupoutside', () => { this.button.texture = reloadNormal; });
            this.addChild(this.button);
        } else {
            this.button = new PIXI.Graphics();
            this.button.roundRect(0, 0, 260, 84, 42).fill(0x5c4aa8).stroke({ width: 2, color: 0xa89cff });
            this.button.position.set(width / 2 - 130, panelY + panelHeight - 110);
            this.button.eventMode = 'static';
            this.button.cursor = 'pointer';
            this.button.hitArea = new PIXI.Rectangle(0, 0, 260, 84);
            this.button.on('pointerdown', () => this.onReload());
            this.button.on('pointertap', () => this.onReload());
            this.addChild(this.button);

            const buttonLabel = new PIXI.Text({
                text: 'Reload',
                style: {
                    fill: 0xffffff,
                    fontSize: 36,
                    fontFamily: APP_FONT_FAMILY,
                    fontWeight: APP_FONT_WEIGHT_REGULAR
                }
            });
            buttonLabel.anchor.set(0.5);
            buttonLabel.position.set(this.button.x + 130, this.button.y + 42);
            buttonLabel.eventMode = 'none';
            this.addChild(buttonLabel);
        }
    }

    resize(width, height) {
        this.build(width, height);
    }

    show(message) {
        if (typeof message === 'string' && this.messageText) {
            this.messageText.text = message;
        }
        this.visible = true;
    }

    hide() {
        this.visible = false;
    }

    getTexture(frameName) {
        try {
            const texture = PIXI.Texture.from(frameName);
            return texture && texture !== PIXI.Texture.EMPTY ? texture : null;
        } catch (_err) {
            return null;
        }
    }
}
