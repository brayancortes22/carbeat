// Búsqueda en YouTube Music (endpoint interno WEB_REMIX, el mismo que usa su web).
// Antes este código estaba copiado en tres sitios (api/yt/search, api/yt/related y
// vite.config.ts) con diferencias entre ellos. Ahora hay uno.
//
// Aviso: no es una API pública documentada. Si YouTube cambia la estructura, la búsqueda
// devuelve [] y el cliente cae a iTunes/Audius; no rompe la app.

import type { Track } from '../shared/track.js';

const ENDPOINT = 'https://music.youtube.com/youtubei/v1/search';
// Filtro "Canciones" de la búsqueda de YouTube Music: devuelve artista, álbum y duración.
const SONGS_FILTER = 'EgWKAQIIAWoKEAkQBRAKEAMQBA%3D%3D';
const CLIENT_VERSION = '1.20241014.01.00';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function parseDuration(text: string): number {
  const parts = text.split(':').map((n) => Number(n));
  if (parts.some((n) => !Number.isFinite(n))) return 0;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

const TYPE_LABELS = /^(canción|cancion|song|video|vídeo|episodio|episode)$/i;

function toTrack(item: Json): Track | null {
  const cols: string[] = (item.flexColumns ?? []).map((c: Json) =>
    (c.musicResponsiveListItemFlexColumnRenderer?.text?.runs ?? []).map((r: Json) => r.text).join('').trim(),
  );
  const title = cols[0];
  const videoId: string | undefined =
    item.playlistItemData?.videoId ??
    item.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint?.videoId;
  if (!title || !videoId) return null;

  const segments = (cols[1] ?? '').split(' • ').map((s) => s.trim()).filter((s) => s && !TYPE_LABELS.test(s));
  let duration = 0;
  if (segments.length && /^\d{1,2}(:\d{2}){1,2}$/.test(segments[segments.length - 1])) {
    duration = parseDuration(segments.pop()!);
  }
  const [artist = 'YouTube Music', album] = segments;
  const thumbs: Json[] = item.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails ?? [];
  const cover = thumbs[thumbs.length - 1]?.url?.replace(/=w\d+-h\d+/, '=w400-h400');

  return {
    id: `yt_${videoId}`,
    title,
    artist,
    album,
    duration,
    coverUrl: cover || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    source: 'stream',
    audioUrl: '',
    videoId,
  };
}

async function rawSearch(query: string, params?: string): Promise<Json[]> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      Referer: 'https://music.youtube.com/',
      Origin: 'https://music.youtube.com',
    },
    body: JSON.stringify({
      context: { client: { clientName: 'WEB_REMIX', clientVersion: CLIENT_VERSION, hl: 'es', gl: 'CO' } },
      query,
      ...(params ? { params } : {}),
    }),
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as Json;
  const sections: Json[] = data.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents ?? [];
  const items: Json[] = [];
  for (const s of sections) {
    for (const c of s.musicShelfRenderer?.contents ?? s.itemSectionRenderer?.contents ?? []) {
      if (c.musicResponsiveListItemRenderer) items.push(c.musicResponsiveListItemRenderer);
    }
  }
  return items;
}

export async function searchYouTubeMusic(query: string, limit = 20): Promise<Track[]> {
  const q = query.trim().slice(0, 120);
  if (!q) return [];
  let items = await rawSearch(q, SONGS_FILTER);
  if (!items.length) items = await rawSearch(q);
  const out: Track[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    const t = toTrack(it);
    if (t && !seen.has(t.id)) {
      seen.add(t.id);
      out.push(t);
    }
    if (out.length >= limit) break;
  }
  return out;
}

/** Canciones afines a la que suena: más del mismo artista y del género que se le parezca. */
export async function relatedYouTubeMusic(artist: string, title: string, exclude: string[] = [], limit = 12): Promise<Track[]> {
  const skip = new Set(exclude);
  const byArtist = await searchYouTubeMusic(artist, 25);
  const pool = byArtist.filter((t) => !skip.has(t.id) && t.title.toLowerCase() !== title.toLowerCase());
  return pool.slice(0, limit);
}
