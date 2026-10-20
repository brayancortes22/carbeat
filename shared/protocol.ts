// Protocolo de salas v2.
//
// Modelo: el carro (host) es la única fuente de verdad. Los pasajeros no modifican el
// estado: envían INTENCIONES (pedir, votar, controlar) y reciben FOTOS del estado (snapshot)
// con un número de revisión creciente.
//
// Por qué así: en la v1 cada mensaje viajaba a la vez por P2P, WebSocket, HTTP y
// BroadcastChannel, y el carro procesaba la misma petición dos veces (1 petición = 2 votos,
// medido). Ahora cada intención lleva un id único y el carro la aplica una sola vez; las fotos
// son idempotentes, así que recibir la misma dos veces no cambia nada.

import type { Track, TrackSource } from './track.js';
import { isRoomCode } from './room-code.js';

export const PROTOCOL_VERSION = 2 as const;

export type VoteValue = -1 | 0 | 1;
export type ControlAction = 'toggle' | 'next' | 'prev';

export type Intent =
  | { kind: 'hello'; name: string }
  | { kind: 'bye' }
  | { kind: 'request'; track: Track; playNow?: boolean }
  | { kind: 'vote'; queueId: string; value: VoteValue }
  | { kind: 'control'; action: ControlAction };

export interface Envelope {
  /** Único por mensaje: deduplica entre transportes. */
  id: string;
  room: string;
  /** Id estable del dispositivo del pasajero. */
  from: string;
  name: string;
  /** Reloj del emisor; sólo informativo. */
  at: number;
  intent: Intent;
}

export interface QueueEntry {
  queueId: string;
  track: Track;
  requestedBy: string;
  requestedById: string;
  requestedAt: number;
  autopilot: boolean;
  /** clientId -> voto. Así cada pasajero sabe qué votó y nadie vota dos veces. */
  votes: Record<string, 1 | -1>;
}

export interface Rider {
  id: string;
  name: string;
}

export interface NowPlaying {
  track: Track;
  isPlaying: boolean;
  /** Segundos reproducidos en el instante `sentAt` del snapshot. */
  position: number;
  duration: number;
  requestedBy?: string;
}

export interface RoomSettings {
  /** Los pasajeros pueden pausar y saltar. */
  passengerControl: boolean;
  /** Canciones pendientes por pasajero; evita que uno solo llene la cola. */
  maxPendingPerRider: number;
}

/** Aviso para un pasajero concreto (o para todos si `to` es '*'). Viaja dentro de la foto
 * para que llegue igual por P2P, WebSocket o HTTP. */
export interface Notice {
  id: string;
  to: string;
  text: string;
  at: number;
}

export interface Snapshot {
  v: typeof PROTOCOL_VERSION;
  room: string;
  name: string;
  rev: number;
  sentAt: number;
  now: NowPlaying | null;
  queue: QueueEntry[];
  history: Track[];
  riders: Rider[];
  settings: RoomSettings;
  notices: Notice[];
  /** Versión del índice de la biblioteca del carro (0 si no hay). */
  libraryRev?: number;
  closed: boolean;
}

/** Entrada del índice de la música guardada en el carro (sin URL: sólo el carro la reproduce). */
export interface LibraryItem {
  id: string;
  title: string;
  artist: string;
  duration: number;
}

export interface LibraryIndex {
  room: string;
  rev: number;
  items: LibraryItem[];
}

export const LIBRARY_MAX = 600;

/** Lo que viaja por P2P, WebSocket y BroadcastChannel. */
export type WireMessage =
  | { t: 'intent'; e: Envelope }
  | { t: 'snapshot'; s: Snapshot }
  | { t: 'library'; l: LibraryIndex };

export const LIMITS = {
  name: 32,
  title: 160,
  artist: 120,
  album: 120,
  url: 1024,
  id: 96,
  envelopeBytes: 8 * 1024,
  snapshotBytes: 96 * 1024,
  libraryBytes: 120 * 1024,
} as const;

// ---------------------------------------------------------------- validación

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function str(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s) return null;
  return s.slice(0, max);
}

function safeUrl(v: unknown, allowed: string[]): string | undefined {
  if (typeof v !== 'string' || !v || v.length > LIMITS.url) return undefined;
  try {
    const u = new URL(v);
    return allowed.includes(u.protocol) ? v : undefined;
  } catch {
    return undefined;
  }
}

const SOURCES: TrackSource[] = ['local_car', 'passenger_dj', 'stream'];
const VIDEO_ID = /^[A-Za-z0-9_-]{6,20}$/;

/**
 * Limpia una pista que viene de otro dispositivo. Una URL blob: de otro teléfono no sirve en
 * el carro, y una javascript: sería peligrosa: sólo se aceptan http(s).
 */
export function sanitizeTrack(raw: unknown): Track | null {
  if (!isObj(raw)) return null;
  const id = str(raw.id, LIMITS.id);
  const title = str(raw.title, LIMITS.title);
  if (!id || !title) return null;
  const videoId = typeof raw.videoId === 'string' && VIDEO_ID.test(raw.videoId) ? raw.videoId : undefined;
  const audioUrl = safeUrl(raw.audioUrl, ['https:', 'http:']) ?? '';
  // Una canción guardada en el carro viaja sólo con su id: el carro la busca en su biblioteca.
  const isCarTrack = raw.source === 'local_car';
  if (!videoId && !audioUrl && !isCarTrack) return null; // nada que reproducir
  const duration = typeof raw.duration === 'number' && Number.isFinite(raw.duration) && raw.duration > 0
    ? Math.min(Math.round(raw.duration), 6 * 3600)
    : 0;
  return {
    id,
    title,
    artist: str(raw.artist, LIMITS.artist) ?? 'Desconocido',
    album: str(raw.album, LIMITS.album) ?? undefined,
    duration,
    coverUrl: safeUrl(raw.coverUrl, ['https:', 'http:']),
    source: SOURCES.includes(raw.source as TrackSource) ? (raw.source as TrackSource) : 'stream',
    addedBy: str(raw.addedBy, LIMITS.name) ?? undefined,
    audioUrl,
    videoId,
  };
}

function parseIntent(raw: unknown): Intent | null {
  if (!isObj(raw)) return null;
  switch (raw.kind) {
    case 'hello': {
      const name = str(raw.name, LIMITS.name);
      return name ? { kind: 'hello', name } : null;
    }
    case 'bye':
      return { kind: 'bye' };
    case 'request': {
      const track = sanitizeTrack(raw.track);
      return track ? { kind: 'request', track } : null;
    }
    case 'vote': {
      const queueId = str(raw.queueId, LIMITS.id);
      const value = raw.value;
      if (!queueId || (value !== 1 && value !== 0 && value !== -1)) return null;
      return { kind: 'vote', queueId, value };
    }
    case 'control': {
      const action = raw.action;
      if (action !== 'toggle' && action !== 'next' && action !== 'prev') return null;
      return { kind: 'control', action };
    }
    default:
      return null;
  }
}

export function parseEnvelope(raw: unknown): Envelope | null {
  if (!isObj(raw)) return null;
  const id = str(raw.id, LIMITS.id);
  const from = str(raw.from, LIMITS.id);
  const name = str(raw.name, LIMITS.name) ?? 'Pasajero';
  if (!id || !from || !isRoomCode(raw.room)) return null;
  const intent = parseIntent(raw.intent);
  if (!intent) return null;
  const at = typeof raw.at === 'number' && Number.isFinite(raw.at) ? raw.at : 0;
  return { id, room: raw.room, from, name, at, intent };
}

/** Validación ligera de una foto: el carro es de confianza (tiene token), pero el cable no. */
export function parseSnapshot(raw: unknown): Snapshot | null {
  if (!isObj(raw)) return null;
  if (raw.v !== PROTOCOL_VERSION || !isRoomCode(raw.room)) return null;
  if (typeof raw.rev !== 'number' || !Array.isArray(raw.queue) || !Array.isArray(raw.riders)) return null;
  if (!Array.isArray(raw.notices)) raw.notices = [];
  return raw as unknown as Snapshot;
}

export function parseLibrary(raw: unknown): LibraryIndex | null {
  if (!isObj(raw) || !isRoomCode(raw.room) || typeof raw.rev !== 'number' || !Array.isArray(raw.items)) return null;
  const items: LibraryItem[] = [];
  for (const it of raw.items.slice(0, LIBRARY_MAX)) {
    if (!isObj(it)) continue;
    const id = str(it.id, LIMITS.id);
    const title = str(it.title, LIMITS.title);
    if (!id || !title) continue;
    items.push({ id, title, artist: str(it.artist, LIMITS.artist) ?? '', duration: typeof it.duration === 'number' ? it.duration : 0 });
  }
  return { room: raw.room, rev: raw.rev, items };
}

export function parseWire(raw: unknown): WireMessage | null {
  if (!isObj(raw)) return null;
  if (raw.t === 'intent') {
    const e = parseEnvelope(raw.e);
    return e ? { t: 'intent', e } : null;
  }
  if (raw.t === 'snapshot') {
    const s = parseSnapshot(raw.s);
    return s ? { t: 'snapshot', s } : null;
  }
  if (raw.t === 'library') {
    const l = parseLibrary(raw.l);
    return l ? { t: 'library', l } : null;
  }
  return null;
}

export function newId(prefix = ''): string {
  const buf = new Uint8Array(12);
  globalThis.crypto.getRandomValues(buf);
  let out = prefix;
  for (const b of buf) out += b.toString(36).padStart(2, '0');
  return out;
}

/** Puntuación neta de una entrada de la cola. */
export function scoreOf(entry: Pick<QueueEntry, 'votes'>): number {
  let s = 0;
  for (const v of Object.values(entry.votes)) s += v;
  return s;
}
