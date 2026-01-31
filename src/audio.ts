// MIT license: https://d20.zip/license.txt
// https://github.com/DenWav/d20.zip

import { DiceSoundConstant, SOUND } from './constants.js';

type CollisionType = 'dice-dice' | 'dice-floor' | 'dice-wall';

export class AudioManager {
    private audioContext: AudioContext | null = null;
    private lastPlayTime = 0;
    private enabled: boolean = SOUND.ENABLED;
    private initialized = false;
    private buffers: Map<string, AudioBuffer> = new Map();
    private loading = false;
    private volume: number = SOUND.DEFAULT_VOLUME;

    public constructor() {
        // Set up event listeners for user interaction to initialize audio
        const initAudio = async () => {
            if (!this.initialized) {
                this.ensureAudioContext();
                await this.loadSamples();
                this.initialized = true;
            }
        };

        // Listen for any user interaction
        document.addEventListener('click', initAudio, { once: true });
        document.addEventListener('keydown', initAudio, { once: true });
        document.addEventListener('touchstart', initAudio, { once: true });
    }

    public setupUi() {
        // Audio controls in UI
        const audioEnabledCheckbox = document.getElementById('audio-enabled') as HTMLInputElement;
        const audioVolumeSlider = document.getElementById('audio-volume') as HTMLInputElement;
        const audioVolumeValue = document.getElementById('audio-volume-value') as HTMLSpanElement;

        if (audioEnabledCheckbox) {
            audioEnabledCheckbox.checked = this.isEnabled();
            audioEnabledCheckbox.addEventListener('change', () => {
                this.setEnabled(audioEnabledCheckbox.checked);
            });
        }

        if (audioVolumeSlider && audioVolumeValue) {
            audioVolumeSlider.value = this.getVolume().toString();
            audioVolumeValue.textContent = `${this.getVolume()}%`;

            audioVolumeSlider.addEventListener('input', () => {
                const volume = parseInt(audioVolumeSlider.value, 10);
                this.setVolume(volume);
                audioVolumeValue.textContent = `${volume}%`;
            });
        }
    }

    private ensureAudioContext() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        return this.audioContext;
    }

    private async loadSamples() {
        if (this.loading) return;
        this.loading = true;

        const ctx = this.ensureAudioContext();
        const samples = [
            { key: 'dice-mat-1', url: 'audio/dice_mat_1.mp3' },
            { key: 'dice-mat-2', url: 'audio/dice_mat_2.mp3' },
            { key: 'dice-dice-1', url: 'audio/dice_dice_1.mp3' },
            { key: 'dice-dice-2', url: 'audio/dice_dice_2.mp3' },
        ];

        try {
            await Promise.all(
                samples.map(async (sample) => {
                    const response = await fetch(sample.url);
                    const arrayBuffer = await response.arrayBuffer();
                    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
                    this.buffers.set(sample.key, audioBuffer);
                })
            );
        } catch (e) {
            console.error('Failed to load audio samples:', e);
        }
    }

    public play(type: CollisionType, velocity: number) {
        if (!this.enabled || !this.initialized) return;
        if (velocity < SOUND.MIN_VELOCITY) return;

        const now = performance.now() / 1000;
        if (now - this.lastPlayTime < SOUND.MIN_INTERVAL) return;
        this.lastPlayTime = now;

        const ctx = this.ensureAudioContext();

        if (ctx.state === 'suspended') {
            // noinspection JSIgnoredPromiseFromCall
            ctx.resume();
        }

        // Select appropriate buffer
        let bufferKey: string;
        let config: DiceSoundConstant;

        if (type === 'dice-dice') {
            bufferKey = `dice-dice-${Math.random() < 0.5 ? 1 : 2}`;
            config = SOUND.DICE_DICE;
        } else {
            bufferKey = `dice-mat-${Math.random() < 0.5 ? 1 : 2}`;
            config = type === 'dice-floor' ? SOUND.DICE_FLOOR : SOUND.DICE_WALL;
        }

        const buffer = this.buffers.get(bufferKey);
        if (!buffer) {
            // Buffer might not exist if the audio context hasn't started yet
            return;
        }

        try {
            const source = ctx.createBufferSource();
            source.buffer = buffer;

            // Pitch variation based on velocity
            // Higher velocity = higher pitch (more energetic)
            // Range: 0.8 to 1.3 (lower to higher pitch)
            const velocityFactor = Math.min(velocity / 15, 2.0); // Normalize velocity
            const pitchVariation = 0.8 + velocityFactor * 0.25 + (Math.random() * 0.2 - 0.1);
            source.playbackRate.value = Math.max(0.7, Math.min(1.4, pitchVariation));

            // Volume scales with velocity but caps to avoid distortion
            const velocityVolume = Math.min(velocity / 15, 15);
            const volume = config.BASE_VOLUME * velocityVolume * this.volume;

            const gainNode = ctx.createGain();
            gainNode.gain.value = Math.min(volume * 2, 1.0);

            source.connect(gainNode);
            gainNode.connect(ctx.destination);

            source.start(0);

            // Clean up after sound completes
            source.onended = () => {
                source.disconnect();
                gainNode.disconnect();
            };
        } catch (e) {
            console.warn('Audio playback failed:', e);
        }
    }

    public setEnabled(enabled: boolean) {
        this.enabled = enabled;
    }

    public isEnabled(): boolean {
        return this.enabled;
    }

    public setVolume(volume: number) {
        // Volume is 0-100, convert to 0-1 and update volume
        this.volume = Math.max(0, Math.min(100, volume)) / 100;
    }

    public getVolume(): number {
        return Math.round(this.volume * 100);
    }
}
