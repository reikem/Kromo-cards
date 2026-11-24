export interface AudioPreset {
  id: string;
  title: string;
  genre: string;
  bpm: number;
  notes: number[];
  waveform: OscillatorType;
}

export const AUDIO_PRESETS: AudioPreset[] = [
  {
    id: 'acoustic-stadium',
    title: 'Luces en el Cielo (Acústico Estadio)',
    genre: 'Acústico / Estadio',
    bpm: 92,
    notes: [261.63, 329.63, 392.0, 493.88, 392.0, 329.63, 293.66, 392.0],
    waveform: 'triangle',
  },
  {
    id: 'synth-arena',
    title: 'Estrellas en Neón (Encore Synth)',
    genre: 'Pop Arena',
    bpm: 118,
    notes: [349.23, 440.0, 523.25, 659.25, 523.25, 440.0, 392.0, 523.25],
    waveform: 'sine',
  },
  {
    id: 'golden-anthem',
    title: 'Himno del Estadio (Campeones)',
    genre: 'Épico / Brass',
    bpm: 108,
    notes: [293.66, 369.99, 440.0, 587.33, 440.0, 369.99, 329.63, 440.0],
    waveform: 'sawtooth',
  },
  {
    id: 'lofi-memory',
    title: 'Acordes de Verano (Recuerdo)',
    genre: 'Lo-Fi Cálido',
    bpm: 78,
    notes: [220.0, 261.63, 329.63, 392.0, 329.63, 261.63, 246.94, 329.63],
    waveform: 'sine',
  },
  {
    id: 'encore-piano',
    title: 'Piano de Despedida (Encore)',
    genre: 'Piano Vivo',
    bpm: 84,
    notes: [261.63, 293.66, 349.23, 440.0, 523.25, 440.0, 349.23, 293.66],
    waveform: 'triangle',
  },
];

class SoundEngine {
  private ctx: AudioContext | null = null;
  private loopTimer: number | null = null;
  private customAudioEl: HTMLAudioElement | null = null;
  private crowdNodes: { source: AudioBufferSourceNode; gain: GainNode } | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  /**
   * Generates copyright-free warm stadium crowd applause/ambience using filtered pink noise
   */
  public playCrowdWelcome(durationSec = 4.2) {
    const ctx = this.getContext();
    if (!ctx) return;

    this.stopCrowd();

    const bufferSize = Math.floor(ctx.sampleRate * durationSec);
    const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);

    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        const pink = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04;
        b6 = white * 0.115926;

        // Subtle applause ripple envelope
        const t = i / ctx.sampleRate;
        const clapMod = 0.65 + 0.35 * Math.sin(t * (14 + ch * 3)) * Math.cos(t * 5.2);
        data[i] = pink * clapMod;
      }
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1150, ctx.currentTime);
    filter.Q.setValueAtTime(0.65, ctx.currentTime);

    const gain = ctx.createGain();
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.22, now + 0.7);
    gain.gain.setValueAtTime(0.18, now + durationSec - 1.4);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start();

    this.crowdNodes = { source, gain };
    source.onended = () => {
      if (this.crowdNodes?.source === source) {
        this.crowdNodes = null;
      }
    };
  }

  public stopCrowd() {
    if (this.crowdNodes) {
      try {
        this.crowdNodes.source.stop();
      } catch {
        // ignore if already stopped
      }
      this.crowdNodes = null;
    }
  }

  public playCardFlip() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.09);
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  public playVerifyChime() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const t = now + idx * 0.07;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.exponentialRampToValueAtTime(0.08, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.36);
    });
  }

  public playSnippet(presetId: string, customAudioUrl?: string, onEnded?: () => void) {
    this.stopSnippet();

    if (customAudioUrl) {
      const audio = new Audio(customAudioUrl);
      audio.volume = 0.85;
      audio.onended = () => {
        this.customAudioEl = null;
        onEnded?.();
      };
      this.customAudioEl = audio;
      void audio.play().catch(() => {
        onEnded?.();
      });
      return;
    }

    const ctx = this.getContext();
    if (!ctx) return;
    const preset = AUDIO_PRESETS.find((p) => p.id === presetId) || AUDIO_PRESETS[0];
    const stepMs = (60 / preset.bpm) * 500;
    let step = 0;

    const triggerNote = () => {
      if (!ctx) return;
      const now = ctx.currentTime;
      const freq = preset.notes[step % preset.notes.length];
      const osc = ctx.createOscillator();
      const sub = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = preset.waveform;
      osc.frequency.setValueAtTime(freq, now);
      sub.type = 'sine';
      sub.frequency.setValueAtTime(freq * 0.5, now);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1900, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.09, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + stepMs / 1000);

      osc.connect(filter);
      sub.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      sub.start(now);
      osc.stop(now + stepMs / 1000 + 0.04);
      sub.stop(now + stepMs / 1000 + 0.04);

      step++;
      if (step >= 16) {
        this.stopSnippet();
        onEnded?.();
      }
    };

    triggerNote();
    this.loopTimer = window.setInterval(triggerNote, stepMs);
  }

  public stopSnippet() {
    if (this.loopTimer !== null) {
      clearInterval(this.loopTimer);
      this.loopTimer = null;
    }
    if (this.customAudioEl) {
      this.customAudioEl.pause();
      this.customAudioEl = null;
    }
  }
}

export const soundEngine = new SoundEngine();
