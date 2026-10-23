// Motor de la sala: funciones puras que corren en el carro.
// No sabe nada de red ni de audio: recibe intenciones y devuelve el estado nuevo más los
// efectos que el reproductor tiene que ejecutar. Por eso se puede probar sin navegador.

import { sameTrack, type Track } from './track.js';
import {
  PROTOCOL_VERSION,
  newId,
  scoreOf,
  type Envelope,
  type Notice,
  type NowPlaying,
  type QueueEntry,
  type RoomSettings,
  type Snapshot,
} from './protocol.js';

export interface RiderPresence {
  name: string;
  lastSeen: number;
}

export interface EngineState {
  room: string;
  name: string;
  rev: number;
  queue: QueueEntry[];
  /** Más reciente primero. */
  history: Track[];
  riders: Record<string, RiderPresence>;
  settings: RoomSettings;
}

export type Effect =
  | { type: 'play'; track: Track; requestedBy?: string }
  | { type: 'toggle' }
  | { type: 'next' }
  | { type: 'prev' };

export interface ApplyContext {
  now: number;
  /** Lo que suena ahora en el carro. */
  current: Track | null;
}

export interface ApplyResult {
  state: EngineState;
  effects: Effect[];
  /** true si la foto que ven los pasajeros cambió (hay que publicar). */
  changed: boolean;
  /** Mensaje para quien envió la intención. */
  notice?: string;
}

export interface Requester {
  id: string;
  name: string;
}

export const HOST_ID = 'host';
export const AUTOPILOT_ID = 'autopilot';
export const DEFAULT_SETTINGS: RoomSettings = { passengerControl: true, passengerPlayNow: false, maxPendingPerRider: 4 };
export const HISTORY_SIZE = 12;
/** Debe ser holgado frente al saludo HTTP del pasajero (cada 25 s). */
export const RIDER_TIMEOUT_MS = 60_000;

export function createEngine(room: string, name: string, settings: RoomSettings = DEFAULT_SETTINGS): EngineState {
  return { room, name, rev: 1, queue: [], history: [], riders: {}, settings: { ...settings } };
}

const bump = (state: EngineState, patch: Partial<EngineState>): EngineState => ({ ...state, ...patch, rev: state.rev + 1 });
const same = (state: EngineState, effects: Effect[] = [], notice?: string): ApplyResult => ({ state, effects, changed: false, notice });

/**
 * Orden de la cola: más votos primero; a igualdad, lo que pidió una persona antes que el piloto
 * automático; y a igualdad, el que lo pidió antes.
 */
export function sortQueue(queue: QueueEntry[]): QueueEntry[] {
  return [...queue].sort((a, b) => {
    const s = scoreOf(b) - scoreOf(a);
    if (s !== 0) return s;
    if (a.autopilot !== b.autopilot) return a.autopilot ? 1 : -1;
    return a.requestedAt - b.requestedAt;
  });
}

export function activeRiderCount(state: EngineState): number {
  return Object.keys(state.riders).length;
}

/** Votos negativos para sacar una canción: la mitad de los pasajeros, mínimo 2. */
export function vetoThreshold(state: EngineState): number {
  return Math.max(2, Math.ceil(activeRiderCount(state) / 2));
}

export function requestTrack(
  state: EngineState,
  track: Track,
  by: Requester,
  ctx: ApplyContext,
  opts: { autopilot?: boolean } = {},
): ApplyResult {
  const autopilot = opts.autopilot === true;
  if (ctx.current && sameTrack(ctx.current, track)) return same(state, [], 'Esa canción ya está sonando');

  const existing = state.queue.find((e) => sameTrack(e.track, track));
  if (existing) {
    if (autopilot || by.id === AUTOPILOT_ID) return same(state);
    if (existing.votes[by.id] === 1) return same(state, [], 'Ya la tienes pedida');
    const queue = sortQueue(
      state.queue.map((e) => (e === existing ? { ...e, votes: { ...e.votes, [by.id]: 1 as const } } : e)),
    );
    return { state: bump(state, { queue }), effects: [], changed: true, notice: 'Ya estaba en la cola: sumaste tu voto' };
  }

  const isPassenger = by.id !== HOST_ID && by.id !== AUTOPILOT_ID;
  if (isPassenger) {
    const pending = state.queue.filter((e) => e.requestedById === by.id).length;
    if (pending >= state.settings.maxPendingPerRider) {
      return same(state, [], `Tienes ${pending} canciones en espera. Espera a que suene una.`);
    }
  }

  const stamped: Track = { ...track, addedBy: by.name };
  if (!ctx.current) {
    // Nada sonando: suena ya, sin pasar por la cola.
    return { state, effects: [{ type: 'play', track: stamped, requestedBy: by.name }], changed: false };
  }

  const entry: QueueEntry = {
    queueId: newId('q_'),
    track: stamped,
    requestedBy: by.name,
    requestedById: by.id,
    requestedAt: ctx.now,
    autopilot,
    votes: autopilot ? {} : { [by.id]: 1 },
  };
  return { state: bump(state, { queue: sortQueue([...state.queue, entry]) }), effects: [], changed: true };
}

export function applyVote(state: EngineState, voterId: string, queueId: string, value: -1 | 0 | 1): ApplyResult {
  const entry = state.queue.find((e) => e.queueId === queueId);
  if (!entry) return same(state, [], 'Esa canción ya no está en la cola');
  const prev = entry.votes[voterId] ?? 0;
  if (prev === value) return same(state);

  const votes = { ...entry.votes };
  if (value === 0) delete votes[voterId];
  else votes[voterId] = value;
  const updated = { ...entry, votes };

  const downs = Object.values(votes).filter((v) => v === -1).length;
  if (scoreOf(updated) < 0 && downs >= vetoThreshold(state)) {
    const queue = state.queue.filter((e) => e.queueId !== queueId);
    return { state: bump(state, { queue }), effects: [], changed: true, notice: `«${entry.track.title}» salió de la cola por votación` };
  }
  const queue = sortQueue(state.queue.map((e) => (e.queueId === queueId ? updated : e)));
  return { state: bump(state, { queue }), effects: [], changed: true };
}

/** Aplica una intención de un pasajero. Idempotente para hello/vote; la deduplicación por id la hace la sesión. */
export function applyIntent(state: EngineState, env: Envelope, ctx: ApplyContext): ApplyResult {
  const { intent } = env;

  // Cualquier mensaje cuenta como señal de vida.
  let base = state;
  const known = state.riders[env.from];
  if (known && intent.kind !== 'bye') {
    base = { ...state, riders: { ...state.riders, [env.from]: { ...known, lastSeen: ctx.now } } };
  }

  switch (intent.kind) {
    case 'hello': {
      const prev = base.riders[env.from];
      const riders = { ...base.riders, [env.from]: { name: intent.name, lastSeen: ctx.now } };
      const changed = !prev || prev.name !== intent.name;
      return { state: changed ? bump(base, { riders }) : { ...base, riders }, effects: [], changed };
    }
    case 'bye': {
      if (!base.riders[env.from]) return same(base);
      const riders = { ...base.riders };
      delete riders[env.from];
      return { state: bump(base, { riders }), effects: [], changed: true };
    }
    case 'request': {
      // Un pasajero que pide sin haber saludado (por ejemplo tras recargar) queda registrado.
      const withRider = base.riders[env.from]
        ? base
        : bump(base, { riders: { ...base.riders, [env.from]: { name: env.name, lastSeen: ctx.now } } });
      const res = requestTrack(withRider, intent.track, { id: env.from, name: env.name }, ctx);
      return { ...res, changed: res.changed || withRider !== base };
    }
    case 'vote':
      return applyVote(base, env.from, intent.queueId, intent.value);
    case 'control':
      if (!base.settings.passengerControl) return same(base, [], 'El conductor desactivó el control de los pasajeros');
      return same(base, [{ type: intent.action }]);
    case 'play_now': {
      if (!base.settings.passengerPlayNow) return same(base, [], 'El conductor no permite «Sonar ya» a los pasajeros');
      if (intent.queueId) {
        const taken = takeEntry(base, intent.queueId);
        if (!taken.entry) return same(base, [], 'Esa canción ya no está en la cola');
        return { state: taken.state, effects: [{ type: 'play', track: taken.entry.track, requestedBy: taken.entry.requestedBy }], changed: true };
      }
      if (!intent.track) return same(base);
      const who = base.riders[env.from]?.name ?? env.name;
      return { state: bump(base, {}), effects: [{ type: 'play', track: intent.track, requestedBy: who }], changed: true };
    }
    default:
      return same(base);
  }
}

// ------------------------------------------------------------ acciones del carro

export function takeNext(state: EngineState): { state: EngineState; entry: QueueEntry | null } {
  const [entry, ...rest] = state.queue;
  if (!entry) return { state, entry: null };
  return { state: bump(state, { queue: rest }), entry };
}

export function takeEntry(state: EngineState, queueId: string): { state: EngineState; entry: QueueEntry | null } {
  const entry = state.queue.find((e) => e.queueId === queueId) ?? null;
  if (!entry) return { state, entry: null };
  return { state: bump(state, { queue: state.queue.filter((e) => e !== entry) }), entry };
}

export function removeEntry(state: EngineState, queueId: string): EngineState {
  return takeEntry(state, queueId).state;
}

export function clearQueue(state: EngineState): EngineState {
  return state.queue.length ? bump(state, { queue: [] }) : state;
}

export function hasAutopilotEntry(state: EngineState): boolean {
  return state.queue.some((e) => e.autopilot);
}

export function pushHistory(state: EngineState, track: Track): EngineState {
  const history = [track, ...state.history.filter((t) => !sameTrack(t, track))].slice(0, HISTORY_SIZE);
  return bump(state, { history });
}

export function popHistory(state: EngineState): { state: EngineState; track: Track | null } {
  const [track, ...rest] = state.history;
  if (!track) return { state, track: null };
  return { state: bump(state, { history: rest }), track };
}

export function pruneRiders(state: EngineState, now: number, timeoutMs = RIDER_TIMEOUT_MS): EngineState {
  const riders: Record<string, RiderPresence> = {};
  let removed = 0;
  for (const [id, r] of Object.entries(state.riders)) {
    if (now - r.lastSeen <= timeoutMs) riders[id] = r;
    else removed++;
  }
  return removed ? bump(state, { riders }) : state;
}

export function updateSettings(state: EngineState, patch: Partial<RoomSettings>): EngineState {
  return bump(state, { settings: { ...state.settings, ...patch } });
}

/**
 * `rev` lo pone la sesión del carro y no el motor: la foto también cambia cuando cambia lo que
 * suena, y eso lo decide el reproductor, no el motor.
 */
export function toSnapshot(
  state: EngineState,
  now: NowPlaying | null,
  sentAt: number,
  rev: number,
  closed = false,
  notices: Notice[] = [],
): Snapshot {
  return {
    v: PROTOCOL_VERSION,
    room: state.room,
    name: state.name,
    rev,
    sentAt,
    now,
    queue: state.queue,
    history: state.history,
    riders: Object.entries(state.riders).map(([id, r]) => ({ id, name: r.name })),
    settings: state.settings,
    notices,
    closed,
  };
}
