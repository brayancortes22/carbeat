// Manejadores HTTP comunes. Los usan igual:
//   - las funciones de Vercel (api/*.ts),
//   - el servidor de desarrollo de Vite (vite.config.ts),
//   - el servidor de red local (server/lan-server.ts).
// Así lo que se prueba en local es lo que corre en producción.

import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleRelay } from './relay.js';
import { redisFromEnv, type RedisLike } from './redis.js';
import { relatedYouTubeMusic, searchYouTubeMusic } from './yt-music.js';
import { CARBEAT_BUILD_DATE, CARBEAT_RELEASE_NOTES, CARBEAT_VERSION } from '../shared/version.js';

/** Vercel añade query y body ya parseados; Node puro no. */
export type Req = IncomingMessage & { query?: Record<string, string | string[] | undefined>; body?: unknown };
export type Res = ServerResponse;

const MAX_BODY = 128 * 1024;

function send(res: Res, status: number, body: unknown, extraHeaders: Record<string, string> = {}): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  for (const [k, v] of Object.entries(extraHeaders)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}

function queryOf(req: Req): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  if (req.query) {
    for (const [k, v] of Object.entries(req.query)) out[k] = Array.isArray(v) ? v[0] : v;
    return out;
  }
  const url = new URL(req.url ?? '/', 'http://localhost');
  url.searchParams.forEach((v, k) => (out[k] = v));
  return out;
}

async function bodyOf(req: Req): Promise<unknown> {
  if (req.body !== undefined) return req.body;
  if (req.method !== 'POST') return null;
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error('cuerpo demasiado grande'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      try {
        resolve(raw ? JSON.parse(raw) : null);
      } catch {
        resolve(null);
      }
    });
    req.on('error', reject);
  });
}

export function clientIp(req: Req): string {
  const fwd = req.headers['x-forwarded-for'];
  const first = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0]?.trim();
  const real = req.headers['x-real-ip'];
  return first || (Array.isArray(real) ? real[0] : real) || req.socket?.remoteAddress || '0.0.0.0';
}

const preflight = (req: Req, res: Res) => {
  if (req.method === 'OPTIONS') {
    send(res, 204, null);
    return true;
  }
  return false;
};

export function makeRoomHandler(redis?: RedisLike) {
  return async function roomHandler(req: Req, res: Res): Promise<void> {
    if (preflight(req, res)) return;
    const store = redis ?? redisFromEnv();
    let body: unknown;
    try {
      body = await bodyOf(req);
    } catch {
      send(res, 413, { error: 'Mensaje demasiado grande' });
      return;
    }
    const out = await handleRelay({ method: req.method ?? 'GET', query: queryOf(req), body, ip: clientIp(req) }, store);
    send(res, out.status, out.body, { 'Cache-Control': 'no-store', 'X-CarBeat-Store': store.kind });
  };
}

export async function searchHandler(req: Req, res: Res): Promise<void> {
  if (preflight(req, res)) return;
  const q = queryOf(req).q ?? '';
  try {
    const tracks = await searchYouTubeMusic(q);
    // Caché en el CDN de Vercel: la misma búsqueda de varios pasajeros no repite la llamada.
    send(res, 200, tracks, { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=86400' });
  } catch (err) {
    send(res, 502, { error: err instanceof Error ? err.message : 'Error en la búsqueda' });
  }
}

export async function relatedHandler(req: Req, res: Res): Promise<void> {
  if (preflight(req, res)) return;
  const q = queryOf(req);
  const artist = (q.artist ?? '').trim();
  if (!artist) {
    send(res, 200, []);
    return;
  }
  try {
    const exclude = (q.exclude ?? '').split(',').filter(Boolean).slice(0, 50);
    const tracks = await relatedYouTubeMusic(artist, q.title ?? '', exclude);
    send(res, 200, tracks, { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600' });
  } catch (err) {
    send(res, 502, { error: err instanceof Error ? err.message : 'Error buscando afines' });
  }
}

export async function versionHandler(req: Req, res: Res): Promise<void> {
  if (preflight(req, res)) return;
  send(
    res,
    200,
    { version: CARBEAT_VERSION, buildDate: CARBEAT_BUILD_DATE, latestApk: '/downloads/carbeat-latest.apk', features: CARBEAT_RELEASE_NOTES },
    { 'Cache-Control': 'no-store' },
  );
}

/** Enrutador para servidores Node (Vite dev y red local). Devuelve false si la ruta no es de la API. */
export function makeApiRouter(redis?: RedisLike) {
  const room = makeRoomHandler(redis);
  return async (req: Req, res: Res): Promise<boolean> => {
    const path = new URL(req.url ?? '/', 'http://localhost').pathname;
    if (path === '/api/room') await room(req, res);
    else if (path === '/api/yt/search') await searchHandler(req, res);
    else if (path === '/api/yt/related') await relatedHandler(req, res);
    else if (path === '/api/version') await versionHandler(req, res);
    else return false;
    return true;
  };
}
