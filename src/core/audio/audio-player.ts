import type { Track } from '../../types/track.types';
import type { PlayerState } from '../../types/player.types';
import { videoIdOf } from '../../../shared/track';
import { apiUrl } from '../network/api-config';
import { YouTubePlayerBridge } from './youtube-player-bridge';
import { equalizerService } from './equalizer-service';

type PlayerListener = (state: PlayerState) => void;

/**
 * Motor de audio del carro:
 * - HTML5 Audio para archivos del carro (USB, tablet) y MP3 directos (Audius).
 * - Reproductor oficial de YouTube (IFrame API) para canciones completas.
 */
export class AudioEngine {
  private audio: HTMLAudioElement;
  private yt: YouTubePlayerBridge;
  private current: Track | null = null;
  private listeners = new Set<PlayerListener>();
  private ytActive = false;
  private ytPlaying = false;
  private endedHandler: (() => void) | null = null;
  private errorHandler: ((track: Track, reason: string) => void) | null = null;
  private volume = 1;
  private loadToken = 0;

  constructor() {
    this.audio = new Audio();
    this.audio.preload = 'auto';
    this.yt = YouTubePlayerBridge.getInstance();

    const html = () => !this.ytActive && this.notify();
    this.audio.addEventListener('timeupdate', html);
    this.audio.addEventListener('play', () => {
      equalizerService.connectSource(this.audio);
      equalizerService.resumeContext();
      html();
    });
    this.audio.addEventListener('pause', html);
    this.audio.addEventListener('loadedmetadata', html);
    this.audio.addEventListener('ended', () => {
      if (this.ytActive) return;
      this.notify();
      this.endedHandler?.();
    });
    this.audio.addEventListener('error', () => {
      if (this.ytActive || !this.current || !this.audio.src) return;
      this.fail(this.current, 'No se pudo leer el archivo de audio');
    });

    this.yt.onStateChange((state) => {
      if (!this.ytActive) return;
      if (state === 'playing') this.ytPlaying = true;
      else if (state === 'paused' || state === 'ended') this.ytPlaying = false;
      this.notify();
      if (state === 'ended') this.endedHandler?.();
    });
    this.yt.onError((code) => {
      if (this.ytActive && this.current) this.fail(this.current, YouTubePlayerBridge.describeError(code));
    });
    // El IFrame de YouTube no emite progreso: se consulta cada segundo mientras suena.
    setInterval(() => this.ytActive && this.ytPlaying && this.notify(), 1000);
  }

  /** Error de reproducción: se avisa y se pasa a la siguiente, sin quedarse colgado. */
  private fail(track: Track, reason: string): void {
    this.notify();
    this.errorHandler?.(track, reason);
    const token = this.loadToken;
    setTimeout(() => token === this.loadToken && this.endedHandler?.(), 1200);
  }

  subscribe(listener: PlayerListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const s = this.getState();
    this.listeners.forEach((l) => l(s));
  }

  getState(): PlayerState {
    if (this.ytActive) {
      return {
        currentTrack: this.current,
        isPlaying: this.ytPlaying,
        currentTime: this.yt.getCurrentTime(),
        duration: this.yt.getDuration() || this.current?.duration || 0,
        volume: this.volume,
        isMuted: this.volume === 0,
      };
    }
    return {
      currentTrack: this.current,
      // !paused y no readyState: si no, cada micro-pausa de buffer contaría como pausa.
      isPlaying: !this.audio.paused && !this.audio.ended,
      currentTime: this.audio.currentTime || 0,
      duration: Number.isFinite(this.audio.duration) ? this.audio.duration : this.current?.duration ?? 0,
      volume: this.audio.volume,
      isMuted: this.audio.muted,
    };
  }

  load(track: Track, autoPlay = true, startAt = 0): void {
    this.loadToken++;
    this.current = track;
    const videoId = videoIdOf(track);
    if (videoId) {
      this.ytActive = true;
      this.audio.pause();
      this.audio.removeAttribute('src');
      this.ytPlaying = autoPlay;
      this.yt.loadVideo(videoId, autoPlay, startAt);
      this.notify();
      return;
    }
    if (track.audioUrl.includes('itunes.apple.com') || track.audioUrl.includes('audio-ssl.itunes') || track.id.startsWith('apple_')) {
      // iTunes sólo da 30 s de muestra: se busca la canción completa en YouTube.
      const token = this.loadToken;
      fetch(apiUrl(`/api/yt/search?q=${encodeURIComponent(`${track.title} ${track.artist}`)}`))
        .then((r) => r.json())
        .then((songs: Track[]) => {
          if (token !== this.loadToken) return;
          const hit = Array.isArray(songs) ? songs.find((s) => s.videoId) : undefined;
          if (hit) this.load({ ...track, videoId: hit.videoId, duration: hit.duration || track.duration }, autoPlay, startAt);
          else this.playHtml5(track, autoPlay, startAt);
        })
        .catch(() => token === this.loadToken && this.playHtml5(track, autoPlay, startAt));
      return;
    }
    this.playHtml5(track, autoPlay, startAt);
  }

  /** Alias para el código que aún lo llama así. */
  loadTrack(track: Track, autoPlay = true): void {
    this.load(track, autoPlay);
  }

  private playHtml5(track: Track, autoPlay: boolean, startAt = 0): void {
    this.ytActive = false;
    this.ytPlaying = false;
    this.yt.pause();
    this.audio.src = track.audioUrl;
    this.audio.load();
    // Antes de tener metadatos, currentTime fija la posición de arranque (así lo define HTML).
    if (startAt > 0) this.audio.currentTime = startAt;
    if (autoPlay) void this.play();
    else this.notify();
  }

  play(): Promise<void> {
    if (this.ytActive) {
      this.ytPlaying = true;
      this.yt.play();
      this.notify();
      return Promise.resolve();
    }
    return this.audio.play().catch((err) => {
      // Autoplay bloqueado por el navegador: queda en pausa hasta que el conductor toque.
      console.warn('[AudioEngine] reproducción bloqueada:', err);
      this.notify();
    });
  }

  pause(): void {
    if (this.ytActive) {
      this.ytPlaying = false;
      this.yt.pause();
      this.notify();
      return;
    }
    this.audio.pause();
  }

  toggle(): void {
    if (this.getState().isPlaying) this.pause();
    else void this.play();
  }

  seek(seconds: number): void {
    if (!Number.isFinite(seconds) || seconds < 0) return;
    if (this.ytActive) {
      this.yt.seek(seconds);
      this.notify();
    } else {
      this.audio.currentTime = seconds;
    }
  }

  setVolume(level: number): void {
    const v = Math.max(0, Math.min(1, level));
    this.volume = v;
    this.audio.volume = v;
    this.yt.setVolume(v);
    this.notify();
  }

  onEnded(handler: () => void): void {
    this.endedHandler = handler;
  }

  /** Alias histórico. */
  setOnEnded(handler: () => void): void {
    this.onEnded(handler);
  }

  onError(handler: (track: Track, reason: string) => void): void {
    this.errorHandler = handler;
  }
}

export const globalAudioEngine = new AudioEngine();
