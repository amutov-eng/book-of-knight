// @ts-nocheck
import { createGameOutcome } from '../../../game/GameOutcome';
import { isInFreeGames } from '../../../game/FreeGamesController';

function getLocalized(game, key, fallback) {
    if (game && game.localization && typeof game.localization.t === 'function') {
        return game.localization.t(key, {}, { defaultValue: fallback });
    }
    return fallback;
}

export default class SpinSystem {
    /**
     * @param {import('../../../core/BaseGame').default} game
     */
    constructor(game) {
        this.game = game;
    }

    /**
     * @param {import('../../../game/Controller').default} controller
     * @returns {boolean}
     */
    startSpin(controller) {
        if (!this.game.gsLink || !this.game.gsLink.isFullyConnected || !this.game.gsLink.isFullyConnected()) {
            this.game.menu.setStatus('UNABLE TO CONNECT WITH SERVER');
            return false;
        }

        controller.lineCounter = 0;
        controller.reelCounter = 0;
        controller.lastReelStopped = -1;

        this.game.context.outcome = createGameOutcome();

        const totalBet = this.game.meters.getTotalBet();
        const freeGamesSpin = isInFreeGames(this.game.context);
        const hasBuyBonus = !!this.game.context.hasBuyBonus;
        const buyType = hasBuyBonus ? Number(this.game.context.buyBonusType) : -1;
        const buyMult = hasBuyBonus
            ? (buyType === 0 ? Number(this.game.context.buyFreeGamesMult || 0) : Number(this.game.context.buyHoldAndWinMult || 0))
            : 1;

        const requiredCredits = freeGamesSpin ? 0 : (hasBuyBonus ? (totalBet * buyMult) : totalBet);
        if (!Number.isFinite(requiredCredits) || requiredCredits <= 0) {
            this.game.menu.setStatus('BUY BONUS IS NOT AVAILABLE');
            this.game.context.hasBuyBonus = false;
            this.game.context.buyBonusType = -1;
            return false;
        }

        if (requiredCredits > this.game.meters.credit) {
            this.game.menu.setStatus('INSERT CREDITS TO PLAY');
            this.game.context.hasBuyBonus = false;
            this.game.context.buyBonusType = -1;
            return false;
        }

        this.game.context.onscreenCreditMeter = Math.floor(this.game.meters.credit - requiredCredits);

        for (let i = 0; i < this.game.reels.NUMBER_OF_REELS; i++) {
            this.game.reels.spinReel(i);
        }

        this.game.gsLink.setParams();
        this.game.gsLink.spin();

        // Consume buy-bonus intent for one spin only.
        this.game.context.hasBuyBonus = false;
        this.game.context.buyBonusType = -1;

        this.game.menu.setCredit(this.game.context.onscreenCreditMeter);
        this.game.menu.disableControls();
        this.game.menu.setWin(0);
        this.game.menu.setWinStatus('');
        this.game.menu.setStatus(
            freeGamesSpin
                ? getLocalized(this.game, 'freeGameLeft', 'FREE GAMES')
                : getLocalized(this.game, 'goodLuck', 'GOOD LUCK !')
        );

        return true;
    }

    /**
     * @param {number} previousLastReelStopped
     * @returns {{changed:boolean,lastReel:number}}
     */
    getLastStoppedReel(previousLastReelStopped) {
        let lastReel = -1;
        for (let r = 0; r < this.game.reels.NUMBER_OF_REELS; r++) {
            if (this.game.reels.reelStopped(r)) {
                lastReel = r;
            }
        }

        return {
            changed: previousLastReelStopped !== lastReel,
            lastReel
        };
    }

    /**
     * @returns {boolean}
     */
    areAllReelsStopped() {
        for (let r = 0; r < this.game.reels.NUMBER_OF_REELS; r++) {
            if (!this.game.reels.reelStopped(r)) {
                return false;
            }
        }
        return true;
    }
}
