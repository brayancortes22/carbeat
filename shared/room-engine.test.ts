import { describe, expect, it } from 'vitest';
import {
  applyIntent,
  createEngine,
  popHistory,
  pruneRiders,
  pushHistory,
  requestTrack,
  takeNext,
  updateSettings,
  AUTOPILOT_ID,
  type ApplyContext,
  type EngineState,
} from './room-engine.ts';
import { scoreOf, type Envelope, type Intent } from './protocol.ts';
import type { Track } from './track.ts';

const ROOM = 'VIBE-7KQ3';
const song = (id: string, title = `Canción ${id}`, artist = 'Artista'): Track => ({
  id: `yt_${id}`,
  title,
  artist,
  duration: 200,
  source: 'stream',
  audioUrl: '',
  videoId: `${id}vid0000`.slice(0, 11),
});
const playing = song('sonando', 'Sonando');
let seq = 0;
const env = (from: string, intent: Intent, name = from): Envelope => ({ id: `e${++seq}`, room: ROOM, from, name, at: 0, intent });
const ctx = (current: Track | null = playing, now = 1000): ApplyContext => ({ now, current });

function withRiders(...ids: string[]): EngineState {
  let s = createEngine(ROOM, 'Carro');
  for (const id of ids) s = applyIntent(s, env(id, { kind: 'hello', name: id }), ctx()).state;
  return s;
}

describe('peticiones', () => {
  it('si no suena nada, la primera petición suena ya y no entra en la cola', () => {
    const r = applyIntent(withRiders('ana'), env('ana', { kind: 'request', track: song('a') }), ctx(null));
    expect(r.effects).toEqual([{ type: 'play', track: expect.objectContaining({ id: 'yt_a', addedBy: 'ana' }), requestedBy: 'ana' }]);
    expect(r.state.queue).toHaveLength(0);
  });

  it('con algo sonando, entra en la cola con el voto de quien la pidió', () => {
    const r = applyIntent(withRiders('ana'), env('ana', { kind: 'request', track: song('a') }), ctx());
    expect(r.changed).toBe(true);
    expect(r.state.queue).toHaveLength(1);
    expect(scoreOf(r.state.queue[0])).toBe(1);
  });

  it('regresión v1: la misma petición recibida dos veces no suma dos votos', () => {
    let s = withRiders('ana');
    const e = env('ana', { kind: 'request', track: song('a') });
    s = applyIntent(s, e, ctx()).state;
    const second = applyIntent(s, { ...e, id: 'otro-transporte' }, ctx());
    expect(second.changed).toBe(false);
    expect(second.notice).toBe('Ya la tienes pedida');
    expect(scoreOf(second.state.queue[0])).toBe(1);
  });

  it('si otro pasajero pide la misma canción, cuenta como voto y sube', () => {
    let s = withRiders('ana', 'beto');
    s = applyIntent(s, env('ana', { kind: 'request', track: song('a') }), ctx()).state;
    s = applyIntent(s, env('ana', { kind: 'request', track: song('b') }), ctx()).state;
    const r = applyIntent(s, env('beto', { kind: 'request', track: song('b') }), ctx());
    expect(r.state.queue.map((e) => e.track.id)).toEqual(['yt_b', 'yt_a']);
    expect(scoreOf(r.state.queue[0])).toBe(2);
  });

  it('reconoce la misma canción aunque el título venga con "(Official Video)" y tildes', () => {
    let s = withRiders('ana', 'beto');
    const a: Track = { ...song('x', 'Vivir Mi Vida'), videoId: undefined, audioUrl: 'https://a.example/1.mp3', id: 'local_1', artist: 'Marc Anthony' };
    const b: Track = { ...a, id: 'local_2', title: 'Vivír mi vida (Official Video)' };
    s = applyIntent(s, env('ana', { kind: 'request', track: a }), ctx()).state;
    s = applyIntent(s, env('beto', { kind: 'request', track: b }), ctx()).state;
    expect(s.queue).toHaveLength(1);
    expect(scoreOf(s.queue[0])).toBe(2);
  });

  it('no deja pedir lo que ya está sonando', () => {
    const r = applyIntent(withRiders('ana'), env('ana', { kind: 'request', track: playing }), ctx());
    expect(r.notice).toBe('Esa canción ya está sonando');
    expect(r.state.queue).toHaveLength(0);
  });

  it('limita las canciones pendientes por pasajero', () => {
    let s = withRiders('ana');
    for (let i = 0; i < 4; i++) s = applyIntent(s, env('ana', { kind: 'request', track: song(`p${i}`) }), ctx()).state;
    const r = applyIntent(s, env('ana', { kind: 'request', track: song('p9') }), ctx());
    expect(r.state.queue).toHaveLength(4);
    expect(r.notice).toMatch(/4 canciones en espera/);
  });

  it('un pasajero que pide sin saludar queda registrado', () => {
    const r = applyIntent(createEngine(ROOM, 'Carro'), env('nuevo', { kind: 'request', track: song('a') }, 'Nuevo'), ctx());
    expect(r.state.riders.nuevo?.name).toBe('Nuevo');
    expect(r.changed).toBe(true);
  });
});

describe('votos', () => {
  const base = () => {
    let s = withRiders('ana', 'beto', 'caro', 'dani');
    s = applyIntent(s, env('ana', { kind: 'request', track: song('a') }), ctx()).state;
    return s;
  };

  it('votar dos veces lo mismo no cambia nada', () => {
    let s = base();
    const q = s.queue[0].queueId;
    s = applyIntent(s, env('beto', { kind: 'vote', queueId: q, value: 1 }), ctx()).state;
    const again = applyIntent(s, env('beto', { kind: 'vote', queueId: q, value: 1 }), ctx());
    expect(again.changed).toBe(false);
    expect(scoreOf(again.state.queue[0])).toBe(2);
  });

  it('cambiar de voto y quitarlo', () => {
    let s = base();
    const q = s.queue[0].queueId;
    s = applyIntent(s, env('beto', { kind: 'vote', queueId: q, value: 1 }), ctx()).state;
    s = applyIntent(s, env('beto', { kind: 'vote', queueId: q, value: -1 }), ctx()).state;
    expect(scoreOf(s.queue[0])).toBe(0);
    s = applyIntent(s, env('beto', { kind: 'vote', queueId: q, value: 0 }), ctx()).state;
    expect(scoreOf(s.queue[0])).toBe(1);
    expect(s.queue[0].votes).toEqual({ ana: 1 });
  });

  it('la mitad de los pasajeros en contra saca la canción (veto)', () => {
    let s = base(); // 4 pasajeros -> umbral 2
    const q = s.queue[0].queueId;
    s = applyIntent(s, env('beto', { kind: 'vote', queueId: q, value: -1 }), ctx()).state;
    expect(s.queue).toHaveLength(1); // score 0, no se veta
    const r = applyIntent(s, env('caro', { kind: 'vote', queueId: q, value: -1 }), ctx());
    expect(r.state.queue).toHaveLength(0);
    expect(r.notice).toMatch(/salió de la cola/);
  });

  it('votar una canción que ya no está avisa sin romper', () => {
    const r = applyIntent(base(), env('beto', { kind: 'vote', queueId: 'q_inexistente', value: 1 }), ctx());
    expect(r.changed).toBe(false);
    expect(r.notice).toBe('Esa canción ya no está en la cola');
  });
});

describe('orden y piloto automático', () => {
  it('a igualdad de votos, lo pedido por una persona va antes que el piloto automático', () => {
    let s = withRiders('ana');
    s = requestTrack(s, song('auto'), { id: AUTOPILOT_ID, name: 'Piloto' }, ctx(playing, 10), { autopilot: true }).state;
    s = applyIntent(s, env('ana', { kind: 'request', track: song('humana') }), ctx(playing, 20)).state;
    s = applyIntent(s, env('ana', { kind: 'vote', queueId: s.queue.find((e) => e.autopilot)!.queueId, value: 1 }), ctx()).state;
    // Ambas con 1 voto: gana la humana.
    expect(s.queue.map((e) => e.track.id)).toEqual(['yt_humana', 'yt_auto']);
  });

  it('el piloto automático no vota ni duplica', () => {
    let s = withRiders('ana');
    s = applyIntent(s, env('ana', { kind: 'request', track: song('a') }), ctx()).state;
    const r = requestTrack(s, song('a'), { id: AUTOPILOT_ID, name: 'Piloto' }, ctx(), { autopilot: true });
    expect(r.changed).toBe(false);
    expect(scoreOf(r.state.queue[0])).toBe(1);
  });

  it('takeNext saca la primera; el historial guarda y devuelve en orden', () => {
    let s = withRiders('ana');
    s = applyIntent(s, env('ana', { kind: 'request', track: song('a') }), ctx()).state;
    const n = takeNext(s);
    expect(n.entry?.track.id).toBe('yt_a');
    expect(n.state.queue).toHaveLength(0);
    let h = pushHistory(n.state, song('h1'));
    h = pushHistory(h, song('h2'));
    h = pushHistory(h, song('h1')); // repetida: sube al principio, no se duplica
    expect(h.history.map((t) => t.id)).toEqual(['yt_h1', 'yt_h2']);
    expect(popHistory(h).track?.id).toBe('yt_h1');
  });
});

describe('control y presencia', () => {
  it('el control de los pasajeros produce efectos, salvo que el carro lo desactive', () => {
    let s = withRiders('ana');
    expect(applyIntent(s, env('ana', { kind: 'control', action: 'next' }), ctx()).effects).toEqual([{ type: 'next' }]);
    s = updateSettings(s, { passengerControl: false });
    const r = applyIntent(s, env('ana', { kind: 'control', action: 'next' }), ctx());
    expect(r.effects).toEqual([]);
    expect(r.notice).toMatch(/desactivó/);
  });

  it('saludar de nuevo sólo cambia la foto si cambia el nombre', () => {
    const s = withRiders('ana');
    expect(applyIntent(s, env('ana', { kind: 'hello', name: 'ana' }), ctx()).changed).toBe(false);
    expect(applyIntent(s, env('ana', { kind: 'hello', name: 'Ana P.' }), ctx()).changed).toBe(true);
  });

  it('los pasajeros sin señal de vida desaparecen', () => {
    const s = withRiders('ana', 'beto');
    const later = applyIntent(s, env('ana', { kind: 'hello', name: 'ana' }), ctx(playing, 70_000)).state;
    const pruned = pruneRiders(later, 70_000);
    expect(Object.keys(pruned.riders)).toEqual(['ana']);
    expect(pruned.rev).toBeGreaterThan(later.rev);
  });
});
