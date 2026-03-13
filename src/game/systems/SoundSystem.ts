import { SOUND_DEFINITIONS, type SoundDefinition, type SoundId } from '../../config/soundConfig';

const AUDIO_PRELOAD_TIMEOUT_MS = 4000;

export default class SoundSystem {
    private readonly definitions: Map<SoundId, SoundDefinition>;
    private readonly prototypes: Map<SoundId, HTMLAudioElement>;
    private readonly looping: Map<SoundId, HTMLAudioElement>;
    private muted: boolean;
    private enabled: boolean;

    constructor() {
        this.definitions = new Map(SOUND_DEFINITIONS.map((definition) => [definition.id, definition]));
        this.prototypes = new Map();
        this.looping = new Map();
        this.muted = false;
        this.enabled = true;
    }

    async preload(ids?: SoundId[]): Promise<void> {
        const targetIds = Array.isArray(ids) && ids.length > 0
            ? ids
            : Array.from(this.definitions.keys());

        await Promise.all(targetIds.map(async (id) => {
            if (this.prototypes.has(id)) return;
            const definition = this.definitions.get(id);
            if (!definition) return;
            const audio = new Audio(definition.path);
            audio.preload = 'auto';
            audio.volume = definition.volume;
            this.prototypes.set(id, audio);
            await this.waitForPreload(audio);
        }));
    }

    play(id: SoundId, looping = false): void {
        if (this.muted || !this.enabled) return;
        const definition = this.definitions.get(id);
        if (!definition) return;

        if (looping) {
            this.stop(id);
            const audio = this.createAudioInstance(id, definition);
            audio.loop = true;
            this.looping.set(id, audio);
            void audio.play().catch(() => undefined);
            return;
        }

        const audio = this.createAudioInstance(id, definition);
        audio.loop = false;
        void audio.play().catch(() => undefined);
    }

    stop(id: SoundId): void {
        const active = this.looping.get(id);
        if (!active) return;
        active.pause();
        active.currentTime = 0;
        this.looping.delete(id);
    }

    stopAll(): void {
        for (const id of this.looping.keys()) {
            this.stop(id);
        }
    }

    isEnabled(): boolean {
        return this.enabled && !this.muted;
    }

    setEnabled(enabled: boolean): void {
        this.enabled = !!enabled;
        if (!this.enabled) {
            this.stopAll();
        }
    }

    setMuted(muted: boolean): void {
        this.muted = !!muted;
        if (this.muted) {
            this.stopAll();
        }
    }

    private createAudioInstance(id: SoundId, definition: SoundDefinition): HTMLAudioElement {
        const prototype = this.prototypes.get(id);
        const audio = prototype ? prototype.cloneNode(true) as HTMLAudioElement : new Audio(definition.path);
        audio.preload = 'auto';
        audio.volume = definition.volume;
        return audio;
    }

    private waitForPreload(audio: HTMLAudioElement): Promise<void> {
        return new Promise((resolve) => {
            let settled = false;
            const finish = () => {
                if (settled) return;
                settled = true;
                cleanup();
                resolve();
            };
            const cleanup = () => {
                audio.removeEventListener('canplaythrough', finish);
                audio.removeEventListener('loadeddata', finish);
                audio.removeEventListener('error', finish);
                window.clearTimeout(timeoutId);
            };
            const timeoutId = window.setTimeout(finish, AUDIO_PRELOAD_TIMEOUT_MS);
            audio.addEventListener('canplaythrough', finish, { once: true });
            audio.addEventListener('loadeddata', finish, { once: true });
            audio.addEventListener('error', finish, { once: true });
            audio.load();
        });
    }
}
