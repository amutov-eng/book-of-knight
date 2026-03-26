// @ts-nocheck
/**
 * Created by Dimitar on 2/17/2017.
 */
import BaseScreen from "../core/BaseScreen";
import BackgroundLayer from './BackgroundLayer';
import ReelsFrameLayer from './ReelsFrameLayer';
import ServerErrorModal from './ServerErrorModal';

/** @typedef {import('../core/BaseGame').default} BaseGame */

export default class MainScreen extends BaseScreen {

    /**
     * @param {BaseGame} game
     */
    constructor(game){
        super(game);
        log('MainScreen::constructor', 'debug');
        this.connectionGraceTimerSec = 0;
        this.connectionGraceThresholdSec = 1.0;
        this.serverErrorModal = null;
    }

    show() {
        this.game.backgroundLayer = new BackgroundLayer(this.game);
        this.game.backgroundLayer.setByState(this.game.controller.state.title);
        this.game.screen.stage.addChild(this.game.backgroundLayer);
        this.game.reels.show();
        this.game.reelsFrameLayer = new ReelsFrameLayer(this.game);
        this.game.reelsFrameLayer.setByState(this.game.controller.state.title);
        this.game.screen.stage.addChild(this.game.reelsFrameLayer);
        this.game.menu.show();
        this.stage.addChild(this.game.menu);
        this.buildServerErrorModal();
        this.stage.addChild(this.serverErrorModal);
        this.serverErrorModal.hide();
    }

    act(delta) {
        this.updateConnectionErrorState(delta);
        if (this.serverErrorModal && this.serverErrorModal.visible) {
            return;
        }

        if (this.game.gameplayEngine && this.game.gameplayEngine.update) {
            this.game.gameplayEngine.update(delta);
        } else {
            this.game.controller.update(delta);
        }
        for(let i = 0; i < this.stage.children.length; i++ ) {
            if (this.stage.children[i].act) {
                this.stage.children[i].act(delta);
            }
        }
    }

    buildServerErrorModal() {
        if (this.serverErrorModal) return;
        this.serverErrorModal = new ServerErrorModal(() => window.location.reload());
    }

    updateConnectionErrorState(delta) {
        const serverError = this.game.context && this.game.context.serverError ? this.game.context.serverError : null;
        const isConnected = !!(this.game.gsLink && this.game.gsLink.isFullyConnected && this.game.gsLink.isFullyConnected());
        if (isConnected) {
            this.connectionGraceTimerSec = 0;
            if (!serverError || !serverError.visible) {
                this.setConnectionErrorVisible(false);
            }
            return;
        }

        this.connectionGraceTimerSec += Number.isFinite(delta) ? delta : 0;
        if (this.connectionGraceTimerSec < this.connectionGraceThresholdSec) {
            return;
        }

        if (serverError && serverError.visible) {
            this.setConnectionErrorVisible(true, serverError.message);
            return;
        }

        this.setConnectionErrorVisible(true, 'Unable to connect with server.\nCheck your connection and try again');
    }

    setConnectionErrorVisible(visible, message) {
        if (!this.serverErrorModal) return;
        if (visible) {
            const screenWidth = (this.game.renderer && this.game.renderer.width) ? this.game.renderer.width : 1920;
            const screenHeight = (this.game.renderer && this.game.renderer.height) ? this.game.renderer.height : 1080;
            this.serverErrorModal.resize(screenWidth, screenHeight);
            this.serverErrorModal.show(message);
            return;
        }
        this.serverErrorModal.hide();
    }
}
