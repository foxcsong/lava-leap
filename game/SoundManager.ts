
export class SoundManager {
    private ctx: AudioContext | null = null;

    private init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    private playTone(freq: number, type: OscillatorType, duration: number, volume: number = 0.1, slideTo?: number) {
        this.init();
        if (!this.ctx) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        if (slideTo) {
            osc.frequency.exponentialRampToValueAtTime(slideTo, this.ctx.currentTime + duration);
        }

        gain.gain.setValueAtTime(volume, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    public playJump() {
        this.playTone(200, 'square', 0.15, 0.05, 600);
    }

    public playGem() {
        this.playTone(800, 'sine', 0.1, 0.08, 1200);
    }

    public playSpecialGem() {
        this.playTone(600, 'sine', 0.2, 0.1, 1800);
    }

    public playDeath() {
        this.playTone(300, 'sawtooth', 0.4, 0.1, 40);
    }

    public playSlow() {
        this.playTone(400, 'triangle', 0.3, 0.1, 100);
    }

    public playColorShift() {
        this.playTone(800, 'square', 0.1, 0.05, 1200);
    }
}

export const sounds = new SoundManager();
