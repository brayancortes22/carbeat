// Tipos de pista compartidos por la web, el APK y las funciones de Vercel.
// Viven fuera de src/ porque el servidor también los valida.

export type TrackSource = 'local_car' | 'passenger_dj' | 'stream';

export interface Track {
  id: string;
  title: string;
  artist: string;
  album?: string;
  /** Segundos. 0 si no se conoce todavía. */
  duration: number;
  coverUrl?: string;
  source: TrackSource;
  addedBy?: string;
  /** URL reproducible por <audio>. Vacía si la pista sólo existe en YouTube. */
  audioUrl: string;
  /** Vídeo de YouTube para el reproductor oficial (IFrame API). */
  videoId?: string;
}

/** Normaliza para comparar títulos: sin tildes, sin mayúsculas, sin "(Official Video)". */
/** Más de esto no es una canción: es un mix, un directo de horas o un podcast. */
export const MAX_SONG_SECONDS = 15 * 60;

/** Sin duración conocida se da por buena: la mayoría de MP3 del carro llegan así al principio. */
export function isSongLength(track: Pick<Track, 'duration'>): boolean {
  return !track.duration || track.duration <= MAX_SONG_SECONDS;
}

export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\((official|oficial|video|audio|lyric|letra)[^)]*\)/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/[^a-z0-9ñ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Clave de identidad de una canción. Dos pistas con el mismo vídeo de YouTube son la misma;
 * si no hay vídeo, título + artista (no sólo título: "Vivir mi vida" tiene más de un autor).
 */
export function trackKey(track: Pick<Track, 'title' | 'artist' | 'videoId'>): string {
  if (track.videoId) return `yt:${track.videoId}`;
  return `ta:${normalizeText(track.title)}|${normalizeText(track.artist || '')}`;
}

export function sameTrack(a: Track, b: Track): boolean {
  if (a.id === b.id) return true;
  if (a.videoId && b.videoId) return a.videoId === b.videoId;
  return trackKey({ ...a, videoId: undefined }) === trackKey({ ...b, videoId: undefined });
}

/** Elimina duplicados conservando el primero. */
export function dedupeTracks<T extends Track>(tracks: T[]): T[] {
  const out: T[] = [];
  for (const t of tracks) {
    if (!t?.title) continue;
    if (!out.some((o) => sameTrack(o, t))) out.push(t);
  }
  return out;
}

export function videoIdOf(track: Pick<Track, 'id' | 'videoId'>): string | null {
  if (track.videoId) return track.videoId;
  if (track.id.startsWith('yt_')) return track.id.slice(3);
  return null;
}
