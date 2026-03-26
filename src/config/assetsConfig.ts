import { getRuntimeVariant } from './runtimeConfig';
import { GAME_RULES } from './gameRules';
import { STRIPS_CONFIG } from './stripsConfig';
import { SYMBOL_INDEX_PREFIX_ORDER } from './symbolConfig';
import { APP_FONT_FAMILY, APP_FONT_WEIGHT_REGULAR } from './fontConfig';
import {
    BITMAP_FONT_ROBOTO_BLACK,
    BITMAP_FONT_ROBOTO_CONDENSED_MEDIUM
} from './bitmapFontConfig';

/**
 * Manifest readers used during boot and by UI/layout modules at runtime.
 *
 * This module centralizes fallback behavior so downstream code can consume a
 * stable manifest shape after validation.
 */
let cachedManifest = undefined;
let cachedManifestErrors = [];
const BASE_REEL_KEYS = [
    'spinStep',
    'pitch',
    'symbolWidth',
    'symbolHeight',
    'trimTopY',
    'trimBottomY'
];

async function fetchJsonIfExists(path) {
    const candidates = [];
    if (typeof path !== 'string' || path.length === 0) return null;

    candidates.push(path);
    if (!/^([a-z]+:)?\/\//i.test(path) && !path.startsWith('/')) {
        candidates.unshift(`/${path}`);
    }

    for (let i = 0; i < candidates.length; i++) {
        try {
            const response = await fetch(candidates[i], { cache: 'no-cache' });
            if (!response.ok) continue;

            const contentType = response.headers.get('content-type') || '';
            if (!contentType.toLowerCase().includes('json')) continue;

            return await response.json();
        } catch (_error) {
            // Try the next candidate URL.
        }
    }

    return null;
}

function getModeValue(map, mode) {
    if (!map) return null;
    if (mode === 'fg') return map.fg || null;
    if (mode === 'haw') return map.haw || null;
    return map.base || null;
}

function isObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function mergeBranch(base, override) {
    const result = {};
    const baseObj = isObject(base) ? base : {};
    const overrideObj = isObject(override) ? override : {};
    const keys = [...new Set([...Object.keys(baseObj), ...Object.keys(overrideObj)])];

    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const baseValue = baseObj[key];
        const overrideValue = overrideObj[key];
        if (isObject(baseValue) || isObject(overrideValue)) {
            result[key] = { ...(isObject(baseValue) ? baseValue : {}), ...(isObject(overrideValue) ? overrideValue : {}) };
        } else if (overrideValue !== undefined) {
            result[key] = overrideValue;
        } else {
            result[key] = baseValue;
        }
    }

    return result;
}

function mergeManifestLayers(base, override) {
    if (!isObject(base) && !isObject(override)) {
        return override !== undefined ? override : base;
    }

    const baseObj = isObject(base) ? base : {};
    const overrideObj = isObject(override) ? override : {};
    const result = {};
    const keys = [...new Set([...Object.keys(baseObj), ...Object.keys(overrideObj)])];

    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const baseValue = baseObj[key];
        const overrideValue = overrideObj[key];

        if (Array.isArray(overrideValue)) {
            result[key] = [...overrideValue];
            continue;
        }

        if (isObject(baseValue) || isObject(overrideValue)) {
            result[key] = mergeManifestLayers(baseValue, overrideValue);
            continue;
        }

        result[key] = overrideValue !== undefined ? overrideValue : baseValue;
    }

    return result;
}

function getLayoutBranch(manifest, variant, isLandscape) {
    if (!manifest || !isObject(manifest.layout)) return null;
    const layout = manifest.layout;
    const shared = isObject(layout.shared) ? layout.shared : {};

    let specific = layout.desktop;
    if (variant === 'mobile') {
        specific = isLandscape ? layout.mobileLandscape : layout.mobilePortrait;
    }

    return mergeBranch(shared, specific);
}

function validateLayoutBranch(branchName, branch, errors) {
    if (!isObject(branch)) {
        errors.push(`manifest.layout.${branchName} must be an object.`);
        return;
    }

    if (!isObject(branch.baseReel)) {
        errors.push(`manifest.layout.${branchName}.baseReel is required.`);
    } else {
        for (let i = 0; i < BASE_REEL_KEYS.length; i++) {
            const key = BASE_REEL_KEYS[i];
            if (!Number.isFinite(branch.baseReel[key])) {
                errors.push(`manifest.layout.${branchName}.baseReel.${key} must be a number.`);
            }
        }
    }

    if (branch.reels != null && !isObject(branch.reels)) {
        errors.push(`manifest.layout.${branchName}.reels must be an object.`);
    } else if (isObject(branch.reels) && branch.reels.forceSymbolIndex != null && !Number.isFinite(branch.reels.forceSymbolIndex)) {
        errors.push(`manifest.layout.${branchName}.reels.forceSymbolIndex must be a number when provided.`);
    }
    if (branch.layers != null && !isObject(branch.layers)) {
        errors.push(`manifest.layout.${branchName}.layers must be an object.`);
    }
}

function isNumericArray(value) {
    return Array.isArray(value) && value.length > 0 && value.every((item) => Number.isFinite(item));
}

function isSymbolSpineClipConfig(value) {
    return !!value
        && typeof value === 'object'
        && typeof value.jsonPath === 'string'
        && value.jsonPath.length > 0
        && typeof value.atlasPath === 'string'
        && value.atlasPath.length > 0;
}

function normalizeSymbolSpineClipConfig(value) {
    if (!isSymbolSpineClipConfig(value)) {
        return null;
    }

    return {
        jsonPath: value.jsonPath,
        atlasPath: value.atlasPath,
        runtime: value.runtime === '4.2' ? '4.2' : '3.8',
        animationName: typeof value.animationName === 'string' && value.animationName.length > 0 ? value.animationName : '',
        loop: value.loop === undefined ? false : !!value.loop,
        scale: Number.isFinite(value.scale) ? Number(value.scale) : 1,
        offsetX: Number.isFinite(value.offsetX) ? Number(value.offsetX) : 0,
        offsetY: Number.isFinite(value.offsetY) ? Number(value.offsetY) : 0
    };
}

function normalizeSymbolSpineConfig(value) {
    if (!value || typeof value !== 'object') {
        return null;
    }

    const result = {};
    const variantKeys = ['default', 'win', 'scatter', 'wild'];
    for (let i = 0; i < variantKeys.length; i++) {
        const key = variantKeys[i];
        const clip = normalizeSymbolSpineClipConfig(value[key]);
        if (clip) {
            result[key] = clip;
        }
    }

    return Object.keys(result).length > 0 ? result : null;
}

function normalizeGameplaySpineClipConfig(value) {
    if (!value || typeof value !== 'object') {
        return null;
    }

    if (typeof value.jsonPath !== 'string' || value.jsonPath.length === 0) {
        return null;
    }

    if (typeof value.atlasPath !== 'string' || value.atlasPath.length === 0) {
        return null;
    }

    return {
        jsonPath: value.jsonPath,
        atlasPath: value.atlasPath,
        animationName: typeof value.animationName === 'string' && value.animationName.length > 0 ? value.animationName : 'animation',
        loopAnimationName: typeof value.loopAnimationName === 'string' && value.loopAnimationName.length > 0 ? value.loopAnimationName : '',
        soundId: typeof value.soundId === 'string' && value.soundId.length > 0 ? value.soundId : '',
        x: Number.isFinite(value.x) ? Number(value.x) : 960,
        y: Number.isFinite(value.y) ? Number(value.y) : 540,
        scale: Number.isFinite(value.scale) ? Number(value.scale) : 1,
        pivot: value.pivot === 'top-center' ? 'top-center' : 'center'
    };
}

const DEFAULT_SYMBOL_WIN_PROFILES = {
    normal: {
        scale: [100, 94.4, 88.8, 83.2, 77.6, 72, 82.8, 93.5, 104, 115, 110, 105, 100, 95, 90, 91.4, 92.9, 94, 95.7, 97, 98.6, 100, 100, 100, 100],
        rotate: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    },
    high: {
        scale: [100, 94.4, 88.8, 83.2, 77.6, 72, 82.8, 93.5, 104.2, 115, 110.8, 106.6, 102.4, 98.2, 94, 96.8, 99.5, 102.2, 105, 103.8, 102.5, 101.2, 100, 100, 100],
        rotate: [0, -2.3, -4.5, -6.8, -9, -6.5, -4, -1.5, 1, 3.5, 6, 5.1, 4.3, 3.4, 2.6, 1.7, 0.8, 0, 0, 0, 0, 0, 0, 0, 0]
    }
};

/**
 * Loads the merged runtime manifest.
 *
 * Merge order:
 * 1. `assets/common/assets-manifest.common.json`
 * 2. active variant manifest
 * 3. fallback variant manifest when the active one is missing
 */
export async function loadAssetsManifest(variant = getRuntimeVariant()) {
    if (cachedManifest !== undefined) {
        return cachedManifest;
    }

    const fallbackVariant = variant === 'mobile' ? 'desktop' : 'mobile';
    const commonManifest = await fetchJsonIfExists('assets/common/assets-manifest.common.json');
    const lookup = [
        `assets/${variant}/assets-manifest.${variant}.json`,
        `assets/${fallbackVariant}/assets-manifest.${fallbackVariant}.json`
    ];

    for (let i = 0; i < lookup.length; i++) {
        const variantManifest = await fetchJsonIfExists(lookup[i]);
        const manifest = mergeManifestLayers(commonManifest, variantManifest);
        if (manifest) {
            cachedManifest = manifest;
            cachedManifestErrors = validateAssetsManifest(cachedManifest, variant);
            return cachedManifest;
        }
    }

    cachedManifest = null;
    cachedManifestErrors = ['Missing assets manifest. Expected one of: ' + ['assets/common/assets-manifest.common.json', ...lookup].join(', ')];
    return cachedManifest;
}

/**
 * Returns validation errors captured during the latest manifest load.
 */
export function getManifestValidationErrors() {
    return cachedManifestErrors.slice();
}

/**
 * Performs lightweight structural checks before runtime systems consume the manifest.
 */
export function validateAssetsManifest(manifest, variant = getRuntimeVariant()) {
    const errors = [];
    if (!manifest || typeof manifest !== 'object') {
        errors.push('Manifest must be a JSON object.');
        return errors;
    }

    if (!manifest.backgrounds || typeof manifest.backgrounds !== 'object') {
        errors.push('manifest.backgrounds is required.');
    } else if (variant === 'mobile') {
        if (!manifest.backgrounds.landscape || !manifest.backgrounds.portrait) {
            errors.push('mobile manifest requires backgrounds.landscape and backgrounds.portrait.');
        }
    } else if (variant === 'desktop') {
        if (!manifest.backgrounds.base) {
            errors.push('desktop manifest requires backgrounds.base.');
        }
    }

    if (manifest.reels != null && typeof manifest.reels !== 'object') {
        errors.push('manifest.reels must be an object.');
    }

    if (manifest.symbols != null) {
        if (typeof manifest.symbols !== 'object') {
            errors.push('manifest.symbols must be an object.');
        } else {
            if (manifest.symbols.atlases != null && !Array.isArray(manifest.symbols.atlases)) {
                errors.push('manifest.symbols.atlases must be an array.');
            }
            if (manifest.symbols.frames != null && !Array.isArray(manifest.symbols.frames)) {
                errors.push('manifest.symbols.frames must be an array.');
            } else if (Array.isArray(manifest.symbols.frames)) {
                for (let i = 0; i < manifest.symbols.frames.length; i++) {
                    const entry = manifest.symbols.frames[i];
                    if (!entry || typeof entry !== 'object') continue;
                    if (entry.winProfile != null && typeof entry.winProfile !== 'string') {
                        errors.push(`manifest.symbols.frames[${i}].winProfile must be a string when provided.`);
                    }
                    if (entry.offsetX != null && !Number.isFinite(entry.offsetX)) {
                        errors.push(`manifest.symbols.frames[${i}].offsetX must be a number when provided.`);
                    }
                    if (entry.offsetY != null && !Number.isFinite(entry.offsetY)) {
                        errors.push(`manifest.symbols.frames[${i}].offsetY must be a number when provided.`);
                    }
                    if (entry.spine != null && !isObject(entry.spine)) {
                        errors.push(`manifest.symbols.frames[${i}].spine must be an object when provided.`);
                    } else if (isObject(entry.spine)) {
                        const variantKeys = ['default', 'win', 'scatter', 'wild'];
                        for (let keyIndex = 0; keyIndex < variantKeys.length; keyIndex++) {
                            const variantKey = variantKeys[keyIndex];
                            const clip = entry.spine[variantKey];
                            if (clip == null) continue;
                            if (!isSymbolSpineClipConfig(clip)) {
                                errors.push(`manifest.symbols.frames[${i}].spine.${variantKey} requires jsonPath and atlasPath.`);
                                continue;
                            }
                            if (clip.animationName != null && typeof clip.animationName !== 'string') {
                                errors.push(`manifest.symbols.frames[${i}].spine.${variantKey}.animationName must be a string when provided.`);
                            }
                            if (clip.runtime != null && clip.runtime !== '3.8' && clip.runtime !== '4.2') {
                                errors.push(`manifest.symbols.frames[${i}].spine.${variantKey}.runtime must be "3.8" or "4.2" when provided.`);
                            }
                            if (clip.loop != null && typeof clip.loop !== 'boolean') {
                                errors.push(`manifest.symbols.frames[${i}].spine.${variantKey}.loop must be a boolean when provided.`);
                            }
                            if (clip.scale != null && !Number.isFinite(clip.scale)) {
                                errors.push(`manifest.symbols.frames[${i}].spine.${variantKey}.scale must be a number when provided.`);
                            }
                            if (clip.offsetX != null && !Number.isFinite(clip.offsetX)) {
                                errors.push(`manifest.symbols.frames[${i}].spine.${variantKey}.offsetX must be a number when provided.`);
                            }
                            if (clip.offsetY != null && !Number.isFinite(clip.offsetY)) {
                                errors.push(`manifest.symbols.frames[${i}].spine.${variantKey}.offsetY must be a number when provided.`);
                            }
                        }
                    }
                }
            }
        }
    }

    if (manifest.ui != null) {
        if (typeof manifest.ui !== 'object') {
            errors.push('manifest.ui must be an object.');
        } else if (manifest.ui.atlases != null && !Array.isArray(manifest.ui.atlases)) {
            errors.push('manifest.ui.atlases must be an array.');
        } else if (manifest.ui.hud != null && !isObject(manifest.ui.hud)) {
            errors.push('manifest.ui.hud must be an object when provided.');
        }
    }

    if (manifest.lines != null) {
        if (!isObject(manifest.lines)) {
            errors.push('manifest.lines must be an object.');
        } else if (manifest.lines.atlases != null && !Array.isArray(manifest.lines.atlases)) {
            errors.push('manifest.lines.atlases must be an array.');
        }
    }

    if (manifest.animations != null) {
        if (!isObject(manifest.animations)) {
            errors.push('manifest.animations must be an object.');
        } else if (manifest.animations.atlases != null && !Array.isArray(manifest.animations.atlases)) {
            errors.push('manifest.animations.atlases must be an array.');
        } else if (manifest.animations.symbolProfiles != null && !isObject(manifest.animations.symbolProfiles)) {
            errors.push('manifest.animations.symbolProfiles must be an object when provided.');
        } else if (isObject(manifest.animations.symbolProfiles)) {
            const profileNames = Object.keys(manifest.animations.symbolProfiles);
            for (let i = 0; i < profileNames.length; i++) {
                const profileName = profileNames[i];
                const profile = manifest.animations.symbolProfiles[profileName];
                if (!isObject(profile)) {
                    errors.push(`manifest.animations.symbolProfiles.${profileName} must be an object.`);
                    continue;
                }
                if (profile.scale != null && !isNumericArray(profile.scale)) {
                    errors.push(`manifest.animations.symbolProfiles.${profileName}.scale must be a numeric array when provided.`);
                }
                if (profile.rotate != null && !isNumericArray(profile.rotate)) {
                    errors.push(`manifest.animations.symbolProfiles.${profileName}.rotate must be a numeric array when provided.`);
                }
            }
        }
    }

    if (manifest.layout != null && !isObject(manifest.layout)) {
        errors.push('manifest.layout must be an object.');
    } else if (isObject(manifest.layout)) {
        if (manifest.layout.shared != null && !isObject(manifest.layout.shared)) {
            errors.push('manifest.layout.shared must be an object.');
        }
        if (variant === 'mobile') {
            validateLayoutBranch('mobileLandscape', getLayoutBranch(manifest, 'mobile', true), errors);
            validateLayoutBranch('mobilePortrait', getLayoutBranch(manifest, 'mobile', false), errors);
        } else {
            validateLayoutBranch('desktop', getLayoutBranch(manifest, 'desktop', true), errors);
        }
    }

    return errors;
}

/**
 * Produces the deduplicated asset URL list needed by the loading screen.
 */
export function getLoadingManifest(manifest) {
    if (!manifest) return [];

    const entries = [];
    const bg = manifest.backgrounds || {};
    const bgPaths = [
        bg.base, bg.fg, bg.haw,
        bg.landscape && bg.landscape.base,
        bg.landscape && bg.landscape.fg,
        bg.landscape && bg.landscape.haw,
        bg.portrait && bg.portrait.base,
        bg.portrait && bg.portrait.fg,
        bg.portrait && bg.portrait.haw
    ].filter((value) => typeof value === 'string');
    entries.push(...bgPaths);
    entries.push(...getReelLayerKeys(manifest));

    const atlases = Array.isArray(manifest.symbols && manifest.symbols.atlases)
        ? manifest.symbols.atlases.filter((value) => typeof value === 'string')
        : [];
    entries.push(...atlases);
    entries.push(...getUiAtlases(manifest));
    entries.push(...getLineAtlases(manifest));
    entries.push(...getAnimationAtlases(manifest));

    return [...new Set(entries)];
}

export function getLineAtlases(manifest) {
    if (!manifest || !manifest.lines || !Array.isArray(manifest.lines.atlases)) {
        return [];
    }

    return manifest.lines.atlases.filter((value) => typeof value === 'string');
}

export function getAnimationAtlases(manifest) {
    if (!manifest || !manifest.animations || !Array.isArray(manifest.animations.atlases)) {
        return [];
    }

    return manifest.animations.atlases.filter((value) => typeof value === 'string');
}

export function getSymbolWinAnimationProfiles(manifest) {
    const configured = manifest && manifest.animations && isObject(manifest.animations.symbolProfiles)
        ? manifest.animations.symbolProfiles
        : {};

    const profiles = {};
    const profileNames = [...new Set([...Object.keys(DEFAULT_SYMBOL_WIN_PROFILES), ...Object.keys(configured)])];
    for (let i = 0; i < profileNames.length; i++) {
        const profileName = profileNames[i];
        const fallback = DEFAULT_SYMBOL_WIN_PROFILES[profileName] || DEFAULT_SYMBOL_WIN_PROFILES.normal;
        const source = isObject(configured[profileName]) ? configured[profileName] : {};
        profiles[profileName] = {
            scale: isNumericArray(source.scale) ? source.scale.slice() : fallback.scale.slice(),
            rotate: isNumericArray(source.rotate) ? source.rotate.slice() : fallback.rotate.slice()
        };
    }

    return profiles;
}

/**
 * Returns UI atlas paths declared by the manifest.
 */
export function getUiAtlases(manifest) {
    if (!manifest || !manifest.ui || !Array.isArray(manifest.ui.atlases)) {
        return [];
    }
    return manifest.ui.atlases.filter((value) => typeof value === 'string');
}

/**
 * Returns HUD/menu visual config with a built-in fallback for partial manifests.
 */
export function getUiHudConfig(manifest) {
    const fallback = {
        fonts: {
            primary: APP_FONT_FAMILY,
            jackpot: APP_FONT_FAMILY,
            creditLabel: APP_FONT_FAMILY,
            creditValue: APP_FONT_FAMILY,
            creditLabelBitmap: BITMAP_FONT_ROBOTO_CONDENSED_MEDIUM,
            creditValueBitmap: BITMAP_FONT_ROBOTO_CONDENSED_MEDIUM,
            totalBetLabel: APP_FONT_FAMILY,
            totalBetValue: APP_FONT_FAMILY,
            totalBetLabelBitmap: BITMAP_FONT_ROBOTO_CONDENSED_MEDIUM,
            totalBetValueBitmap: BITMAP_FONT_ROBOTO_CONDENSED_MEDIUM,
            status: APP_FONT_FAMILY,
            winStatus: APP_FONT_FAMILY,
            win: APP_FONT_FAMILY,
            winStatusBitmap: BITMAP_FONT_ROBOTO_CONDENSED_MEDIUM,
            winBitmap: BITMAP_FONT_ROBOTO_BLACK,
            jackpotValue: APP_FONT_FAMILY,
            jackpotLabel: APP_FONT_FAMILY
        },
        backgrounds: {
            bottom: { frame: 'bottom_bg.png', x: 0, y: 1034 },
            winField: { frame: 'win_field.png', x: 0, y: 942 }
        },
        buttons: {
            start: { base: 'button_start', x: 1616, y: 368, width: 300, height: 300, enableFadeFrames: 12, enableFadeFromAlpha: 0.55 },
            stop: { base: 'button_stop', x: 1616, y: 368, width: 300, height: 300, enableFadeFrames: 12, enableFadeFromAlpha: 0.55 },
            auto: { base: 'button_autoplay', x: 1728, y: 88, width: 162, height: 162, enableFadeFrames: 10, enableFadeFromAlpha: 0.55 },
            autoStop: { base: 'button_autoX', x: 1728, y: 88, width: 162, height: 162, enableFadeFrames: 10, enableFadeFromAlpha: 0.55, counter: { x: 82, y: 78, fontSize: 54, minFontSize: 26, maxWidth: 118, color: 0xffffff, fontWeight: APP_FONT_WEIGHT_REGULAR, align: 'center' } },
            bet: { base: 'button_bet', x: 1728, y: 820, width: 162, height: 162, enableFadeFrames: 10, enableFadeFromAlpha: 0.55 },
            settings: { base: 'button_settings', x: 30, y: 820, width: 162, height: 162, enableFadeFrames: 10, enableFadeFromAlpha: 0.55 },
            buyBonus: { base: 'bb_yellow', x: 0, y: 430, width: 194, height: 164, enableFadeFrames: 10, enableFadeFromAlpha: 0.55 },
            home: { base: 'button_home', x: 83, y: 1030, width: 50, height: 50, enableFadeFrames: 8, enableFadeFromAlpha: 0.55 }
        },
        texts: {
            credit: { x: 220, y: 1039, fontSize: 34, align: 'left', anchorX: 0, labelColor: 0xffc600, valueColor: 0xf3f9f9 },
            totalBet: { x: 1490, y: 1039, fontSize: 34, align: 'left', anchorX: 0, labelColor: 0xffc600, valueColor: 0xf3f9f9 },
            status: { x: 960, y: 969, fontSize: 36, align: 'center', anchorX: 0.5 },
            winStatus: { x: 960, y: 990, fontSize: 34, align: 'center', anchorX: 0.5 },
            win: { x: 960, y: 953, fontSize: 36, align: 'center', anchorX: 0.5 }
        },
        freeGamesTitle: {
            panelX: -7,
            panelY: 362,
            twoDigitLeftX: 27,
            twoDigitRightX: 111,
            digitY: 512,
            singleDigitX: 64
        },
        topBar: {
            logo: { frame: 'logo.png', x: 20, y: 6 },
            jackpots: [
                {
                    frame: 'jackpot_gold_act.png',
                    x: 248,
                    y: 6,
                    valueX: 497.5,
                    valueY: 15,
                    valueText: '1000.00',
                    serverValueKey: 'GRAND_JACKPOT_VALUE',
                    betMultiplier: 1000,
                    labelX: 488,
                    labelY: 73,
                    labelText: '',
                    valueFontSize: 48,
                    valueMaxWidth: 300,
                    valueMinFontSize: 28,
                    valueOffsetY: -8,
                    labelFontSize: 22,
                    valueColor: 0xffcc00,
                    labelColor: 0xffcc00
                },
                {
                    frame: 'jackpot_silver_act.png',
                    x: 736,
                    y: 6,
                    valueX: 977.5,
                    valueY: 15,
                    valueText: '10.00',
                    serverValueKey: 'MAJOR_JACKPOT_VALUE',
                    betMultiplier: 100,
                    labelX: 976,
                    labelY: 73,
                    labelText: '',
                    valueFontSize: 48,
                    valueMaxWidth: 300,
                    valueMinFontSize: 28,
                    valueOffsetY: -8,
                    labelFontSize: 22,
                    valueColor: 0xbadcff,
                    labelColor: 0xbadcff
                },
                {
                    frame: 'jackpot_bronze_act.png',
                    x: 1224,
                    y: 6,
                    valueX: 1464.5,
                    valueY: 15,
                    valueText: '2.00',
                    serverValueKey: 'MINOR_JACKPOT_VALUE',
                    betMultiplier: 20,
                    labelX: 1464,
                    labelY: 73,
                    labelText: '',
                    valueFontSize: 48,
                    valueMaxWidth: 300,
                    valueMinFontSize: 28,
                    valueOffsetY: -8,
                    labelFontSize: 22,
                    valueColor: 0xfc87af,
                    labelColor: 0xfc87af
                }
            ]
        },
        betMenu: {
            panel: { frame: 'bg_bet.png', x: 846, y: 86 },
            valueField: { frame: 'bet_value.png', x: 1036, y: 536 },
            title: { x: 1293, y: 120, fontSize: 60, color: 0x93a7bf },
            totalBetLabel: { x: 1293, y: 641, fontSize: 46, color: 0xbee1f5 },
            valueText: { x: 1289, y: 566, fontSize: 46, color: 0xbee1f5 },
            lines: { x: 1293, y: 166, fontSize: 36, color: 0xbee1f5 },
            buttons: {
                max: { frame: 'button_maxbet_001.png', pressed: 'button_maxbet_002.png', x: 1136, y: 740, fontSize: 42, color: 0xbee1f5 },
                plus: { frame: 'plus_001.png', pressed: 'plus_002.png', x: 1401, y: 528 },
                minus: { frame: 'minus_001.png', pressed: 'minus_002.png', x: 1042, y: 528 },
                close: { frame: 'button_closesmall_001.png', pressed: 'button_closesmall_002.png', x: 1550, y: 815 },
                preset: {
                    frame: 'button_digit_001.png',
                    pressed: 'button_digit_002.png',
                    fontSize: 42,
                    color: 0xbee1f5,
                    positions: [
                        { x: 937, y: 364 },
                        { x: 1182, y: 364 },
                        { x: 1427, y: 364 },
                        { x: 937, y: 220 },
                        { x: 1182, y: 220 },
                        { x: 1427, y: 220 }
                    ]
                }
            }
        },
        autoPlayMenu: {
            overlay: { color: 0x000000, alpha: 0.55 },
            panel: { frame: 'bg_auto.png', x: 853, y: 94 },
            title: { x: 1300, y: 96, fontSize: 60, color: 0x93a7bf, maxWidth: 760, minFontSize: 30 },
            autoSpinsLabel: { x: 1300, y: 500, fontSize: 54, color: 0x93a7bf, maxWidth: 880, minFontSize: 26 },
            infoText: { x: 1296, y: 312, fontSize: 36, color: 0xb9c5d3 },
            buttons: {
                close: { frame: 'button_closesmall_001.png', pressed: 'button_closesmall_002.png', x: 1512, y: 859 },
                start: { frame: 'start_autospins_001.png', pressed: 'start_autospins_002.png', x: 901, y: 139, fontSize: 60, color: 0xbee1f5, maxTextWidth: 760, minFontSize: 18, textOffsetY: 0 },
                spin: {
                    frame: 'button_digit_001.png',
                    pressed: 'button_digit_002.png',
                    fontSize: 60,
                    color: 0xbee1f5,
                    values: [10, 20, 50, 100, 1000],
                    positions: [
                        { x: 963, y: 403 },
                        { x: 1190, y: 403 },
                        { x: 1417, y: 403 },
                        { x: 1068, y: 276 },
                        { x: 1295, y: 276 }
                    ]
                },
                turbo: { frame: 'turbo_bg_001.png', pressed: 'turbo_bg_002.png', x: 1043, y: 762, fontSize: 36, color: 0xb9c5d3, textAlign: 'left', textX: 80, textY: 53, textOffsetY: 0 },
                skip: { frame: 'skipscreen_bg_001.png', pressed: 'skipscreen_bg_002.png', x: 1043, y: 603, fontSize: 36, color: 0xb9c5d3, textAlign: 'left', textX: 80, textY: 53, textOffsetY: 0 }
            }
        },
        buyBonusMenu: {
            background: { x: 0, y: 0, width: 1920, height: 1080 },
            panels: {
                free: { x: 420, y: 190 },
                haw: { x: 989, y: 190 }
            },
            symbols: {
                free: { x: 493, y: 605 },
                haw: { x: 1100, y: 590 }
            },
            controls: {
                betBg: { x: 703, y: 86 },
                plus: { x: 1068, y: 78 },
                minus: { x: 709, y: 78 },
                close: { x: 1711, y: 829 },
                freeBuy: { x: 552, y: 285 },
                hawBuy: { x: 1121, y: 285 }
            },
            texts: {
                title: { x: 960, y: 40, fontSize: 60, maxWidth: 760, minFontSize: 30 },
                buyButton: { maxWidth: 180, minFontSize: 24 },
                totalBetLabel: { x: 956, y: 206, fontSize: 46 },
                totalBetValue: { x: 956, y: 139, fontSize: 46 },
                freeTitle: { x: 672, y: 560, fontSize: 54, maxWidth: 430, minFontSize: 28 },
                hawTitle: { x: 1241, y: 560, fontSize: 54, maxWidth: 430, minFontSize: 28 },
                freePrice: { x: 672, y: 465, fontSize: 54 },
                hawPrice: { x: 1241, y: 465, fontSize: 54 }
            }
        },
        buyBonusConfirm: {
            background: { x: 0, y: 0, width: 1920, height: 1080 },
            panel: { x: 465, y: 240 },
            symbols: {
                free: { x: 782, y: 581 },
                haw: { x: 811, y: 566 }
            },
            buttons: {
                yes: { x: 665, y: 331 },
                no: { x: 988, y: 331 }
            },
            texts: {
                title: { x: 960, y: 345, fontSize: 54, wordWrapWidth: 930 }
            }
        },
        bootSoundPrompt: {
            background: { x: 0, y: 0, width: 1920, height: 1080, alpha: 0.92 },
            panel: { x: 611, y: 297 },
            logo: { x: 711, y: 496 },
            buttons: {
                yes: { x: 665, y: 341 },
                no: { x: 988, y: 341 }
            },
            texts: {
                title: { x: 960, y: 250, fontSize: 54 }
            }
        },
        helpMenu: {
            background: { frame: 'bg_menu.png', width: 1920, height: 1080 },
            overlay: { color: 0x000000, alpha: 0.08 },
            title: { x: 960, y: 98, fontSize: 58, color: 0x93a7bf, maxWidth: 760 },
            page: { x: 1750, y: 925, fontSize: 28, color: 0xffffff, maxWidth: 180 },
            logo: { frame: 'logo.png', x: 18, y: 8, scale: 0.76 },
            footer: {
                background: { frame: 'bottom_bg.png', x: 0, y: 1034 },
                credit: { x: 220, y: 1039, fontSize: 34, labelColor: 0xffc600, valueColor: 0xf3f9f9, labelMaxWidth: 260, valueMaxWidth: 360 },
                totalBet: { x: 1490, y: 1039, fontSize: 34, labelColor: 0xffc600, valueColor: 0xf3f9f9, labelMaxWidth: 160, valueMaxWidth: 260 }
            },
            navigation: {
                close: { normal: 'button_close_001.png', pressed: 'button_close_002.png', x: 1711, y: 928, legacyY: true },
                prev: { normal: 'button_arrow_l_001.png', pressed: 'button_arrow_l_002.png', x: 1660, y: 150, legacyY: true },
                next: { normal: 'button_arrow_r_001.png', pressed: 'button_arrow_r_002.png', x: 1760, y: 150, legacyY: true }
            },
            tabs: {
                history: { base: 'button_history', x: 1394, y: 140, legacyY: true, key: 'helpHistory', fallback: 'HISTORY' },
                paytable: { base: 'button_pay', x: 354, y: 140, legacyY: true, key: 'helpPay', fallback: 'PAYTABLE' },
                settings: { base: 'button_sett', x: 874, y: 140, legacyY: true, key: 'helpSettings', fallback: 'SETTINGS' },
                rules: { base: 'button_rules', x: 1394, y: 140, legacyY: true, key: 'helpRules', fallback: 'RULES' }
            },
            paytablePages: {
                holdAndWin: {
                    symbols: { frames: ['mega_blur_01.png', 'major_blur_01.png', 'mini_blur_01.png', 'shield_blur_01.png'], startX: 500, bottomY: 690, scale: 0.7, stepMultiplier: 0.7 },
                    texts: [
                        { x: 200, bottomY: 690, width: 1580, height: 300, fontSize: 30, key: 'splashTxt' }
                    ]
                },
                freeGames: {
                    book: { frame: 'book_blur_01.png', x: 346, bottomY: 590, scale: 0.7 },
                    titles: {
                        wild: { x: 391, bottomY: 870, fontSize: 34, key: 'splashSecTitleWild', fallback: 'SCATTER / WILD' },
                        special: { x: 1073, bottomY: 870, fontSize: 34, key: 'splashSecTitleSpecial', fallback: 'SPECIAL SYMBOLS' }
                    },
                    specialSymbols: {
                        frames: ['10_blur_01.png', 'J_blur_01.png', 'Q_blur_01.png', 'K_blur_01.png', 'A_blur_01.png', 'torch_blur_01.png', 'axe_blur_01.png', 'chalice_blur_01.png', 'knight_blur_01.png'],
                        topRowX: 900,
                        secondRowX: 948,
                        bottomY: 665,
                        scale: 0.3,
                        stepMultiplier: 0.35,
                        tint: 0xffdc57
                    },
                    texts: [
                        { x: 210, bottomY: 568, width: 1520, height: 240, fontSize: 30, key: 'splashSecTxt' }
                    ]
                },
                primary: {
                    topSymbol: { frame: 'book_blur_01.png', x: 660, bottomY: 800, scale: 0.5 },
                    description: { x: 850, bottomY: 860, width: 720, height: 160, fontSize: 28, key: 'paytableScatter' },
                    scatterPays: { x: 483, bottomY: 884, fontSize: 32 },
                    items: [
                        { frame: 'knight_blur_01.png', x: 165, bottomY: 570, paysX: 365, paysY: 674, includeFourRows: true },
                        { frame: 'chalice_blur_01.png', x: 575, bottomY: 600, paysX: 745, paysY: 674 },
                        { frame: 'axe_blur_01.png', x: 970, bottomY: 600, paysX: 1130, paysY: 674 },
                        { frame: 'torch_blur_01.png', x: 1365, bottomY: 600, paysX: 1525, paysY: 674 },
                        { frame: 'A_blur_01.png', x: 110, bottomY: 400, paysX: 260, paysY: 506 },
                        { frame: 'K_blur_01.png', x: 440, bottomY: 400, paysX: 590, paysY: 506 },
                        { frame: 'Q_blur_01.png', x: 770, bottomY: 400, paysX: 920, paysY: 506 },
                        { frame: 'J_blur_01.png', x: 1100, bottomY: 400, paysX: 1250, paysY: 506 },
                        { frame: '10_blur_01.png', x: 1430, bottomY: 400, paysX: 1580, paysY: 506 }
                    ]
                },
                gold: {
                    items: [
                        { frame: 'knight_blur_01.png', x: 145, bottomY: 671, paysX: 335, paysY: 743, includeFourRows: true },
                        { frame: 'chalice_blur_01.png', x: 585, bottomY: 688, paysX: 755, paysY: 743 },
                        { frame: 'axe_blur_01.png', x: 990, bottomY: 688, paysX: 1150, paysY: 743 },
                        { frame: 'torch_blur_01.png', x: 1410, bottomY: 688, paysX: 1570, paysY: 743 },
                        { frame: 'A_blur_01.png', x: 110, bottomY: 488, paysX: 260, paysY: 558 },
                        { frame: 'K_blur_01.png', x: 450, bottomY: 488, paysX: 600, paysY: 558 },
                        { frame: 'Q_blur_01.png', x: 790, bottomY: 488, paysX: 940, paysY: 558 },
                        { frame: 'J_blur_01.png', x: 1130, bottomY: 488, paysX: 1280, paysY: 558 },
                        { frame: '10_blur_01.png', x: 1470, bottomY: 488, paysX: 1620, paysY: 558 }
                    ],
                    scale: 0.45,
                    tint: 0xffdc57,
                    frameFill: 0xd19a12,
                    frameStroke: 0xffef9f
                },
                paylines: {
                    text1: { x: 310, bottomY: 445, width: 1300, height: 220, fontSize: 28, key: 'paylinesTxt', align: 'center' },
                    grid: { startX: 500, topRowBottomY: 800, bottomRowBottomY: 650, stepX: 260 }
                }
            },
            settingsPage: {
                columns: { leftX: 357, rightX: 1063 },
                rows: { sound: 812, soundFx: 658, music: 499, volume: 345, lobby: 812, skipIntro: 658, turbo: 499, skipScreen: 340 },
                volumeTitle: { offsetX: 80, bottomY: 382, fontSize: 34, color: 0xb9c5d3 },
                volumeValue: { offsetX: 295, bottomY: 382, fontSize: 38, color: 0xb9c5d3 },
                infoText: { x: 1063, bottomY: 430, fontSize: 26, color: 0xb9c5d3, maxWidth: 320 }
            },
            rulesPages: {
                howTo: {
                    minBet: { x: 0, bottomY: 910, width: 920, height: 40, fontSize: 28 },
                    maxBet: { x: 0, bottomY: 950, width: 920, height: 40, fontSize: 28 },
                    interfaceText: { x: 220, bottomY: 720, width: 1265, height: 220, fontSize: 26, key: 'rulesInterface' },
                    autoplayText: { x: 220, bottomY: 420, width: 1265, height: 180, fontSize: 26, key: 'rulesAutoplay' }
                },
                betSettings: {
                    betMenuText: { x: 220, bottomY: 760, width: 1265, height: 220, fontSize: 26, key: 'rulesBetMenu' },
                    settingsText: { x: 220, bottomY: 480, width: 1265, height: 220, fontSize: 26, key: 'rulesSettings' }
                },
                lines: {
                    linesText: { x: 220, bottomY: 700, width: 1265, height: 250, fontSize: 26, key: 'rulesLines' },
                    unfinishedText: { x: 220, bottomY: 420, width: 1265, height: 140, fontSize: 26, key: 'rulesUnfinished' },
                    gamePercent: { x: 220, bottomY: 330, width: 1265, height: 80, fontSize: 28 }
                },
                extra: {
                    maxWinText: { x: 220, bottomY: 790, width: 1580, height: 140, fontSize: 26, key: 'rulesMaxWin' },
                    buyBonusText: { x: 220, bottomY: 590, width: 1580, height: 190, fontSize: 26, key: 'rulesBuyBonus' },
                    buyFreeRtp: { x: 220, bottomY: 360, width: 1580, height: 60, fontSize: 28 },
                    buyHoldRtp: { x: 220, bottomY: 315, width: 1580, height: 60, fontSize: 28 }
                },
                addFreeGames: {
                    addFreeGamesText: { x: 220, bottomY: 750, width: 1700, height: 180, fontSize: 34, key: 'rulesAddFg' }
                }
            }
        }
    }; 

    if (!manifest || !isObject(manifest.ui) || !isObject(manifest.ui.hud)) {
        return fallback;
    }

    const hud = manifest.ui.hud;
    return {
        fonts: mergeBranch(fallback.fonts, hud.fonts),
        backgrounds: mergeBranch(fallback.backgrounds, hud.backgrounds),
        buttons: mergeBranch(fallback.buttons, hud.buttons),
        texts: mergeBranch(fallback.texts, hud.texts),
        freeGamesTitle: mergeBranch(fallback.freeGamesTitle, hud.freeGamesTitle),
        topBar: mergeBranch(fallback.topBar, hud.topBar),
        betMenu: mergeBranch(fallback.betMenu, hud.betMenu),
        autoPlayMenu: mergeBranch(fallback.autoPlayMenu, hud.autoPlayMenu),
        buyBonusMenu: mergeBranch(fallback.buyBonusMenu, hud.buyBonusMenu),
        buyBonusConfirm: mergeBranch(fallback.buyBonusConfirm, hud.buyBonusConfirm),
        bootSoundPrompt: mergeBranch(fallback.bootSoundPrompt, hud.bootSoundPrompt),
        helpMenu: mergeBranch(fallback.helpMenu, hud.helpMenu)
    };
}

export function getGameplaySpineConfig(manifest) {
    if (!manifest || !manifest.gameplaySpine || typeof manifest.gameplaySpine !== 'object') {
        return {};
    }

    const result = {};
    const keys = ['freeGamesIntro', 'freeGamesBook', 'freeGamesCongrats'];
    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const clip = normalizeGameplaySpineClipConfig(manifest.gameplaySpine[key]);
        if (clip) {
            result[key] = clip;
        }
    }

    return result;
}

export function getIntroConfig(manifest) {
    const fallback = {
        boot: {
            layoutMode: 'fit-center',
            backgroundColor: 0x000000,
            spine: { x: 960, y: 420, offsetX: -360, offsetY: 0, scale: 0.58 },
            loadingBar: {
                atlasPath: 'assets/spine/intro/loading.json',
                x: 0,
                y: 36,
                width: 440,
                height: 10,
                sweepSpeed: 420,
                chunkFraction: 0.25
            }
        },
        gameplay: {
            layoutMode: 'native-center-top',
            backgroundColor: 0x000000,
            backgroundImagePath: 'assets/backgrounds/bg.jpg',
            background: { x: 0, y: 0, width: 1920, height: 1080 },
            spine: { x: 960, y: 0, offsetX: 0, offsetY: 0, scale: 1 },
            skipPrompt: {
                enabled: true,
                text: 'TAP TO CONTINUE',
                x: 960,
                y: 620,
                fontSize: 60,
                maxWidth: 900,
                color: 0xffffff,
                delaySec: 1.2,
                minAlpha: 0.15,
                maxAlpha: 1
            }
        }
    };

    if (!manifest || !isObject(manifest.intro)) {
        return fallback;
    }

    const intro = manifest.intro;
    return {
        boot: mergeBranch(fallback.boot, intro.boot),
        gameplay: mergeBranch(fallback.gameplay, intro.gameplay)
    };
}

export function getBackgroundKeys(manifest) {
    if (!manifest) return [];
    const bg = manifest.backgrounds || {};
    return [
        bg.base, bg.fg, bg.haw,
        bg.landscape && bg.landscape.base,
        bg.landscape && bg.landscape.fg,
        bg.landscape && bg.landscape.haw,
        bg.portrait && bg.portrait.base,
        bg.portrait && bg.portrait.fg,
        bg.portrait && bg.portrait.haw
    ].filter((value) => typeof value === 'string');
}

export function getBackgroundTextureKey(manifest, variant, mode, isLandscape) {
    if (!manifest || !manifest.backgrounds) {
        return null;
    }

    const bg = manifest.backgrounds;

    if (variant === 'mobile') {
        const mobileMap = isLandscape ? bg.landscape : bg.portrait;
        return getModeValue(mobileMap, mode) || getModeValue(bg, mode);
    }

    return getModeValue(bg, mode);
}

export function getReelLayerKeys(manifest) {
    if (!manifest || !manifest.reels) return [];
    const reels = manifest.reels;
    const keys = [
        reels.background && reels.background.base,
        reels.background && reels.background.fg,
        reels.background && reels.background.haw,
        reels.frame && reels.frame.base,
        reels.frame && reels.frame.fg,
        reels.frame && reels.frame.haw
    ].filter((value) => typeof value === 'string');
    return [...new Set(keys)];
}

export function getReelTextureKey(manifest, layer, mode) {
    if (!manifest || !manifest.reels || !manifest.reels[layer]) {
        return null;
    }
    return getModeValue(manifest.reels[layer], mode);
}

export function getSymbolAtlases(manifest) {
    if (!manifest || !manifest.symbols || !Array.isArray(manifest.symbols.atlases)) {
        return [];
    }
    return manifest.symbols.atlases.filter((value) => typeof value === 'string');
}

export function getSymbolFrameDefs(manifest) {
    if (!manifest || !manifest.symbols || !Array.isArray(manifest.symbols.frames)) {
        return [];
    }

    return manifest.symbols.frames
        .filter((entry) => entry && typeof entry.prefix === 'string' && typeof entry.atlas === 'string')
        .map((entry) => ({
            prefix: entry.prefix,
            atlas: entry.atlas,
            winProfile: typeof entry.winProfile === 'string' && entry.winProfile.length > 0 ? entry.winProfile : 'normal',
            offsetX: Number.isFinite(entry.offsetX) ? entry.offsetX : 0,
            offsetY: Number.isFinite(entry.offsetY) ? entry.offsetY : 0,
            spine: normalizeSymbolSpineConfig(entry.spine)
        }));
}

function normalizePrefix(prefix) {
    if (typeof prefix !== 'string') return '';
    return prefix.endsWith('_') ? prefix.slice(0, -1) : prefix;
}

export function getSymbolFrameDefsByIndex(manifest) {
    const defs = getSymbolFrameDefs(manifest);
    const defsByPrefix = new Map();
    for (let i = 0; i < defs.length; i++) {
        defsByPrefix.set(normalizePrefix(defs[i].prefix), defs[i]);
    }

    return SYMBOL_INDEX_PREFIX_ORDER.map((prefix) => {
        const key = normalizePrefix(prefix);
        const found = defsByPrefix.get(key);
        if (found) return found;
        return { prefix, atlas: '', winProfile: 'normal', offsetX: 0, offsetY: 0, spine: null };
    });
}

export function getReelsLayoutConfig(manifest, variant, isLandscape) {
    const fallback = {
        reels: {
            count: GAME_RULES.REELS,
            spacing: 162,
            x: 105,
            y: 65,
            width: 162,
            height: 440,
            strip: [1, 5, 6, 4, 5],
            forceSymbolIndex: null
        },
        layers: {
            reelsBgX: 0,
            reelsBgY: 0,
            titleX: 0,
            titleY: 0,
            linesAboveSymbols: false
        },
        betMenu: {
            panel: { frame: 'bg_bet.png', x: 846, y: 86 },
            valueField: { frame: 'bet_value.png', x: 1036, y: 536 },
            title: { x: 1293, y: 120, fontSize: 60, color: 0x93a7bf },
            totalBetLabel: { x: 1293, y: 641, fontSize: 46, color: 0xbee1f5 },
            valueText: { x: 1289, y: 566, fontSize: 46, color: 0xbee1f5 },
            lines: { x: 1293, y: 166, fontSize: 36, color: 0xbee1f5 },
            buttons: {
                max: { frame: 'button_maxbet_001.png', pressed: 'button_maxbet_002.png', x: 1136, y: 740, fontSize: 42, color: 0xbee1f5 },
                plus: { frame: 'plus_001.png', pressed: 'plus_002.png', x: 1401, y: 528 },
                minus: { frame: 'minus_001.png', pressed: 'minus_002.png', x: 1042, y: 528 },
                close: { frame: 'button_closesmall_001.png', pressed: 'button_closesmall_002.png', x: 1505, y: 815 },
                preset: {
                    frame: 'button_digit_001.png',
                    pressed: 'button_digit_002.png',
                    fontSize: 42,
                    color: 0xbee1f5,
                    positions: [
                        { x: 937, y: 364 },
                        { x: 1182, y: 364 },
                        { x: 1427, y: 364 },
                        { x: 937, y: 220 },
                        { x: 1182, y: 220 },
                        { x: 1427, y: 220 }
                    ]
                }
            }
        }
    }; 

    if (!manifest || !isObject(manifest.layout)) return fallback;
    const branch = getLayoutBranch(manifest, variant, isLandscape);

    if (!isObject(branch)) return fallback;

    const branchValue = branch as any;
    const reels = isObject(branchValue.reels) ? branchValue.reels : {};
    const layers = isObject(branchValue.layers) ? branchValue.layers : {};

    return {
        reels: {
            count: GAME_RULES.REELS,
            spacing: Number.isFinite(reels.spacing) ? reels.spacing : fallback.reels.spacing,
            x: Number.isFinite(reels.x) ? reels.x : fallback.reels.x,
            y: Number.isFinite(reels.y) ? reels.y : fallback.reels.y,
            width: Number.isFinite(reels.width) ? reels.width : fallback.reels.width,
            height: Number.isFinite(reels.height) ? reels.height : fallback.reels.height,
            strip: Array.isArray(reels.strip) && reels.strip.length > 0 ? reels.strip : fallback.reels.strip,
            forceSymbolIndex: Number.isFinite(reels.forceSymbolIndex) ? reels.forceSymbolIndex : fallback.reels.forceSymbolIndex
        },
        layers: {
            reelsBgX: Number.isFinite(layers.reelsBgX) ? layers.reelsBgX : fallback.layers.reelsBgX,
            reelsBgY: Number.isFinite(layers.reelsBgY) ? layers.reelsBgY : fallback.layers.reelsBgY,
            titleX: Number.isFinite(layers.titleX) ? layers.titleX : fallback.layers.titleX,
            titleY: Number.isFinite(layers.titleY) ? layers.titleY : fallback.layers.titleY,
            linesAboveSymbols: typeof layers.linesAboveSymbols === 'boolean' ? layers.linesAboveSymbols : fallback.layers.linesAboveSymbols
        },
        betMenu: {
            panel: { frame: 'bg_bet.png', x: 846, y: 86 },
            valueField: { frame: 'bet_value.png', x: 1036, y: 536 },
            title: { x: 1293, y: 120, fontSize: 60, color: 0x93a7bf },
            totalBetLabel: { x: 1293, y: 641, fontSize: 46, color: 0xbee1f5 },
            valueText: { x: 1289, y: 566, fontSize: 46, color: 0xbee1f5 },
            lines: { x: 1293, y: 166, fontSize: 36, color: 0xbee1f5 },
            buttons: {
                max: { frame: 'button_maxbet_001.png', pressed: 'button_maxbet_002.png', x: 1136, y: 740, fontSize: 42, color: 0xbee1f5 },
                plus: { frame: 'plus_001.png', pressed: 'plus_002.png', x: 1401, y: 528 },
                minus: { frame: 'minus_001.png', pressed: 'minus_002.png', x: 1042, y: 528 },
                close: { frame: 'button_closesmall_001.png', pressed: 'button_closesmall_002.png', x: 1505, y: 815 },
                preset: {
                    frame: 'button_digit_001.png',
                    pressed: 'button_digit_002.png',
                    fontSize: 42,
                    color: 0xbee1f5,
                    positions: [
                        { x: 937, y: 364 },
                        { x: 1182, y: 364 },
                        { x: 1427, y: 364 },
                        { x: 937, y: 220 },
                        { x: 1182, y: 220 },
                        { x: 1427, y: 220 }
                    ]
                }
            }
        }
    }; 
}

function normalizeStripSet(stripSet, reelsCount, fallbackStrip) {
    if (!Array.isArray(stripSet) || stripSet.length === 0) {
        return new Array(reelsCount).fill(0).map(() => [...fallbackStrip]);
    }

    const normalized = [];
    for (let i = 0; i < reelsCount; i++) {
        const reelStrip = stripSet[i];
        if (isNumericArray(reelStrip)) {
            normalized.push([...reelStrip]);
        } else {
            normalized.push([...fallbackStrip]);
        }
    }
    return normalized;
}

function resolveStripSetByMode(math, mode) {
    if (!math || !isObject(math)) return null;
    if (mode === 'free') return math.stripsFreeGames || math.stripsNormalGames || null;
    if (mode === 'holdAndWin') return math.stripsHoldAndWin || math.stripsNormalGames || null;
    return math.stripsNormalGames || null;
}

export function getReelStripsConfig(manifest, variant, isLandscape, mode = 'normal') {
    const layout = getReelsLayoutConfig(manifest, variant, isLandscape);
    const reelsCount = layout.reels.count;
    const fallbackStrip = Array.isArray(layout.reels.strip) && layout.reels.strip.length > 0
        ? layout.reels.strip
        : [1, 5, 6, 4, 5];

    const stripSet = resolveStripSetByMode(STRIPS_CONFIG, mode) || resolveStripSetByMode(manifest && manifest.math, mode);
    return normalizeStripSet(stripSet, reelsCount, fallbackStrip);
}

export function getDefaultStripMode(manifest) {
    const mode = STRIPS_CONFIG.activeStripSet as string;
    if (mode === 'free' || mode === 'holdAndWin') return mode;
    return 'normal';
}








