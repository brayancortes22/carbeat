import { Track } from '../../types/track.types';
import { ITunesProvider } from './itunes-provider';
import { YouTubeMusicProvider } from './youtube-music-provider';
import { AudiusProvider } from './audius-provider';
import { TOP_TRENDING_TRACKS } from '../network/music-search-service';

export type MusicSourceType = 'all' | 'youtube' | 'audius' | 'apple' | 'trending';

export class OmniMusicGateway {
  /**
   * Búsqueda en cascada multi-proveedor (OmniRoute Pattern).
   * Prioriza YouTube Music y Audius para canciones completas al 100%.
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
      return AudiusProvider.search(cleanQuery, djName);
    }

    if (source === 'audius') {
      return AudiusProvider.search(cleanQuery, djName);
    }

    if (source === 'apple') {
      return ITunesProvider.search(cleanQuery, djName);
    }

    // Búsqueda combinada en paralelo con OmniRoute
    const [ytResults, audiusResults, appleResults] = await Promise.all([
      YouTubeMusicProvider.search(cleanQuery, djName).catch(() => []),
      AudiusProvider.search(cleanQuery, djName).catch(() => []),
      ITunesProvider.search(cleanQuery, djName).catch(() => []),
    ]);

    // Intercalar y deduplicar resultados dando máxima prioridad a fuentes de audio completo
    const combined: Track[] = [];
    const seenTitles = new Set<string>();

    const candidateLists = [ytResults, audiusResults, appleResults];
    const maxLen = Math.max(ytResults.length, audiusResults.length, appleResults.length);

    for (let i = 0; i < maxLen; i++) {
      for (const list of candidateLists) {
        const item = list[i];
        if (item) {
          const key = `${item.title.toLowerCase().trim()}_${item.artist.toLowerCase().trim()}`;
          if (!seenTitles.has(key)) {
            seenTitles.add(key);
            combined.push(item);
          }
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
