import { createGameOutcome } from './GameOutcome';
import { ensureFreeGamesState } from './FreeGamesController';

interface ServerErrorState {
  visible: boolean;
  message: string;
}

interface JackpotMultiplierState {
  GRAND_JACKPOT_VALUE: number;
  MAJOR_JACKPOT_VALUE: number;
  MINOR_JACKPOT_VALUE: number;
}

export default class Context {
  outcome: ReturnType<typeof createGameOutcome>;

  autoplay: boolean;

  autoplayCounter: number;

  autoplayLimit: number;

  autoplayUnlimited: boolean;

  autoplayWinUnlimited: boolean;

  autoplayLostUnlimited: boolean;

  turboGame: boolean;

  turboSpinIsEnabled: boolean;

  skipScreen: boolean;

  onscreenWinMeter: number;

  onscreenCreditMeter: number;

  finalCreditMeter: number;

  hasBuyFeature: boolean;

  buyFeatureConfigured: boolean;

  hasBuyBonus: boolean;

  buyBonusType: number;

  buyFreeGamesMult: number;

  buyHoldAndWinMult: number;

  addFreeSpinsCnt: number;

  showAddFreeSpins: boolean;

  hasAddFreeSpins: boolean;

  hasReloadButton: boolean;

  hasHomeButton: boolean;

  hasHistoryButton: boolean;

  hasLobbyButton: boolean;

  gamePercent: number;

  gamePercentBuyFree: number;

  gamePercentBuyHold: number;

  serverError: ServerErrorState;

  jackpotMultipliers: JackpotMultiplierState;

  constructor() {
    this.outcome = createGameOutcome();
    this.autoplay = false;
    this.autoplayCounter = 0;
    this.autoplayLimit = 20;
    this.autoplayUnlimited = false;
    this.autoplayWinUnlimited = true;
    this.autoplayLostUnlimited = true;
    this.turboGame = false;
    this.turboSpinIsEnabled = true;
    this.skipScreen = false;
    this.onscreenWinMeter = 0;
    this.onscreenCreditMeter = 0;
    this.finalCreditMeter = 0;

    this.hasBuyFeature = false;
    this.buyFeatureConfigured = false;
    this.hasBuyBonus = false;
    this.buyBonusType = -1;
    this.buyFreeGamesMult = 0;
    this.buyHoldAndWinMult = 0;

    this.addFreeSpinsCnt = 0;
    this.showAddFreeSpins = false;
    this.hasAddFreeSpins = false;

    this.hasReloadButton = false;
    this.hasHomeButton = false;
    this.hasHistoryButton = false;
    this.hasLobbyButton = false;

    this.gamePercent = 0;
    this.gamePercentBuyFree = 0;
    this.gamePercentBuyHold = 0;

    this.serverError = {
      visible: false,
      message: ''
    };

    this.jackpotMultipliers = {
      GRAND_JACKPOT_VALUE: 1000,
      MAJOR_JACKPOT_VALUE: 100,
      MINOR_JACKPOT_VALUE: 20
    };

    ensureFreeGamesState(this as unknown as Record<string, any>);
  }
}
