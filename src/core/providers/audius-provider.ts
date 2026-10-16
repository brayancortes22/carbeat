import { Track } from '../../types/track.types';

interface AudiusTrack {
  id: string;
  title: string;
  user?: {
    name: string;
  };
  duration: number; // en segundos completos (ej. 210, 340)
  artwork?: {
    '480x480'?: string;
    '150x150'?: string;
  };
}

/**
 * Proveedor de música completa sin DRM Audius (OmniRoute Tier).
 * Entrega audio/mpeg completo (canciones enteras de 3 a 5+ minutos).
 */
export class AudiusProvider {
  private static readonly ENDPOINT = 'https://discoveryprovider.audius.co/v1/tracks/search';
  private static readonly APP_NAME = 'CARBEAT';

  public static async search(query: string, djName: string): Promise<Track[]> {
    const cleanQuery = query.trim();
    if (!cleanQuery) return [];

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const url = `${this.ENDPOINT}?query=${encodeURIComponent(cleanQuery)}&app_name=${this.APP_NAME}`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) return [];

      const json = await res.json();
      const tracks: AudiusTrack[] = json.data || [];

      return tracks
        .filter((t) => t.id && t.title && t.duration > 30)
        .slice(0, 15)
        .map((t) => ({
          id: `audius_${t.id}`,
          title: t.title,
          artist: t.user?.name || 'Audius Artist',
          album: 'Audius Direct Stream',
          duration: t.duration,
          source: 'passenger_dj',
          addedBy: djName,
          coverUrl:
            t.artwork?.['480x480'] ||
            t.artwork?.['150x150'] ||
            'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&q=80',
          audioUrl: `https://discoveryprovider.audius.co/v1/tracks/${t.id}/stream?app_name=${this.APP_NAME}`,
        }));
    } catch {
      return [];
    }
  }
}
