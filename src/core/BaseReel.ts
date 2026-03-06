// @ts-nocheck
/**
 * Created by Dimitar on 2/20/2017.
 */
/**
 * Reel groups symbols in a scene2d Group. Each symbol is an Actor.
 * Two extra symbols are inserted - one on top and one on the bottom
 * for partial drawing.
 *
 * @author Dimitar
 *
 */

import ReelSymbol from '../game/ReelSymbol'
import { getBaseReelConfig } from '../config/reelConfig';
import { getAssetsManifest, getIsLandscape } from './RuntimeContext';

const State = Object.freeze({
    REEL_IDLE : 0,
    REEL_SPIN : 1,
    REEL_STOP : 3,
    REEL_SKILL_STOP : 4,
    REEL_BOUNCE : 5
});

/** @typedef {import('pixi.js').Graphics} PixiGraphics */

export default class Reel extends PIXI.Container {

/**
 * Reel constructor
 * @param textures - reference to ReelTextures
 * @param x - x position on the screen
 * @param y - y position on the screen
 * @param strip - int array (math)
 */
    constructor (game, x, y, width, height, strip) {
        super();

        this.game = game;           // reference to game
        const variant = this.game && this.game.variant ? this.game.variant : 'desktop';
        const isLandscape = getIsLandscape();
        const baseReelConfig = getBaseReelConfig(getAssetsManifest(), variant, isLandscape);

        this.SYMBOLS = baseReelConfig.symbolsVisible;	        // visible symbols
        this.clicksToStopLimit = baseReelConfig.clicksToStop;
        this.stopPopulateClicks = this.SYMBOLS;
        this.TOTAL_SYMBOLS = this.SYMBOLS + 2;
        this.STEP = baseReelConfig.spinStep;			    // Spinning step (speed) Aristocrat 38
        this.pitch = baseReelConfig.pitch;			// vertical spacing between symbols
        this.WRAP_Y = 4 * this.pitch;
        this.REEL_SPAN = this.TOTAL_SYMBOLS * this.pitch;

        this.symbolWidth = baseReelConfig.symbolWidth; //156;	// symbol width
        this.symbolHeight = baseReelConfig.symbolHeight; 	// symbol height

        this.trimTopY = baseReelConfig.trimTopY; //436;
        this.trimBottomY = baseReelConfig.trimBottomY;
        this.targetSpeedPxPerSec = this.STEP * 60;
        this.minStopSpeedPxPerSec = Math.max(this.targetSpeedPxPerSec * 0.45, this.pitch * 3);
        this.accelPxPerSec2 = this.targetSpeedPxPerSec * 7;
        this.decelPxPerSec2 = this.targetSpeedPxPerSec * 8;
        this.spinSpeedPxPerSec = 0;
        this.motionAccumulatorSec = 0;

        this.currentStop;		// current top stop
        this.stopAtIndex;		//
        this.travel;

        this.reelClick;		// flag to indicate one stop move

        this.startSpinFlag = false;
        this.stopSpinFlag = false;
        this.skillStopSpin = false;
        this.skillStopped = false; // flag to indicate reel was skill stopped
    //	private boolean reversed = false;
        this.clicksToStop = 0;

        this.frameCnt = 0;


        this.travel = 0;
        this.spriteOffset = 4; // sprite index at stop 0
        this.reelState = State.REEL_IDLE;
        this.reelStrip = strip;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.sortableChildren = true;

        //this.mask = new Graphics();
        /** @type {PixiGraphics} */
        this.reelMaskNormal = new PIXI.Graphics();
        this.reelMaskNormal.rect(0, 0, width, height).fill(0xFF0000);
        this.reelMaskNormal.alpha = 0;
        this.addChild(this.reelMaskNormal); // debug

        /** @type {PixiGraphics} */
        this.reelMaskSpin = new PIXI.Graphics();
        this.reelMaskSpin
            .rect(0, -this.trimTopY, width, height + this.trimTopY + this.trimBottomY)
            .fill(0x00ff00);
        this.reelMaskSpin.alpha = 0;
        this.addChild(this.reelMaskSpin); // debug

        //this.reelMaskExtended = new Graphics();
        //this.reelMaskExtended.beginFill(0x0033CC);
        //this.reelMaskExtended.drawRect(0, -30, width, height + 60);
        //this.reelMaskExtended.endFill();
        //this.reelMaskExtended.alpha = 0.5;
        //this.addChild(this.reelMaskExtended); // debug

        /****************************************************************
         * visibleSymbols holds the symbols drawn the screen and
         * reelStrip is a reference to int array defining the math
         ***************************************************************/
        this.visibleSymbols = [];
        this.stopSymbols = [0, 1, 7];				// game outcome
        this.callback = null;
        this.highlight;
        this.timeElapsed = 0;
        this.lastTimeElapsed = 0;
        this.currentTrimMask = undefined;
        this.hiddenTopSymbolIndex = -1;
        this.hiddenBottomSymbolIndex = -1;
        this.currentBlurFrame = 0;

        //
        // Add reel highlight
        //
        //highlight = new ReelHighlight(textures);
        //highlight.setPosition(-9, -16);

        let symbol;
        let symbolX = this.width/2, symbolY = this.height/2;
        this.currentStop = 10;

        for (let i = 0; i < this.TOTAL_SYMBOLS; i++ ) {
            this.currentStop++;
            this.currentStop %= this.reelStrip.length;

            symbol = new ReelSymbol(game, this, this.reelStrip[this.currentStop]);
            symbol.setPosition(symbolX, symbolY);
            symbolY += this.pitch;
            if (symbolY > this.WRAP_Y) {
                symbolY -= this.REEL_SPAN;
            }
            this.visibleSymbols.push(symbol);
            this.addChild(symbol);
        }
        this.updateSymbolDepths();

        // Keep mask renderable for Pixi masking pipeline; alpha=0 keeps it visually hidden.
        this.reelMaskNormal.visible = true;
        this.reelMaskSpin.visible = true;
        this.trim(null);
    }

    act(delta){
        this.updateSymbolAnimations(delta);

        this.reelClick = false;

        // FSM
        switch (this.reelState) {

            case State.REEL_IDLE:
                this.handleIdleState();
                break;

            case State.REEL_SPIN:
                this.handleSpinState(delta);
                break;

            case State.REEL_STOP:
                this.handleStopState(delta);
                break;

            case State.REEL_SKILL_STOP:
                this.handleSkillStopState(delta);
                break;

            case State.REEL_BOUNCE:
                this.handleBounceState();
                break;

            default:
                this.reelState = State.REEL_IDLE;

                break;
        }
    }

    /**
     * Spins the reel
     */
    spin(delta) {
        const dt = Number.isFinite(delta) && delta > 0 ? delta : (1 / 60);
        const tickSec = 0.010;
        this.reelClick = false;
        this.motionAccumulatorSec += dt;

        while (this.motionAccumulatorSec >= tickSec) {
            this.motionAccumulatorSec -= tickSec;
            this.spinFixedStep();
        }

    }

    spinFixedStep() {
        let step = this.STEP;

        if ((this.stopSpinFlag || this.skillStopSpin) && this.pitch - this.travel < this.STEP) {
            step = this.pitch - this.travel;
        }

        this.travel += step;

        if (this.travel >= this.pitch) {
            this.travel %= this.pitch;
            this.spriteOffset += this.SYMBOLS + 1;
            this.spriteOffset %= this.TOTAL_SYMBOLS;
            this.reelClick = true;
        }

        for (let i = 0; i < this.TOTAL_SYMBOLS; i++) {
            const symbol = this.visibleSymbols[i];
            let nextY = symbol.getLogicalY() + step;

            if (nextY >= this.WRAP_Y) {
                nextY -= this.REEL_SPAN;
                this.currentStop++;
                this.currentStop %= this.reelStrip.length;
                symbol.setIndex(this.reelStrip[this.currentStop]);
            }

            symbol.setLogicalY(nextY);
        }

        this.updateSymbolDepths();
    }

    updateSymbolDepths() {
        for (let i = 0; i < this.visibleSymbols.length; i++) {
            const symbol = this.visibleSymbols[i];
            const h = symbol && symbol.texture ? symbol.texture.height : this.symbolHeight;
            symbol.zIndex = symbol.y + h * 0.5;
        }
    }

    updateSymbolAnimations(delta) {
        // Update symbol animations at ~25fps.
        this.timeElapsed += delta;
        if (this.timeElapsed - this.lastTimeElapsed <= 0.040) return;
        this.lastTimeElapsed = this.timeElapsed;
        for (let i = 0; i < this.TOTAL_SYMBOLS; i++) {
            this.visibleSymbols[i].act(delta);
        }
    }

    handleIdleState() {
        if (!this.startSpinFlag) return;

        this.startSpinFlag = false;
        this.stopSpinFlag = false;
        this.skillStopSpin = false;
        this.clicksToStop = 0;
        this.dampedIndex = 0;
        this.frameCnt = 0;
        this.spinSpeedPxPerSec = 0;
        this.motionAccumulatorSec = 0;
        this.reelState = State.REEL_SPIN;
        this.trim(this.reelMaskSpin);
        log('BaseReel::act, state change REEL_IDLE > REEL_SPIN', 'debug');
    }

    handleSpinState(delta) {
        this.spin(delta);
        this.applySpinBlurRamp();

        if (this.skillStopSpin) {
            log("Reel: " + this.x, "reel skill stopped, travel: " + this.travel);
            this.clicksToStop = 0;
            this.reelState = State.REEL_SKILL_STOP;
            log('BaseReel::act, state change REEL_SPIN > REEL_SKILL_STOP', 'debug');
            return;
        }

        if (this.stopSpinFlag) {
            this.clicksToStop = 0;
            this.reelState = State.REEL_STOP;
            log('BaseReel::act, state change REEL_SPIN > REEL_STOP', 'debug');
        }
    }

    handleStopState(delta) {
        this.spin(delta);

        if (this.skillStopSpin) {
            this.clicksToStop = 0;
            this.reelState = State.REEL_SKILL_STOP;
            log('BaseReel::act, state change REEL_STOP > REEL_SKILL_STOP', 'debug');
            return;
        }

        if (this.reelClick) {
            this.clicksToStop++;
        }

        if (this.clicksToStop >= 1 && this.clicksToStop <= this.stopPopulateClicks) {
            this.stopHelper(this.clicksToStop);
            return;
        }

        if (this.clicksToStop === this.clicksToStopLimit) {
            this.alignToGrid();
            this.stopSpinFlag = false;
            this.reelState = State.REEL_BOUNCE;
            this.trim(null);
            this.dampedIndex = 0;
            this.notifyStopped();
            log('BaseReel::act, state change REEL_STOP > REEL_BOUNCE', 'debug');
        }
    }

    handleSkillStopState(delta) {
        this.spin(delta);
        if (!this.reelClick) return;

        this.skillStopSpin = false;
        this.skillStopHelper();
        this.alignToGrid();
        this.trim(null);
        this.reelState = State.REEL_BOUNCE;
        this.dampedIndex = 0;
        this.notifyStopped();
        log('BaseReel::act, state change REEL_SKILL_STOP > REEL_BOUNCE', 'debug');
    }

    handleBounceState() {
        if (this.frameCnt > 0) {
            this.applyBounceBlurRamp();
            this.frameCnt--;
            return;
        }

        // Ensure all reels end with the base (non-blur) frame.
        this.debounce(0);
        this.trim(null);
        this.reelState = State.REEL_IDLE;
        this.spinSpeedPxPerSec = 0;
        log('BaseReel::act, state change REEL_BOUNCE > REEL_IDLE', 'debug');
    }

    applySpinBlurRamp() {
        if (this.frameCnt >= 6) return;
        switch (this.frameCnt) {
            case 0: this.debounce(1); break;
            case 2: this.debounce(2); break;
            case 4: this.debounce(3); break;
            default: break;
        }
        this.frameCnt++;
    }

    applyBounceBlurRamp() {
        switch (this.frameCnt) {
            case 5: this.debounce(2); break;
            case 3: this.debounce(1); break;
            case 1: this.debounce(0); break;
            default: break;
        }
    }

    notifyStopped() {
        if (typeof this.callback === 'function') {
            this.callback();
        }
    }

    alignToGrid() {
        if (!Number.isFinite(this.travel)) return;
        const correction = ((this.travel % this.pitch) + this.pitch) % this.pitch;
        if (correction < 0.001) {
            this.travel = 0;
            return;
        }

        for (let i = 0; i < this.visibleSymbols.length; i++) {
            let y = this.visibleSymbols[i].getLogicalY() - correction;
            y = ((y + this.pitch) % this.REEL_SPAN + this.REEL_SPAN) % this.REEL_SPAN - this.pitch;
            y = Math.round(y * 1000) / 1000;
            this.visibleSymbols[i].setLogicalY(y);
        }
        this.travel = 0;
        this.updateSymbolDepths();
    }

    /**
     * Trim symbols outside reel margins
     * @param {PixiGraphics|null} mask
     */
    trim(mask) {
        if (this.hiddenTopSymbolIndex >= 0) {
            this.visibleSymbols[this.hiddenTopSymbolIndex].visible = true;
            this.hiddenTopSymbolIndex = -1;
        }

        if (this.hiddenBottomSymbolIndex >= 0) {
            this.visibleSymbols[this.hiddenBottomSymbolIndex].visible = true;
            this.hiddenBottomSymbolIndex = -1;
        }

        if (this.currentTrimMask !== mask) {
            for (let i = 0; i < this.visibleSymbols.length; i++) {
                this.visibleSymbols[i].mask = mask;
            }
            this.currentTrimMask = mask;
        }

        if(mask == null) { // hide symbols on top
            this.hiddenTopSymbolIndex = (this.spriteOffset + 3) % this.TOTAL_SYMBOLS;
            this.hiddenBottomSymbolIndex = (this.spriteOffset + 4) % this.TOTAL_SYMBOLS;
            this.visibleSymbols[this.hiddenTopSymbolIndex].visible = false;
            this.visibleSymbols[this.hiddenBottomSymbolIndex].visible = false;
        }
    }

    debounce(index) {
        if (this.currentBlurFrame === index) {
            return;
        }
        this.currentBlurFrame = index;

        let symbol;

        for (let i = 0; i < this.visibleSymbols.length; i++) {
            symbol = this.visibleSymbols[i];
            symbol.setBlurFrame(index);
        }

    }

    /**
     * This function will start a reel spin for
     * @param stopAtIndex - stop in game outcome
     */
    startSpin() {
        this.startSpinFlag	= true;
        this.skillStopped = false;
        this.currentBlurFrame = -1;
    }

    /**
     * Signal reel stop
     */
    stop() {
        this.stopSpinFlag = true;
    }

    forceStop() {
        if (this.reelState === State.REEL_IDLE) {
            return;
        }

        this.startSpinFlag = false;
        this.stopSpinFlag = false;
        this.skillStopSpin = false;
        this.skillStopped = true;
        this.clicksToStop = this.clicksToStopLimit;

        this.skillStopHelper();
        this.alignToGrid();
        this.trim(null);
        this.debounce(0);

        this.frameCnt = 0;
        this.travel = 0;
        this.motionAccumulatorSec = 0;
        this.spinSpeedPxPerSec = 0;
        this.reelState = State.REEL_IDLE;

        this.notifyStopped();
    }

    /**
     * Signal skill stop reel
     */
    skillStop() {
        this.skillStopSpin = true;
        this.skillStopped = true;
    }

    skillStopHelper() {
        const offset = this.spriteOffset;
        this.visibleSymbols[offset].setIndex(this.stopSymbols[0]);
        this.visibleSymbols[(offset + 1) % this.TOTAL_SYMBOLS].setIndex(this.stopSymbols[1]);
        this.visibleSymbols[(offset + 2) % this.TOTAL_SYMBOLS].setIndex(this.stopSymbols[2]);
    }

    stopHelper(index) {
        // the first symbol that is about to come up from the top
        let symbol = this.visibleSymbols[(this.spriteOffset + this.SYMBOLS) % this.TOTAL_SYMBOLS];
        symbol.setIndex(this.stopSymbols[this.SYMBOLS - index]);
    }

    getReelSymbolAtStop(stop) {
        return this.visibleSymbols[(this.spriteOffset + stop) % this.TOTAL_SYMBOLS];
    }

    isReelStopped() {
        return (this.reelState === State.REEL_IDLE);
    }

    isReelStopping() {
        return this.stopSpinFlag;
    }

    isSkillStopped() {
        return this.skillStopped;
    }

    /**
     * Highlight reel
     * @param int - iterations
     */
    highlight(iterations) {
        //highlight.show(iterations);
    }

    /**
     * Highlight scatters if any
     */
    highlightScatters() {
        let result = false;
        const offset = this.spriteOffset;
        for(let i=0; i < 3; i++) {
            const symbol = this.visibleSymbols[(offset + i) % this.TOTAL_SYMBOLS];
            if(symbol.getIndex() === 0) {
                symbol.animate(true, false, true);
                result = true;
            }
        }
        return result;
    }

    //highlightSymbolAtStop(stop) {
    //    this.visibleSymbols[(spriteOffset + stop) % 5].isWinning = true;
    //}

    highlightSymbolAtStop(stop, looping, isLong){
        const symbol = this.visibleSymbols[(this.spriteOffset + stop) % this.TOTAL_SYMBOLS];
        symbol.animate(true, looping, isLong);
        symbol.isWinning = true;
    }

    removeHighlight() {
        for( let i = 0; i < this.TOTAL_SYMBOLS; i++ ) {
            this.visibleSymbols[i].animate(false, false, false);
            this.visibleSymbols[i].alpha = 1.0;
            this.visibleSymbols[i].isWinning = false;
        }
        //this.highlight.hide(-1);
    }

    registerCallback(callback) {
        this.callback = callback;
    }

    unregisterCallback() {
        this.callback = null;
    }

    /**
     * @param {number[]} strip
     */
    setReelStrip(strip) {
        if (!Array.isArray(strip) || strip.length === 0) return;
        this.reelStrip = strip;
        this.currentStop = this.currentStop % this.reelStrip.length;
    }

}
