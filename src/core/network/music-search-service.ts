import { Track } from '../../types/track.types';

interface ITunesResult {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName?: string;
  artworkUrl100: string;
  previewUrl: string;
  trackTimeMillis: number;
}

export class MusicSearchService {
  public static async searchOnline(query: string, djName: string): Promise<Track[]> {
    if (!query.trim()) return [];

    try {
      const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=15`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Error al consultar catálogo online');

      const data = await res.json();
      const results: ITunesResult[] = data.results || [];

      return results.map((item) => ({
        id: `online_${item.trackId}`,
        title: item.trackName,
        artist: item.artistName,
        album: item.collectionName || 'Single / Álbum',
        duration: Math.round(item.trackTimeMillis / 1000),
        source: 'passenger_dj',
        addedBy: djName,
        coverUrl: item.artworkUrl100.replace('100x100bb.jpg', '400x400bb.jpg'),
        audioUrl: item.previewUrl,
      }));
    } catch (err) {
      console.warn('[MusicSearchService] Fallback or network error:', err);
      return [];
    }
  }
}
