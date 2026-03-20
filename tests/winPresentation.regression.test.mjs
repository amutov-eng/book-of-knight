import assert from 'node:assert/strict';
import WinPresentationOrchestrator from '../src/architecture/gameplay/systems/WinPresentationOrchestrator.ts';
import WinPresentationSystem from '../src/architecture/gameplay/systems/WinPresentationSystem.ts';

function createGameStub(spineAnimationMs = 0) {
  const win = {
    type: 1,
    mult: 10,
    winningLine: 0,
    cnt: 3,
    symbol: 9,
    highlightTimeout: 40
  };

  return {
    meters: {
      getTotalBet: () => 100,
      getBetPerLine: () => 100,
      getDenomination: () => 1
    },
    reels: {
      highlightWin: () => spineAnimationMs,
      unhighlightAll: () => undefined,
      lineRenderer: {
        addLine: () => undefined,
        clear: () => undefined
      },
      NUMBER_OF_REELS: 5,
      highlightScattersOnReel: () => undefined
    },
    menu: {
      setStatus: () => undefined,
      setWinStatus: () => undefined,
      setWin: () => undefined
    },
    soundSystem: {
      played: [],
      play(id) {
        this.played.push(id);
      }
    },
    context: {
      onscreenWinMeter: 0,
      outcome: {
        wins: [win]
      }
    },
    localization: {
      t: (_key, _vars, options) => options?.defaultValue ?? ''
    }
  };
}

{
  const orchestrator = new WinPresentationOrchestrator();
  assert.equal(orchestrator.isReady(), true);

  orchestrator.startDelay(5);
  assert.equal(orchestrator.isReady(), false);
  orchestrator.tick(2);
  assert.equal(orchestrator.isReady(), false);
  orchestrator.tick(3);
  assert.equal(orchestrator.isReady(), true);
}

{
  const system = new WinPresentationSystem(createGameStub(1200));
  const frames = system.processWinAt(0);
  assert.equal(frames, 72, 'win presentation should wait for the returned animation duration');
}

{
  const system = new WinPresentationSystem(createGameStub(0));
  const frames = system.showWinAt(0);
  assert.equal(frames, 40, 'wins without an animation duration should fall back to the configured highlight timeout');
}

{
  const system = new WinPresentationSystem(createGameStub(417));
  const frames = system.showWinAt(0);
  assert.equal(frames, 26, 'standard win animations should switch lines as soon as the animation finishes');
}

{
  const game = createGameStub(0);
  game.context.outcome.wins[0].sound = 'scatter';
  const system = new WinPresentationSystem(game);
  system.processWinAt(0);
  assert.deepEqual(game.soundSystem.played, ['scatter'], 'configured win sound should play with the win presentation');
}

{
  const game = createGameStub(0);
  game.context.outcome.wins[0].sound = 'scatter';
  const system = new WinPresentationSystem(game);
  system.showWinAt(0);
  assert.deepEqual(game.soundSystem.played, [], 'last wins replay should not trigger the win sound again');
}

console.log('win presentation regressions: OK');
