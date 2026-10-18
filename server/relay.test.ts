import { beforeEach, describe, expect, it } from 'vitest';
import { handleRelay, resetRelayCache, type RelayRequest } from './relay.ts';
import { MemoryRedis } from './redis.ts';
import { createEngine, toSnapshot } from '../shared/room-engine.ts';
import type { Envelope } from '../shared/protocol.ts';

const ROOM = 'RUTA-K7M2';
const TOKEN = 'a'.repeat(32);
let clock = 1_000_000;
let redis: MemoryRedis;

const post = (body: unknown, ip = '200.1.1.1') => handleRelay({ method: 'POST', query: {}, body, ip }, redis, clock);
const get = (query: RelayRequest['query'], ip = '200.1.1.1') => handleRelay({ method: 'GET', query, body: null, ip }, redis, clock);
const envelope = (id: string, from = 'c1'): Envelope => ({ id, room: ROOM, from, name: 'Ana', at: clock, intent: { kind: 'hello', name: 'Ana' } });
const snapshot = (rev: number) => toSnapshot(createEngine(ROOM, 'Carro'), null, clock, rev);

beforeEach(() => {
  clock = 1_000_000;
  redis = new MemoryRedis(() => clock);
  resetRelayCache();
});

describe('relé de salas', () => {
  it('reserva un código y no deja que otro carro lo use', async () => {
    expect((await post({ op: 'claim', room: ROOM, token: TOKEN, name: 'Carro de Diego' })).status).toBe(200);
    expect((await post({ op: 'claim', room: ROOM, token: 'b'.repeat(32) })).status).toBe(409);
    // El mismo carro tras recargar recupera su sala.
    expect((await post({ op: 'claim', room: ROOM, token: TOKEN })).status).toBe(200);
  });

  it('rechaza tokens cortos y códigos del formato viejo', async () => {
    expect((await post({ op: 'claim', room: ROOM, token: 'corto' })).status).toBe(401);
    expect((await post({ op: 'claim', room: 'BEAT-123', token: TOKEN })).status).toBe(400);
  });

  it('un pasajero deja intenciones y el carro las recoge una sola vez', async () => {
    await post({ op: 'claim', room: ROOM, token: TOKEN });
    expect((await post({ op: 'push', envelope: envelope('e1') })).status).toBe(202);
    expect((await post({ op: 'push', envelope: envelope('e2') })).status).toBe(202);
    const first = await post({ op: 'sync', room: ROOM, token: TOKEN });
    expect((first.body as { intents: Envelope[] }).intents.map((e) => e.id)).toEqual(['e1', 'e2']);
    const second = await post({ op: 'sync', room: ROOM, token: TOKEN });
    expect((second.body as { intents: Envelope[] }).intents).toEqual([]);
  });

  it('sin token correcto no se puede leer la bandeja ni cerrar', async () => {
    await post({ op: 'claim', room: ROOM, token: TOKEN });
    await post({ op: 'push', envelope: envelope('e1') });
    expect((await post({ op: 'sync', room: ROOM, token: 'x'.repeat(32) })).status).toBe(403);
    expect((await post({ op: 'close', room: ROOM, token: 'x'.repeat(32) })).status).toBe(403);
    const real = await post({ op: 'sync', room: ROOM, token: TOKEN });
    expect((real.body as { intents: Envelope[] }).intents).toHaveLength(1);
  });

  it('pedir a una sala que no existe responde 404', async () => {
    expect((await post({ op: 'push', envelope: envelope('e1') })).status).toBe(404);
  });

  it('rechaza mensajes inválidos', async () => {
    await post({ op: 'claim', room: ROOM, token: TOKEN });
    expect((await post({ op: 'push', envelope: { ...envelope('e1'), intent: { kind: 'hack' } } })).status).toBe(400);
  });

  it('la foto publicada se puede leer y "unchanged" ahorra el envío', async () => {
    await post({ op: 'claim', room: ROOM, token: TOKEN });
    await post({ op: 'sync', room: ROOM, token: TOKEN, snapshot: snapshot(7) });
    const full = await get({ op: 'state', room: ROOM });
    expect((full.body as { snapshot: { rev: number } }).snapshot.rev).toBe(7);
    clock += 30_000;
    const same = await get({ op: 'state', room: ROOM, rev: '7' });
    expect(same.body).toEqual({ exists: true, unchanged: true, rev: 7, age: 30 });
  });

  it('cerrar la sala avisa a los pasajeros y bloquea peticiones', async () => {
    await post({ op: 'claim', room: ROOM, token: TOKEN });
    await post({ op: 'sync', room: ROOM, token: TOKEN, snapshot: snapshot(1) });
    expect((await post({ op: 'close', room: ROOM, token: TOKEN })).status).toBe(200);
    expect((await get({ op: 'state', room: ROOM })).body).toEqual({ exists: false, closed: true });
    expect((await post({ op: 'push', envelope: envelope('e9') })).status).toBe(410);
    // El código se puede reutilizar después.
    expect((await post({ op: 'claim', room: ROOM, token: 'z'.repeat(32) })).status).toBe(200);
  });

  it('si el carro deja de publicar, la sala caduca sola', async () => {
    await post({ op: 'claim', room: ROOM, token: TOKEN });
    await post({ op: 'sync', room: ROOM, token: TOKEN, snapshot: snapshot(1) });
    clock += 121_000;
    expect((await get({ op: 'state', room: ROOM })).body).toEqual({ exists: false, closed: false });
  });

  it('"cercanas" sólo muestra salas de quien comparte la misma IP pública', async () => {
    await post({ op: 'claim', room: ROOM, token: TOKEN, name: 'Carro de Diego' }, '190.5.5.5');
    const mine = await get({ op: 'nearby' }, '190.5.5.5');
    expect(mine.body).toEqual({ rooms: [{ room: ROOM, name: 'Carro de Diego' }] });
    const other = await get({ op: 'nearby' }, '181.9.9.9');
    expect(other.body).toEqual({ rooms: [] });
  });

  it('consultar el estado cuesta un solo comando', async () => {
    await post({ op: 'claim', room: ROOM, token: TOKEN });
    await post({ op: 'sync', room: ROOM, token: TOKEN, snapshot: snapshot(3) });
    const before = redis.commandCount;
    await get({ op: 'state', room: ROOM, rev: '3' });
    expect(redis.commandCount - before).toBe(1);
  });

  it('la sincronización del carro no repite la comprobación del token', async () => {
    await post({ op: 'claim', room: ROOM, token: TOKEN });
    await post({ op: 'sync', room: ROOM, token: TOKEN });
    const before = redis.commandCount;
    await post({ op: 'sync', room: ROOM, token: TOKEN });
    expect(redis.commandCount - before).toBe(1); // sólo LPOP
  });

  it('la bandeja no crece sin límite', async () => {
    await post({ op: 'claim', room: ROOM, token: TOKEN });
    for (let i = 0; i < 130; i++) await post({ op: 'push', envelope: envelope(`e${i}`) });
    const a = await post({ op: 'sync', room: ROOM, token: TOKEN });
    const b = await post({ op: 'sync', room: ROOM, token: TOKEN });
    const ids = [...(a.body as { intents: Envelope[] }).intents, ...(b.body as { intents: Envelope[] }).intents].map((e) => e.id);
    expect(ids).toHaveLength(100);
    expect(ids[0]).toBe('e30'); // se descartan las más viejas
  });
});
