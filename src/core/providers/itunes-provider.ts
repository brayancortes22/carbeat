import { Track } from '../../types/track.types';

interface ITunesItem {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName?: string;
  artworkUrl100: string;
  previewUrl: string;
  trackTimeMillis: number;
}

export class ITunesProvider {
  public static async search(query: string, djName: string): Promise<Track[]> {
    if (!query.trim()) return [];

    try {
      const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=25`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`iTunes API status: ${res.status}`);

      const data = await res.json();
      const items: ITunesItem[] = data.results || [];

      return items
        .filter((item) => item.previewUrl && item.trackName)
        .map((item) => ({
          id: `apple_${item.trackId}`,
          title: item.trackName,
          artist: item.artistName,
          album: item.collectionName || 'Single / Álbum',
          duration: Math.round(item.trackTimeMillis / 1000) || 30,
          source: 'passenger_dj',
          addedBy: djName,
          coverUrl: item.artworkUrl100.replace('100x100bb.jpg', '600x600bb.jpg'),
          audioUrl: item.previewUrl,
        }));
    } catch (err) {
      console.warn('[ITunesProvider] Error al consultar API de Apple:', err);
      return [];
    }
  }
}
