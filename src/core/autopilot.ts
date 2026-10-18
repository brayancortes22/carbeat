// Piloto automático: elige la siguiente canción cuando nadie ha pedido nada.
//
// Nota honesta: la v1 lo llamaba "IA", pero nunca hubo un modelo; son reglas (mismo artista,
// rotación de géneros, biblioteca local). Se renombró para no prometer lo que no hace.

import { isSongLength, sameTrack, trackKey, type Track } from '../../shared/track';
import { apiUrl } from './network/api-config';

export type AutopilotMode = 'off' | 'hybrid' | 'local' | 'cloud' | 'crossover';

export const AUTOPILOT_MODES: { id: AutopilotMode; label: string; hint: string }[] = [
  { id: 'hybrid', label: 'Afín', hint: 'Primero tu música del carro del mismo artista; si no hay, canciones afines de internet.' },
  { id: 'local', label: 'Solo carro', hint: 'Sólo música guardada en el carro. Cero datos móviles.' },
  { id: 'cloud', label: 'Solo internet', hint: 'Canciones afines de YouTube Music.' },
  { id: 'crossover', label: 'Mezcla', hint: 'Rota géneros: rock en español, reggaetón, vallenato, salsa, popular...' },
  { id: 'off', label: 'Apagado', hint: 'Cuando la cola se vacía, la música se detiene.' },
];

const CROSSOVER_QUERIES = [
  'rock en español clásicos',
  'reggaeton clásico',
  'vallenato romántico',
  'salsa clásica',
  'música popular colombiana',
  'cumbia clásica',
  'merengue bailable',
  'regional mexicano',
  'pop latino 2000s',
  'bachata clásica',
  'baladas en español',
  'reggaeton 2024',
];

const RECENT_MAX = 60;

export class Autopilot {
  private recent: string[] = [];
  private genreIndex = Math.floor(Math.random() * CROSSOVER_QUERIES.length);

  remember(track: Track): void {
    const k = trackKey(track);
    this.recent = [k, ...this.recent.filter((r) => r !== k)].slice(0, RECENT_MAX);
  }

  private fresh(candidates: Track[], avoid: Track[]): Track[] {
    // Nada de mixes de una hora: el piloto elige canciones, no se adueña del viaje.
    return candidates.filter((c) => isSongLength(c) && !this.recent.includes(trackKey(c)) && !avoid.some((a) => sameTrack(a, c)));
  }

  private pickLocal(current: Track, avoid: Track[], local: Track[], sameArtist: boolean): Track | null {
    const artist = current.artist.trim().toLowerCase();
    const pool = this.fresh(local, avoid).filter((t) => !sameArtist || t.artist.trim().toLowerCase() === artist);
    return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
  }

  private async fetchTracks(path: string): Promise<Track[]> {
    try {
      const res = await fetch(apiUrl(path), { signal: AbortSignal.timeout(7000) });
      if (!res.ok) return [];
      const data = (await res.json()) as unknown;
      return Array.isArray(data) ? (data as Track[]) : [];
    } catch {
      return [];
    }
  }

  private async pickCloud(current: Track, avoid: Track[]): Promise<Track | null> {
    const q = new URLSearchParams({ artist: current.artist, title: current.title, exclude: avoid.map((t) => t.id).slice(0, 40).join(',') });
    const pool = this.fresh(await this.fetchTracks(`/api/yt/related?${q.toString()}`), avoid);
    // Entre las primeras para no alejarse del artista, pero no siempre la misma.
    return pool.length ? pool[Math.floor(Math.random() * Math.min(5, pool.length))] : null;
  }

  private async pickCrossover(avoid: Track[]): Promise<Track | null> {
    for (let tries = 0; tries < 3; tries++) {
      const q = CROSSOVER_QUERIES[this.genreIndex++ % CROSSOVER_QUERIES.length];
      const pool = this.fresh(await this.fetchTracks(`/api/yt/search?q=${encodeURIComponent(q)}`), avoid);
      if (pool.length) return pool[Math.floor(Math.random() * Math.min(8, pool.length))];
    }
    return null;
  }

  /** `avoid`: lo que suena, la cola y el historial. */
  async next(mode: AutopilotMode, current: Track, avoid: Track[], local: Track[]): Promise<Track | null> {
    if (mode === 'off') return null;
    let pick: Track | null = null;
    if (mode === 'local') pick = this.pickLocal(current, avoid, local, true) ?? this.pickLocal(current, avoid, local, false);
    else if (mode === 'cloud') pick = await this.pickCloud(current, avoid);
    else if (mode === 'crossover') {
      pick = local.length > 3 && Math.random() < 0.35 ? this.pickLocal(current, avoid, local, false) : null;
      pick ??= await this.pickCrossover(avoid);
    } else {
      pick = this.pickLocal(current, avoid, local, true) ?? (await this.pickCloud(current, avoid)) ?? this.pickLocal(current, avoid, local, false);
    }
    if (pick) this.remember(pick);
    return pick;
  }
}
