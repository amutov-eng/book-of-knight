// @ts-nocheck
import { GameplayEvent } from '../architecture/gameplay/GameplayStateMachine';
import { getUiHudConfig } from '../config/assetsConfig';
import { GAME_RULES } from '../config/gameRules';
import { getAssetsManifest } from '../core/RuntimeContext';
import { formatCentsByPattern, getDefaultNumberPattern } from '../utils/numberFormat';
import BetMenu from './BetMenu';
import AutoPlayMenu from './AutoPlayMenu';
import BuyBonusMenu from './BuyBonusMenu';
import BuyBonusConfirm from './BuyBonusConfirm';

/** @typedef {import('../core/BaseGame').default} BaseGame */

const VIRTUAL_WIDTH = 1920;
const BUTTON_DISABLED_ALPHA = 0.85;
const BUTTON_ENABLE_FROM_ALPHA = 0.85;
const BUTTON_ENABLE_FADE_FRAMES = 10;
const FRAMES_PER_SECOND = 60;

function toNumber(value, fallback = 0) {
    return Number.isFinite(value) ? value : fallback;
}

function hasTextureInCache(textureId) {
    if (!textureId || typeof textureId !== 'string' || !window.PIXI) return false;

    const cache = PIXI.Cache || (PIXI.Assets && PIXI.Assets.cache);
    if (!cache) return false;

    if (typeof cache.has === 'function') {
        return cache.has(textureId);
    }

    if (typeof cache.get === 'function') {
        return !!cache.get(textureId);
    }

    return false;
}

function getNumberPattern(game) {
    if (!game || !game.gsLink || typeof game.gsLink.getNumberPattern !== 'function') {
        return getDefaultNumberPattern();
    }

    const pattern = game.gsLink.getNumberPattern();
    return typeof pattern === 'string' && pattern.trim().length > 0
        ? pattern
        : getDefaultNumberPattern();
}

function formatMoney(value, game) {
    return formatCentsByPattern(value, getNumberPattern(game));
}

function tryFormatJackpotValue(rawValueText, game) {
    const value = String(rawValueText || '').trim();
    if (!/^[0-9]+([.,][0-9]+)?$/.test(value)) {
        return value;
    }

    const normalized = value.replace(',', '.');
    const amount = Number.parseFloat(normalized);
    if (!Number.isFinite(amount)) {
        return value;
    }

    const cents = Math.round(amount * 100);
    return formatMoney(cents, game);
}

function getLocalized(game, key, fallback) {
    if (game && game.localization && typeof game.localization.t === 'function') {
        return game.localization.t(key, {}, { defaultValue: fallback });
    }
    return fallback;
}

function getCurrency(game) {
    const currency = game && game.gsLink && typeof game.gsLink.currency === 'string'
        ? game.gsLink.currency.trim()
        : '';
    return currency || 'FUN';
}

export default class Menu extends PIXI.Container {
    /**
     * @param {BaseGame} game
     */
    constructor(game) {
        super();
        this.game = game;
        this.controlsDisabled = false;
        this.assetsLoaded = false;
        this.buildStarted = false;
        this.hudConfig = null;

        this.pendingState = {
            status: '',
            winStatus: '',
            win: 0,
            credit: 0,
            totalBet: 0
        };
        this.idleBlinkStartedAt = 0;

        this.bottomBg = null;
        this.winFieldBg = null;
        this.topLogo = null;
        this.topJackpotLayer = null;
        this.jackpotValueEntries = [];
        this.creditLabelText = null;
        this.creditValueText = null;
        this.totalBetLabelText = null;
        this.totalBetValueText = null;
        this.statusText = null;
        this.winStatusText = null;
        this.winText = null;

        this.startButton = null;
        this.stopButton = null;
        this.autoButton = null;
        this.autoStopButton = null;
        this.autoStopCounterText = null;
        this.autoStopCounterCfg = null;
        this.betButton = null;
        this.paytableButton = null;
        this.buyBonusButton = null;
        this.lobbyButton = null;
        this.betMenu = null;
        this.autoPlayMenu = null;
        this.buyBonusMenu = null;
        this.buyBonusConfirm = null;
        this.buttonStateKey = '';

        this.eventMode = 'passive';
        this.interactiveChildren = true;
    }

    show() {
        if (this.buildStarted) {
            this.visible = true;
            return;
        }

        this.buildStarted = true;
        this.visible = true;
        this.ensureBuilt();
    }

    ensureBuilt() {
        if (this.assetsLoaded) return;

        this.hudConfig = getUiHudConfig(getAssetsManifest());
        this.buildHud();
        this.assetsLoaded = true;
        this.updateMeters();
        this.applyPendingState();
    }

    getTexture(frameName) {
        if (!frameName || !hasTextureInCache(frameName)) {
            return null;
        }

        const texture = PIXI.Texture.from(frameName);
        return texture && texture !== PIXI.Texture.EMPTY ? texture : null;
    }

    addSprite(frameName, x, y) {
        const texture = this.getTexture(frameName);
        if (!texture) return null;

        const sprite = new PIXI.Sprite(texture);
        sprite.position.set(x, y);
        this.addChild(sprite);
        return sprite;
    }

    getControllerStateTitle() {
        return this.game && this.game.controller && this.game.controller.state
            ? this.game.controller.state.title
            : '';
    }

    buildHud() {
        const backgrounds = this.hudConfig && this.hudConfig.backgrounds ? this.hudConfig.backgrounds : {};
        const bottom = backgrounds.bottom || {};
        const winField = backgrounds.winField || {};

        this.buildTopBar();
        this.bottomBg = this.addSprite(bottom.frame || 'bottom_bg.png', toNumber(bottom.x, 0), toNumber(bottom.y, 1034));
        this.winFieldBg = this.addSprite(winField.frame || 'win_field.png', toNumber(winField.x, 0), toNumber(winField.y, 942));

        this.buildTexts();
        this.buildButtons();
        this.buildBetMenu();
        this.buildAutoPlayMenu();
        this.buildBuyBonusUi();
    }

    buildTopBar() {
        const topBar = this.hudConfig && this.hudConfig.topBar ? this.hudConfig.topBar : {};
        const fontCfg = this.hudConfig && this.hudConfig.fonts ? this.hudConfig.fonts : {};
        const jackpotValueFont = String(fontCfg.jackpotValue || fontCfg.jackpot || fontCfg.primary || 'Arial');
        const jackpotLabelFont = String(fontCfg.jackpotLabel || fontCfg.jackpot || fontCfg.primary || 'Arial');
        const logoCfg = topBar.logo || {};
        const jackpots = Array.isArray(topBar.jackpots) ? topBar.jackpots : [];
        this.jackpotValueEntries = [];

        this.topLogo = this.addSprite(logoCfg.frame || 'logo.png', toNumber(logoCfg.x, 20), toNumber(logoCfg.y, 6));
        this.topJackpotLayer = new PIXI.Container();
        this.addChild(this.topJackpotLayer);

        for (let i = 0; i < jackpots.length; i++) {
            const cfg = jackpots[i] || {};
            const frame = cfg.frame || '';
            const valueTextRaw = String(cfg.valueText || '');
            const valueText = tryFormatJackpotValue(valueTextRaw, this.game);
            const labelText = String(cfg.labelText || '');

            if (frame) {
                const panelTexture = this.getTexture(frame);
                const panel = panelTexture ? new PIXI.Sprite(panelTexture) : null;
                if (panel) {
                    panel.position.set(toNumber(cfg.x, 0), toNumber(cfg.y, 0));
                    this.topJackpotLayer.addChild(panel);
                }
            }

            const valueLabel = new PIXI.Text({
                text: valueText,
                style: new PIXI.TextStyle({
                    fontFamily: jackpotValueFont,
                    fontSize: toNumber(cfg.valueFontSize, 56),
                    fontWeight: '700',
                    fill: toNumber(cfg.valueColor, 0xffcc00),
                    align: 'center'
                })
            });
            valueLabel.anchor.set(0.5, 0);
            valueLabel.position.set(toNumber(cfg.valueX, 0), toNumber(cfg.valueY, 0));
            this.topJackpotLayer.addChild(valueLabel);
            this.jackpotValueEntries.push({ label: valueLabel, rawValueText: valueTextRaw });

            if (labelText.trim().length > 0) {
                const nameLabel = new PIXI.Text({
                    text: labelText,
                    style: new PIXI.TextStyle({
                        fontFamily: jackpotLabelFont,
                        fontSize: toNumber(cfg.labelFontSize, 22),
                        fontWeight: '700',
                        fill: toNumber(cfg.labelColor, 0xffcc00),
                        align: 'center'
                    })
                });
                nameLabel.anchor.set(0.5, 0);
                nameLabel.position.set(toNumber(cfg.labelX, 0), toNumber(cfg.labelY, 0));
                this.topJackpotLayer.addChild(nameLabel);
            }
        }
    }

    buildTexts() {
        const textCfg = this.hudConfig && this.hudConfig.texts ? this.hudConfig.texts : {};
        const fontCfg = this.hudConfig && this.hudConfig.fonts ? this.hudConfig.fonts : {};
        const primaryFont = String(fontCfg.primary || 'Arial');
        const creditLabelFont = String(fontCfg.creditLabel || primaryFont);
        const creditValueFont = String(fontCfg.creditValue || primaryFont);
        const totalBetLabelFont = String(fontCfg.totalBetLabel || primaryFont);
        const totalBetValueFont = String(fontCfg.totalBetValue || primaryFont);
        const statusFont = String(fontCfg.status || primaryFont);
        const winStatusFont = String(fontCfg.winStatus || primaryFont);
        const winFont = String(fontCfg.win || primaryFont);
        const creditCfg = textCfg.credit || {};
        const totalBetCfg = textCfg.totalBet || {};
        const statusCfg = textCfg.status || {};
        const winStatusCfg = textCfg.winStatus || {};
        const winCfg = textCfg.win || {};

        const white = 0xf3f9f9;
        const yellow = 0xffc600;

        const creditLabelStyle = new PIXI.TextStyle({
            fontFamily: creditLabelFont,
            fontSize: toNumber(creditCfg.fontSize, 34),
            fontWeight: '700',
            fill: toNumber(creditCfg.labelColor, 0xffc600),
            align: String(creditCfg.align || 'left')
        });

        const creditValueStyle = new PIXI.TextStyle({
            fontFamily: creditValueFont,
            fontSize: toNumber(creditCfg.fontSize, 34),
            fontWeight: '700',
            fill: toNumber(creditCfg.valueColor, white),
            align: String(creditCfg.align || 'left')
        });

        const totalBetLabelStyle = new PIXI.TextStyle({
            fontFamily: totalBetLabelFont,
            fontSize: toNumber(totalBetCfg.fontSize, 34),
            fontWeight: '700',
            fill: toNumber(totalBetCfg.labelColor, 0xffc600),
            align: String(totalBetCfg.align || 'left')
        });

        const totalBetValueStyle = new PIXI.TextStyle({
            fontFamily: totalBetValueFont,
            fontSize: toNumber(totalBetCfg.fontSize, 34),
            fontWeight: '700',
            fill: toNumber(totalBetCfg.valueColor, white),
            align: String(totalBetCfg.align || 'left')
        });

        const statusStyle = new PIXI.TextStyle({
            fontFamily: statusFont,
            fontSize: toNumber(statusCfg.fontSize, 36),
            fontWeight: '700',
            fill: white,
            align: String(statusCfg.align || 'center')
        });

        const winStatusStyle = new PIXI.TextStyle({
            fontFamily: winStatusFont,
            fontSize: toNumber(winStatusCfg.fontSize, 34),
            fontWeight: '700',
            fill: white,
            align: String(winStatusCfg.align || 'center')
        });

        const winStyle = new PIXI.TextStyle({
            fontFamily: winFont,
            fontSize: toNumber(winCfg.fontSize, 36),
            fontWeight: '800',
            fill: yellow,
            align: String(winCfg.align || 'center')
        });

        this.creditLabelText = new PIXI.Text({ text: '', style: creditLabelStyle });
        this.creditLabelText.position.set(toNumber(creditCfg.x, 220), toNumber(creditCfg.y, 1039));
        this.creditValueText = new PIXI.Text({ text: '', style: creditValueStyle });
        this.creditValueText.position.set(toNumber(creditCfg.x, 220), toNumber(creditCfg.y, 1039));

        this.totalBetLabelText = new PIXI.Text({ text: '', style: totalBetLabelStyle });
        this.totalBetLabelText.position.set(toNumber(totalBetCfg.x, 1490), toNumber(totalBetCfg.y, 1039));
        this.totalBetValueText = new PIXI.Text({ text: '', style: totalBetValueStyle });
        this.totalBetValueText.position.set(toNumber(totalBetCfg.x, 1490), toNumber(totalBetCfg.y, 1039));

        this.statusText = new PIXI.Text({ text: '', style: statusStyle });
        this.statusText.anchor.set(toNumber(statusCfg.anchorX, 0.5), 0);
        this.statusText.position.set(toNumber(statusCfg.x, VIRTUAL_WIDTH / 2), toNumber(statusCfg.y, 969));

        this.winStatusText = new PIXI.Text({ text: '', style: winStatusStyle });
        this.winStatusText.anchor.set(toNumber(winStatusCfg.anchorX, 0.5), 0);
        this.winStatusText.position.set(toNumber(winStatusCfg.x, VIRTUAL_WIDTH / 2), toNumber(winStatusCfg.y, 990));

        this.winText = new PIXI.Text({ text: '', style: winStyle });
        this.winText.anchor.set(toNumber(winCfg.anchorX, 0.5), 0);
        this.winText.position.set(toNumber(winCfg.x, VIRTUAL_WIDTH / 2), toNumber(winCfg.y, 953));

        this.addChild(this.creditLabelText);
        this.addChild(this.creditValueText);
        this.addChild(this.totalBetLabelText);
        this.addChild(this.totalBetValueText);
        this.addChild(this.winText);
        this.addChild(this.statusText);
        this.addChild(this.winStatusText);
    }

    createButton(buttonCfg, fallbackBaseName, x, y, width, height, onRelease) {
        const cfg = buttonCfg && typeof buttonCfg === 'object' ? buttonCfg : {};
        const baseName = String(cfg.base || fallbackBaseName || '').trim();

        const normalFrame = String(cfg.normalFrame || cfg.normal || (baseName ? `${baseName}_001.png` : ''));
        const downFrame = String(cfg.downFrame || cfg.down || (baseName ? `${baseName}_002.png` : ''));
        const hoverFrame = String(cfg.hoverFrame || cfg.hover || (baseName ? `${baseName}_hover.png` : ''));
        const disabledFrame = String(cfg.disabledFrame || cfg.disabled || (baseName ? `${baseName}_deact.png` : ''));

        const normal = normalFrame ? this.getTexture(normalFrame) : null;
        if (!normal) {
            return null;
        }

        const down = (downFrame ? this.getTexture(downFrame) : null) || normal;
        const hover = (hoverFrame ? this.getTexture(hoverFrame) : null) || normal;
        const disabled = (disabledFrame ? this.getTexture(disabledFrame) : null) || normal;

        const button = new PIXI.Sprite(normal);
        button.position.set(x, y);
        button.width = width;
        button.height = height;
        button.eventMode = 'static';
        button.cursor = 'pointer';
        button.interactiveChildren = false;

        const enableFadeFrames = Math.max(0, toNumber(cfg.enableFadeFrames, BUTTON_ENABLE_FADE_FRAMES));
        const fadeFromAlpha = Math.max(0, Math.min(1, toNumber(cfg.enableFadeFromAlpha, BUTTON_ENABLE_FROM_ALPHA)));
        const state = {
            enabled: true,
            isHovered: false,
            fadeFramesTotal: enableFadeFrames,
            fadeFramesRemaining: 0,
            fadeFromAlpha,
            normal,
            down,
            hover,
            disabled
        };

        const setEnabled = (enabled) => {
            const nextEnabled = !!enabled;
            const prevEnabled = state.enabled;

            if (prevEnabled === nextEnabled) {
                button.cursor = nextEnabled ? 'pointer' : 'default';
                button.eventMode = nextEnabled ? 'static' : 'none';
                if (!nextEnabled) {
                    button.texture = state.disabled;
                    button.alpha = BUTTON_DISABLED_ALPHA;
                }
                return;
            }

            state.enabled = nextEnabled;
            button.cursor = nextEnabled ? 'pointer' : 'default';
            button.eventMode = nextEnabled ? 'static' : 'none';

            if (!nextEnabled) {
                state.fadeFramesRemaining = 0;
                state.isHovered = false;
                button.texture = state.disabled;
                button.alpha = BUTTON_DISABLED_ALPHA;
                return;
            }

            button.texture = state.isHovered ? state.hover : state.normal;
            if (state.fadeFramesTotal > 0) {
                state.fadeFramesRemaining = state.fadeFramesTotal;
                button.alpha = state.fadeFromAlpha;
            } else {
                state.fadeFramesRemaining = 0;
                button.alpha = 1;
            }
        };

        const stepStateTransition = (delta) => {
            if (!state.enabled || state.fadeFramesRemaining <= 0) {
                return;
            }

            const step = Number.isFinite(delta) && delta > 0 ? delta : 1;
            state.fadeFramesRemaining = Math.max(0, state.fadeFramesRemaining - step);
            const progress = 1 - (state.fadeFramesRemaining / Math.max(1, state.fadeFramesTotal));
            const eased = progress * progress * (3 - 2 * progress);
            button.alpha = state.fadeFromAlpha + (1 - state.fadeFromAlpha) * eased;

            if (state.fadeFramesRemaining <= 0) {
                button.alpha = 1;
            }
        };

        button.on('pointerdown', () => {
            if (!state.enabled) return;
            button.texture = state.down;
        });

        button.on('pointerup', () => {
            if (!state.enabled) return;
            button.texture = state.isHovered ? state.hover : state.normal;
            if (onRelease) onRelease();
        });

        button.on('pointerupoutside', () => {
            if (!state.enabled) return;
            button.texture = state.normal;
        });

        button.on('pointerover', () => {
            if (!state.enabled) return;
            state.isHovered = true;
            button.texture = state.hover;
        });

        button.on('pointerout', () => {
            if (!state.enabled) return;
            state.isHovered = false;
            button.texture = state.normal;
        });

        button.setEnabled = setEnabled;
        button.stepStateTransition = stepStateTransition;
        setEnabled(true);

        this.addChild(button);
        return button;
    }

    buildButtons() {
        const btn = this.hudConfig && this.hudConfig.buttons ? this.hudConfig.buttons : {};
        const startCfg = btn.start || {};
        const stopCfg = btn.stop || {};
        const autoCfg = btn.auto || {};
        const autoStopCfg = btn.autoStop || {};
        const betCfg = btn.bet || {};
        const settingsCfg = btn.settings || {};
        const buyBonusCfg = btn.buyBonus || {};
        const homeCfg = btn.home || {};

        this.startButton = this.createButton(
            startCfg,
            'button_start',
            toNumber(startCfg.x, 1616),
            toNumber(startCfg.y, 412),
            toNumber(startCfg.width, 300),
            toNumber(startCfg.height, 300),
            () => this.onStartPressed()
        );

        this.stopButton = this.createButton(
            stopCfg,
            'button_stop',
            toNumber(stopCfg.x, 1616),
            toNumber(stopCfg.y, 412),
            toNumber(stopCfg.width, 300),
            toNumber(stopCfg.height, 300),
            () => this.onStartPressed()
        );
        if (this.stopButton) this.stopButton.visible = false;
        this.autoButton = this.createButton(
            autoCfg,
            'button_autoplay',
            toNumber(autoCfg.x, 1728),
            toNumber(autoCfg.y, 88),
            toNumber(autoCfg.width, 162),
            toNumber(autoCfg.height, 162),
            () => this.onAutoPressed()
        );

        this.autoStopButton = this.createButton(
            autoStopCfg,
            'button_autoX',
            toNumber(autoStopCfg.x, toNumber(autoCfg.x, 1728)),
            toNumber(autoStopCfg.y, toNumber(autoCfg.y, 88)),
            toNumber(autoStopCfg.width, toNumber(autoCfg.width, 162)),
            toNumber(autoStopCfg.height, toNumber(autoCfg.height, 162)),
            () => this.onAutoStopPressed()
        );
        if (this.autoStopButton) {
            this.autoStopButton.visible = false;
            this.buildAutoStopCounter(autoStopCfg);
        }

        this.betButton = this.createButton(
            betCfg,
            'button_bet',
            toNumber(betCfg.x, 1728),
            toNumber(betCfg.y, 756),
            toNumber(betCfg.width, 162),
            toNumber(betCfg.height, 162),
            () => this.toggleBetMenu()
        );

        this.paytableButton = this.createButton(
            settingsCfg,
            'button_settings',
            toNumber(settingsCfg.x, 30),
            toNumber(settingsCfg.y, 98),
            toNumber(settingsCfg.width, 162),
            toNumber(settingsCfg.height, 162),
            () => this.setStatus(getLocalized(this.game, 'helpSettings', 'SETTINGS'))
        );

        this.buyBonusButton = this.createButton(
            buyBonusCfg,
            'bb_yellow',
            toNumber(buyBonusCfg.x, 0),
            toNumber(buyBonusCfg.y, 346),
            toNumber(buyBonusCfg.width, 194),
            toNumber(buyBonusCfg.height, 164),
            () => this.toggleBuyBonusMenu()
        );

        this.lobbyButton = this.createButton(
            homeCfg,
            'button_home',
            toNumber(homeCfg.x, 83),
            toNumber(homeCfg.y, 1030),
            toNumber(homeCfg.width, 50),
            toNumber(homeCfg.height, 50),
            () => {
                if (this.game.gsLink && typeof this.game.gsLink.onHomeButton === 'function') {
                    this.game.gsLink.onHomeButton();
                }
            }
        );

        this.updateSpinButtonVisibility();
        this.updateAutoPlayButtonVisibility();
        this.updateButtonState();
    }

    onStartPressed() {
        if (!this.game || !this.game.controller) return;
        if (this.isBetMenuOpen()) this.closeBetMenu();
        if (this.isAutoPlayMenuOpen()) this.closeAutoPlayMenu();
        if (this.isBuyBonusMenuOpen()) this.closeBuyBonusMenu(false);
        if (this.isBuyBonusConfirmOpen()) this.closeBuyBonusConfirm(false);
        this.game.controller.event = GameplayEvent.START;
    }
    buildBetMenu() {
        if (this.betMenu) return;

        this.betMenu = new BetMenu(this.game, this.hudConfig, () => {
            this.enableControls();
            this.setStatus('');
            this.updateMeters();
        });

        this.betMenu.visible = false;
        this.addChild(this.betMenu);
    }

    buildAutoPlayMenu() {
        if (this.autoPlayMenu) return;

        this.autoPlayMenu = new AutoPlayMenu(
            this.game,
            this.hudConfig,
            (count) => this.startAutoplay(count),
            () => {
                this.enableControls();
                this.setStatus('');
            }
        );

        this.autoPlayMenu.visible = false;
        this.addChild(this.autoPlayMenu);
    }
    buildBuyBonusUi() {
        if (this.buyBonusMenu || this.buyBonusConfirm) return;

        this.buyBonusMenu = new BuyBonusMenu(
            this.game,
            () => {
                this.enableControls();
                this.setStatus('');
                this.updateMeters();
            },
            (type, cost) => this.openBuyBonusConfirm(type, cost),
            this.hudConfig
        );
        this.buyBonusMenu.visible = false;
        this.addChild(this.buyBonusMenu);

        this.buyBonusConfirm = new BuyBonusConfirm(
            this.game,
            () => {
                this.openBuyBonusMenu();
            },
            this.hudConfig
        );
        this.buyBonusConfirm.visible = false;
        this.addChild(this.buyBonusConfirm);
    }
    isBetMenuOpen() {
        return !!(this.betMenu && this.betMenu.isOpen && this.betMenu.isOpen());
    }

    isAutoPlayMenuOpen() {
        return !!(this.autoPlayMenu && this.autoPlayMenu.isOpen && this.autoPlayMenu.isOpen());
    }
    isBuyBonusMenuOpen() {
        return !!(this.buyBonusMenu && this.buyBonusMenu.isOpen && this.buyBonusMenu.isOpen());
    }

    isBuyBonusConfirmOpen() {
        return !!(this.buyBonusConfirm && this.buyBonusConfirm.isOpen && this.buyBonusConfirm.isOpen());
    }
    openBetMenu() {
        if (!this.betMenu || this.isBetMenuOpen()) return;
        if (this.isAutoPlayMenuOpen()) {
            this.closeAutoPlayMenu();
        }
        if (this.isBuyBonusMenuOpen()) {
            this.closeBuyBonusMenu(false);
        }
        if (this.isBuyBonusConfirmOpen()) {
            this.closeBuyBonusConfirm(false);
        }
        this.disableControls();
        this.betMenu.show();
        this.setStatus(getLocalized(this.game, 'menuBetTitle', 'SELECT BET'));
    }

    closeBetMenu() {
        if (!this.betMenu || !this.isBetMenuOpen()) return;
        this.betMenu.hide();
    }

    toggleBetMenu() {
        if (this.isBetMenuOpen()) {
            this.closeBetMenu();
            return;
        }

        this.openBetMenu();
    }

    openAutoPlayMenu() {
        if (!this.autoPlayMenu || this.isAutoPlayMenuOpen()) return;
        if (this.isBetMenuOpen()) {
            this.closeBetMenu();
        }
        if (this.isBuyBonusMenuOpen()) {
            this.closeBuyBonusMenu(false);
        }
        if (this.isBuyBonusConfirmOpen()) {
            this.closeBuyBonusConfirm(false);
        }
        this.disableControls();
        this.autoPlayMenu.show();
        this.setStatus(getLocalized(this.game, 'autoStatusTxt', 'Choose number of auto spins'));
    }

    closeAutoPlayMenu(notify = true) {
        if (!this.autoPlayMenu || !this.isAutoPlayMenuOpen()) return;
        this.autoPlayMenu.hide(notify);
    }

    toggleAutoPlayMenu() {
        if (this.isAutoPlayMenuOpen()) {
            this.closeAutoPlayMenu();
            return;
        }

        this.openAutoPlayMenu();
    }
    openBuyBonusMenu() {
        if (!this.buyBonusMenu || this.isBuyBonusMenuOpen()) return;
        if (this.isBetMenuOpen()) this.closeBetMenu();
        if (this.isAutoPlayMenuOpen()) this.closeAutoPlayMenu();
        if (this.isBuyBonusConfirmOpen()) this.closeBuyBonusConfirm(false);
        this.disableControls();
        this.buyBonusMenu.refresh();
        this.buyBonusMenu.show();
        this.setStatus(getLocalized(this.game, 'buyBonusTxt', 'BUY BONUS'));
    }

    closeBuyBonusMenu(notify = true) {
        if (!this.buyBonusMenu || !this.isBuyBonusMenuOpen()) return;
        this.buyBonusMenu.hide(notify);
    }

    toggleBuyBonusMenu() {
        if (this.isBuyBonusMenuOpen()) {
            this.closeBuyBonusMenu();
            return;
        }
        this.openBuyBonusMenu();
    }

    openBuyBonusConfirm(type, cost) {
        if (!this.buyBonusConfirm) return;
        if (this.isBuyBonusMenuOpen()) {
            this.closeBuyBonusMenu(false);
        }
        this.disableControls();
        this.buyBonusConfirm.show(type, cost);
        this.setStatus(getLocalized(this.game, 'buyTxt', 'BUY'));
    }

    closeBuyBonusConfirm(notify = true) {
        if (!this.buyBonusConfirm || !this.isBuyBonusConfirmOpen()) return;
        this.buyBonusConfirm.hide();
        if (notify) {
            this.enableControls();
            this.setStatus('');
        }
    }
    onAutoPressed() {
        if (this.game && this.game.context && this.game.context.autoplay) {
            this.onAutoStopPressed();
            return;
        }

        this.toggleAutoPlayMenu();
    }

    onAutoStopPressed() {
        if (!this.game || !this.game.context) return;

        this.game.context.autoplay = false;
        this.game.context.autoplayCounter = 0;

        if (this.isAutoPlayMenuOpen()) {
            this.closeAutoPlayMenu(false);
        }

        const stateTitle = this.getControllerStateTitle();
        const spinning = stateTitle === 'REELS_SPINNING' || stateTitle === 'REELS_STOPPING' || stateTitle === 'START_SPIN';
        if (!spinning) {
            this.enableControls();
        }

        this.setStatus('');
        this.updateAutoPlayButtonVisibility();
    }

    startAutoplay(count) {
        if (!this.game || !this.game.context || !this.game.controller || !this.game.meters) {
            return;
        }

        const connected = !!(this.game.gsLink && this.game.gsLink.isFullyConnected && this.game.gsLink.isFullyConnected());
        if (!connected) {
            this.setStatus('UNABLE TO CONNECT WITH SERVER');
            this.closeAutoPlayMenu(false);
            return;
        }

        if (this.game.meters.getTotalBet() > this.game.meters.credit) {
            this.setStatus('INSERT CREDITS TO PLAY');
            this.closeAutoPlayMenu(false);
            return;
        }

        const spinsCount = Math.max(1, parseInt(count, 10) || 1);

        this.game.context.autoplay = true;
        this.game.context.autoplayCounter = Math.max(0, spinsCount - 1);
        this.game.context.autoplayUnlimited = spinsCount >= 1000;
        this.game.context.autoplayWinUnlimited = true;
        this.game.context.autoplayLostUnlimited = true;

        this.closeAutoPlayMenu(false);
        this.setStatus('');
        this.updateAutoPlayButtonVisibility();

        const stateTitle = this.getControllerStateTitle();
        if (stateTitle === 'WIN_TO_CREDIT') {
            this.game.controller.event = GameplayEvent.TAKEWIN;
        } else {
            this.game.controller.event = GameplayEvent.START;
        }
    }

    updateSpinButtonVisibility() {
        const title = this.getControllerStateTitle();
        const spinning = title === 'REELS_SPINNING' || title === 'REELS_STOPPING';

        if (this.startButton) this.startButton.visible = !spinning;
        if (this.stopButton) this.stopButton.visible = spinning;
    }

    updateAutoPlayButtonVisibility() {
        const autoplayActive = !!(this.game && this.game.context && this.game.context.autoplay);
        if (this.autoButton) this.autoButton.visible = !autoplayActive;
        if (this.autoStopButton) this.autoStopButton.visible = autoplayActive;
        this.updateAutoStopCounterLabel();
    }

    buildAutoStopCounter(autoStopCfg) {
        if (!this.autoStopButton) return;
        const cfg = autoStopCfg && typeof autoStopCfg === 'object' ? autoStopCfg : {};
        const counterCfg = cfg.counter && typeof cfg.counter === 'object' ? cfg.counter : {};

        this.autoStopCounterCfg = {
            x: toNumber(counterCfg.x, 82),
            y: toNumber(counterCfg.y, 78),
            fontSize: toNumber(counterCfg.fontSize, 54),
            minFontSize: toNumber(counterCfg.minFontSize, 26),
            maxWidth: toNumber(counterCfg.maxWidth, 118),
            color: toNumber(counterCfg.color, 0xffffff),
            fontWeight: String(counterCfg.fontWeight || '700'),
            align: String(counterCfg.align || 'center')
        };

        this.autoStopCounterText = new PIXI.Text({
            text: '',
            style: new PIXI.TextStyle({
                fontFamily: this.hudConfig && this.hudConfig.fonts && this.hudConfig.fonts.primary ? String(this.hudConfig.fonts.primary) : 'Arial',
                fontSize: this.autoStopCounterCfg.fontSize,
                fill: this.autoStopCounterCfg.color,
                fontWeight: this.autoStopCounterCfg.fontWeight,
                align: this.autoStopCounterCfg.align
            })
        });

        this.autoStopCounterText.anchor.set(0.5, 0.5);
        this.autoStopCounterText.position.set(
            toNumber(this.autoStopButton.x, 0) + this.autoStopCounterCfg.x,
            toNumber(this.autoStopButton.y, 0) + this.autoStopCounterCfg.y
        );
        this.autoStopCounterText.visible = false;
        this.addChild(this.autoStopCounterText);
    }

    updateAutoStopCounterLabel() {
        if (!this.autoStopButton || !this.autoStopCounterText) return;

        const autoplayActive = !!(this.game && this.game.context && this.game.context.autoplay);
        if (!autoplayActive) {
            this.autoStopCounterText.visible = false;
            return;
        }

        const remaining = Math.max(0, parseInt(this.game.context.autoplayCounter, 10) || 0);
        const label = `${remaining}`;
        this.autoStopCounterText.visible = !!this.autoStopButton.visible;

        const style = this.autoStopCounterText.style;
        const baseSize = this.autoStopCounterCfg && Number.isFinite(this.autoStopCounterCfg.fontSize) ? this.autoStopCounterCfg.fontSize : 54;
        const minSize = this.autoStopCounterCfg && Number.isFinite(this.autoStopCounterCfg.minFontSize) ? this.autoStopCounterCfg.minFontSize : 26;
        const maxWidth = this.autoStopCounterCfg && Number.isFinite(this.autoStopCounterCfg.maxWidth) ? this.autoStopCounterCfg.maxWidth : 118;

        style.fontSize = baseSize;
        this.autoStopCounterText.text = label;

        while (style.fontSize > minSize && this.autoStopCounterText.width > maxWidth) {
            style.fontSize -= 1;
            this.autoStopCounterText.text = label;
        }
    }

    /**
     * Syncs enabled/disabled button states with the current gameplay state and modal visibility.
     */
    updateButtonState() {
        const title = this.getControllerStateTitle();
        const isReelsSpinning = title === 'REELS_SPINNING';
        const isReelsStopping = title === 'REELS_STOPPING';
        const canInterruptShowWins = title === 'SHOW_WINS';
        const showStopButton = isReelsSpinning || isReelsStopping;
        const connected = !!(this.game && this.game.gsLink && this.game.gsLink.isFullyConnected && this.game.gsLink.isFullyConnected());
        const serverSpinResultReady = !!(this.game && this.game.gsLink && this.game.gsLink.spinEnded);

        const autoplayActive = !!(this.game && this.game.context && this.game.context.autoplay);
        const autoMenuOpen = this.isAutoPlayMenuOpen();
        const buyMenuOpen = this.isBuyBonusMenuOpen();
        const buyConfirmOpen = this.isBuyBonusConfirmOpen();
        const betMenuOpen = this.isBetMenuOpen();
        const nextStateKey = [
            title,
            connected ? 1 : 0,
            serverSpinResultReady ? 1 : 0,
            this.controlsDisabled ? 1 : 0,
            autoplayActive ? 1 : 0,
            autoMenuOpen ? 1 : 0,
            buyMenuOpen ? 1 : 0,
            buyConfirmOpen ? 1 : 0,
            betMenuOpen ? 1 : 0
        ].join(':');

        if (nextStateKey === this.buttonStateKey) {
            return;
        }
        this.buttonStateKey = nextStateKey;

        const mainEnabled = connected && !this.controlsDisabled;
        const startEnabled = connected && (!this.controlsDisabled || canInterruptShowWins);

        if (this.startButton && this.startButton.setEnabled) {
            this.startButton.setEnabled(startEnabled);
        }
        if (this.stopButton && this.stopButton.setEnabled) {
            const canForceStop = connected && showStopButton && serverSpinResultReady;
            this.stopButton.setEnabled(canForceStop);
        }

        const sideEnabled = connected && !this.controlsDisabled;
        const betEnabled = connected && (!this.controlsDisabled || betMenuOpen);
        const autoEnabled = sideEnabled && !autoMenuOpen && !buyMenuOpen && !buyConfirmOpen && !autoplayActive;
        const autoStopEnabled = connected && autoplayActive;

        if (this.autoButton && this.autoButton.setEnabled) this.autoButton.setEnabled(autoEnabled);
        if (this.autoStopButton && this.autoStopButton.setEnabled) this.autoStopButton.setEnabled(autoStopEnabled);
        if (this.betButton && this.betButton.setEnabled) this.betButton.setEnabled(betEnabled && !autoMenuOpen && !buyMenuOpen && !buyConfirmOpen && !autoplayActive);
        if (this.paytableButton && this.paytableButton.setEnabled) this.paytableButton.setEnabled(sideEnabled && !autoMenuOpen && !buyMenuOpen && !buyConfirmOpen && !autoplayActive);
        if (this.buyBonusButton) {
            const canShowBuyBonus = !!GAME_RULES.BUY_BONUS_BUTTON_ENABLED && !!(this.game && this.game.context && this.game.context.hasBuyFeature);
            this.buyBonusButton.visible = canShowBuyBonus;
            if (this.buyBonusButton.setEnabled) {
                this.buyBonusButton.setEnabled(canShowBuyBonus && sideEnabled && !autoMenuOpen && !buyMenuOpen && !buyConfirmOpen && !autoplayActive);
            }
        }
        if (this.lobbyButton && this.lobbyButton.setEnabled) this.lobbyButton.setEnabled(true);
    }

    setStatus(value) {
        const nextValue = typeof value === 'string' ? value : '';
        if (this.pendingState.status === nextValue) {
            return;
        }
        this.pendingState.status = nextValue;
        if (nextValue.trim().length > 0) {
            this.idleBlinkStartedAt = 0;
        }
        this.applyPendingState();
    }

    setWinStatus(value) {
        const nextValue = typeof value === 'string' ? value : '';
        if (this.pendingState.winStatus === nextValue) return;
        this.pendingState.winStatus = nextValue;
        this.applyPendingState();
    }

    setLeftStatus(_value) {}
    setBet(_bet) {}
    setLines(_lines) {}
    setDenom(_denom) {}

    setTotalBet(value) {
        const nextValue = toNumber(value, 0);
        if (this.pendingState.totalBet === nextValue) return;
        this.pendingState.totalBet = nextValue;
        this.applyPendingState();
    }

    setWin(value) {
        const nextValue = toNumber(value, 0);
        if (this.pendingState.win === nextValue) return;
        this.pendingState.win = nextValue;
        this.applyPendingState();
    }

    setCredit(value) {
        const nextValue = toNumber(value, 0);
        if (this.pendingState.credit === nextValue) return;
        this.pendingState.credit = nextValue;
        this.applyPendingState();
    }

    refreshJackpotValues() {
        if (!Array.isArray(this.jackpotValueEntries) || this.jackpotValueEntries.length === 0) return;
        for (let i = 0; i < this.jackpotValueEntries.length; i++) {
            const entry = this.jackpotValueEntries[i];
            if (!entry || !entry.label) continue;
            entry.label.text = tryFormatJackpotValue(entry.rawValueText, this.game);
        }
    }

    getIdleStatusBaseText() {
        const context = this.game && this.game.context ? this.game.context : null;
        if (!context || context.autoplay) {
            return '';
        }

        if (context.turboGame || context.turboSpinIsEnabled === false) {
            return getLocalized(this.game, 'placeBets', 'PLACE YOUR BETS!');
        }

        return getLocalized(this.game, 'holdSpin', 'HOLD START FOR TURBO SPINS');
    }

    getIdleStatusText() {
        const baseStatus = this.getIdleStatusBaseText();
        if (!baseStatus) {
            return '';
        }

        const blinkStatus = getLocalized(this.game, 'startWinUp', 'WIN UP TO 5000 X BET');
        const now = Date.now();
        if (!this.idleBlinkStartedAt) {
            this.idleBlinkStartedAt = now;
        }

        const blinkInterval = 2000;
        const elapsed = now - this.idleBlinkStartedAt;
        return Math.floor(elapsed / blinkInterval) % 2 === 0 ? baseStatus : blinkStatus;
    }

    refreshIdleStatus() {
        if (this.pendingState.status && this.pendingState.status.trim().length > 0) {
            return;
        }

        this.applyPendingState();
    }

    /**
     * Applies buffered meter and status values to Pixi text nodes.
     */
    applyPendingState() {
        if (!this.assetsLoaded) return;
        this.refreshJackpotValues();

        const currency = getCurrency(this.game);
        const creditPrefix = getLocalized(this.game, 'balanceDemo', 'DEMO PLAY :');
        const betPrefix = getLocalized(this.game, 'bet', 'BET :');
        const winPrefix = getLocalized(this.game, 'win', 'WIN:');

        if (this.creditLabelText && this.creditValueText) {
            this.creditLabelText.text = `${creditPrefix}`;
            this.creditValueText.text = ` ${formatMoney(this.pendingState.credit, this.game)} ${currency}`;
            this.creditValueText.x = this.creditLabelText.x + this.creditLabelText.width;
            this.creditValueText.y = this.creditLabelText.y;
        }

        if (this.totalBetLabelText && this.totalBetValueText) {
            this.totalBetLabelText.text = `${betPrefix}`;
            this.totalBetValueText.text = ` ${formatMoney(this.pendingState.totalBet, this.game)} ${currency}`;
            this.totalBetValueText.x = this.totalBetLabelText.x + this.totalBetLabelText.width;
            this.totalBetValueText.y = this.totalBetLabelText.y;
        }

        const hasWinStatus = this.pendingState.winStatus.trim().length > 0;
        const hasWinValue = this.pendingState.win > 0;
        const showWinOverlay = hasWinStatus || hasWinValue;

        if (this.pendingState.status && this.pendingState.status.trim().length > 0) {
            if (this.statusText) this.statusText.text = this.pendingState.status;
            if (this.statusText) this.statusText.visible = true;
            if (this.winStatusText) this.winStatusText.visible = false;
            if (this.winText) this.winText.visible = false;
        } else {
            const defaultStatus = this.getIdleStatusText();
            if (this.statusText) this.statusText.text = defaultStatus;
            if (this.statusText) this.statusText.visible = !showWinOverlay;
            if (this.winStatusText) {
                this.winStatusText.text = this.pendingState.winStatus;
                this.winStatusText.visible = hasWinStatus;
            }
            if (this.winText) {
                this.winText.text = hasWinValue
                    ? `${winPrefix} ${formatMoney(this.pendingState.win, this.game)}`
                    : '';
                this.winText.visible = hasWinValue;
            }
        }
    }

    disableControls() {
        this.controlsDisabled = true;
        this.buttonStateKey = '';
        this.updateButtonState();
    }

    enableControls() {
        this.controlsDisabled = false;
        this.buttonStateKey = '';
        this.updateButtonState();
    }

    getControlsDisabled() {
        return this.controlsDisabled;
    }

    updateMeters() {
        if (!this.game || !this.game.meters) return;
        this.setTotalBet(this.game.meters.getTotalBet());
        this.setCredit(this.game.meters.credit);
        this.setWin(this.game.meters.win);
        if (this.betMenu && this.betMenu.refresh) {
            this.betMenu.refresh();
        }
        if (this.buyBonusMenu && this.buyBonusMenu.refresh) {
            this.buyBonusMenu.refresh();
        }
    }

    onStartSpin() {}
    onReelsStop() {}
    onSpinEnd() {}
    onTakeWin() {}
    onShowWins() {}
    onWinToCredit() {}
    onFreeGamesTakeWins() {
        this.setLeftStatus('');
    }

    onDoubleUp() {}
    onDoubleUpExit() {}

    updateButtonTransitions(delta) {
        const frameDelta = Math.max(0.0001, (Number.isFinite(delta) ? delta : 0) * FRAMES_PER_SECOND);
        const buttons = [
            this.startButton,
            this.stopButton,
            this.autoButton,
            this.autoStopButton,
            this.betButton,
            this.paytableButton,
            this.buyBonusButton,
            this.lobbyButton
        ];

        for (let i = 0; i < buttons.length; i++) {
            const button = buttons[i];
            if (button && typeof button.stepStateTransition === 'function') {
                button.stepStateTransition(frameDelta);
            }
        }
    }

    act(delta) {
        if (!this.assetsLoaded) return;
        this.updateSpinButtonVisibility();
        this.updateAutoPlayButtonVisibility();
        this.updateButtonState();
        this.updateAutoStopCounterLabel();
        this.updateButtonTransitions(delta);
    }
}







