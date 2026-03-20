import assert from 'node:assert/strict';
import {
  calculateReelViewportOverflow,
  getNormalViewportBounds,
  getSpinViewportBounds,
  getHiddenServiceSymbolIndices
} from '../src/game/reels/reelViewportMath.ts';

const options = {
  width: 162,
  height: 440,
  symbolWidth: 278,
  symbolHeight: 264,
  pitch: 220,
  trimTopY: 18,
  trimBottomY: 22
};

{
  const overflow = calculateReelViewportOverflow(options);
  assert.ok(overflow.horizontal >= 120, 'horizontal overflow should be wide enough for oversized symbols');
  assert.ok(overflow.vertical > 36, 'vertical overflow should grow when symbols are taller than reel pitch');
}

{
  const bounds = getNormalViewportBounds(options);
  assert.ok(bounds.y < 0, 'normal viewport should extend above the reel for top-row oversized symbols');
  assert.ok(bounds.height > options.height, 'normal viewport height should extend for top/bottom oversized symbols');
}

{
  const bounds = getSpinViewportBounds(options);
  assert.equal(bounds.y, -options.trimTopY);
  assert.equal(bounds.height, options.height + options.trimTopY + options.trimBottomY);
}

{
  const indices = getHiddenServiceSymbolIndices(4, 5);
  assert.deepEqual(indices, { top: 2, bottom: 3 }, 'service symbol indices should stay deterministic for clipping logic');
}

console.log('reel viewport regressions: OK');
