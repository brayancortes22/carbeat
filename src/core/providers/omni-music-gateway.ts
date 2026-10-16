import { Track } from '../../types/track.types';
import { ITunesProvider } from './itunes-provider';
import { YouTubeMusicProvider } from './youtube-music-provider';
import { TOP_TRENDING_TRACKS } from '../network/music-search-service';

export type MusicSourceType = 'all' | 'youtube' | 'apple' | 'trending';

export class OmniMusicGateway {
  /**
   * Búsqueda en cascada multi-proveedor (OmniRoute Pattern).
   * Intenta primero fuentes primarias y fusiona resultados deduplicados.
   */
  public static async search(
    query: string,
    djName: string,
    source: MusicSourceType = 'all'
  ): Promise<Track[]> {
    const cleanQuery = query.trim();

    if (!cleanQuery) {
      return TOP_TRENDING_TRACKS.map((t) => ({ ...t, addedBy: djName }));
    }

    if (source === 'youtube') {
      const ytResults = await YouTubeMusicProvider.search(cleanQuery, djName);
      if (ytResults.length > 0) return ytResults;
      // Fallback a Apple si YouTube no responde
      return ITunesProvider.search(cleanQuery, djName);
    }

    if (source === 'apple') {
      return ITunesProvider.search(cleanQuery, djName);
    }

    // Búsqueda combinada paralela con OmniRoute
    const [appleResults, ytResults] = await Promise.all([
      ITunesProvider.search(cleanQuery, djName),
      YouTubeMusicProvider.search(cleanQuery, djName),
    ]);

    // Intercalar y deduplicar resultados
    const combined: Track[] = [];
    const seenTitles = new Set<string>();

    const maxLen = Math.max(appleResults.length, ytResults.length);
    for (let i = 0; i < maxLen; i++) {
      if (appleResults[i]) {
        const key = `${appleResults[i].title.toLowerCase()}_${appleResults[i].artist.toLowerCase()}`;
        if (!seenTitles.has(key)) {
          seenTitles.add(key);
          combined.push(appleResults[i]);
        }
      }
      if (ytResults[i]) {
        const key = `${ytResults[i].title.toLowerCase()}_${ytResults[i].artist.toLowerCase()}`;
        if (!seenTitles.has(key)) {
          seenTitles.add(key);
          combined.push(ytResults[i]);
        }
      }
    }

    if (combined.length === 0) {
      console.warn('[OmniMusicGateway] Sin resultados online, usando Top Tendencias');
      return TOP_TRENDING_TRACKS.filter(
        (t) =>
          t.title.toLowerCase().includes(cleanQuery.toLowerCase()) ||
          t.artist.toLowerCase().includes(cleanQuery.toLowerCase())
      ).map((t) => ({ ...t, addedBy: djName }));
    }

    return combined;
  }
}
