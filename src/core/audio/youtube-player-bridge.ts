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

export class YouTubePlayerBridge {
  private static instance: YouTubePlayerBridge | null = null;
  private player: any = null;
  private isApiReady = false;
  private pendingVideoId: string | null = null;
  private stateHandler: YtStateChangeHandler | null = null;
  private containerId = 'carbeat-yt-engine-container';
  private timer: ReturnType<typeof setInterval> | null = null;
  private currentTime = 0;
  private duration = 0;

  private constructor() {
    this.initScript();
  }

  public static getInstance(): YouTubePlayerBridge {
    if (!this.instance) {
      this.instance = new YouTubePlayerBridge();
    }
    return this.instance;
  }

  private initScript(): void {
    if (typeof window === 'undefined') return;

    if (window.YT && window.YT.Player) {
      this.isApiReady = true;
      return;
    }

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScript = document.getElementsByTagName('script')[0];
    firstScript?.parentNode?.insertBefore(tag, firstScript);

    const prevReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (prevReady) prevReady();
      this.isApiReady = true;
      if (this.pendingVideoId) {
        this.mountPlayer(this.pendingVideoId);
        this.pendingVideoId = null;
      }
    };
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

  public loadVideo(videoId: string, autoPlay = true): void {
    if (!this.isApiReady || !window.YT || !window.YT.Player) {
      this.pendingVideoId = videoId;
      return;
    }

    this.ensureContainer();

    if (!this.player) {
      this.mountPlayer(videoId, autoPlay);
    } else {
      try {
        if (autoPlay) {
          this.player.loadVideoById(videoId);
        } else {
          this.player.cueVideoById(videoId);
        }
      } catch {
        this.mountPlayer(videoId, autoPlay);
      }
    }
  }

  private mountPlayer(videoId: string, autoPlay = true): void {
    try {
      this.player = new window.YT.Player(this.containerId, {
        height: '200',
        width: '200',
        videoId,
        playerVars: {
          autoplay: autoPlay ? 1 : 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          playsinline: 1,
          rel: 0,
        },
        events: {
          onReady: (event: any) => {
            if (autoPlay) event.target.playVideo();
            this.startTicker();
          },
          onStateChange: (event: any) => {
            // YT.PlayerState: 0 = ENDED, 1 = PLAYING, 2 = PAUSED, 3 = BUFFERING
            if (event.data === 0) {
              this.stateHandler?.('ended');
            } else if (event.data === 1) {
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
        } catch {
          /* ignore */
        }
      }
    }, 500);
  }

  public onStateChange(handler: YtStateChangeHandler): void {
    this.stateHandler = handler;
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
