// Relé HTTP de salas. Es el respaldo cuando el P2P no conecta (redes móviles con NAT estricto,
// WebViews sin WebRTC...). No decide nada sobre la música: guarda la última foto del carro y
// una bandeja de intenciones de los pasajeros.
//
// Por qué así: en la v1 el servidor aplicaba votos y colas por su cuenta y el carro también,
// con dos verdades distintas. Ahora sólo hay una (el carro) y el servidor es un buzón.
//
// Seguridad: crear, publicar, leer la bandeja y cerrar exigen el token del carro. Sólo se guarda
// su hash. Un pasajero sólo puede dejar intenciones, que el carro valida otra vez.

import { createHash } from 'node:crypto';
import { LIMITS, parseEnvelope, parseLibrary, parseSnapshot, type Envelope } from '../shared/protocol.js';
import { isRoomCode } from '../shared/room-code.js';
import type { Cmd, RedisLike } from './redis.js';

export const RELAY_TTL = {
  /** Si el carro deja de publicar 2 min, la sala desaparece sola. */
  room: 120,
  closed: 600,
  nearby: 300,
} as const;
const NEARBY_WINDOW_MS = 90_000;
const INBOX_MAX = 100;
const PULL_BATCH = 50;

const key = {
  meta: (c: string) => `cb:${c}:meta`,
  snap: (c: string) => `cb:${c}:snap`,
  rev: (c: string) => `cb:${c}:rev`,
  lib: (c: string) => `cb:${c}:lib`,
  inbox: (c: string) => `cb:${c}:inbox`,
  nearby: (ipHash: string) => `cb:nearby:${ipHash}`,
};

interface RoomMeta {
  name: string;
  tokenHash: string;
  ipHash: string;
  createdAt: number;
}

export interface RelayRequest {
  method: string;
  query: Record<string, string | undefined>;
  body: unknown;
  /** IP pública del cliente: agrupa a quienes comparten el hotspot del carro. */
  ip: string;
}

export interface RelayResponse {
  status: number;
  body: unknown;
}

// La clave rev guarda "<rev>|<hora del servidor>" de la última foto, o CLOSED si el carro cerró.
// La hora sirve para saber si el carro sigue vivo: la foto dura 2 min en el almacén aunque el
// carro haya desaparecido, y "sin cambios" no basta para decir "en vivo" (medido: falso positivo).
// Así el pasajero sabe "existe / cambió / cerró" con UN comando (medido: 254 -> menos comandos/min).
const CLOSED = 'closed';

// Caché del token por instancia de la función: evita un GET por cada sincronización del carro.
// Si la instancia se recicla, sólo cuesta un GET más.
const hostCache = new Map<string, { meta: RoomMeta; until: number }>();
const HOST_CACHE_MS = 60_000;

const sha = (v: string) => createHash('sha256').update(v).digest('hex');
const hashToken = (token: string) => sha(`carbeat:token:${token}`);
// Con sal para no guardar IPs en claro. Sólo sirve para "quién comparte red conmigo".
const hashIp = (ip: string) => sha(`carbeat:ip:${process.env.CARBEAT_IP_SALT ?? 'carbeat'}:${ip}`).slice(0, 24);

const ok = (body: unknown, status = 200): RelayResponse => ({ status, body });
const fail = (status: number, error: string): RelayResponse => ({ status, body: { error } });

function readJson<T>(v: unknown): T | null {
  if (typeof v !== 'string') return null;
  try {
    return JSON.parse(v) as T;
  } catch {
    return null;
  }
}

function asObject(body: unknown): Record<string, unknown> {
  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
}

function validToken(t: unknown): t is string {
  return typeof t === 'string' && t.length >= 24 && t.length <= 128;
}

async function one(redis: RedisLike, cmd: Cmd): Promise<unknown> {
  const [r] = await redis.exec([cmd]);
  if (r instanceof Error) throw r;
  return r;
}

async function verifyHost(redis: RedisLike, room: string, token: unknown, now: number): Promise<RoomMeta | RelayResponse> {
  if (!isRoomCode(room)) return fail(400, 'Código de sala inválido');
  if (!validToken(token)) return fail(401, 'Falta el token del carro');
  const hash = hashToken(token);
  const cached = hostCache.get(room);
  if (cached && cached.until > now && cached.meta.tokenHash === hash) return cached.meta;
  const meta = readJson<RoomMeta>(await one(redis, ['GET', key.meta(room)]));
  if (!meta) return fail(404, 'La sala no existe o caducó');
  if (meta.tokenHash !== hash) return fail(403, 'Token incorrecto');
  hostCache.set(room, { meta, until: now + HOST_CACHE_MS });
  if (hostCache.size > 500) hostCache.delete(hostCache.keys().next().value as string);
  return meta;
}

/** Sólo para tests: cada test empieza sin caché. */
export function resetRelayCache(): void {
  hostCache.clear();
}

export async function handleRelay(req: RelayRequest, redis: RedisLike, now = Date.now()): Promise<RelayResponse> {
  try {
    if (req.method === 'GET') return await handleGet(req, redis, now);
    if (req.method === 'POST') return await handlePost(req, redis, now);
    return fail(405, 'Método no permitido');
  } catch (err) {
    return fail(502, `Almacén no disponible: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function handleGet(req: RelayRequest, redis: RedisLike, now: number): Promise<RelayResponse> {
  const op = req.query.op ?? 'state';

  if (op === 'health') return ok({ ok: true, store: redis.kind });

  if (op === 'state') {
    const room = (req.query.room ?? '').toUpperCase();
    if (!isRoomCode(room)) return fail(400, 'Código de sala inválido');
    const raw = await one(redis, ['GET', key.rev(room)]);
    if (raw === CLOSED) return ok({ exists: false, closed: true });
    if (raw === null) return ok({ exists: false, closed: false });
    const [revPart, atPart] = String(raw).split('|');
    // Segundos desde la última foto del carro, medidos con el reloj del servidor.
    const age = atPart ? Math.max(0, Math.round((now - Number(atPart)) / 1000)) : null;
    if (req.query.rev && revPart === req.query.rev) return ok({ exists: true, unchanged: true, rev: Number(revPart), age });
    const snapshot = readJson(await one(redis, ['GET', key.snap(room)]));
    return ok({ exists: true, snapshot, age });
  }

  if (op === 'library') {
    const room = (req.query.room ?? '').toUpperCase();
    if (!isRoomCode(room)) return fail(400, 'Código de sala inválido');
    return ok({ library: readJson(await one(redis, ['GET', key.lib(room)])) });
  }

  if (op === 'nearby') {
    const nk = key.nearby(hashIp(req.ip));
    const [, codes] = await redis.exec([
      ['ZREMRANGEBYSCORE', nk, '-inf', now - NEARBY_WINDOW_MS],
      ['ZRANGEBYSCORE', nk, now - NEARBY_WINDOW_MS, '+inf'],
    ]);
    const list = Array.isArray(codes) ? (codes as string[]).filter(isRoomCode).slice(0, 10) : [];
    if (!list.length) return ok({ rooms: [] });
    const [metas] = await redis.exec([['MGET', ...list.map(key.meta)]]);
    const rooms = list
      .map((room, i) => ({ room, meta: readJson<RoomMeta>((metas as unknown[])?.[i]) }))
      .filter((r) => r.meta)
      .map((r) => ({ room: r.room, name: r.meta!.name }));
    return ok({ rooms });
  }

  return fail(400, 'Operación desconocida');
}

async function handlePost(req: RelayRequest, redis: RedisLike, now: number): Promise<RelayResponse> {
  const body = asObject(req.body);
  const op = body.op;
  const room = typeof body.room === 'string' ? body.room.toUpperCase() : '';

  // ---- pasajero: dejar una intención en la bandeja del carro
  if (op === 'push') {
    const raw = JSON.stringify(body.envelope ?? null);
    if (raw.length > LIMITS.envelopeBytes) return fail(413, 'Mensaje demasiado grande');
    const envelope = parseEnvelope(body.envelope);
    if (!envelope) return fail(400, 'Mensaje inválido');
    const c = envelope.room;
    // Un solo viaje: si la sala no existe, el mensaje caduca solo con la bandeja.
    const [rev] = await redis.exec([
      ['GET', key.rev(c)],
      ['RPUSH', key.inbox(c), JSON.stringify(envelope)],
      ['LTRIM', key.inbox(c), -INBOX_MAX, -1],
      ['EXPIRE', key.inbox(c), RELAY_TTL.room],
    ]);
    if (rev === CLOSED) return fail(410, 'El conductor cerró la sala');
    if (rev === null || rev instanceof Error) return fail(404, 'La sala no existe o el carro está desconectado');
    return ok({ ok: true }, 202);
  }

  // ---- carro: reservar el código
  if (op === 'claim') {
    if (!isRoomCode(room)) return fail(400, 'Código de sala inválido');
    if (!validToken(body.token)) return fail(401, 'Falta el token del carro');
    const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim().slice(0, LIMITS.name) : `Carro ${room}`;
    const meta: RoomMeta = { name, tokenHash: hashToken(body.token), ipHash: hashIp(req.ip), createdAt: now };
    const set = await one(redis, ['SET', key.meta(room), JSON.stringify(meta), 'NX', 'EX', RELAY_TTL.room]);
    if (set !== 'OK') {
      const current = readJson<RoomMeta>(await one(redis, ['GET', key.meta(room)]));
      // El mismo carro tras recargar la página: se le devuelve su sala.
      if (!current || current.tokenHash !== meta.tokenHash) return fail(409, 'Ese código ya está en uso');
      meta.createdAt = current.createdAt;
      await redis.exec([['SET', key.meta(room), JSON.stringify(meta), 'EX', RELAY_TTL.room]]);
    }
    hostCache.delete(room);
    await redis.exec([
      // rev = 0 hasta la primera foto; también borra un CLOSED anterior del mismo código.
      ['SET', key.rev(room), 0, 'EX', RELAY_TTL.room],
      ['ZADD', key.nearby(meta.ipHash), now, room],
      ['EXPIRE', key.nearby(meta.ipHash), RELAY_TTL.nearby],
    ]);
    return ok({ ok: true, room });
  }

  // ---- carro: publicar foto (opcional) y recoger intenciones, en una sola llamada
  if (op === 'sync') {
    const meta = await verifyHost(redis, room, body.token, now);
    if ('status' in meta) return meta;
    const cmds: Cmd[] = [['LPOP', key.inbox(room), PULL_BATCH]];
    if (body.snapshot !== undefined) {
      const raw = JSON.stringify(body.snapshot);
      if (raw.length > LIMITS.snapshotBytes) return fail(413, 'Foto de la sala demasiado grande');
      const snap = parseSnapshot(body.snapshot);
      if (!snap || snap.room !== room) return fail(400, 'Foto inválida');
      cmds.push(
        ['SET', key.snap(room), raw, 'EX', RELAY_TTL.room],
        ['SET', key.rev(room), `${snap.rev}|${now}`, 'EX', RELAY_TTL.room],
        ['EXPIRE', key.meta(room), RELAY_TTL.room],
        ['ZADD', key.nearby(meta.ipHash), now, room],
        ['EXPIRE', key.nearby(meta.ipHash), RELAY_TTL.nearby],
      );
    }
    if (body.library !== undefined) {
      const raw = JSON.stringify(body.library);
      if (raw.length > LIMITS.libraryBytes) return fail(413, 'Biblioteca demasiado grande');
      const lib = parseLibrary(body.library);
      if (!lib || lib.room !== room) return fail(400, 'Biblioteca inválida');
      cmds.push(['SET', key.lib(room), JSON.stringify(lib), 'EX', RELAY_TTL.room * 30]);
    } else if (body.snapshot !== undefined) {
      cmds.push(['EXPIRE', key.lib(room), RELAY_TTL.room * 30]);
    }
    const [popped] = await redis.exec(cmds);
    const intents: Envelope[] = [];
    if (Array.isArray(popped)) {
      for (const item of popped) {
        const e = parseEnvelope(readJson(item));
        if (e && e.room === room) intents.push(e);
      }
    }
    return ok({ ok: true, intents });
  }

  // ---- carro: cerrar la sala y avisar a quien pregunte
  if (op === 'close') {
    const meta = await verifyHost(redis, room, body.token, now);
    if ('status' in meta) return meta;
    hostCache.delete(room);
    await redis.exec([
      ['DEL', key.meta(room), key.snap(room), key.inbox(room), key.lib(room)],
      ['SET', key.rev(room), CLOSED, 'EX', RELAY_TTL.closed],
      ['ZREM', key.nearby(meta.ipHash), room],
    ]);
    return ok({ ok: true, closed: true });
  }

  return fail(400, 'Operación desconocida');
}
