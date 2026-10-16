import { Track } from '../../types/track.types';

interface InvidiousSearchResult {
  type: string;
  title: string;
  videoId: string;
  author: string;
  lengthSeconds: number;
  videoThumbnails?: Array<{ quality: string; url: string }>;
}

export class YouTubeMusicProvider {
  // Lista de instancias públicas de Invidious / Piped para rotación y alta resiliencia
  private static readonly INSTANCES = [
    'https://inv.nadeko.net',
    'https://invidious.nerdvpn.de',
    'https://invidious.private.coffee',
    'https://vid.puffyan.us',
  ];

  public static async search(query: string, djName: string): Promise<Track[]> {
    if (!query.trim()) return [];

    for (const instance of this.INSTANCES) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);

        const url = `${instance}/api/v1/search?q=${encodeURIComponent(query + ' audio')}&type=video`;
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!res.ok) continue;

        const results: InvidiousSearchResult[] = await res.json();
        if (!Array.isArray(results) || results.length === 0) continue;

        return results
          .filter((item) => item.videoId && item.title)
          .slice(0, 15)
          .map((item) => {
            const bestThumbnail =
              item.videoThumbnails?.find((t) => t.quality === 'high' || t.quality === 'medium')?.url ||
              `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`;

            // Stream directo de audio proxied a través de la instancia de Invidious
            const audioStreamUrl = `${instance}/latest_version?id=${item.videoId}&itag=140`;

            return {
              id: `yt_${item.videoId}`,
              title: item.title.replace(/\(Official.*?\)|\[Official.*?\]|Audio Oficial|Official Video/gi, '').trim(),
              artist: item.author || 'YouTube Music',
              album: 'YouTube Music Stream',
              duration: item.lengthSeconds || 180,
              source: 'passenger_dj',
              addedBy: djName,
              coverUrl: bestThumbnail,
              audioUrl: audioStreamUrl,
            };
          });
      } catch {
        // Fallback a la siguiente instancia si alguna falla o tiene timeout
        continue;
      }
    }

    return [];
  }
}
