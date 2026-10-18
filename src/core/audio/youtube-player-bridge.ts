/**
 * Puente Oficial con YouTube IFrame API.
 * Permite reproducir canciones 100% completas (3-6 minutos) sin cortes ni errores 429.
 */

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export type YtStateChangeHandler = (state: 'playing' | 'paused' | 'ended' | 'buffering') => void;
export type YtErrorHandler = (code: number) => void;

export class YouTubePlayerBridge {
  private static instance: YouTubePlayerBridge | null = null;
  private player: any = null;
  private isApiReady = false;
  private pendingVideoId: string | null = null;
  private stateHandler: YtStateChangeHandler | null = null;
  private errorHandler: YtErrorHandler | null = null;
  private containerId = 'carbeat-yt-engine-container';
  private timer: ReturnType<typeof setInterval> | null = null;
  private currentTime = 0;
  private duration = 0;
  private hasTriggeredEnded = false;

  private constructor() {
    this.initScript();
  }

  public static getInstance(): YouTubePlayerBridge {
    if (!this.instance) {
      this.instance = new YouTubePlayerBridge();
    }
    return this.instance;
  }

  /*
   * Carga de la IFrame API con reintentos. Medido en el APK: la primera petición a
   * iframe_api tardó 10,3 s y falló (red lenta al arrancar), y sin reintento YouTube quedaba
   * muerto toda la sesión. Ahora: reintento con espera creciente y, además del aviso
   * onYouTubeIframeAPIReady (que se pierde si llega antes de tiempo), sondeo de window.YT.Player.
   */
  private loading = false;
  private attempts = 0;
  private pendingAutoPlay = true;
  private pendingStartAt = 0;

  private initScript(): void {
    if (typeof window === 'undefined') return;
    if (window.YT?.Player) {
      this.markReady();
      return;
    }
    const prevReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prevReady?.();
      this.markReady();
    };
    this.loadApi();
  }

  private loadApi(): void {
    if (this.isApiReady || this.loading) return;
    this.loading = true;
    this.attempts++;
    const tag = document.createElement('script');
    tag.src = `https://www.youtube.com/iframe_api${this.attempts > 1 ? `?r=${this.attempts}` : ''}`;
    tag.async = true;
    let settled = false;
    const fail = () => {
      if (settled || this.isApiReady) return;
      settled = true;
      this.loading = false;
      tag.remove();
      const wait = Math.min(30_000, 2000 * 2 ** (this.attempts - 1));
      setTimeout(() => this.loadApi(), wait);
    };
    tag.onerror = fail;
    setTimeout(fail, 12_000);
    tag.onload = () => {
      // El script cargó; window.YT.Player llega un instante después (carga otro script).
      const started = Date.now();
      const poll = setInterval(() => {
        if (window.YT?.Player) {
          clearInterval(poll);
          settled = true;
          this.markReady();
        } else if (Date.now() - started > 10_000) {
          clearInterval(poll);
          fail();
        }
      }, 250);
    };
    document.head.appendChild(tag);
  }

  private markReady(): void {
    if (this.isApiReady) return;
    this.isApiReady = true;
    this.loading = false;
    if (this.pendingVideoId) {
      const id = this.pendingVideoId;
      this.pendingVideoId = null;
      this.loadVideo(id, this.pendingAutoPlay, this.pendingStartAt);
    }
  }

  private ensureContainer(): HTMLElement {
    let el = document.getElementById(this.containerId);
    if (!el) {
      el = document.createElement('div');
      el.id = this.containerId;
      // Mantener tamaño mínimo visible para cumplimiento estricto de autoplay de YouTube
      el.style.position = 'fixed';
      el.style.bottom = '-9999px';
      el.style.left = '-9999px';
      el.style.width = '200px';
      el.style.height = '200px';
      el.style.opacity = '0.01';
      el.style.pointerEvents = 'none';
      el.style.zIndex = '-1';
      document.body.appendChild(el);
    }
    return el;
  }

  public loadVideo(videoId: string, autoPlay = true, startAt = 0): void {
    this.hasTriggeredEnded = false;
    this.currentTime = startAt;
    // Sin esto la canción nueva heredaba la duración de la anterior hasta el siguiente tic
    // (medido: 4:28 mostrados para una de 5:27 al pulsar "Siguiente").
    this.duration = 0;
    if (!this.isApiReady || !window.YT || !window.YT.Player) {
      this.pendingVideoId = videoId;
      this.pendingAutoPlay = autoPlay;
      this.pendingStartAt = startAt;
      this.loadApi();
      return;
    }

    this.ensureContainer();

    if (!this.player) {
      this.mountPlayer(videoId, autoPlay, startAt);
    } else {
      try {
        if (autoPlay) {
          this.player.loadVideoById({ videoId, startSeconds: startAt });
        } else {
          this.player.cueVideoById({ videoId, startSeconds: startAt });
        }
      } catch {
        this.mountPlayer(videoId, autoPlay, startAt);
      }
    }
  }

  private mountPlayer(videoId: string, autoPlay = true, startAt = 0): void {
    try {
      this.player = new window.YT.Player(this.containerId, {
        height: '200',
        width: '200',
        videoId,
        playerVars: {
          autoplay: autoPlay ? 1 : 0,
          start: Math.floor(startAt),
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          playsinline: 1,
          rel: 0,
        },
        events: {
          onError: (event: any) => {
            this.errorHandler?.(Number(event?.data) || 0);
          },
          onReady: (event: any) => {
            if (autoPlay) event.target.playVideo();
            this.startTicker();
          },
          onStateChange: (event: any) => {
            // YT.PlayerState: 0 = ENDED, 1 = PLAYING, 2 = PAUSED, 3 = BUFFERING
            if (event.data === 0) {
              if (!this.hasTriggeredEnded) {
                this.hasTriggeredEnded = true;
                this.stateHandler?.('ended');
              }
            } else if (event.data === 1) {
              this.hasTriggeredEnded = false;
              this.stateHandler?.('playing');
            } else if (event.data === 2) {
              this.stateHandler?.('paused');
            } else if (event.data === 3) {
              this.stateHandler?.('buffering');
            }
          },
        },
      });
    } catch (e) {
      console.warn('[YouTubeBridge] Error montando reproductor:', e);
    }
  }

  private startTicker(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      if (this.player && typeof this.player.getCurrentTime === 'function') {
        try {
          this.currentTime = this.player.getCurrentTime() || 0;
          this.duration = this.player.getDuration() || this.duration;

          // Salvaguarda Watchdog: Si llega al final del track (faltando <0.8s) y no ha saltado ended, dispararlo
          if (
            !this.hasTriggeredEnded &&
            this.duration > 5 &&
            this.currentTime >= this.duration - 0.8
          ) {
            this.hasTriggeredEnded = true;
            this.stateHandler?.('ended');
          }
        } catch {
          /* ignore */
        }
      }
    }, 500);
  }

  public onStateChange(handler: YtStateChangeHandler): void {
    this.stateHandler = handler;
  }

  public onError(handler: YtErrorHandler): void {
    this.errorHandler = handler;
  }

  /** Códigos documentados de la IFrame API de YouTube. */
  public static describeError(code: number): string {
    if (code === 100) return 'El vídeo ya no existe en YouTube';
    if (code === 101 || code === 150) return 'El dueño no permite reproducirla fuera de YouTube';
    if (code === 152 || code === 153) return 'YouTube rechazó el reproductor de esta app';
    if (code === 5) return 'El reproductor de YouTube falló';
    if (code === 2) return 'Identificador de vídeo inválido';
    return `YouTube no pudo reproducirla (error ${code})`;
  }

  public play(): void {
    if (this.player?.playVideo) this.player.playVideo();
  }

  public pause(): void {
    if (this.player?.pauseVideo) this.player.pauseVideo();
  }

  public seek(seconds: number): void {
    if (this.player?.seekTo) this.player.seekTo(seconds, true);
  }

  public setVolume(level: number): void {
    if (this.player?.setVolume) this.player.setVolume(Math.round(level * 100));
  }

  public getCurrentTime(): number {
    return this.currentTime;
  }

  public getDuration(): number {
    return this.duration;
  }
}
