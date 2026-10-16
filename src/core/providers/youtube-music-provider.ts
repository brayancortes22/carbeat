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
    'https://invidious.nerdvpn.de',
    'https://inv.nadeko.net',
    'https://invidious.private.coffee',
    'https://vid.puffyan.us',
  ];

  public static async search(query: string, djName: string): Promise<Track[]> {
    const cleanQuery = query.trim();
    if (!cleanQuery) return [];

    // 1. Intentar primero con el endpoint nativo de Innertube en el backend/Vite
    try {
      const localRes = await fetch(`/api/yt/search?q=${encodeURIComponent(cleanQuery)}`);
      if (localRes.ok) {
        const localSongs = (await localRes.json()) as Track[];
        if (Array.isArray(localSongs) && localSongs.length > 0) {
          return localSongs.map((s) => ({ ...s, addedBy: djName, source: 'passenger_dj' }));
        }
      }
    } catch {
      // Si el proxy local no responde, continuar al fallback en la nube
    }

    // 2. Fallback a nodos públicos de Invidious / Piped
    for (const instance of this.INSTANCES) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);

        const url = `${instance}/api/v1/search?q=${encodeURIComponent(cleanQuery + ' audio')}&type=video`;
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

            return {
              id: `yt_${item.videoId}`,
              title: item.title.replace(/\(Official.*?\)|\[Official.*?\]|Audio Oficial|Official Video/gi, '').trim(),
              artist: item.author || 'YouTube Music',
              album: 'YouTube Music Stream',
              duration: item.lengthSeconds || 180,
              source: 'passenger_dj',
              addedBy: djName,
              coverUrl: bestThumbnail,
              audioUrl: `${instance}/latest_version?id=${item.videoId}&itag=140`,
              videoId: item.videoId,
            };
          });
      } catch {
        continue;
      }
    }

    return [];
  }
}
