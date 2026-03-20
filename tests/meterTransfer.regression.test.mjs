import assert from 'node:assert/strict';
import MeterTransferSystem from '../src/architecture/gameplay/systems/MeterTransferSystem.ts';

function createGameStub({ win, totalBet, credit = 5000 }) {
  return {
    meters: {
      win,
      credit,
      getTotalBet: () => totalBet
    },
    context: {
      onscreenWinMeter: 0,
      onscreenCreditMeter: 0,
      finalCreditMeter: credit + win
    },
    menu: {
      setWin: () => undefined,
      setCredit: () => undefined,
      setStatus: () => undefined,
      setWinStatus: () => undefined
    },
    soundSystem: {
      stop: () => undefined,
      play: () => undefined
    }
  };
}

function runTransferFrames({ win, totalBet }) {
  const game = createGameStub({ win, totalBet });
  const system = new MeterTransferSystem(game);
  const controller = { w2cSpeed: 0 };
  assert.equal(system.beginWinToCredit(controller), true);

  let frames = 0;
  while (game.context.onscreenCreditMeter < game.context.finalCreditMeter) {
    const completed = system.stepWinToCredit(controller);
    frames += 1;
    if (completed) {
      break;
    }
    assert.ok(frames < 200, 'transfer should finish within a bounded frame budget');
  }

  return {
    frames,
    speed: controller.w2cSpeed
  };
}

{
  const low = runTransferFrames({ win: 300, totalBet: 100 });
  const mid = runTransferFrames({ win: 1200, totalBet: 100 });
  const high = runTransferFrames({ win: 2500, totalBet: 100 });
  const huge = runTransferFrames({ win: 12000, totalBet: 100 });

  assert.equal(low.frames, 42, 'wins below 5x bet should use the fastest transfer bucket');
  assert.equal(mid.frames, 48, 'wins from 5x to below 15x should use the next transfer bucket');
  assert.equal(high.frames, 54, 'wins from 15x to below 30x should use the third transfer bucket');
  assert.equal(huge.frames, 60, 'wins at or above 30x should use the slowest transfer bucket');
}

{
  const smallBet = runTransferFrames({ win: 1200, totalBet: 100 });
  const largeBet = runTransferFrames({ win: 12000, totalBet: 1000 });

  assert.equal(
    smallBet.frames,
    largeBet.frames,
    'equal win multipliers should transfer in the same duration regardless of raw bet size'
  );
  assert.notEqual(
    smallBet.speed,
    largeBet.speed,
    'equal durations should still adapt step size to the raw win amount'
  );
}

console.log('meter transfer regressions: OK');
