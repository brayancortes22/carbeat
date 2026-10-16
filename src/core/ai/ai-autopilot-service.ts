import { Track } from '../../types/track.types';

export class AiAutopilotService {
  private static recentTrackIds: Set<string> = new Set();
  private static isPredicting = false;

  /**
   * Predice la siguiente mejor pista armónica de a 1 por 1 para no saturar la red ni la cola
   */
  public static async predictNextTrack(
    currentTrack: Track | null,
    existingQueue: { track: Track }[] = []
  ): Promise<Track | null> {
    if (!currentTrack || this.isPredicting) return null;

    this.isPredicting = true;
    try {
      // Registrar pistas recientes para no repetir
      this.recentTrackIds.add(currentTrack.id);
      if (currentTrack.videoId) this.recentTrackIds.add(`yt_${currentTrack.videoId}`);
      existingQueue.forEach((q) => {
        this.recentTrackIds.add(q.track.id);
        if (q.track.videoId) this.recentTrackIds.add(`yt_${q.track.videoId}`);
      });

      const params = new URLSearchParams({
        artist: currentTrack.artist || '',
        title: currentTrack.title || '',
      });

      const res = await fetch(`/api/yt/related?${params.toString()}`);
      if (!res.ok) return null;

      const candidates = (await res.json()) as Track[];
      if (!Array.isArray(candidates) || candidates.length === 0) return null;

      // Filtrar canciones que ya hayan sonado o estén en cola
      for (const candidate of candidates) {
        const isRecent =
          this.recentTrackIds.has(candidate.id) ||
          (candidate.videoId && this.recentTrackIds.has(`yt_${candidate.videoId}`)) ||
          existingQueue.some(
            (q) =>
              q.track.title.toLowerCase().trim() === candidate.title.toLowerCase().trim()
          );

        if (!isRecent) {
          this.recentTrackIds.add(candidate.id);
          if (this.recentTrackIds.size > 50) {
            const first = this.recentTrackIds.values().next().value;
            if (first) this.recentTrackIds.delete(first);
          }

          return {
            ...candidate,
            source: 'stream',
            addedBy: 'IA Autopilot ⚡',
          };
        }
      }

      return null;
    } catch (err) {
      console.warn('[AiAutopilotService] Error prediciendo siguiente pista:', err);
      return null;
    } finally {
      this.isPredicting = false;
    }
  }

  public static resetHistory(): void {
    this.recentTrackIds.clear();
    this.isPredicting = false;
  }
}
