import { VehicleTypeId } from '../types/game';

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineSubOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;

  private rainGain: GainNode | null = null;
  private rainSource: AudioBufferSourceNode | null = null;

  private musicTimer: number | null = null;
  private musicStep = 0;

  public muted = false;
  public musicEnabled = false;
  private initialized = false;

  public unlock(): void {
    if (this.initialized) {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      this.ctx = ctx;

      const master = ctx.createGain();
      master.gain.value = this.muted ? 0 : 0.45;
      master.connect(ctx.destination);
      this.masterGain = master;

      // Continuous vehicle engine synth
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 240;
      filter.Q.value = 2.5;

      const engineGain = ctx.createGain();
      engineGain.gain.value = 0;

      const osc1 = ctx.createOscillator();
      osc1.type = 'sawtooth';
      osc1.frequency.value = 48;

      const osc2 = ctx.createOscillator();
      osc2.type = 'triangle';
      osc2.frequency.value = 24;

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(master);

      osc1.start();
      osc2.start();

      this.engineOsc = osc1;
      this.engineSubOsc = osc2;
      this.engineFilter = filter;
      this.engineGain = engineGain;

      // Continuous procedural rain noise loop
      const bufferSize = ctx.sampleRate * 2;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99765 * b0 + white * 0.099046;
        b1 = 0.96300 * b1 + white * 0.2965164;
        b2 = 0.57000 * b2 + white * 1.0526913;
        output[i] = (b0 + b1 + b2 + white * 0.1848) * 0.12;
      }

      const rainSrc = ctx.createBufferSource();
      rainSrc.buffer = noiseBuffer;
      rainSrc.loop = true;

      const rainFilter = ctx.createBiquadFilter();
      rainFilter.type = 'bandpass';
      rainFilter.frequency.value = 950;
      rainFilter.Q.value = 0.6;

      const rainGain = ctx.createGain();
      rainGain.gain.value = 0;

      rainSrc.connect(rainFilter);
      rainFilter.connect(rainGain);
      rainGain.connect(master);
      rainSrc.start();

      this.rainSource = rainSrc;
      this.rainGain = rainGain;
      this.initialized = true;

      if (this.musicEnabled) {
        this.startMusicLoop();
      }
    } catch {
      // Ignore audio errors in restricted headless contexts
    }
  }

  public setMuted(mute: boolean): void {
    this.muted = mute;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(mute ? 0 : 0.45, this.ctx.currentTime, 0.05);
    }
  }

  public setMusicEnabled(enabled: boolean): void {
    this.musicEnabled = enabled;
    if (enabled) {
      this.unlock();
      this.startMusicLoop();
    } else if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  public updateEngine(inVehicle: boolean, vehicleType: VehicleTypeId, speedRatio: number, isRaining: boolean): void {
    if (!this.initialized || !this.ctx || !this.engineOsc || !this.engineSubOsc || !this.engineGain || !this.engineFilter) {
      return;
    }
    const now = this.ctx.currentTime;

    if (!inVehicle) {
      this.engineGain.gain.setTargetAtTime(0, now, 0.08);
    } else {
      const clamped = Math.min(1.2, Math.max(0, Math.abs(speedRatio)));
      let baseFreq = 46;
      let maxFreq = 135;
      let wave: OscillatorType = 'sawtooth';
      let vol = 0.09 + clamped * 0.08;

      if (vehicleType === 'moto_simples' || vehicleType === 'moto_carga') {
        baseFreq = 54;
        maxFreq = 168;
        wave = 'sawtooth';
        vol = 0.08 + clamped * 0.07;
      } else if (vehicleType === 'fiorino' || vehicleType === 'kombi') {
        baseFreq = 42;
        maxFreq = 118;
        wave = 'triangle';
        vol = 0.1 + clamped * 0.08;
      } else {
        // Trucks: deep diesel thrum
        baseFreq = 30;
        maxFreq = 82;
        wave = 'sawtooth';
        vol = 0.12 + clamped * 0.09;
      }

      if (this.engineOsc.type !== wave) {
        this.engineOsc.type = wave;
      }
      const freq = baseFreq + (maxFreq - baseFreq) * clamped;
      this.engineOsc.frequency.setTargetAtTime(freq, now, 0.06);
      this.engineSubOsc.frequency.setTargetAtTime(freq * 0.5, now, 0.06);
      this.engineFilter.frequency.setTargetAtTime(180 + clamped * 520, now, 0.08);
      this.engineGain.gain.setTargetAtTime(vol, now, 0.08);
    }

    if (this.rainGain) {
      this.rainGain.gain.setTargetAtTime(isRaining ? 0.16 : 0, now, 0.4);
    }
  }

  /**
   * Classic Brazilian gas delivery horn (melodic 4-note chime or sharp moto horn)
   */
  public playHorn(isMoto: boolean): void {
    this.unlock();
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;

    if (isMoto) {
      // Punchy dual-beep moto horn
      [0, 0.14].forEach((offset) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(440, now + offset);
        gain.gain.setValueAtTime(0.16, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.11);
        osc.connect(gain);
        gain.connect(this.masterGain!);
        osc.start(now + offset);
        osc.stop(now + offset + 0.12);
      });
    } else {
      // Iconic Brazilian gas delivery truck 4-note jingle!
      const notes = [523.25, 659.25, 783.99, 659.25];
      notes.forEach((freq, idx) => {
        const t = now + idx * 0.13;
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.22, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        osc.connect(gain);
        gain.connect(this.masterGain!);
        osc.start(t);
        osc.stop(t + 0.125);
      });
    }
  }

  /**
   * Metallic hollow ring of a P13 steel gas cylinder being lifted/strapped
   */
  public playCylinderClank(): void {
    this.unlock();
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;

    [310, 468, 790].forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = i === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.92, now + 0.18);
      gain.gain.setValueAtTime(0.14 / (i + 1), now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(now);
      osc.stop(now + 0.2);
    });
  }

  /**
   * Two-tone Brazilian house gate doorbell ("Ding-Dong")
   */
  public playDoorbell(): void {
    this.unlock();
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;

    const chimes = [
      { freq: 784, delay: 0, dur: 0.28 },
      { freq: 587.33, delay: 0.22, dur: 0.45 },
    ];
    chimes.forEach(({ freq, delay, dur }) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + delay);
      gain.gain.setValueAtTime(0.22, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + dur);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(now + delay);
      osc.stop(now + delay + dur + 0.02);
    });
  }

  /**
   * Payment chime: cash register coins vs POS card machine beep
   */
  public playPayment(isCard: boolean): void {
    this.unlock();
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;

    const freqs = isCard ? [1200, 1200, 1600] : [587.33, 880, 1174.66];
    const step = isCard ? 0.09 : 0.075;

    freqs.forEach((f, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = isCard ? 'square' : 'sine';
      osc.frequency.setValueAtTime(f, now + idx * step);
      gain.gain.setValueAtTime(isCard ? 0.09 : 0.18, now + idx * step);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * step + 0.14);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(now + idx * step);
      osc.stop(now + idx * step + 0.15);
    });
  }

  public playCollision(intensity: number): void {
    this.unlock();
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const vol = Math.min(0.32, Math.max(0.06, intensity * 0.28));

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(115, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.18);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.21);
  }

  public playFineAlert(): void {
    this.unlock();
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    [920, 680, 920].forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, now + i * 0.1);
      gain.gain.setValueAtTime(0.11, now + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.09);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(now + i * 0.1);
      osc.stop(now + i * 0.1 + 0.095);
    });
  }

  public playLevelUp(): void {
    this.unlock();
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.1);
      gain.gain.setValueAtTime(0.22, now + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.28);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(now + i * 0.1);
      osc.stop(now + i * 0.1 + 0.3);
    });
  }

  private startMusicLoop(): void {
    if (this.musicTimer !== null) return;
    // Gentle Brazilian bossa-nova inspired chord & bass groove
    const bassNotes = [130.81, 130.81, 146.83, 196.0, 164.81, 164.81, 146.83, 196.0];
    const chordNotes = [
      [261.63, 329.63, 392.0, 493.88],
      [293.66, 349.23, 440.0, 523.25],
      [329.63, 392.0, 493.88, 587.33],
      [293.66, 392.0, 493.88, 587.33],
    ];

    this.musicTimer = window.setInterval(() => {
      if (!this.ctx || !this.masterGain || this.muted || !this.musicEnabled) return;
      const now = this.ctx.currentTime;
      const step = this.musicStep % 8;

      // Warm acoustic bass pluck
      const bass = this.ctx.createOscillator();
      const bassGain = this.ctx.createGain();
      bass.type = 'triangle';
      bass.frequency.setValueAtTime(bassNotes[step], now);
      bassGain.gain.setValueAtTime(0.07, now);
      bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      bass.connect(bassGain);
      bassGain.connect(this.masterGain);
      bass.start(now);
      bass.stop(now + 0.3);

      // Syncopated bossa chord on beats 0, 3, 6
      if (step === 0 || step === 3 || step === 6) {
        const chord = chordNotes[Math.floor(this.musicStep / 8) % chordNotes.length];
        chord.forEach((freq) => {
          const osc = this.ctx!.createOscillator();
          const g = this.ctx!.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now);
          g.gain.setValueAtTime(0.024, now);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
          osc.connect(g);
          g.connect(this.masterGain!);
          osc.start(now);
          osc.stop(now + 0.25);
        });
      }

      this.musicStep++;
    }, 310);
  }

  public dispose(): void {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    try {
      this.engineOsc?.stop();
      this.engineSubOsc?.stop();
      this.rainSource?.stop();
      this.ctx?.close();
    } catch {
      // Ignore cleanup errors
    }
  }
}
