// @ts-nocheck
﻿function resolveNestedKey(map, key) {
    if (!map || typeof map !== 'object') return undefined;
    if (Object.prototype.hasOwnProperty.call(map, key)) return map[key];

    const parts = String(key).split('.');
    let cursor = map;
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (!cursor || typeof cursor !== 'object' || !Object.prototype.hasOwnProperty.call(cursor, part)) {
            return undefined;
        }
        cursor = cursor[part];
    }
    return cursor;
}

function formatTemplate(text, params) {
    if (typeof text !== 'string') return text;
    if (!params || typeof params !== 'object') return text;

    return text.replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, key) => {
        if (!Object.prototype.hasOwnProperty.call(params, key)) return `{${key}}`;
        return String(params[key]);
    });
}

export default class LocalizationService {
    constructor({ locales = {}, currentLocale = 'en', fallbackLocale = 'en' } = {}) {
        this.locales = locales;
        this.currentLocale = currentLocale;
        this.fallbackLocale = fallbackLocale;
    }

    static async loadFromUrl(url, options = {}) {
        const candidates = [];
        if (typeof url === 'string' && url.length > 0) {
            candidates.push(url);
            if (!/^([a-z]+:)?\/\//i.test(url) && !url.startsWith('/')) {
                candidates.unshift(`/${url}`);
            }
        }

        let lastError = 'Failed to load translations';
        for (let i = 0; i < candidates.length; i++) {
            const response = await fetch(candidates[i], { cache: 'no-cache' });
            if (!response.ok) {
                lastError = `Failed to load translations: ${response.status} ${response.statusText}`;
                continue;
            }

            const contentType = response.headers.get('content-type') || '';
            if (!contentType.toLowerCase().includes('json')) {
                lastError = `Failed to load translations: expected JSON but received ${contentType || 'unknown content type'}`;
                continue;
            }

            const payload = await response.json();
            const locales = payload && payload.locales ? payload.locales : {};
            const fallbackLocale = options.fallbackLocale || (payload.meta && payload.meta.fallbackLocale) || 'en';
            const currentLocale = options.currentLocale || fallbackLocale;

            return new LocalizationService({ locales, currentLocale, fallbackLocale });
        }

        throw new Error(lastError);
    }

    setLocale(locale) {
        if (!locale || typeof locale !== 'string') return;
        this.currentLocale = locale;
    }

    getLocale() {
        return this.currentLocale;
    }

    has(key, locale = this.currentLocale) {
        const dictionary = this.locales[locale];
        return resolveNestedKey(dictionary, key) !== undefined;
    }

    t(key, params = {}, options = {}) {
        const locale = options.locale || this.currentLocale;
        const fallbackLocale = options.fallbackLocale || this.fallbackLocale;

        const primary = resolveNestedKey(this.locales[locale], key);
        if (primary !== undefined) return formatTemplate(primary, params);

        const fallback = resolveNestedKey(this.locales[fallbackLocale], key);
        if (fallback !== undefined) return formatTemplate(fallback, params);

        return options.defaultValue != null ? String(options.defaultValue) : String(key);
    }
}
