import { WINTYPES } from './Win';

export function ensureFreeGamesState(context: Record<string, any> | null | undefined): void {
  if (!context) return;

  if (!Number.isFinite(context.MAIN_GAME)) context.MAIN_GAME = 0;
  if (!Number.isFinite(context.FREE_GAMES)) context.FREE_GAMES = 1;

  if (!Number.isFinite(context.gameMode)) context.gameMode = context.MAIN_GAME;
  if (!Number.isFinite(context.prevGameMode)) context.prevGameMode = context.gameMode;
  if (!Number.isFinite(context.freeGamesCounter)) context.freeGamesCounter = 0;
  if (!Number.isFinite(context.freeGamesWon)) context.freeGamesWon = 0;
  if (!Number.isFinite(context.freeGamesStartCredit)) context.freeGamesStartCredit = 0;
  if (!Number.isFinite(context.pendingFreeGamesIntroSource)) {
    context.pendingFreeGamesIntroSource = context.MAIN_GAME;
  }
}

export function isInFreeGames(context: Record<string, any> | null | undefined): boolean {
  return !!context && Number(context.gameMode) === Number(context.FREE_GAMES);
}

export function shouldEnterFreeBook(context: Record<string, any> | null | undefined): boolean {
  if (!context) return false;
  return Number(context.pendingFreeGamesIntroSource) !== Number(context.FREE_GAMES);
}

export function markFreeGamesIntroSource(context: Record<string, any> | null | undefined, sourceMode: number): void {
  if (!context) return;
  context.pendingFreeGamesIntroSource = Number.isFinite(sourceMode)
    ? sourceMode
    : Number(context.MAIN_GAME || 0);
}

export function collectScatterWins(outcome: Record<string, any> | null | undefined): any[] {
  if (!outcome || !Array.isArray(outcome.wins)) return [];
  return outcome.wins.filter((win) => Number(win?.type) === Number(WINTYPES.SCATTER));
}
