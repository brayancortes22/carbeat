// Estado del carro guardado por sala, para que recargar la página (o que Android mate la app
// en segundo plano) no borre la cola. El carro es la única fuente de verdad: si no lo guarda
// él, no lo tiene nadie.

import { sanitizeTrack, type QueueEntry, type RoomSettings } from '../../../shared/protocol';
import { DEFAULT_SETTINGS } from '../../../shared/room-engine';
import type { Track } from '../../../shared/track';
import { AUTOPILOT_MODES, type AutopilotMode } from '../autopilot';

const KEY = (room: string) => `carbeat.host-state.v2.${room}`;
/** Pasado un viaje largo, una cola vieja estorba más de lo que ayuda. */
const MAX_AGE_MS = 6 * 60 * 60 * 1000;

export interface SavedHost {
  at: number;
  rev: number;
  queue: QueueEntry[];
  history: Track[];
  settings: RoomSettings;
  autopilot: AutopilotMode;
  now: { track: Track; position: number; requestedBy?: string } | null;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

function entry(raw: unknown): QueueEntry | null {
  if (!isObj(raw) || typeof raw.queueId !== 'string') return null;
  const track = sanitizeTrack(raw.track);
  if (!track) return null;
  const votes: Record<string, 1 | -1> = {};
  if (isObj(raw.votes)) for (const [k, v] of Object.entries(raw.votes)) if (v === 1 || v === -1) votes[k] = v;
  return {
    queueId: raw.queueId,
    track,
    requestedBy: typeof raw.requestedBy === 'string' ? raw.requestedBy : 'Alguien',
    requestedById: typeof raw.requestedById === 'string' ? raw.requestedById : '',
    requestedAt: typeof raw.requestedAt === 'number' ? raw.requestedAt : 0,
    autopilot: raw.autopilot === true,
    votes,
  };
}

/** Lee y valida: lo guardado puede venir de otra versión o estar a medias. */
export function loadHostState(room: string, now = Date.now()): SavedHost | null {
  let raw: unknown;
  try {
    raw = JSON.parse(localStorage.getItem(KEY(room)) ?? 'null');
  } catch {
    return null;
  }
  if (!isObj(raw) || typeof raw.at !== 'number' || now - raw.at > MAX_AGE_MS) return null;
  const s = isObj(raw.settings) ? raw.settings : {};
  const n = isObj(raw.now) ? raw.now : null;
  const nowTrack = n ? sanitizeTrack(n.track) : null;
  return {
    at: raw.at,
    rev: typeof raw.rev === 'number' ? raw.rev : 1,
    queue: Array.isArray(raw.queue) ? raw.queue.map(entry).filter((e): e is QueueEntry => !!e) : [],
    history: Array.isArray(raw.history) ? raw.history.map(sanitizeTrack).filter((t): t is Track => !!t) : [],
    settings: {
      passengerControl: typeof s.passengerControl === 'boolean' ? s.passengerControl : DEFAULT_SETTINGS.passengerControl,
      maxPendingPerRider: typeof s.maxPendingPerRider === 'number' ? s.maxPendingPerRider : DEFAULT_SETTINGS.maxPendingPerRider,
    },
    autopilot: AUTOPILOT_MODES.find((m) => m.id === raw.autopilot)?.id ?? 'hybrid',
    now: n && nowTrack
      ? { track: nowTrack, position: typeof n.position === 'number' ? Math.max(0, n.position) : 0, requestedBy: typeof n.requestedBy === 'string' ? n.requestedBy : undefined }
      : null,
  };
}

export function saveHostState(room: string, state: Omit<SavedHost, 'at'>): void {
  try {
    localStorage.setItem(KEY(room), JSON.stringify({ ...state, at: Date.now() }));
  } catch {
    /* almacenamiento lleno o modo privado: la sala sigue, sólo sin memoria */
  }
}

export function forgetHostState(room: string): void {
  try {
    localStorage.removeItem(KEY(room));
  } catch {
    /* nada que borrar */
  }
}
