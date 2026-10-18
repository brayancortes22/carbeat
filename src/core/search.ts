// Búsqueda de música para el carro y los pasajeros.
// Primero YouTube Music (canciones completas, vía nuestra API); si no responde, Audius (MP3
// completos, libres) e iTunes (sólo metadatos: el motor busca la versión completa al sonar).

import { dedupeTracks, isSongLength, type Track } from '../../shared/track';
import { apiUrl } from './network/api-config';

async function json<T>(url: string, signal?: AbortSignal): Promise<T | null> {
  try {
    const res = await fetch(url, { signal: signal ?? AbortSignal.timeout(7000) });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

async function youtube(q: string, signal?: AbortSignal): Promise<Track[]> {
  const data = await json<Track[]>(apiUrl(`/api/yt/search?q=${encodeURIComponent(q)}`), signal);
  return Array.isArray(data) ? data : [];
}

async function audius(q: string): Promise<Track[]> {
  type A = { id: string; title: string; duration: number; user?: { name: string }; artwork?: Record<string, string> };
  const data = await json<{ data?: A[] }>(`https://api.audius.co/v1/tracks/search?query=${encodeURIComponent(q)}&app_name=CARBEAT`);
  return (data?.data ?? [])
    .filter((t) => t.id && t.title && t.duration > 30)
    .slice(0, 12)
    .map((t) => ({
      id: `audius_${t.id}`,
      title: t.title,
      artist: t.user?.name ?? 'Audius',
      duration: t.duration,
      coverUrl: t.artwork?.['480x480'] ?? t.artwork?.['150x150'],
      source: 'stream' as const,
      audioUrl: `https://api.audius.co/v1/tracks/${t.id}/stream?app_name=CARBEAT`,
    }));
}

async function itunes(q: string): Promise<Track[]> {
  type I = { trackId: number; trackName: string; artistName: string; collectionName?: string; artworkUrl100?: string; previewUrl?: string; trackTimeMillis?: number };
  const data = await json<{ results?: I[] }>(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=song&limit=15&country=co`);
  return (data?.results ?? [])
    .filter((i) => i.previewUrl && i.trackName)
    .map((i) => ({
      id: `apple_${i.trackId}`,
      title: i.trackName,
      artist: i.artistName,
      album: i.collectionName,
      duration: Math.round((i.trackTimeMillis ?? 0) / 1000),
      coverUrl: i.artworkUrl100?.replace('100x100bb', '400x400bb'),
      source: 'stream' as const,
      audioUrl: i.previewUrl!,
    }));
}

export async function searchMusic(query: string, signal?: AbortSignal): Promise<{ tracks: Track[]; source: 'youtube' | 'respaldo' | 'nada' }> {
  const q = query.trim();
  if (!q) return { tracks: [], source: 'nada' };
  const yt = await youtube(q, signal);
  // Los largos se bajan al final en vez de quitarlos: si alguien busca un mix, lo encuentra.
  if (yt.length) return { tracks: [...yt.filter(isSongLength), ...yt.filter((t) => !isSongLength(t))], source: 'youtube' };
  if (signal?.aborted) return { tracks: [], source: 'nada' };
  const [a, i] = await Promise.all([audius(q), itunes(q)]);
  const tracks = dedupeTracks([...a, ...i]);
  return { tracks, source: tracks.length ? 'respaldo' : 'nada' };
}

/** Atajos de búsqueda por género: en vez de una lista fija de "tendencias" que se queda vieja. */
export const GENRE_SHORTCUTS = [
  { label: 'Reggaetón', q: 'reggaeton éxitos' },
  { label: 'Vallenato', q: 'vallenato romántico' },
  { label: 'Salsa', q: 'salsa clásica' },
  { label: 'Popular', q: 'música popular colombiana' },
  { label: 'Rock en español', q: 'rock en español clásicos' },
  { label: 'Despecho', q: 'despecho cantina' },
  { label: 'Cumbia', q: 'cumbia colombiana' },
  { label: 'Regional mexicano', q: 'regional mexicano' },
];
