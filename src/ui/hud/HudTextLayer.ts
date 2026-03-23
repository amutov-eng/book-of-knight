// @ts-nocheck
import {
    BITMAP_FONT_ROBOTO_BLACK,
    BITMAP_FONT_ROBOTO_CONDENSED_MEDIUM
} from '../../config/bitmapFontConfig';
import {
    APP_FONT_FAMILY,
    APP_FONT_WEIGHT_BLACK,
    APP_FONT_WEIGHT_LIGHT,
    APP_FONT_WEIGHT_REGULAR
} from '../../config/fontConfig';
import { formatCentsByPattern, getDefaultNumberPattern } from '../../utils/numberFormat';
import { fitPixiTextToBounds } from '../utils/fitText';

const VIRTUAL_WIDTH = 1920;

function toNumber(value, fallback = 0) {
    return Number.isFinite(value) ? value : fallback;
}

function snapPixel(value) {
    return Math.round(toNumber(value, 0));
}

function createBitmapText(text, fontFamily, fontSize, fill, align = 'left') {
    const bitmapText = new PIXI.BitmapText({
        text,
        style: {
            fontFamily,
            fontSize,
            fill,
            align
        }
    });
    bitmapText.roundPixels = true;
    return bitmapText;
}

function getNumberPattern(game) {
    if (!game || !game.gsLink || typeof game.gsLink.getNumberPattern !== 'function') {
        return getDefaultNumberPattern();
    }

    const pattern = game.gsLink.getNumberPattern();
    return typeof pattern === 'string' && pattern.trim().length > 0
        ? pattern
        : getDefaultNumberPattern();
}

function formatMoney(value, game) {
    return formatCentsByPattern(value, getNumberPattern(game));
}

function tryFormatJackpotValue(rawValueText, game) {
    const value = String(rawValueText || '').trim();
    if (!/^[0-9]+([.,][0-9]+)?$/.test(value)) {
        return value;
    }

    const normalized = value.replace(',', '.');
    const amount = Number.parseFloat(normalized);
    if (!Number.isFinite(amount)) {
        return value;
    }

    const cents = Math.round(amount * 100);
    return formatMoney(cents, game);
}

function parseJackpotAmount(rawValueText) {
    const value = String(rawValueText || '').trim();
    if (!/^[0-9]+([.,][0-9]+)?$/.test(value)) {
        return null;
    }

    const normalized = value.replace(',', '.');
    const amount = Number.parseFloat(normalized);
    if (!Number.isFinite(amount)) {
        return null;
    }

    return Math.round(amount * 100);
}

function resolveJackpotMultiplier(game, serverValueKey, fallbackMultiplier = 0) {
    const key = String(serverValueKey || '').trim();
    const contextMultipliers = game && game.context && game.context.jackpotMultipliers
        ? game.context.jackpotMultipliers
        : null;

    if (key && contextMultipliers && Number.isFinite(contextMultipliers[key])) {
        return Number(contextMultipliers[key]);
    }

    if (key && typeof window !== 'undefined') {
        const rawValue = window[key];
        const parsed = Number(rawValue);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }

    return Number.isFinite(fallbackMultiplier) ? Number(fallbackMultiplier) : 0;
}

function getLocalized(game, key, fallback) {
    if (game && game.localization && typeof game.localization.t === 'function') {
        return game.localization.t(key, {}, { defaultValue: fallback });
    }
    return fallback;
}

function getCurrency(game) {
    const currency = game && game.gsLink && typeof game.gsLink.currency === 'string'
        ? game.gsLink.currency.trim()
        : '';
    return currency || 'FUN';
}

export default class HudTextLayer extends PIXI.Container {
    constructor(game, hudConfig, getTexture) {
        super();
        this.game = game;
        this.hudConfig = hudConfig;
        this.getTexture = getTexture;
        this.pendingState = {
            status: '',
            winStatus: '',
            win: 0,
            credit: 0,
            totalBet: 0
        };
        this.idleBlinkStartedAt = 0;
        this.topLogo = null;
        this.topJackpotLayer = null;
        this.jackpotValueEntries = [];
        this.creditLabelText = null;
        this.creditValueText = null;
        this.totalBetLabelText = null;
        this.totalBetValueText = null;
        this.statusText = null;
        this.winStatusText = null;
        this.winText = null;
    }

    build() {
        this.buildTopBar();
        this.buildTexts();
        this.applyPendingState();
    }

    buildTopBar() {
        const topBar = this.hudConfig && this.hudConfig.topBar ? this.hudConfig.topBar : {};
        const fontCfg = this.hudConfig && this.hudConfig.fonts ? this.hudConfig.fonts : {};
        const jackpotValueFont = String(fontCfg.jackpotValue || fontCfg.jackpot || fontCfg.primary || APP_FONT_FAMILY);
        const jackpotLabelFont = String(fontCfg.jackpotLabel || fontCfg.jackpot || fontCfg.primary || APP_FONT_FAMILY);
        const logoCfg = topBar.logo || {};
        const jackpots = Array.isArray(topBar.jackpots) ? topBar.jackpots : [];
        this.jackpotValueEntries = [];

        const logoTexture = this.getTexture(logoCfg.frame || 'logo.png');
        if (logoTexture) {
            this.topLogo = new PIXI.Sprite(logoTexture);
            this.topLogo.position.set(toNumber(logoCfg.x, 20), toNumber(logoCfg.y, 6));
            this.addChild(this.topLogo);
        }

        this.topJackpotLayer = new PIXI.Container();
        this.addChild(this.topJackpotLayer);

        for (let i = 0; i < jackpots.length; i++) {
            const cfg = jackpots[i] || {};
            const frame = cfg.frame || '';
            const valueTextRaw = String(cfg.valueText || '');
            const valueText = tryFormatJackpotValue(valueTextRaw, this.game);
            const labelText = String(cfg.labelText || '');
            let panel = null;

            if (frame) {
                const panelTexture = this.getTexture(frame);
                panel = panelTexture ? new PIXI.Sprite(panelTexture) : null;
                if (panel) {
                    panel.position.set(snapPixel(cfg.x), snapPixel(cfg.y));
                    this.topJackpotLayer.addChild(panel);
                }
            }

            const valueLabel = new PIXI.Text({
                text: valueText,
                style: new PIXI.TextStyle({
                    fontFamily: jackpotValueFont,
                    fontSize: toNumber(cfg.valueFontSize, 48),
                    fontWeight: '700',
                    fill: toNumber(cfg.valueColor, 0xffcc00),
                    align: 'center'
                })
            });
            valueLabel.anchor.set(0.5, 0.5);
            if (panel) {
                const valueCenterX = Number.isFinite(cfg.valueCenterX)
                    ? Number(cfg.valueCenterX)
                    : toNumber(cfg.labelX, panel.x + panel.width * 0.5);
                const valueOffsetX = toNumber(cfg.valueOffsetX, 0);
                const valueOffsetY = toNumber(cfg.valueOffsetY, -8);
                valueLabel.position.set(
                    snapPixel(valueCenterX + valueOffsetX),
                    snapPixel(panel.y + panel.height * 0.5 + valueOffsetY)
                );
            } else {
                valueLabel.position.set(snapPixel(cfg.valueX), snapPixel(cfg.valueY));
            }
            this.topJackpotLayer.addChild(valueLabel);
            this.jackpotValueEntries.push({
                label: valueLabel,
                rawValueText: valueTextRaw,
                betMultiplier: Number.isFinite(cfg.betMultiplier) ? Number(cfg.betMultiplier) : null,
                serverValueKey: String(cfg.serverValueKey || ''),
                maxWidth: toNumber(cfg.valueMaxWidth, panel ? Math.max(0, panel.width - 160) : 0),
                maxHeight: toNumber(cfg.valueMaxHeight, 0),
                minFontSize: toNumber(cfg.valueMinFontSize, Math.max(18, toNumber(cfg.valueFontSize, 48) - 18))
            });
            fitPixiTextToBounds(valueLabel, {
                maxWidth: toNumber(cfg.valueMaxWidth, panel ? Math.max(0, panel.width - 160) : 0),
                maxHeight: toNumber(cfg.valueMaxHeight, 0),
                minFontSize: toNumber(cfg.valueMinFontSize, Math.max(18, toNumber(cfg.valueFontSize, 48) - 18))
            });

            if (labelText.trim().length > 0) {
                const nameLabel = new PIXI.Text({
                    text: labelText,
                    style: new PIXI.TextStyle({
                        fontFamily: jackpotLabelFont,
                        fontSize: toNumber(cfg.labelFontSize, 22),
                        fontWeight: APP_FONT_WEIGHT_REGULAR,
                        fill: toNumber(cfg.labelColor, 0xffcc00),
                        align: 'center'
                    })
                });
                nameLabel.anchor.set(0.5, 0);
                nameLabel.roundPixels = true;
                nameLabel.position.set(snapPixel(cfg.labelX), snapPixel(cfg.labelY));
                this.topJackpotLayer.addChild(nameLabel);
            }
        }
    }

    buildTexts() {
        const textCfg = this.hudConfig && this.hudConfig.texts ? this.hudConfig.texts : {};
        const fontCfg = this.hudConfig && this.hudConfig.fonts ? this.hudConfig.fonts : {};
        const primaryFont = String(fontCfg.primary || APP_FONT_FAMILY);
        const creditLabelBitmapFont = String(fontCfg.creditLabelBitmap || BITMAP_FONT_ROBOTO_CONDENSED_MEDIUM);
        const creditValueBitmapFont = String(fontCfg.creditValueBitmap || BITMAP_FONT_ROBOTO_CONDENSED_MEDIUM);
        const totalBetLabelBitmapFont = String(fontCfg.totalBetLabelBitmap || BITMAP_FONT_ROBOTO_CONDENSED_MEDIUM);
        const totalBetValueBitmapFont = String(fontCfg.totalBetValueBitmap || BITMAP_FONT_ROBOTO_CONDENSED_MEDIUM);
        const totalBetLabelFont = String(fontCfg.totalBetLabel || primaryFont);
        const totalBetValueFont = String(fontCfg.totalBetValue || primaryFont);
        const statusFont = String(fontCfg.status || primaryFont);
        const winStatusBitmapFont = String(fontCfg.winStatusBitmap || BITMAP_FONT_ROBOTO_CONDENSED_MEDIUM);
        const winBitmapFont = String(fontCfg.winBitmap || BITMAP_FONT_ROBOTO_BLACK);
        const creditCfg = textCfg.credit || {};
        const totalBetCfg = textCfg.totalBet || {};
        const statusCfg = textCfg.status || {};
        const winStatusCfg = textCfg.winStatus || {};
        const winCfg = textCfg.win || {};

        const white = 0xf3f9f9;
        const yellow = 0xffc600;

        const statusStyle = new PIXI.TextStyle({
            fontFamily: statusFont,
            fontSize: toNumber(statusCfg.fontSize, 36),
            fontWeight: APP_FONT_WEIGHT_REGULAR,
            fill: white,
            align: String(statusCfg.align || 'center')
        });

        this.creditLabelText = createBitmapText('', creditLabelBitmapFont, toNumber(creditCfg.fontSize, 34), toNumber(creditCfg.labelColor, 0xffc600), String(creditCfg.align || 'left'));
        this.creditLabelText.position.set(snapPixel(toNumber(creditCfg.x, 220)), snapPixel(toNumber(creditCfg.y, 1039)));
        this.creditValueText = createBitmapText('', creditValueBitmapFont, toNumber(creditCfg.fontSize, 34), toNumber(creditCfg.valueColor, white), String(creditCfg.align || 'left'));
        this.creditValueText.position.set(snapPixel(toNumber(creditCfg.x, 220)), snapPixel(toNumber(creditCfg.y, 1039)));

        this.totalBetLabelText = createBitmapText('', totalBetLabelBitmapFont, toNumber(totalBetCfg.fontSize, 34), toNumber(totalBetCfg.labelColor, 0xffc600), String(totalBetCfg.align || 'left'));
        this.totalBetLabelText.position.set(snapPixel(toNumber(totalBetCfg.x, 1490)), snapPixel(toNumber(totalBetCfg.y, 1039)));
        this.totalBetValueText = createBitmapText('', totalBetValueBitmapFont, toNumber(totalBetCfg.fontSize, 34), toNumber(totalBetCfg.valueColor, white), String(totalBetCfg.align || 'left'));
        this.totalBetValueText.position.set(snapPixel(toNumber(totalBetCfg.x, 1490)), snapPixel(toNumber(totalBetCfg.y, 1039)));

        this.statusText = new PIXI.Text({ text: '', style: statusStyle });
        this.statusText.roundPixels = true;
        this.statusText.anchor.set(toNumber(statusCfg.anchorX, 0.5), 0);
        this.statusText.position.set(snapPixel(toNumber(statusCfg.x, VIRTUAL_WIDTH / 2)), snapPixel(toNumber(statusCfg.y, 969)));

        this.winStatusText = createBitmapText('', winStatusBitmapFont, toNumber(winStatusCfg.fontSize, 34), white, String(winStatusCfg.align || 'center'));
        this.winStatusText.anchor.set(toNumber(winStatusCfg.anchorX, 0.5), 0);
        this.winStatusText.position.set(snapPixel(toNumber(winStatusCfg.x, VIRTUAL_WIDTH / 2)), snapPixel(toNumber(winStatusCfg.y, 990)));

        this.winText = createBitmapText('', winBitmapFont, toNumber(winCfg.fontSize, 36), yellow, String(winCfg.align || 'center'));
        this.winText.anchor.set(toNumber(winCfg.anchorX, 0.5), 0);
        this.winText.position.set(snapPixel(toNumber(winCfg.x, VIRTUAL_WIDTH / 2)), snapPixel(toNumber(winCfg.y, 953)));

        this.addChild(this.creditLabelText);
        this.addChild(this.creditValueText);
        this.addChild(this.totalBetLabelText);
        this.addChild(this.totalBetValueText);
        this.addChild(this.winText);
        this.addChild(this.statusText);
        this.addChild(this.winStatusText);
    }

    setStatus(value) {
        const nextValue = typeof value === 'string' ? value : '';
        if (this.pendingState.status === nextValue) {
            return;
        }
        this.pendingState.status = nextValue;
        if (nextValue.trim().length > 0) {
            this.idleBlinkStartedAt = 0;
        }
        this.applyPendingState();
    }

    setWinStatus(value) {
        const nextValue = typeof value === 'string' ? value : '';
        if (this.pendingState.winStatus === nextValue) return;
        this.pendingState.winStatus = nextValue;
        this.applyPendingState();
    }

    setTotalBet(value) {
        const nextValue = toNumber(value, 0);
        if (this.pendingState.totalBet === nextValue) return;
        this.pendingState.totalBet = nextValue;
        this.applyPendingState();
    }

    setWin(value) {
        const nextValue = toNumber(value, 0);
        if (this.pendingState.win === nextValue) return;
        this.pendingState.win = nextValue;
        this.applyPendingState();
    }

    setCredit(value) {
        const nextValue = toNumber(value, 0);
        if (this.pendingState.credit === nextValue) return;
        this.pendingState.credit = nextValue;
        this.applyPendingState();
    }

    refreshJackpotValues() {
        if (!Array.isArray(this.jackpotValueEntries) || this.jackpotValueEntries.length === 0) return;
        const totalBet = this.game && this.game.meters && typeof this.game.meters.getTotalBet === 'function'
            ? toNumber(this.game.meters.getTotalBet(), 0)
            : 0;
        for (let i = 0; i < this.jackpotValueEntries.length; i++) {
            const entry = this.jackpotValueEntries[i];
            if (!entry || !entry.label) continue;
            const activeMultiplier = resolveJackpotMultiplier(this.game, entry.serverValueKey, entry.betMultiplier);
            if (Number.isFinite(activeMultiplier) && activeMultiplier > 0) {
                entry.label.text = formatMoney(Math.round(totalBet * activeMultiplier), this.game);
                fitPixiTextToBounds(entry.label, {
                    maxWidth: toNumber(entry.maxWidth, 0),
                    maxHeight: toNumber(entry.maxHeight, 0),
                    minFontSize: toNumber(entry.minFontSize, 18)
                });
                continue;
            }

            const parsedAmount = parseJackpotAmount(entry.rawValueText);
            entry.label.text = parsedAmount != null
                ? formatMoney(parsedAmount, this.game)
                : tryFormatJackpotValue(entry.rawValueText, this.game);
            fitPixiTextToBounds(entry.label, {
                maxWidth: toNumber(entry.maxWidth, 0),
                maxHeight: toNumber(entry.maxHeight, 0),
                minFontSize: toNumber(entry.minFontSize, 18)
            });
        }
    }

    getIdleStatusBaseText() {
        const context = this.game && this.game.context ? this.game.context : null;
        if (!context || context.autoplay) {
            return '';
        }

        if (context.turboGame || context.turboSpinIsEnabled === false) {
            return getLocalized(this.game, 'placeBets', 'PLACE YOUR BETS!');
        }

        return getLocalized(this.game, 'holdSpin', 'HOLD START FOR TURBO SPINS');
    }

    getIdleStatusText() {
        const baseStatus = this.getIdleStatusBaseText();
        if (!baseStatus) {
            return '';
        }

        const blinkStatus = getLocalized(this.game, 'startWinUp', 'WIN UP TO 5000 X BET');
        const now = Date.now();
        if (!this.idleBlinkStartedAt) {
            this.idleBlinkStartedAt = now;
        }

        const blinkInterval = 2000;
        const elapsed = now - this.idleBlinkStartedAt;
        return Math.floor(elapsed / blinkInterval) % 2 === 0 ? baseStatus : blinkStatus;
    }

    refreshIdleStatus() {
        if (this.pendingState.status && this.pendingState.status.trim().length > 0) {
            return;
        }

        this.applyPendingState();
    }

    applyPendingState() {
        this.refreshJackpotValues();

        const currency = getCurrency(this.game);
        const creditPrefix = getLocalized(this.game, 'balanceDemo', 'DEMO PLAY :');
        const betPrefix = getLocalized(this.game, 'bet', 'BET :');
        const winPrefix = getLocalized(this.game, 'win', 'WIN:');

        if (this.creditLabelText && this.creditValueText) {
            this.creditLabelText.text = `${creditPrefix}`;
            this.creditValueText.text = ` ${formatMoney(this.pendingState.credit, this.game)} ${currency}`;
            this.creditValueText.x = snapPixel(this.creditLabelText.x + this.creditLabelText.width);
            this.creditValueText.y = snapPixel(this.creditLabelText.y);
        }

        if (this.totalBetLabelText && this.totalBetValueText) {
            this.totalBetLabelText.text = `${betPrefix}`;
            this.totalBetValueText.text = ` ${formatMoney(this.pendingState.totalBet, this.game)} ${currency}`;
            this.totalBetValueText.x = snapPixel(this.totalBetLabelText.x + this.totalBetLabelText.width);
            this.totalBetValueText.y = snapPixel(this.totalBetLabelText.y);
        }

        const hasWinStatus = this.pendingState.winStatus.trim().length > 0;
        const hasWinValue = this.pendingState.win > 0;
        const showWinOverlay = hasWinStatus || hasWinValue;

        if (this.pendingState.status && this.pendingState.status.trim().length > 0) {
            if (this.statusText) this.statusText.text = this.pendingState.status;
            if (this.statusText) this.statusText.visible = true;
            if (this.winStatusText) this.winStatusText.visible = false;
            if (this.winText) this.winText.visible = false;
        } else {
            const defaultStatus = this.getIdleStatusText();
            if (this.statusText) this.statusText.text = defaultStatus;
            if (this.statusText) this.statusText.visible = !showWinOverlay;
            if (this.winStatusText) {
                this.winStatusText.text = this.pendingState.winStatus;
                this.winStatusText.visible = hasWinStatus;
            }
            if (this.winText) {
                this.winText.text = hasWinValue
                    ? `${winPrefix} ${formatMoney(this.pendingState.win, this.game)}`
                    : '';
                this.winText.visible = hasWinValue;
            }
        }
    }
}
