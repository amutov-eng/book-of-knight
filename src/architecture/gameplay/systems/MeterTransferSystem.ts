// @ts-nocheck
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

        const totalWin = Math.max(0, Number(this.game.meters.win) || 0);
        const totalBet = Math.max(1, Number(this.game.meters.getTotalBet?.()) || 0);
        const winMultiplier = totalWin / totalBet;
        const targetFrames = this.resolveTransferDurationFrames(winMultiplier);

        this.game.soundSystem?.stop(SOUND_IDS.COINEND);
        this.game.soundSystem?.play(SOUND_IDS.COINUP, true);
        this.game.context.onscreenWinMeter = this.game.meters.win;
        this.game.menu.setWin(this.game.context.onscreenWinMeter);
        this.game.context.onscreenCreditMeter = this.game.meters.credit;
        this.game.menu.setCredit(this.game.context.onscreenCreditMeter);
        controller.w2cFramesRemaining = Math.max(1, targetFrames);
        controller.w2cSpeed = Math.max(1, Math.ceil(totalWin / controller.w2cFramesRemaining));
        this.game.menu.setStatus('');
        this.game.menu.setWinStatus('');
        return true;
    }

    /**
     * @param {import('../../../game/Controller').default} controller
     * @returns {boolean} true when transfer is complete
     */
    stepWinToCredit(controller) {
        const targetCredit = Math.max(this.game.meters.credit, this.game.context.finalCreditMeter || this.game.meters.credit);

        if (this.game.context.onscreenCreditMeter < targetCredit) {
            const remaining = targetCredit - this.game.context.onscreenCreditMeter;
            const framesRemaining = Math.max(1, Number(controller.w2cFramesRemaining) || 1);
            const delta = Math.min(remaining, Math.max(1, Math.ceil(remaining / framesRemaining)));

            this.game.context.onscreenCreditMeter += delta;
            this.game.menu.setCredit(this.game.context.onscreenCreditMeter);
            controller.w2cSpeed = delta;
            controller.w2cFramesRemaining = Math.max(0, framesRemaining - 1);
            return false;
        }

        this.game.soundSystem?.stop(SOUND_IDS.COINUP);
        this.game.soundSystem?.play(SOUND_IDS.COINEND);
        this.game.meters.credit = targetCredit;
        this.game.menu.setCredit(targetCredit);
        controller.w2cFramesRemaining = 0;
        return true;
    }

    resolveTransferDurationFrames(winMultiplier) {
        const multiplier = Number.isFinite(winMultiplier) ? Number(winMultiplier) : 0;
        if (multiplier >= 30) {
            return 60;
        }
        if (multiplier >= 15) {
            return 54;
        }
        if (multiplier >= 5) {
            return 48;
        }
        return 42;
    }
}

