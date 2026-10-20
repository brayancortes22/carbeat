// Servicio de Ecualización Car Audio Pro (Web Audio API)
// Ajuste paramétrico de 3 bandas (Bajos 80Hz, Medios 1kHz, Agudos 8kHz) con presets y persistencia.

export interface EqualizerGains {
  bass: number; // -12 a +12 dB
  mid: number;  // -12 a +12 dB
  treble: number; // -12 a +12 dB
}

export type EqualizerPreset = 'flat' | 'bass_boost' | 'subwoofer' | 'vocal' | 'crossover' | 'rock' | 'custom';

export const EQ_PRESETS: Record<Exclude<EqualizerPreset, 'custom'>, { name: string; gains: EqualizerGains }> = {
  flat: { name: 'Plano (Normal)', gains: { bass: 0, mid: 0, treble: 0 } },
  bass_boost: { name: 'Bajo Potente (Bass Boost)', gains: { bass: 8, mid: 0, treble: 2 } },
  subwoofer: { name: 'Subwoofer Extremo (Planta)', gains: { bass: 12, mid: -2, treble: 1 } },
  vocal: { name: 'Voz Clara (Carretera)', gains: { bass: -2, mid: 6, treble: 3 } },
  crossover: { name: 'Discoteca / Crossover', gains: { bass: 7, mid: 2, treble: 5 } },
  rock: { name: 'Rock / En Vivo', gains: { bass: 5, mid: 3, treble: 4 } },
};

const STORAGE_KEY = 'carbeat_equalizer_v1';

class EqualizerService {
  private ctx: AudioContext | null = null;
  private bassNode: BiquadFilterNode | null = null;
  private midNode: BiquadFilterNode | null = null;
  private trebleNode: BiquadFilterNode | null = null;
  private sourceConnected = false;
  private connectedElement: HTMLMediaElement | null = null;

  private gains: EqualizerGains = { bass: 0, mid: 0, treble: 0 };
  private activePreset: EqualizerPreset = 'flat';
  private listeners = new Set<() => void>();

  constructor() {
    this.loadFromStorage();
  }

  subscribe = (cb: () => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };

  private notify() {
    for (const l of this.listeners) l();
  }

  getGains(): EqualizerGains {
    return { ...this.gains };
  }

  getPreset(): EqualizerPreset {
    return this.activePreset;
  }

  private initContext() {
    if (this.ctx) return;
    if (typeof window === 'undefined') return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    try {
      this.ctx = new AudioCtx();

      // 1. Bajos: LowShelf a 80 Hz
      this.bassNode = this.ctx.createBiquadFilter();
      this.bassNode.type = 'lowshelf';
      this.bassNode.frequency.value = 80;
      this.bassNode.gain.value = this.gains.bass;

      // 2. Medios: Peaking a 1000 Hz (Q = 1.0)
      this.midNode = this.ctx.createBiquadFilter();
      this.midNode.type = 'peaking';
      this.midNode.frequency.value = 1000;
      this.midNode.Q.value = 1.0;
      this.midNode.gain.value = this.gains.mid;

      // 3. Altos: HighShelf a 8000 Hz
      this.trebleNode = this.ctx.createBiquadFilter();
      this.trebleNode.type = 'highshelf';
      this.trebleNode.frequency.value = 8000;
      this.trebleNode.gain.value = this.gains.treble;

      // Encadenar filtros: Bass -> Mid -> Treble -> Destination
      this.bassNode.connect(this.midNode);
      this.midNode.connect(this.trebleNode);
      this.trebleNode.connect(this.ctx.destination);
    } catch (err) {
      console.warn('[Equalizer] AudioContext no soportado:', err);
    }
  }

  /** Conecta un elemento HTMLAudioElement a la cadena de ecualización. */
  connectSource(mediaElement: HTMLMediaElement): void {
    if (this.sourceConnected && this.connectedElement === mediaElement) return;
    this.initContext();
    if (!this.ctx || !this.bassNode) return;

    try {
      const source = this.ctx.createMediaElementSource(mediaElement);
      source.connect(this.bassNode);
      this.sourceConnected = true;
      this.connectedElement = mediaElement;
    } catch {
      // Ya conectado o restringido por CORS
    }
  }

  /** Reanuda el contexto si el navegador lo suspendió por política de autoplay. */
  resumeContext(): void {
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  setGain(band: keyof EqualizerGains, value: number): void {
    const clamped = Math.max(-12, Math.min(12, Math.round(value)));
    this.gains[band] = clamped;
    this.activePreset = 'custom';

    const node = band === 'bass' ? this.bassNode : band === 'mid' ? this.midNode : this.trebleNode;
    if (node) {
      node.gain.setTargetAtTime(clamped, this.ctx?.currentTime ?? 0, 0.05);
    }
    this.saveToStorage();
    this.notify();
  }

  applyPreset(preset: Exclude<EqualizerPreset, 'custom'>): void {
    const target = EQ_PRESETS[preset];
    if (!target) return;
    this.gains = { ...target.gains };
    this.activePreset = preset;

    if (this.bassNode) this.bassNode.gain.value = this.gains.bass;
    if (this.midNode) this.midNode.gain.value = this.gains.mid;
    if (this.trebleNode) this.trebleNode.gain.value = this.gains.treble;

    this.saveToStorage();
    this.notify();
  }

  private saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ gains: this.gains, preset: this.activePreset }));
    } catch {
      /* storage lleno */
    }
  }

  private loadFromStorage() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.gains) this.gains = parsed.gains;
        if (parsed.preset) this.activePreset = parsed.preset;
      }
    } catch {
      /* ignorar */
    }
  }
}

export const equalizerService = new EqualizerService();
