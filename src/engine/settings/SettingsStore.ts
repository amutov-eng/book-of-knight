/**
 * In-memory settings storage.
 */
export default class SettingsStore {
  private data: Record<string, unknown>;
  private readonly storageKey: string | null;

  constructor(initial: Record<string, unknown> = {}, storageKey: string | null = null) {
    this.storageKey = typeof storageKey === 'string' && storageKey.trim().length > 0
      ? storageKey
      : null;
    this.data = { ...initial };
    this.hydrate();
  }

  get<T = unknown>(key: string, fallback: T | null = null): T | null {
    return Object.prototype.hasOwnProperty.call(this.data, key) ? (this.data[key] as T) : fallback;
  }

  set(key: string, value: unknown): void {
    this.data[key] = value;
    this.persist();
  }

  merge(patch: Record<string, unknown> | null | undefined): void {
    if (!patch || typeof patch !== 'object') return;
    Object.assign(this.data, patch);
    this.persist();
  }

  private hydrate(): void {
    if (!this.storageKey || typeof window === 'undefined' || !window.localStorage) return;

    try {
      const raw = window.localStorage.getItem(this.storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return;
      Object.assign(this.data, parsed);
    } catch {
      return;
    }
  }

  private persist(): void {
    if (!this.storageKey || typeof window === 'undefined' || !window.localStorage) return;

    try {
      window.localStorage.setItem(this.storageKey, JSON.stringify(this.data));
    } catch {
      return;
    }
  }
}
