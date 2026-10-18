import { beforeEach, describe, expect, it } from 'vitest';
import { isSongLength } from '../../../shared/track';
import { forgetHostState, loadHostState, saveHostState } from './host-store';

// En Node no hay localStorage: basta un mapa con la misma forma.
const mem = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
  },
});

const song = { id: 'yt_abc', title: 'Tusa', artist: 'Karol G', videoId: 'dQw4w9WgXcQ', audioUrl: '', coverUrl: '', duration: 200, source: 'stream' as const };

describe('host-store', () => {
  beforeEach(() => mem.clear());

  it('devuelve la cola, la canción y la posición tal como se guardaron', () => {
    saveHostState('ABC-1234', {
      rev: 7,
      queue: [{ queueId: 'q1', track: song, requestedBy: 'Ana', requestedById: 'c1', requestedAt: 1, autopilot: false, votes: { c2: 1 } }],
      history: [song],
      settings: { passengerControl: false, maxPendingPerRider: 2 },
      autopilot: 'local',
      now: { track: song, position: 83.4, requestedBy: 'Ana' },
    });
    const s = loadHostState('ABC-1234');
    expect(s?.rev).toBe(7);
    expect(s?.queue[0].votes).toEqual({ c2: 1 });
    expect(s?.settings).toEqual({ passengerControl: false, maxPendingPerRider: 2 });
    expect(s?.autopilot).toBe('local');
    expect(s?.now?.position).toBe(83.4);
    expect(loadHostState('OTRA-0000')).toBeNull();
  });

  it('descarta lo viejo, lo roto y lo cerrado', () => {
    saveHostState('ABC-1234', { rev: 1, queue: [], history: [], settings: { passengerControl: true, maxPendingPerRider: 4 }, autopilot: 'hybrid', now: null });
    expect(loadHostState('ABC-1234', Date.now() + 7 * 3600_000)).toBeNull();
    mem.set('carbeat.host-state.v2.ROTO-0000', '{no es json');
    expect(loadHostState('ROTO-0000')).toBeNull();
    // Entradas sin canción reproducible y modos desconocidos no tumban la carga.
    mem.set('carbeat.host-state.v2.RARO-0000', JSON.stringify({ at: Date.now(), queue: [{ queueId: 'x', track: { id: 'a' } }, 5], autopilot: 'turbo' }));
    const raro = loadHostState('RARO-0000');
    expect(raro?.queue).toEqual([]);
    expect(raro?.autopilot).toBe('hybrid');
    forgetHostState('ABC-1234');
    expect(loadHostState('ABC-1234')).toBeNull();
  });

  it('una canción de más de 15 min no cuenta como canción', () => {
    expect(isSongLength({ duration: 15 * 60 })).toBe(true);
    expect(isSongLength({ duration: 15 * 60 + 1 })).toBe(false);
    expect(isSongLength({ duration: 0 })).toBe(true);
  });
});
