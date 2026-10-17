import { Track } from '../../types/track.types';
import { apiUrl } from '../network/api-config';

export type AutopilotMode = 'hybrid' | 'local' | 'cloud' | 'crossover';

// Matriz exhaustiva de géneros para el Modo Mix Crossover Aleatorio de Viaje
const CROSSOVER_GENRE_QUERIES = [
  // Rock & Clásicos en Español / Inglés
  'rock en espanol clasicos',
  'rock argentino 80s 90s',
  'rock clasico 80s hits',
  // Reggaeton & Urbano
  'reggaeton clasico viejito',
  'reggaeton 2024 exitos',
  'latin urban perreo',
  // Vallenato
  'vallenatos clasicos romanticos',
  'vallenato nueva ola parranda',
  // Salsa & Merengue
  'salsa brava clasicos',
  'salsa romantica exitos',
  'merengue ochentero bailable',
  // Cumbia & Tropical
  'cumbia sonidera exitos',
  'cumbia villera clasicos',
  'tropical bailable diciembre',
  // Música Popular & Despecho
  'musica popular colombiana exitos',
  'despecho cantina clasicos',
  // Regional Mexicano & Rancheras
  'regional mexicano corridos banda',
  'rancheras mariachi clasicos',
  // Pop Latino & Baladas
  'pop latino 2000s exitos',
  'baladas romanticas en espanol',
  // Bachata & Electrónica
  'bachata clasicos exitos',
  'musica electronica festival edm',
];

export class AiAutopilotService {
  private static recentTrackIds: Set<string> = new Set();
  private static isPredicting = false;
  private static lastGenreIndex = 0;

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

      // Modo 4: Crossover / Mix Aleatorio de Todo (Rock, Reggaeton, Vallenato, Salsa, Popular, Cumbia, etc.)
      if (mode === 'crossover') {
        return await this.predictCrossover(currentTrack, existingQueue, localCatalog);
      }

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

  /**
   * Modo Fiesta / Crossover Aleatorio: Rota entre Rock, Reggaetón, Salsa, Vallenato, Popular, Cumbia, etc.
   */
  private static async predictCrossover(
    currentTrack: Track,
    existingQueue: { track: Track }[],
    localCatalog: Track[]
  ): Promise<Track | null> {
    // 50% de probabilidad o si hay buen catálogo local, intentar mezclar una pista local al azar
    const shouldTryLocal = localCatalog.length > 3 && Math.random() < 0.45;
    if (shouldTryLocal) {
      const localPick = this.predictFromLocal(currentTrack, existingQueue, localCatalog, false);
      if (localPick) {
        return {
          ...localPick,
          addedBy: 'IA Crossover (Local) 🔀',
        };
      }
    }

    // Rotar al siguiente género en la lista de crossovers
    const query = CROSSOVER_GENRE_QUERIES[this.lastGenreIndex % CROSSOVER_GENRE_QUERIES.length];
    this.lastGenreIndex = (this.lastGenreIndex + 1) % CROSSOVER_GENRE_QUERIES.length;

    try {
      const res = await fetch(apiUrl(`/api/yt/search?q=${encodeURIComponent(query)}`));
      if (!res.ok) return this.predictFromLocal(currentTrack, existingQueue, localCatalog, false);

      const songs = (await res.json()) as Track[];
      if (!Array.isArray(songs) || songs.length === 0) {
        return this.predictFromLocal(currentTrack, existingQueue, localCatalog, false);
      }

      // Tomar una pista no reciente de los resultados
      for (const song of songs) {
        const isRecent =
          this.recentTrackIds.has(song.id) ||
          (song.videoId && this.recentTrackIds.has(`yt_${song.videoId}`)) ||
          existingQueue.some(
            (q) => q.track.title.toLowerCase().trim() === song.title.toLowerCase().trim()
          );

        if (!isRecent) {
          this.recentTrackIds.add(song.id);
          if (this.recentTrackIds.size > 50) {
            const first = this.recentTrackIds.values().next().value;
            if (first) this.recentTrackIds.delete(first);
          }

          return {
            ...song,
            source: 'stream',
            addedBy: 'IA Crossover (Mix) 🔀',
          };
        }
      }

      // Si todas eran recientes, hacer fallback a local
      return this.predictFromLocal(currentTrack, existingQueue, localCatalog, false);
    } catch {
      return this.predictFromLocal(currentTrack, existingQueue, localCatalog, false);
    }
  }

  public static resetHistory(): void {
    this.recentTrackIds.clear();
    this.isPredicting = false;
  }
}
