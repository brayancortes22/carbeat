import { Track } from '../../types/track.types';
import { PlayerState } from '../../types/player.types';

type PlayerListener = (state: PlayerState) => void;

export class AudioEngine {
  private audio: HTMLAudioElement;
  private currentTrack: Track | null = null;
  private listeners: Set<PlayerListener> = new Set();

  constructor() {
    this.audio = new Audio();
    this.audio.preload = 'metadata';
    this.setupListeners();
  }

  private setupListeners(): void {
    this.audio.addEventListener('timeupdate', () => this.notify());
    this.audio.addEventListener('play', () => this.notify());
    this.audio.addEventListener('pause', () => this.notify());
    this.audio.addEventListener('ended', () => this.notify());
    this.audio.addEventListener('volumechange', () => this.notify());
  }

  public subscribe(listener: PlayerListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const state = this.getState();
    this.listeners.forEach((listener) => listener(state));
  }

  public getState(): PlayerState {
    return {
      currentTrack: this.currentTrack,
      isPlaying: !this.audio.paused && !this.audio.ended && this.audio.readyState > 2,
      currentTime: this.audio.currentTime || 0,
      duration: this.audio.duration || (this.currentTrack?.duration ?? 0),
      volume: this.audio.volume,
      isMuted: this.audio.muted,
    };
  }

  public loadTrack(track: Track, autoPlay = true): void {
    this.currentTrack = track;
    this.audio.src = track.audioUrl;
    this.audio.load();
    if (autoPlay) {
      this.play();
    } else {
      this.notify();
    }
  }

  public play(): Promise<void> {
    return this.audio.play().catch((err) => {
      console.warn('[AudioEngine] Playback prevented or failed:', err);
    });
  }

  public pause(): void {
    this.audio.pause();
  }

  public toggle(): void {
    if (this.audio.paused) {
      this.play();
    } else {
      this.pause();
    }
  }

  public seek(seconds: number): void {
    if (!Number.isNaN(seconds) && seconds >= 0) {
      this.audio.currentTime = seconds;
    }
  }

  public setVolume(level: number): void {
    this.audio.volume = Math.max(0, Math.min(1, level));
  }

  public setOnEnded(handler: () => void): void {
    this.audio.onended = handler;
  }
}

export const globalAudioEngine = new AudioEngine();
