import { Track } from '../../types/track.types';
import { apiUrl } from '../network/api-config';

export type AutopilotMode = 'hybrid' | 'local' | 'cloud';

export class AiAutopilotService {
  private static recentTrackIds: Set<string> = new Set();
  private static isPredicting = false;

  /**
   * Predice la siguiente mejor pista armónica de a 1 por 1 según el modo del chofer
   */
  public static async predictNextTrack(
    currentTrack: Track | null,
    existingQueue: { track: Track }[] = [],
    localCatalog: Track[] = [],
    mode: AutopilotMode = 'hybrid'
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

      // Modo 1: Solo Local (Cero Datos / Tablet / USB)
      if (mode === 'local') {
        return this.predictFromLocal(currentTrack, existingQueue, localCatalog);
      }

      // Modo 2: Solo Nube (Internet / YouTube)
      if (mode === 'cloud') {
        return await this.predictFromCloud(currentTrack, existingQueue);
      }

      // Modo 3: Híbrido (Prioriza afinidad local, si no hay, busca en nube, y si falla nube, vuelve a local)
      const localCandidate = this.predictFromLocal(currentTrack, existingQueue, localCatalog, true);
      if (localCandidate) return localCandidate;

      const cloudCandidate = await this.predictFromCloud(currentTrack, existingQueue);
      if (cloudCandidate) return cloudCandidate;

      // Fallback final: Cualquier pista local no reproducida recientemente
      return this.predictFromLocal(currentTrack, existingQueue, localCatalog, false);
    } catch (err) {
      console.warn('[AiAutopilotService] Error prediciendo siguiente pista:', err);
      return this.predictFromLocal(currentTrack, existingQueue, localCatalog, false);
    } finally {
      this.isPredicting = false;
    }
  }

  /**
   * Búsqueda inteligente en el catálogo local de la tablet/USB
   * @param strictArtist Si es true, exige afinidad de artista
   */
  private static predictFromLocal(
    currentTrack: Track,
    existingQueue: { track: Track }[],
    localCatalog: Track[],
    strictArtist = false
  ): Track | null {
    if (!localCatalog || localCatalog.length === 0) return null;

    const currentArtist = (currentTrack.artist || '').toLowerCase().trim();

    // 1. Buscar canciones del mismo artista o afines en el catálogo local que no hayan sonado
    const candidates = localCatalog.filter((track) => {
      const isRecent =
        this.recentTrackIds.has(track.id) ||
        existingQueue.some(
          (q) => q.track.title.toLowerCase().trim() === track.title.toLowerCase().trim()
        );
      if (isRecent) return false;

      if (strictArtist && currentArtist) {
        return track.artist.toLowerCase().trim() === currentArtist;
      }
      return true;
    });

    if (candidates.length === 0) {
      // Si todas ya sonaron y no es estricto, relajar historial
      if (!strictArtist && localCatalog.length > 0) {
        const available = localCatalog.filter(
          (t) => t.id !== currentTrack.id && !existingQueue.some((q) => q.track.id === t.id)
        );
        if (available.length > 0) {
          const picked = available[Math.floor(Math.random() * available.length)];
          this.recentTrackIds.add(picked.id);
          return {
            ...picked,
            source: 'local_car',
            addedBy: 'IA Autopilot (Local) 💾',
          };
        }
      }
      return null;
    }

    // Elegir aleatoriamente entre los candidatos no repetidos
    const selected = candidates[Math.floor(Math.random() * candidates.length)];
    this.recentTrackIds.add(selected.id);
    if (this.recentTrackIds.size > 50) {
      const first = this.recentTrackIds.values().next().value;
      if (first) this.recentTrackIds.delete(first);
    }

    return {
      ...selected,
      source: 'local_car',
      addedBy: 'IA Autopilot (Local) 💾',
    };
  }

  /**
   * Búsqueda en la nube vía YouTube Music Related
   */
  private static async predictFromCloud(
    currentTrack: Track,
    existingQueue: { track: Track }[]
  ): Promise<Track | null> {
    try {
      const params = new URLSearchParams({
        artist: currentTrack.artist || '',
        title: currentTrack.title || '',
      });

      const res = await fetch(apiUrl(`/api/yt/related?${params.toString()}`));
      if (!res.ok) return null;

      const candidates = (await res.json()) as Track[];
      if (!Array.isArray(candidates) || candidates.length === 0) return null;

      for (const candidate of candidates) {
        const isRecent =
          this.recentTrackIds.has(candidate.id) ||
          (candidate.videoId && this.recentTrackIds.has(`yt_${candidate.videoId}`)) ||
          existingQueue.some(
            (q) => q.track.title.toLowerCase().trim() === candidate.title.toLowerCase().trim()
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
            addedBy: 'IA Autopilot (Nube) 🌐',
          };
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  public static resetHistory(): void {
    this.recentTrackIds.clear();
    this.isPredicting = false;
  }
}
