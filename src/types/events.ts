export interface CoreEventMap {
  'lifecycle:changed': { from: string; to: string };
  'gameplay:stateChanged': { from: string; to: string };
  'spin:started': { source: 'controller' };
  'spin:resultReceived': {
    result: {
      reelStops: number[][];
      totalWin: number;
      hasBonus: boolean;
    };
  };
  'spin:resolved': { result: null };
  'debug:toggle': { visible: boolean };
}
