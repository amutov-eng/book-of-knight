// @ts-nocheck
/**
 * Win class file.
 *
 *  Simple object that represents result from a spin. It can be a line win or near-miss win (no credits win)
 *  that is simply used to highlight a combination on the screen.
 *
 * @author Dimitar
 *
 */

let WINTYPES = {LINE:0, SCATTER:1, NEAR_MISS:2, NEAR_MISS_WILD:4};

let Win = {

    type : WINTYPES.LINE,

    /**
     * A matrix representation of the screen symbols that will be highlighted
     */
    highlight : [
        [ 0, 0, 0, 0, 0 ],
        [ 0, 0, 0, 0, 0 ],
        [ 0, 0, 0, 0, 0 ]
    ],

    /**
     * Winning line number, bet (credits wagered), symbol index, the number of symbols
     * counted on a line, and multiplier
     */
    winningLine : 0,
    bet : 0,
    symbol : -1,
    cnt : 0,
    mult : 0,

    /**
     * Flag set when a combination includes a wild symbol.
     */
    hasWild : false,

    /**
     * Sound id triggered when this win is presented.
     */
    sound : null,

    /**
     * Timeout variable used in Controller to determine duration of the highlighting animation.
     */
    highlightTimeout : 0

};

export {WINTYPES, Win};
