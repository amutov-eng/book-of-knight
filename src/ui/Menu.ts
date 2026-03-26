// @ts-nocheck
import { GameplayEvent } from '../architecture/gameplay/GameplayStateMachine';
import { getUiHudConfig } from '../config/assetsConfig';
import { GAME_RULES } from '../config/gameRules';
import { getAssetsManifest } from '../core/RuntimeContext';
import BetMenu from './BetMenu';
import AutoPlayMenu from './AutoPlayMenu';
import BuyBonusMenu from './BuyBonusMenu';
import BuyBonusConfirm from './BuyBonusConfirm';
import HelpMenu from './HelpMenu';
import HudTextLayer from './hud/HudTextLayer';
import HudButtonLayer from './hud/HudButtonLayer';
import FreeGamesInfoPanel from './FreeGamesInfoPanel';

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

function getLocalized(game, key, fallback) {
    if (game && game.localization && typeof game.localization.t === 'function') {
        return game.localization.t(key, {}, { defaultValue: fallback });
    }
    return fallback;
}

export default class Menu extends PIXI.Container {
    constructor(game) {
        super();
        this.game = game;
        this.controlsDisabled = false;
        this.assetsLoaded = false;
        this.buildStarted = false;
        this.hudConfig = null;

        this.bottomBg = null;
        this.winFieldBg = null;
        this.textLayer = null;
        this.buttonLayer = null;
        this.freeGamesInfoPanel = null;
        this.betMenu = null;
        this.autoPlayMenu = null;
        this.buyBonusMenu = null;
        this.buyBonusConfirm = null;
        this.helpMenu = null;

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
        this.refreshIdleStatus();
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

        this.bottomBg = this.addSprite(bottom.frame || 'bottom_bg.png', toNumber(bottom.x, 0), toNumber(bottom.y, 1034));
        this.winFieldBg = this.addSprite(winField.frame || 'win_field.png', toNumber(winField.x, 0), toNumber(winField.y, 942));

        this.buildHudLayers();
        this.buildBetMenu();
        this.buildAutoPlayMenu();
        this.buildBuyBonusUi();
        this.buildHelpMenu();
    }

    buildHudLayers() {
        this.textLayer = new HudTextLayer(this.game, this.hudConfig, (frameName) => this.getTexture(frameName));
        this.addChild(this.textLayer);
        this.textLayer.build();

        this.buttonLayer = new HudButtonLayer(this.game, this.hudConfig, (frameName) => this.getTexture(frameName), {
            getControllerStateTitle: () => this.getControllerStateTitle(),
            onStartPressed: () => this.onStartPressed(),
            onAutoPressed: () => this.onAutoPressed(),
            onAutoStopPressed: () => this.onAutoStopPressed(),
            onBetPressed: () => this.toggleBetMenu(),
            onSettingsPressed: () => this.toggleHelpMenu(),
            onBuyBonusPressed: () => this.toggleBuyBonusMenu(),
            onLobbyPressed: () => {
                if (this.game.gsLink && typeof this.game.gsLink.onHomeButton === 'function') {
                    this.game.gsLink.onHomeButton();
                }
            }
        });
        this.addChild(this.buttonLayer);
        this.buttonLayer.build();

        this.freeGamesInfoPanel = new FreeGamesInfoPanel(this.game);
        this.addChild(this.freeGamesInfoPanel);
        this.freeGamesInfoPanel.build();
    }

    onStartPressed() {
        if (!this.game || !this.game.controller) return;
        if (this.isBetMenuOpen()) this.closeBetMenu();
        if (this.isAutoPlayMenuOpen()) this.closeAutoPlayMenu();
        if (this.isBuyBonusMenuOpen()) this.closeBuyBonusMenu(false);
        if (this.isBuyBonusConfirmOpen()) this.closeBuyBonusConfirm(false);
        if (this.isHelpMenuOpen()) this.closeHelpMenu(false);
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

    buildHelpMenu() {
        if (this.helpMenu) return;

        this.helpMenu = new HelpMenu(this.game, () => {
            this.enableControls();
            this.setStatus('');
        }, this.hudConfig);
        this.helpMenu.visible = false;
        this.addChild(this.helpMenu);
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

    isHelpMenuOpen() {
        return !!(this.helpMenu && this.helpMenu.isOpen && this.helpMenu.isOpen());
    }

    openBetMenu() {
        if (!this.betMenu || this.isBetMenuOpen()) return;
        if (this.isAutoPlayMenuOpen()) this.closeAutoPlayMenu();
        if (this.isBuyBonusMenuOpen()) this.closeBuyBonusMenu(false);
        if (this.isBuyBonusConfirmOpen()) this.closeBuyBonusConfirm(false);
        if (this.isHelpMenuOpen()) this.closeHelpMenu(false);
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
        if (this.isBetMenuOpen()) this.closeBetMenu();
        if (this.isBuyBonusMenuOpen()) this.closeBuyBonusMenu(false);
        if (this.isBuyBonusConfirmOpen()) this.closeBuyBonusConfirm(false);
        if (this.isHelpMenuOpen()) this.closeHelpMenu(false);
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
        if (this.isHelpMenuOpen()) this.closeHelpMenu(false);
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
        if (this.isHelpMenuOpen()) this.closeHelpMenu(false);
        this.disableControls();
        this.buyBonusConfirm.show(type, cost);
        this.setStatus(getLocalized(this.game, 'buyTxt', 'BUY'));
    }

    openHelpMenu() {
        if (!this.helpMenu || this.isHelpMenuOpen()) return;
        if (this.isBetMenuOpen()) this.closeBetMenu();
        if (this.isAutoPlayMenuOpen()) this.closeAutoPlayMenu(false);
        if (this.isBuyBonusMenuOpen()) this.closeBuyBonusMenu(false);
        if (this.isBuyBonusConfirmOpen()) this.closeBuyBonusConfirm(false);
        this.disableControls();
        this.helpMenu.show();
        this.setStatus(getLocalized(this.game, 'helpPay', 'PAYTABLE'));
    }

    closeHelpMenu(notify = true) {
        if (!this.helpMenu || !this.isHelpMenuOpen()) return;
        this.helpMenu.hide(notify);
        if (!notify) {
            this.enableControls();
            this.setStatus('');
        }
    }

    toggleHelpMenu() {
        if (this.isHelpMenuOpen()) {
            this.closeHelpMenu();
            return;
        }
        this.openHelpMenu();
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
        if (this.buttonLayer) {
            this.buttonLayer.updateSpinButtonVisibility();
        }
    }

    updateAutoPlayButtonVisibility() {
        if (this.buttonLayer) {
            this.buttonLayer.updateAutoPlayButtonVisibility();
        }
    }

    updateButtonState() {
        if (!this.buttonLayer) return;
        this.buttonLayer.updateButtonState(this.controlsDisabled, {
            autoMenuOpen: this.isAutoPlayMenuOpen(),
            buyMenuOpen: this.isBuyBonusMenuOpen(),
            buyConfirmOpen: this.isBuyBonusConfirmOpen(),
            betMenuOpen: this.isBetMenuOpen(),
            helpMenuOpen: this.isHelpMenuOpen()
        });
    }

    setStatus(value) {
        if (this.textLayer) {
            this.textLayer.setStatus(value);
        }
    }

    setWinStatus(value) {
        if (this.textLayer) {
            this.textLayer.setWinStatus(value);
        }
    }

    setLeftStatus(_value) {}
    setBet(_bet) {}
    setLines(_lines) {}
    setDenom(_denom) {}

    setFreeGamesTitleLabelFirst(value) {
        if (!this.freeGamesInfoPanel) return;
        this.freeGamesInfoPanel.setRemainingCount(value);
        this.freeGamesInfoPanel.setPanelVisible(true);
        if (this.game && this.game.context) {
            this.game.context.freeGamesTitleVisible = true;
        }
    }

    showFreeGamesTitle(visible) {
        if (!this.freeGamesInfoPanel) return;
        this.freeGamesInfoPanel.setPanelVisible(visible);
        if (this.game && this.game.context) {
            this.game.context.freeGamesTitleVisible = !!visible;
        }
        if (this.buttonLayer) {
            this.updateButtonState();
        }
    }

    setTotalBet(value) {
        if (this.textLayer) {
            this.textLayer.setTotalBet(value);
        }
    }

    setWin(value) {
        if (this.textLayer) {
            this.textLayer.setWin(value);
        }
    }

    setCredit(value) {
        if (this.textLayer) {
            this.textLayer.setCredit(value);
        }
    }

    refreshJackpotValues() {
        if (this.textLayer) {
            this.textLayer.refreshJackpotValues();
        }
    }

    refreshIdleStatus() {
        if (this.textLayer) {
            this.textLayer.refreshIdleStatus();
        }
    }

    disableControls() {
        this.controlsDisabled = true;
        this.updateButtonState();
    }

    enableControls() {
        this.controlsDisabled = false;
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

    act(delta = 1) {
        if (!this.assetsLoaded) return;
        this.syncSymbolSpineOverlayVisibility();
        this.updateSpinButtonVisibility();
        this.updateAutoPlayButtonVisibility();
        this.updateButtonState();
        if (this.buttonLayer) {
            this.buttonLayer.stepTransitions(delta);
        }
        if (this.freeGamesInfoPanel && this.freeGamesInfoPanel.act) {
            this.freeGamesInfoPanel.act(delta);
        }
        this.refreshIdleStatus();
    }

    syncSymbolSpineOverlayVisibility() {
        const overlayVisible = !(
            this.isBetMenuOpen()
            || this.isAutoPlayMenuOpen()
            || this.isBuyBonusMenuOpen()
            || this.isBuyBonusConfirmOpen()
            || this.isHelpMenuOpen()
        );

        if (this.game?.symbolSpineOverlay && typeof this.game.symbolSpineOverlay.setVisible === 'function') {
            this.game.symbolSpineOverlay.setVisible(overlayVisible);
        }
    }
}
