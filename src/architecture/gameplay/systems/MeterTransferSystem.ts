// @ts-nocheck
import { getGameplayConfig } from '../../../config/gameplayConfig';
import { SOUND_IDS } from '../../../config/soundConfig';

export default class MeterTransferSystem {
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
    beginWinToCredit(controller) {
        if (this.game.meters.win <= 0) {
            return false;
        }

        this.game.soundSystem?.stop(SOUND_IDS.COINEND);
        this.game.soundSystem?.play(SOUND_IDS.COINUP, true);
        this.game.context.onscreenWinMeter = this.game.meters.win;
        this.game.menu.setWin(this.game.context.onscreenWinMeter);
        this.game.context.onscreenCreditMeter = this.game.meters.credit;
        this.game.menu.setCredit(this.game.context.onscreenCreditMeter);
        controller.w2cSpeed = Math.max(1, getGameplayConfig().winToCreditStep);
        this.game.menu.setStatus('');
        this.game.menu.setWinStatus('');
        return true;
    }

    /**
     * @param {import('../../../game/Controller').default} controller
     * @returns {boolean} true when transfer is complete
     */
    stepWinToCredit(controller) {
        controller.w2cSpeed = Math.max(1, getGameplayConfig().winToCreditStep);
        const targetCredit = Math.max(this.game.meters.credit, this.game.context.finalCreditMeter || this.game.meters.credit);

        if (this.game.context.onscreenCreditMeter < targetCredit) {
            const remaining = targetCredit - this.game.context.onscreenCreditMeter;
            const delta = remaining > controller.w2cSpeed ? controller.w2cSpeed : remaining;

            this.game.context.onscreenCreditMeter += delta;
            this.game.menu.setCredit(this.game.context.onscreenCreditMeter);
            return false;
        }

        this.game.soundSystem?.stop(SOUND_IDS.COINUP);
        this.game.soundSystem?.play(SOUND_IDS.COINEND);
        this.game.meters.credit = targetCredit;
        this.game.menu.setCredit(targetCredit);
        return true;
    }
}

