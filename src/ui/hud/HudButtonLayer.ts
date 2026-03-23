// @ts-nocheck
import { APP_FONT_FAMILY, APP_FONT_WEIGHT_REGULAR } from '../../config/fontConfig';
import { GAME_RULES } from '../../config/gameRules';

const BUTTON_DISABLED_ALPHA = 0.85;
const BUTTON_ENABLE_FROM_ALPHA = 1;
const BUTTON_ENABLE_FADE_FRAMES = 0;

function toNumber(value, fallback = 0) {
    return Number.isFinite(value) ? value : fallback;
}

export default class HudButtonLayer extends PIXI.Container {
    constructor(game, hudConfig, getTexture, handlers) {
        super();
        this.game = game;
        this.hudConfig = hudConfig;
        this.getTexture = getTexture;
        this.handlers = handlers;
        this.buttonStateKey = '';
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
    }

    build() {
        const btn = this.hudConfig && this.hudConfig.buttons ? this.hudConfig.buttons : {};
        const startCfg = btn.start || {};
        const stopCfg = btn.stop || {};
        const autoCfg = btn.auto || {};
        const autoStopCfg = btn.autoStop || {};
        const betCfg = btn.bet || {};
        const settingsCfg = btn.settings || {};
        const buyBonusCfg = btn.buyBonus || {};
        const homeCfg = btn.home || {};

        this.startButton = this.createButton(startCfg, 'button_start', toNumber(startCfg.x, 1616), toNumber(startCfg.y, 412), toNumber(startCfg.width, 300), toNumber(startCfg.height, 300), () => this.handlers.onStartPressed());
        this.stopButton = this.createButton(stopCfg, 'button_stop', toNumber(stopCfg.x, 1616), toNumber(stopCfg.y, 412), toNumber(stopCfg.width, 300), toNumber(stopCfg.height, 300), () => this.handlers.onStartPressed());
        if (this.stopButton) this.stopButton.visible = false;

        this.autoButton = this.createButton(autoCfg, 'button_autoplay', toNumber(autoCfg.x, 1728), toNumber(autoCfg.y, 88), toNumber(autoCfg.width, 162), toNumber(autoCfg.height, 162), () => this.handlers.onAutoPressed());
        this.autoStopButton = this.createButton(autoStopCfg, 'button_autoX', toNumber(autoStopCfg.x, toNumber(autoCfg.x, 1728)), toNumber(autoStopCfg.y, toNumber(autoCfg.y, 88)), toNumber(autoStopCfg.width, toNumber(autoCfg.width, 162)), toNumber(autoStopCfg.height, toNumber(autoCfg.height, 162)), () => this.handlers.onAutoStopPressed());
        if (this.autoStopButton) {
            this.autoStopButton.visible = false;
            this.buildAutoStopCounter(autoStopCfg);
        }

        this.betButton = this.createButton(betCfg, 'button_bet', toNumber(betCfg.x, 1728), toNumber(betCfg.y, 756), toNumber(betCfg.width, 162), toNumber(betCfg.height, 162), () => this.handlers.onBetPressed());
        this.paytableButton = this.createButton(settingsCfg, 'button_settings', toNumber(settingsCfg.x, 30), toNumber(settingsCfg.y, 98), toNumber(settingsCfg.width, 162), toNumber(settingsCfg.height, 162), () => this.handlers.onSettingsPressed());
        this.buyBonusButton = this.createButton(buyBonusCfg, 'bb_yellow', toNumber(buyBonusCfg.x, 0), toNumber(buyBonusCfg.y, 346), toNumber(buyBonusCfg.width, 194), toNumber(buyBonusCfg.height, 164), () => this.handlers.onBuyBonusPressed());
        this.lobbyButton = this.createButton(homeCfg, 'button_home', toNumber(homeCfg.x, 83), toNumber(homeCfg.y, 1030), toNumber(homeCfg.width, 50), toNumber(homeCfg.height, 50), () => this.handlers.onLobbyPressed());

        this.updateSpinButtonVisibility();
        this.updateAutoPlayButtonVisibility();
    }

    createButton(buttonCfg, fallbackBaseName, x, y, width, height, onRelease) {
        const cfg = buttonCfg && typeof buttonCfg === 'object' ? buttonCfg : {};
        const baseName = String(cfg.base || fallbackBaseName || '').trim();
        const normalFrame = String(cfg.normalFrame || cfg.normal || (baseName ? `${baseName}_001.png` : ''));
        const downFrame = String(cfg.downFrame || cfg.down || (baseName ? `${baseName}_002.png` : ''));
        const hoverFrame = String(cfg.hoverFrame || cfg.hover || (baseName ? `${baseName}_hover.png` : ''));
        const disabledFrame = String(cfg.disabledFrame || cfg.disabled || (baseName ? `${baseName}_deact.png` : ''));
        const normal = normalFrame ? this.getTexture(normalFrame) : null;
        if (!normal) return null;

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
            if (!state.enabled || state.fadeFramesRemaining <= 0) return;
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
            fontWeight: String(counterCfg.fontWeight || APP_FONT_WEIGHT_REGULAR),
            align: String(counterCfg.align || 'center')
        };

        this.autoStopCounterText = new PIXI.Text({
            text: '',
            style: new PIXI.TextStyle({
                fontFamily: this.hudConfig && this.hudConfig.fonts && this.hudConfig.fonts.primary ? String(this.hudConfig.fonts.primary) : APP_FONT_FAMILY,
                fontSize: this.autoStopCounterCfg.fontSize,
                fill: this.autoStopCounterCfg.color,
                fontWeight: this.autoStopCounterCfg.fontWeight,
                align: this.autoStopCounterCfg.align
            })
        });

        this.autoStopCounterText.anchor.set(0.5, 0.5);
        this.autoStopCounterText.position.set(toNumber(this.autoStopButton.x, 0) + this.autoStopCounterCfg.x, toNumber(this.autoStopButton.y, 0) + this.autoStopCounterCfg.y);
        this.autoStopCounterText.visible = false;
        this.addChild(this.autoStopCounterText);
    }

    updateSpinButtonVisibility() {
        const title = this.handlers.getControllerStateTitle();
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

    updateButtonState(controlsDisabled, modalState) {
        const title = this.handlers.getControllerStateTitle();
        const isReelsSpinning = title === 'REELS_SPINNING';
        const isReelsStopping = title === 'REELS_STOPPING';
        const canInterruptShowWins = title === 'SHOW_WINS';
        const showStopButton = isReelsSpinning || isReelsStopping;
        const connected = !!(this.game && this.game.gsLink && this.game.gsLink.isFullyConnected && this.game.gsLink.isFullyConnected());
        const serverSpinResultReady = !!(this.game && this.game.gsLink && this.game.gsLink.spinEnded);
        const autoplayActive = !!(this.game && this.game.context && this.game.context.autoplay);
        const nextStateKey = [
            title,
            connected ? 1 : 0,
            serverSpinResultReady ? 1 : 0,
            controlsDisabled ? 1 : 0,
            autoplayActive ? 1 : 0,
            modalState.autoMenuOpen ? 1 : 0,
            modalState.buyMenuOpen ? 1 : 0,
            modalState.buyConfirmOpen ? 1 : 0,
            modalState.betMenuOpen ? 1 : 0
        ].join(':');

        if (nextStateKey === this.buttonStateKey) {
            return;
        }
        this.buttonStateKey = nextStateKey;

        const startEnabled = connected && (!controlsDisabled || canInterruptShowWins);
        if (this.startButton && this.startButton.setEnabled) this.startButton.setEnabled(startEnabled);
        if (this.stopButton && this.stopButton.setEnabled) {
            const canForceStop = connected && showStopButton && serverSpinResultReady;
            this.stopButton.setEnabled(canForceStop);
        }

        const sideEnabled = connected && !controlsDisabled;
        const betEnabled = connected && (!controlsDisabled || modalState.betMenuOpen);
        const autoEnabled = sideEnabled && !modalState.autoMenuOpen && !modalState.buyMenuOpen && !modalState.buyConfirmOpen && !autoplayActive;
        const autoStopEnabled = connected && autoplayActive;

        if (this.autoButton && this.autoButton.setEnabled) this.autoButton.setEnabled(autoEnabled);
        if (this.autoStopButton && this.autoStopButton.setEnabled) this.autoStopButton.setEnabled(autoStopEnabled);
        if (this.betButton && this.betButton.setEnabled) this.betButton.setEnabled(betEnabled && !modalState.autoMenuOpen && !modalState.buyMenuOpen && !modalState.buyConfirmOpen && !autoplayActive);
        if (this.paytableButton && this.paytableButton.setEnabled) this.paytableButton.setEnabled(sideEnabled && !modalState.autoMenuOpen && !modalState.buyMenuOpen && !modalState.buyConfirmOpen && !autoplayActive);
        if (this.buyBonusButton) {
            const canShowBuyBonus = !!GAME_RULES.BUY_BONUS_BUTTON_ENABLED && !!(this.game && this.game.context && this.game.context.hasBuyFeature);
            this.buyBonusButton.visible = canShowBuyBonus;
            if (this.buyBonusButton.setEnabled) {
                this.buyBonusButton.setEnabled(canShowBuyBonus && sideEnabled && !modalState.autoMenuOpen && !modalState.buyMenuOpen && !modalState.buyConfirmOpen && !autoplayActive);
            }
        }
        if (this.lobbyButton && this.lobbyButton.setEnabled) this.lobbyButton.setEnabled(true);
    }

    stepTransitions(delta) {
        const buttons = [this.startButton, this.stopButton, this.autoButton, this.autoStopButton, this.betButton, this.paytableButton, this.buyBonusButton, this.lobbyButton];
        for (let i = 0; i < buttons.length; i++) {
            if (buttons[i] && typeof buttons[i].stepStateTransition === 'function') {
                buttons[i].stepStateTransition(delta);
            }
        }
    }
}
