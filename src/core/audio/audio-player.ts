import { Track } from '../../types/track.types';
import { PlayerState } from '../../types/player.types';
import { YouTubePlayerBridge } from './youtube-player-bridge';

type PlayerListener = (state: PlayerState) => void;

/**
 * Motor de Audio Híbrido Universal de CarBeat:
 * - HTML5 Audio: Archivos locales del vehículo (USB/Almacenamiento) y streams MP3 de Audius.
 * - YouTube Bridge: Streaming oficial de YouTube Music (canciones 100% completas de 3 a 6+ minutos).
 */
export class AudioEngine {
  private audio: HTMLAudioElement;
  private ytBridge: YouTubePlayerBridge;
  private currentTrack: Track | null = null;
  private listeners: Set<PlayerListener> = new Set();
  private isYtActive = false;
  private isYtPlaying = false;
  private onEndedCallback: (() => void) | null = null;
  private currentVolume = 1;
  private ticker: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.audio = new Audio();
    this.audio.preload = 'metadata';
    this.ytBridge = YouTubePlayerBridge.getInstance();
    this.setupListeners();
    this.startGlobalTicker();
  }

  private setupListeners(): void {
    this.audio.addEventListener('timeupdate', () => {
      if (!this.isYtActive) this.notify();
    });
    this.audio.addEventListener('play', () => {
      if (!this.isYtActive) this.notify();
    });
    this.audio.addEventListener('pause', () => {
      if (!this.isYtActive) this.notify();
    });
    this.audio.addEventListener('ended', () => {
      if (!this.isYtActive) {
        this.notify();
        this.onEndedCallback?.();
      }
    });

    this.ytBridge.onStateChange((state) => {
      if (!this.isYtActive) return;
      if (state === 'playing') {
        this.isYtPlaying = true;
        this.notify();
      } else if (state === 'paused') {
        this.isYtPlaying = false;
        this.notify();
      } else if (state === 'ended') {
        this.isYtPlaying = false;
        this.notify();
        this.onEndedCallback?.();
      }
    });
  }

  private startGlobalTicker(): void {
    if (this.ticker) clearInterval(this.ticker);
    this.ticker = setInterval(() => {
      if (this.isYtActive && this.isYtPlaying) {
        this.notify();
      }
    }, 1000);
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
    if (this.isYtActive) {
      const ytTime = this.ytBridge.getCurrentTime();
      const ytDur = this.ytBridge.getDuration() || (this.currentTrack?.duration ?? 210);
      return {
        currentTrack: this.currentTrack,
        isPlaying: this.isYtPlaying,
        currentTime: ytTime,
        duration: ytDur,
        volume: this.currentVolume,
        isMuted: this.currentVolume === 0,
      };
    }

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
    const videoId = track.videoId || (track.id.startsWith('yt_') ? track.id.replace('yt_', '') : null);

    if (videoId) {
      this.isYtActive = true;
      this.audio.pause();
      this.audio.src = '';
      this.isYtPlaying = autoPlay;
      this.ytBridge.loadVideo(videoId, autoPlay);
      this.notify();
    } else if (
      track.id.startsWith('apple_') ||
      track.audioUrl.includes('apple.com') ||
      track.audioUrl.includes('AudioPreview')
    ) {
      // Auto-actualizador: Si es una pista de Apple con recorte de 30s, resolver pista 100% completa en YouTube
      fetch(`/api/yt/search?q=${encodeURIComponent(`${track.title} ${track.artist}`)}`)
        .then((r) => r.json())
        .then((songs: any[]) => {
          if (songs && Array.isArray(songs) && songs[0] && songs[0].videoId) {
            track.videoId = songs[0].videoId;
            track.duration = songs[0].duration || track.duration;
            this.loadTrack(track, autoPlay);
          } else {
            this.playHtml5(track, autoPlay);
          }
        })
        .catch(() => this.playHtml5(track, autoPlay));
    } else {
      this.playHtml5(track, autoPlay);
    }
  }

  private playHtml5(track: Track, autoPlay: boolean): void {
    this.isYtActive = false;
    this.isYtPlaying = false;
    this.ytBridge.pause();
    this.audio.src = track.audioUrl;
    this.audio.load();
    if (autoPlay) {
      this.play();
    } else {
      this.notify();
    }
  }

  public play(): Promise<void> {
    if (this.isYtActive) {
      this.isYtPlaying = true;
      this.ytBridge.play();
      this.notify();
      return Promise.resolve();
    }
    return this.audio.play().catch((err) => {
      console.warn('[AudioEngine] Reproducción pausada por navegador:', err);
    });
  }

  public pause(): void {
    if (this.isYtActive) {
      this.isYtPlaying = false;
      this.ytBridge.pause();
      this.notify();
      return;
    }
    this.audio.pause();
  }

  public toggle(): void {
    if (this.isYtActive) {
      if (this.isYtPlaying) {
        this.pause();
      } else {
        this.play();
      }
      return;
    }
    if (this.audio.paused) {
      this.play();
    } else {
      this.pause();
    }
  }

  public seek(seconds: number): void {
    if (Number.isNaN(seconds) || seconds < 0) return;
    if (this.isYtActive) {
      this.ytBridge.seek(seconds);
      this.notify();
    } else {
      this.audio.currentTime = seconds;
    }
  }

  public setVolume(level: number): void {
    const clamped = Math.max(0, Math.min(1, level));
    this.currentVolume = clamped;
    this.audio.volume = clamped;
    this.ytBridge.setVolume(clamped);
    this.notify();
  }

  public setOnEnded(handler: () => void): void {
    this.onEndedCallback = handler;
  }
}

export const globalAudioEngine = new AudioEngine();
