import { QueueItem, Track } from '../../types/track.types';

/**
 * QueueCacher: Servicio en segundo plano para pre-calentar y almacenar en caché
 * la siguiente pista en cola antes de que le toque sonar, previniendo congelamientos de audio.
 */
class QueueCacherService {
  private static instance: QueueCacherService | null = null;
  private preloadedVideoId: string | null = null;
  private isPreloading = false;
  private cachedUrls = new Map<string, string>();

  private constructor() {}

  public static getInstance(): QueueCacherService {
    if (!this.instance) {
      this.instance = new QueueCacherService();
    }
    return this.instance;
  }

  /**
   * Inspecciona la cola activa y pre-calienta la siguiente pista (queue[0])
   */
  public preloadNextInQueue(queue: QueueItem[]): void {
    if (!queue || queue.length === 0 || this.isPreloading) return;

    const nextTrack = queue[0]?.track;
    if (!nextTrack) return;

    const videoId = nextTrack.videoId || (nextTrack.id.startsWith('yt_') ? nextTrack.id.replace('yt_', '') : null);

    // Si ya fue precalentada la misma pista, no repetir
    if (videoId && this.preloadedVideoId === videoId) return;

    if (videoId) {
      this.preloadYouTubeVideo(videoId, nextTrack);
    } else if (nextTrack.audioUrl && nextTrack.audioUrl.startsWith('http')) {
      this.preloadAudioHttp(nextTrack);
    }
  }

  private preloadYouTubeVideo(videoId: string, track: Track): void {
    this.isPreloading = true;
    this.preloadedVideoId = videoId;

    try {
      // Pre-cargar la imagen de portada de YouTube en memoria del navegador
      if (track.coverUrl) {
        const img = new Image();
        img.src = track.coverUrl;
      }

      // Pre-resolución de DNS y enlace de YouTube IFrame API
      const link = document.createElement('link');
      link.rel = 'preconnect';
      link.href = 'https://www.youtube.com';
      document.head.appendChild(link);
    } catch (e) {
      console.warn('[QueueCacher] Error pre-cargando video:', e);
    } finally {
      this.isPreloading = false;
    }
  }

  private async preloadAudioHttp(track: Track): Promise<void> {
    if (this.cachedUrls.has(track.id)) return;

    this.isPreloading = true;
    try {
      // Pre-fetch en background de los primeros bytes del archivo de audio
      const res = await fetch(track.audioUrl, {
        method: 'GET',
        headers: { Range: 'bytes=0-1048576' }, // Pre-descarga de primer 1MB de búfer
      });
      if (res.ok) {
        this.cachedUrls.set(track.id, track.audioUrl);
      }
    } catch {
      // Si falla o no soporta Range, se ignora silenciosamente
    } finally {
      this.isPreloading = false;
    }
  }

  public clear(): void {
    this.preloadedVideoId = null;
    this.cachedUrls.clear();
  }
}

export const queueCacher = QueueCacherService.getInstance();
