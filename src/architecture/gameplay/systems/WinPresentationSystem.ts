// @ts-nocheck
import { WINTYPES } from '../../../game/Win';
import { formatMoneyByGame, getLocalizedText } from '../../../ui/uiTextFormat';

const SYMBOLS_TO_TEXT = ['BOOK', '10', 'J', 'Q', 'K', 'A', 'TORCH', 'AXE', 'CHALICE', 'KNIGHT'];

export default class WinPresentationSystem {
    /**
     * @param {import('../../../core/BaseGame').default} game
     */
    constructor(game) {
        this.game = game;
    }

    getWinValue(win) {
        if (!win) return 0;

        if (win.type === WINTYPES.SCATTER) {
            return win.mult * this.game.meters.getTotalBet();
        }

        return win.mult * this.game.meters.getBetPerLine() * this.game.meters.getDenomination();
    }

    winningLineToText(win) {
        if (!win) return '';

        const symbolText = SYMBOLS_TO_TEXT[win.symbol] || '';
        const valueText = formatMoneyByGame(this.getWinValue(win), this.game);

        if (win.type === WINTYPES.SCATTER) {
            return `${win.cnt} X ${symbolText} : ${valueText}`;
        }

        const lineLabel = getLocalizedText(this.game, 'line', 'LINE').trim();
        return `${lineLabel} ${win.winningLine + 1} : ${win.cnt} X ${symbolText} : ${valueText}`;
    }

    /**
     * @param {number} lineIndex
     * @returns {number}
     */
    processWinAt(lineIndex) {
        const win = this.game.context.outcome.wins[lineIndex];
        if (!win) return 80;
        let spineAnimationMs = 0;

        this.game.reels.unhighlightAll();
        this.game.menu.setStatus('');

        switch (win.type) {
            case WINTYPES.LINE:
                spineAnimationMs = this.game.reels.highlightWin(win, false, true) || 0;
                if (this.game.reels.lineRenderer) {
                    this.game.reels.lineRenderer.addLine(win.winningLine);
                }
                this.game.context.onscreenWinMeter += this.getWinValue(win);
                this.game.menu.setWin(this.game.context.onscreenWinMeter);
                this.game.menu.setWinStatus(this.winningLineToText(win));
                break;
            case WINTYPES.SCATTER:
                spineAnimationMs = this.game.reels.highlightWin(win, false, true) || 0;
                this.game.context.onscreenWinMeter += this.getWinValue(win);
                this.game.menu.setWin(this.game.context.onscreenWinMeter);
                this.game.menu.setWinStatus(this.winningLineToText(win));
                break;
            case WINTYPES.NEAR_MISS_WILD:
                spineAnimationMs = this.game.reels.highlightWin(win, false, true) || 0;
                this.game.menu.setStatus('');
                this.game.menu.setWinStatus('');
                break;
            default:
                break;
        }

        return this.resolveHighlightDelayFrames(win, spineAnimationMs);
    }

    /**
     * @param {number} lineIndex
     */
    showWinAt(lineIndex) {
        const win = this.game.context.outcome.wins[lineIndex];
        if (!win) return 80;
        let spineAnimationMs = 0;

        this.game.reels.unhighlightAll();
        this.game.menu.setStatus('');

        switch (win.type) {
            case WINTYPES.LINE:
            case WINTYPES.SCATTER:
                spineAnimationMs = this.game.reels.highlightWin(win, false, true) || 0;
                this.game.menu.setWinStatus(this.winningLineToText(win));
                break;
            case WINTYPES.NEAR_MISS:
                spineAnimationMs = this.game.reels.highlightWin(win, false, true) || 0;
                this.game.menu.setStatus('');
                this.game.menu.setWinStatus('');
                break;
            default:
                break;
        }

        return this.resolveHighlightDelayFrames(win, spineAnimationMs);
    }

    showAllWinningLines() {
        if (!this.game.reels.lineRenderer) {
            return;
        }

        for (let line = 0; line < this.game.context.outcome.wins.length; line++) {
            const win = this.game.context.outcome.wins[line];
            if (win.type === WINTYPES.LINE) {
                this.game.reels.lineRenderer.addLine(win.winningLine);
            } else if (win.type === WINTYPES.SCATTER) {
                for (let reel = 0; reel < this.game.reels.NUMBER_OF_REELS; reel++) {
                    this.game.reels.highlightScattersOnReel(reel, win);
                }
            }
        }
    }

    clearAllLines() {
        if (this.game.reels.lineRenderer && this.game.reels.lineRenderer.clear) {
            this.game.reels.lineRenderer.clear();
        }
    }

    resolveHighlightDelayFrames(win, spineAnimationMs) {
        const baseFrames = win && Number.isFinite(win.highlightTimeout) ? Number(win.highlightTimeout) : 80;
        return Math.max(baseFrames, Math.ceil((Number(spineAnimationMs) || 0) / 16.6667));
    }
}

