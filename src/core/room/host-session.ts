// Sesión del carro: la única fuente de verdad de la sala.
// Recibe intenciones por cualquier canal, las aplica UNA vez (dedupe por id), manda al
// reproductor lo que toca y publica la foto por todos los canales.

import {
  applyIntent,
  clearQueue,
  createEngine,
  hasAutopilotEntry,
  popHistory,
  pruneRiders,
  pushHistory,
  removeEntry,
  requestTrack,
  takeEntry,
  takeNext,
  toSnapshot,
  updateSettings,
  AUTOPILOT_ID,
  HOST_ID,
  type Effect,
  type EngineState,
} from '../../../shared/room-engine';
import {
  LIBRARY_MAX,
  newId,
  type Envelope,
  type LibraryIndex,
  type Notice,
  type NowPlaying,
  type RoomSettings,
  type Snapshot,
  type WireMessage,
} from '../../../shared/protocol';
import { generateRoomCode } from '../../../shared/room-code';
import type { Track } from '../../../shared/track';
import type { PlayerState } from '../../types/player.types';
import { Autopilot, type AutopilotMode } from '../autopilot';
import { getRoomWsUrl } from '../network/api-config';
import { getClientId, getHostToken, forgetHostToken, setLastHostRoom } from './identity';
import { createHostP2P, createLanLink, createLocalLink, type Link, type LinkKind, type LinkStatus } from './links';
import { relay, RelayError } from './relay-client';
import { forgetHostState, loadHostState, saveHostState } from './host-store';

export interface PlayerPort {
  getState(): PlayerState;
  load(track: Track, autoplay: boolean, startAt?: number): void;
  toggle(): void;
  pause(): void;
  seek(seconds: number): void;
  subscribe(cb: (s: PlayerState) => void): () => void;
  onEnded(cb: () => void): void;
}

export type CloudStatus = 'connecting' | 'online' | 'offline' | 'error';

export interface HostView {
  room: string;
  engine: EngineState;
  now: NowPlaying | null;
  autopilot: AutopilotMode;
  autopilotBusy: boolean;
  cloud: CloudStatus;
  links: Record<LinkKind, LinkStatus>;
  p2pPeers: number;
  /** Últimos avisos generados por el carro (para mostrarlos también en su pantalla). */
  notices: Notice[];
  closed: boolean;
}

interface Options {
  room?: string;
  name: string;
  player: PlayerPort;
  autopilot?: AutopilotMode;
  /** Música guardada en el carro, para el piloto automático. */
  getLocalLibrary?: () => Track[];
  /** Canales a usar (por defecto todos). Sirve para pruebas y para forzar sólo HTTP. */
  channels?: Partial<Record<LinkKind | 'http', boolean>>;
}

const HTTP_FAST_MS = 1500;
const HTTP_SLOW_MS = 5000;
const HTTP_FAST_WINDOW_MS = 60_000;
const HTTP_KEEPALIVE_MS = 40_000;
const LINK_KEEPALIVE_MS = 10_000;
const NOTICE_TTL_MS = 20_000;
const SEEN_MAX = 600;
/** Cada cuánto se guarda la posición de la canción (lo demás se guarda al cambiar). */
const SAVE_POSITION_MS = 5000;

export class HostSession {
  private engine: EngineState;
  private room: string;
  private token: string;
  private links: Link[] = [];
  private seen = new Set<string>();
  private listeners = new Set<() => void>();
  private view: HostView;
  private notices: Notice[] = [];
  private nowRequestedBy: string | undefined;
  private rev = Date.now(); // monotónico aunque el carro recargue la página
  private lastSignature = '';
  private seekMark = 0;
  private latest: Snapshot | null = null;
  private httpDirty = true;
  private lastHttpUpload = 0;
  private httpFastUntil = 0;
  private httpTimer: ReturnType<typeof setTimeout> | null = null;
  private timers: ReturnType<typeof setInterval>[] = [];
  private unsubPlayer: (() => void) | null = null;
  private cloud: CloudStatus = 'connecting';
  private autopilotMode: AutopilotMode;
  private autopilot = new Autopilot();
  private autopilotBusy = false;
  private autopilotTriedFor = '';
  private lastPlayer: PlayerState;
  private library: LibraryIndex | null = null;
  private httpLibraryDirty = false;
  private librarySignature: string | null = null;
  private closed = false;
  private disposed = false;
  private restored: { track: Track; position: number; requestedBy?: string } | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly opts: Options) {
    this.room = opts.room ?? generateRoomCode();
    this.token = getHostToken(this.room);
    this.engine = createEngine(this.room, opts.name);
    this.autopilotMode = opts.autopilot ?? 'hybrid';
    // Misma sala tras recargar: vuelve la cola, el historial, las reglas y la canción. Los
    // pasajeros no: se reconectan solos y reaparecen con su primer saludo.
    const saved = opts.room ? loadHostState(opts.room) : null;
    if (saved) {
      this.engine = { ...this.engine, rev: saved.rev, queue: saved.queue, history: saved.history, settings: saved.settings };
      this.autopilotMode = saved.autopilot;
      this.restored = saved.now;
    }
    this.lastPlayer = opts.player.getState();
    this.view = this.buildView();
  }

  // ------------------------------------------------------------ ciclo de vida

  async start(): Promise<void> {
    await this.claim();
    if (this.disposed) return;
    setLastHostRoom(this.room);
    this.openLinks();
    this.unsubPlayer = this.opts.player.subscribe((s) => this.onPlayer(s));
    this.opts.player.onEnded(() => this.next());
    if (this.restored && !this.lastPlayer.currentTrack) {
      // En pausa: el navegador no deja sonar sin un toque, y que suene sola al recargar asusta.
      const { track, position, requestedBy } = this.restored;
      this.nowRequestedBy = requestedBy;
      this.opts.player.load(this.playable(track), false, position);
    }
    this.restored = null;
    this.timers.push(
      setInterval(() => this.broadcast(true), LINK_KEEPALIVE_MS),
      setInterval(() => {
        const pruned = pruneRiders(this.engine, Date.now());
        if (pruned !== this.engine) this.commit(pruned);
      }, 10_000),
    );
    this.scheduleHttp(50);
    this.publish();
  }

  /** Reserva el código en la nube. Si está ocupado, genera otro. Sin red, sigue en local. */
  private async claim(): Promise<void> {
    if (this.opts.channels?.http === false) {
      this.cloud = 'offline';
      return;
    }
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        await relay.claim(this.room, this.token, this.opts.name);
        this.cloud = 'online';
        return;
      } catch (err) {
        if (err instanceof RelayError && err.status === 409) {
          forgetHostToken(this.room);
          this.room = generateRoomCode();
          this.token = getHostToken(this.room);
          this.engine = { ...this.engine, room: this.room };
          this.save();
          continue;
        }
        // Sin conexión con el relé: la sala sigue por P2P / red local.
        this.cloud = 'offline';
        return;
      }
    }
    this.cloud = 'error';
  }

  private openLinks(): void {
    const events = {
      onMessage: (msg: WireMessage, via: LinkKind) => {
        if (msg.t === 'intent') this.receive(msg.e, via);
      },
      onStatus: () => this.emit(),
      onPeerOpen: (send: (m: WireMessage) => void) => {
        if (this.latest) send({ t: 'snapshot', s: this.latest });
        if (this.library) send({ t: 'library', l: this.library });
      },
    };
    const on = (k: LinkKind) => this.opts.channels?.[k] !== false;
    if (on('p2p')) this.links.push(createHostP2P(this.room, events));
    const ws = getRoomWsUrl();
    if (ws && on('lan')) this.links.push(createLanLink(ws, { room: this.room, role: 'host', client: getClientId(), token: this.token }, events));
    if (on('local')) this.links.push(createLocalLink(this.room, 'host', events));
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.opts.player.pause();
    this.publish(true);
    this.broadcast(true);
    try {
      await relay.close(this.room, this.token);
    } catch {
      /* si no hay red, la sala caduca sola en 2 min */
    }
    forgetHostToken(this.room);
    forgetHostState(this.room);
    setLastHostRoom(null);
    this.dispose();
  }

  /** Cierre de pestaña: el beacon sobrevive a la navegación. */
  closeOnUnload(): void {
    if (this.closed) return;
    this.save();
    relay.closeBeacon(this.room, this.token);
  }

  dispose(): void {
    if (!this.closed && !this.disposed) this.save();
    this.disposed = true;
    if (this.httpTimer) clearTimeout(this.httpTimer);
    if (this.saveTimer) clearTimeout(this.saveTimer);
    for (const t of this.timers) clearInterval(t);
    this.unsubPlayer?.();
    for (const l of this.links) l.close();
    this.links = [];
    this.emit();
  }

  // ----------------------------------------------------------- store de React

  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };

  getView = (): HostView => this.view;

  private buildView(): HostView {
    const status = (k: LinkKind): LinkStatus => this.links.find((l) => l.kind === k)?.status() ?? 'off';
    return {
      room: this.room,
      engine: this.engine,
      now: this.nowPlaying(),
      autopilot: this.autopilotMode,
      autopilotBusy: this.autopilotBusy,
      cloud: this.cloud,
      links: { p2p: status('p2p'), lan: status('lan'), local: status('local') },
      p2pPeers: this.links.find((l) => l.kind === 'p2p')?.peerCount() ?? 0,
      notices: this.notices,
      closed: this.closed,
    };
  }

  private emit(): void {
    this.view = this.buildView();
    for (const l of this.listeners) l();
  }

  // ------------------------------------------------------- biblioteca del carro

  /** Llamar cuando cambie la música guardada en el carro: los pasajeros ven el índice. */
  libraryChanged(): void {
    const tracks = (this.opts.getLocalLibrary?.() ?? []).filter((t) => t.source === 'local_car').slice(0, LIBRARY_MAX);
    // Sólo si cambió la lista (no por favoritas, historial o progreso de importación).
    const signature = tracks.map((t) => `${t.id}:${t.duration}`).join(',');
    if (signature === this.librarySignature) return;
    this.librarySignature = signature;
    this.library = {
      room: this.room,
      rev: (this.library?.rev ?? Date.now()) + 1,
      items: tracks.map((t) => ({ id: t.id, title: t.title, artist: t.artist, duration: t.duration })),
    };
    this.httpLibraryDirty = true;
    for (const l of this.links) l.send({ t: 'library', l: this.library });
    this.publish();
  }

  private resolveLocal(id: string): Track | null {
    return (this.opts.getLocalLibrary?.() ?? []).find((t) => t.id === id) ?? null;
  }

  /** Las canciones del carro llevan una URL blob que muere al recargar: se piden de nuevo a la biblioteca. */
  private playable(track: Track): Track {
    return track.source === 'local_car' ? (this.resolveLocal(track.id) ?? track) : track;
  }

  /** Guarda ya (antes de cerrar) o agrupado en un instante (los cambios llegan en ráfagas). */
  private save(): void {
    if (this.closed) return;
    const s = this.lastPlayer;
    const now = this.restored ?? (s.currentTrack ? { track: s.currentTrack, position: s.currentTime || 0, requestedBy: this.nowRequestedBy } : null);
    const e = this.engine;
    saveHostState(this.room, { rev: e.rev, queue: e.queue, history: e.history, settings: e.settings, autopilot: this.autopilotMode, now });
  }

  private saveSoon(): void {
    if (this.saveTimer || this.disposed) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.save();
    }, 400);
  }

  // ------------------------------------------------------------ intenciones

  private receive(env: Envelope, via: LinkKind | 'http'): void {
    if (this.closed || env.room !== this.room || this.seen.has(env.id)) return;
    this.seen.add(env.id);
    if (this.seen.size > SEEN_MAX) this.seen.delete(this.seen.values().next().value as string);
    if (via === 'http') this.httpFastUntil = Date.now() + HTTP_FAST_WINDOW_MS;

    // Una canción del carro llega sólo con su id: se cambia por la pista real (con su URL local).
    if (env.intent.kind === 'request' && env.intent.track.source === 'local_car') {
      const real = this.resolveLocal(env.intent.track.id);
      if (!real && !env.intent.track.audioUrl?.startsWith('data:')) {
        this.notify(env.from, 'Esa canción ya no está en el carro');
        this.publish();
        return;
      }
      env = { ...env, intent: { kind: 'request', track: real ?? env.intent.track, playNow: env.intent.playNow } };
    }

    const res = applyIntent(this.engine, env, { now: Date.now(), current: this.lastPlayer.currentTrack });
    if (res.notice) this.notify(env.from, res.notice);
    this.engine = res.state;
    for (const e of res.effects) this.run(e);
    if (res.changed || res.notice) this.publish();
    else this.emit();
    this.maybeAutopilot();
  }

  /** Aviso a todos (también se ve en la pantalla del carro). */
  announce(text: string): void {
    this.notify('*', text);
    this.publish();
  }

  private notify(to: string, text: string): void {
    const now = Date.now();
    this.notices = [{ id: newId('n_'), to, text, at: now }, ...this.notices.filter((n) => now - n.at < NOTICE_TTL_MS)].slice(0, 12);
  }

  private run(effect: Effect): void {
    if (effect.type === 'play') this.startTrack(effect.track, effect.requestedBy);
    else if (effect.type === 'toggle') this.opts.player.toggle();
    else if (effect.type === 'next') this.next();
    else if (effect.type === 'prev') this.prev();
  }

  private commit(state: EngineState): void {
    this.engine = state;
    this.publish();
  }

  // -------------------------------------------------------------- reproductor

  private startTrack(track: Track, requestedBy?: string, recordHistory = true): void {
    const current = this.lastPlayer.currentTrack;
    if (current && recordHistory) this.engine = pushHistory(this.engine, current);
    this.nowRequestedBy = requestedBy;
    this.autopilot.remember(track);
    this.opts.player.load(this.playable(track), true);
    this.publish();
  }

  next(): void {
    const { state, entry } = takeNext(this.engine);
    if (entry) {
      this.engine = state;
      this.startTrack(entry.track, entry.requestedBy);
      return;
    }
    // Cola vacía: el piloto automático busca una; si no hay, se para.
    const current = this.lastPlayer.currentTrack;
    if (current && this.autopilotMode !== 'off') {
      this.fillAutopilot(true);
      return;
    }
    this.opts.player.pause();
    this.notify('*', 'La cola está vacía');
    this.publish();
  }

  prev(): void {
    // Como en cualquier reproductor: si ya avanzó, vuelve al principio.
    if (this.lastPlayer.currentTime > 6) {
      this.opts.player.seek(0);
      return;
    }
    const { state, track } = popHistory(this.engine);
    if (!track) {
      this.opts.player.seek(0);
      return;
    }
    this.engine = state;
    const current = this.lastPlayer.currentTrack;
    if (current) {
      // La que sonaba vuelve a la cola, para no perderla.
      this.engine = requestTrack(this.engine, current, { id: HOST_ID, name: 'Conductor' }, { now: Date.now(), current: track }).state;
    }
    this.startTrack(track, undefined, false);
  }

  private onPlayer(s: PlayerState): void {
    const prev = this.lastPlayer;
    this.lastPlayer = s;
    const trackChanged = prev.currentTrack?.id !== s.currentTrack?.id;
    const toggled = prev.isPlaying !== s.isPlaying;
    const jumped = Math.abs(s.currentTime - prev.currentTime) > 3 && !trackChanged;
    // Cualquier cambio de la duración real (no sólo la primera vez): YouTube corrige la
    // estimada de la búsqueda y los pasajeros veían la barra con la duración vieja.
    const durationChanged = s.duration > 0 && Math.round(s.duration) !== Math.round(prev.duration);
    if (jumped) this.seekMark++;
    if (trackChanged || toggled || jumped || durationChanged) this.publish();
    const tick = SAVE_POSITION_MS / 1000;
    if (Math.floor(s.currentTime / tick) !== Math.floor(prev.currentTime / tick)) this.saveSoon();
    else this.emit();
    this.maybeAutopilot();
  }

  private nowPlaying(): NowPlaying | null {
    const s = this.lastPlayer;
    if (!s.currentTrack) return null;
    return {
      track: s.currentTrack,
      isPlaying: s.isPlaying,
      position: Math.max(0, s.currentTime || 0),
      duration: s.duration || s.currentTrack.duration || 0,
      requestedBy: this.nowRequestedBy,
    };
  }

  // ------------------------------------------------------ piloto automático

  private maybeAutopilot(): void {
    const s = this.lastPlayer;
    if (this.autopilotMode === 'off' || !s.currentTrack || this.autopilotBusy || hasAutopilotEntry(this.engine)) return;
    if (this.engine.queue.length > 0) return;
    // Una sola búsqueda por canción, cuando falta poco o en cuanto la cola queda vacía.
    if (this.autopilotTriedFor === s.currentTrack.id) return;
    const remaining = (s.duration || s.currentTrack.duration || 0) - s.currentTime;
    if (remaining > 60 && s.currentTime < 5) {
      this.fillAutopilot(false);
      return;
    }
    if (remaining <= 60) this.fillAutopilot(false);
  }

  private async fillAutopilot(playWhenFound: boolean): Promise<void> {
    const current = this.lastPlayer.currentTrack;
    if (!current || this.autopilotBusy) return;
    this.autopilotBusy = true;
    this.autopilotTriedFor = current.id;
    this.emit();
    const avoid = [current, ...this.engine.queue.map((e) => e.track), ...this.engine.history];
    const pick = await this.autopilot.next(this.autopilotMode, current, avoid, this.opts.getLocalLibrary?.() ?? []);
    this.autopilotBusy = false;
    if (this.disposed) return;
    if (!pick) {
      if (playWhenFound) {
        this.opts.player.pause();
        this.notify('*', 'La cola está vacía');
      }
      this.publish();
      return;
    }
    if (playWhenFound) {
      this.startTrack({ ...pick, addedBy: 'Piloto automático' }, 'Piloto automático');
      return;
    }
    const res = requestTrack(this.engine, pick, { id: AUTOPILOT_ID, name: 'Piloto automático' }, { now: Date.now(), current }, { autopilot: true });
    this.engine = res.state;
    this.publish();
  }

  // ------------------------------------------------------- acciones del carro

  /** El conductor pide una canción: suena ya si no hay nada, si no va a la cola. */
  request(track: Track): string | undefined {
    const res = requestTrack(this.engine, track, { id: HOST_ID, name: 'Conductor' }, { now: Date.now(), current: this.lastPlayer.currentTrack });
    this.engine = res.state;
    for (const e of res.effects) this.run(e);
    this.publish();
    return res.notice;
  }

  playNow(queueId: string): void {
    const { state, entry } = takeEntry(this.engine, queueId);
    if (!entry) return;
    this.engine = state;
    this.startTrack(entry.track, entry.requestedBy);
  }

  playTrackNow(track: Track): void {
    this.startTrack(track, 'Conductor');
  }

  remove(queueId: string): void {
    this.commit(removeEntry(this.engine, queueId));
  }

  clear(): void {
    this.commit(clearQueue(this.engine));
  }

  toggle(): void {
    this.opts.player.toggle();
  }

  setSettings(patch: Partial<RoomSettings>): void {
    this.commit(updateSettings(this.engine, patch));
  }

  setAutopilot(mode: AutopilotMode): void {
    this.autopilotMode = mode;
    this.autopilotTriedFor = '';
    if (mode === 'off') this.engine = { ...this.engine, queue: this.engine.queue.filter((e) => !e.autopilot) };
    this.publish();
    this.maybeAutopilot();
  }

  // ---------------------------------------------------------------- publicar

  private publish(closed = this.closed): void {
    const now = this.nowPlaying();
    const t = Date.now();
    const notices = this.notices.filter((n) => t - n.at < NOTICE_TTL_MS);
    const signature = JSON.stringify([
      this.engine.rev,
      now?.track.id,
      now?.isPlaying,
      Math.round(now?.duration ?? 0),
      // La posición NO entra: los pasajeros la extrapolan. Si entrara, cada pocos segundos
      // habría una foto nueva y una subida HTTP (comandos de Upstash) sin que cambie nada.
      this.seekMark,
      notices.map((n) => n.id),
      closed,
    ]);
    if (signature !== this.lastSignature) {
      this.lastSignature = signature;
      this.rev++;
      this.httpDirty = true;
    }
    this.latest = { ...toSnapshot(this.engine, now, t, this.rev, closed, notices), libraryRev: this.library?.rev ?? 0 };
    this.saveSoon();
    this.broadcast(false);
    if (this.httpDirty && t - this.lastHttpUpload > HTTP_FAST_MS) this.scheduleHttp(250);
    this.emit();
  }

  /** P2P, red local y pestañas. Gratis: se manda siempre, también como latido. */
  private broadcast(refresh: boolean): void {
    if (!this.latest) return;
    if (refresh) this.latest = { ...this.latest, sentAt: Date.now(), now: this.nowPlaying() };
    const msg: WireMessage = { t: 'snapshot', s: this.latest };
    for (const l of this.links) l.send(msg);
  }

  // -------------------------------------------------------------- relé HTTP

  private scheduleHttp(delay?: number): void {
    if (this.disposed || this.closed || this.opts.channels?.http === false) return;
    if (this.httpTimer) clearTimeout(this.httpTimer);
    const wait = delay ?? (Date.now() < this.httpFastUntil ? HTTP_FAST_MS : HTTP_SLOW_MS);
    this.httpTimer = setTimeout(() => void this.httpTick(), wait);
  }

  private async httpTick(): Promise<void> {
    this.httpTimer = null;
    if (this.disposed || this.closed) return;
    const t = Date.now();
    const upload = this.httpDirty || t - this.lastHttpUpload > HTTP_KEEPALIVE_MS;
    let snapshot: Snapshot | undefined;
    if (upload && this.latest) {
      snapshot = { ...this.latest, sentAt: t, now: this.nowPlaying() };
      this.httpDirty = false;
    }
    const library = this.httpLibraryDirty && this.library ? this.library : undefined;
    this.httpLibraryDirty = false;
    try {
      const res = await relay.sync(this.room, this.token, snapshot, library);
      if (snapshot) this.lastHttpUpload = t;
      if (this.cloud !== 'online') {
        this.cloud = 'online';
        this.emit();
      }
      for (const e of res.intents) this.receive(e, 'http');
      this.scheduleHttp();
    } catch (err) {
      if (snapshot) this.httpDirty = true;
      if (library) this.httpLibraryDirty = true;
      if (err instanceof RelayError && err.status === 404) {
        // La sala caducó (p. ej. túnel sin señal > 2 min): se vuelve a reservar el mismo código.
        try {
          await relay.claim(this.room, this.token, this.opts.name);
          this.httpDirty = true;
          this.scheduleHttp(200);
          return;
        } catch {
          /* sigue offline */
        }
      }
      this.cloud = err instanceof RelayError && err.status === 403 ? 'error' : 'offline';
      this.emit();
      this.scheduleHttp(10_000);
    }
  }
}
