import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getNearMissDurationFrames,
  JACKPOT_NEAR_MISS_START_INDEX,
  NEAR_MISS_CURVE_KEY_TIMES,
  NEAR_MISS_SCALE_CURVE,
  resolveNearMissSoundId,
  SCATTER_NEAR_MISS_SYMBOL_INDEX,
  shouldAnimateNearMissSymbol
} from '../src/game/reels/nearMissRules.ts';

test('near miss keeps the legacy six-step scale curve', () => {
  assert.deepEqual([...NEAR_MISS_SCALE_CURVE], [1.0, 1.08, 1.15, 1.08, 1.03, 1.0]);
});

test('near miss uses extended timing so the pulse is visible before wins start', () => {
  assert.deepEqual([...NEAR_MISS_CURVE_KEY_TIMES], [0, 0.16, 0.34, 0.56, 0.78, 1.0]);
  assert.equal(getNearMissDurationFrames(), 20);
});

test('scatter symbol always triggers near miss pulse and star sound', () => {
  const input = {
    symbolIndex: SCATTER_NEAR_MISS_SYMBOL_INDEX,
    outcomeHasWin: false,
    outcomeHasWild: false,
    previousHoldAndWinValue: 0
  };

  assert.equal(shouldAnimateNearMissSymbol(input), true);
  assert.equal(resolveNearMissSoundId(input), 'beepStar');
});

test('jackpot symbol pulses only when it was not already held previously', () => {
  const freshJackpot = {
    symbolIndex: JACKPOT_NEAR_MISS_START_INDEX,
    outcomeHasWin: false,
    outcomeHasWild: false,
    previousHoldAndWinValue: 0
  };
  const persistedJackpot = {
    ...freshJackpot,
    previousHoldAndWinValue: 3
  };

  assert.equal(shouldAnimateNearMissSymbol(freshJackpot), true);
  assert.equal(resolveNearMissSoundId(freshJackpot), 'beepSun');
  assert.equal(shouldAnimateNearMissSymbol(persistedJackpot), false);
  assert.equal(resolveNearMissSoundId(persistedJackpot), null);
});
