// Sesión del pasajero: manda intenciones al carro y pinta la última foto que recibe.
// No modifica el estado por su cuenta (salvo marcar "enviando..." mientras llega la foto).
//
// El estado de conexión es real. En la v1 la pantalla decía "CONECTADO" aunque el carro no
// existiera (medido con una sala inventada).

import {
  newId,
  type ControlAction,
  type Envelope,
  type Intent,
  type LibraryIndex,
  type Notice,
  type Snapshot,
  type VoteValue,
  type WireMessage,
} from '../../../shared/protocol';
import { trackKey, type Track } from '../../../shared/track';
import { getRoomWsUrl } from '../network/api-config';
import { getClientId, setLastRiderRoom } from './identity';
import { createLanLink, createLocalLink, createRiderP2P, type Link, type LinkKind } from './links';
import { relay, RelayError } from './relay-client';

export type RiderStatus = 'connecting' | 'live' | 'reconnecting' | 'not-found' | 'closed';
export type Via = LinkKind | 'http';

export interface RiderView {
  room: string;
  me: string;
  name: string;
  status: RiderStatus;
  via: Via | null;
  snapshot: Snapshot | null;
  /** Momento (reloj local) en que llegó la foto: para extrapolar la posición. */
  receivedAt: number;
  /** Canciones pedidas que aún no aparecen en la foto. */
  pending: string[];
  toasts: Notice[];
  library: LibraryIndex | null;
}

/** El carro manda foto por P2P cada 10 s y por HTTP al menos cada 40 s. */
const LIVE_WINDOW_MS = 25_000;
const LIVE_WINDOW_HTTP_MS = 70_000;
const NOT_FOUND_AFTER_MS = 9_000;
const HELLO_LINK_MS = 10_000;
const HELLO_HTTP_MS = 25_000;
/** Tras enviar algo o recibir un cambio, se consulta rápido un rato; luego se espacia. */
const HTTP_ACTIVE_WINDOW_MS = 20_000;

export class RiderSession {
  private me = getClientId();
  private links: Link[] = [];
  private listeners = new Set<() => void>();
  private view: RiderView;
  private snapshot: Snapshot | null = null;
  private receivedAt = 0;
  /** Última señal de vida del carro (foto o "sin cambios" del relé). Distinto de receivedAt,
   * que es la base para extrapolar la posición y sólo cambia con una foto nueva. */
  private aliveAt = 0;
  private via: Via | null = null;
  private startedAt = Date.now();
  private httpSaysMissing = false;
  private closed = false;
  private pending = new Map<string, number>();
  private seenNotices = new Set<string>();
  private toasts: Notice[] = [];
  private library: LibraryIndex | null = null;
  private libraryFetching = false;
  private lastHello = 0;
  private activeUntil = 0;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private tick: ReturnType<typeof setInterval> | null = null;
  private disposed = false;

  constructor(
    readonly room: string,
    private name: string,
    /** Canales a usar (por defecto todos). Para pruebas y para forzar sólo HTTP. */
    private readonly channels: Partial<Record<LinkKind | 'http', boolean>> = {},
    /** Id de dispositivo: sólo se cambia en pruebas con varios pasajeros en una página. */
    clientId?: string,
  ) {
    if (clientId) this.me = clientId;
    this.view = this.buildView();
  }

  start(): void {
    setLastRiderRoom(this.room);
    const events = {
      onMessage: (msg: WireMessage, via: LinkKind) => {
        if (msg.t === 'snapshot') this.accept(msg.s, via);
        else if (msg.t === 'library') this.acceptLibrary(msg.l);
      },
      onStatus: () => {
        // Al abrir un canal directo se saluda por él enseguida.
        if (this.directOpen()) this.hello(true);
        this.emit();
      },
    };
    const on = (k: LinkKind) => this.channels[k] !== false;
    if (on('p2p')) this.links.push(createRiderP2P(this.room, events));
    const ws = getRoomWsUrl();
    if (ws && on('lan')) this.links.push(createLanLink(ws, { room: this.room, role: 'rider', client: this.me }, events));
    if (on('local')) this.links.push(createLocalLink(this.room, 'rider', events));
    this.hello(true);
    this.poll(100);
    this.tick = setInterval(() => {
      this.hello(false);
      this.emit(); // recalcula el estado (por ejemplo, de "live" a "reconnecting")
    }, 2000);
  }

  dispose(): void {
    this.disposed = true;
    if (this.pollTimer) clearTimeout(this.pollTimer);
    if (this.tick) clearInterval(this.tick);
    for (const l of this.links) l.close();
    this.links = [];
  }

  leave(): void {
    this.send({ kind: 'bye' });
    setLastRiderRoom(null);
    this.dispose();
  }

  // -------------------------------------------------------------- store

  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };

  getView = (): RiderView => this.view;

  private status(): RiderStatus {
    if (this.closed) return 'closed';
    const age = Date.now() - this.aliveAt;
    const window = this.via === 'http' ? LIVE_WINDOW_HTTP_MS : LIVE_WINDOW_MS;
    if (this.snapshot) return age < window ? 'live' : 'reconnecting';
    if (this.httpSaysMissing && Date.now() - this.startedAt > NOT_FOUND_AFTER_MS) return 'not-found';
    return 'connecting';
  }

  private buildView(): RiderView {
    return {
      room: this.room,
      me: this.me,
      name: this.name,
      status: this.status(),
      via: this.via,
      snapshot: this.snapshot,
      receivedAt: this.receivedAt,
      pending: [...this.pending.keys()],
      toasts: this.toasts,
      library: this.library,
    };
  }

  private emit(): void {
    const next = this.buildView();
    const v = this.view;
    // Evita renders inútiles cada 2 s si nada cambió.
    if (
      v.status === next.status &&
      v.snapshot === next.snapshot &&
      v.via === next.via &&
      v.pending.length === next.pending.length &&
      v.toasts === next.toasts &&
      v.library === next.library &&
      v.name === next.name
    ) {
      return;
    }
    this.view = next;
    for (const l of this.listeners) l();
  }

  /** Posición estimada de la canción ahora mismo. */
  position(): number {
    const now = this.snapshot?.now;
    if (!now) return 0;
    const extra = now.isPlaying ? (Date.now() - this.receivedAt) / 1000 : 0;
    return Math.min(now.duration || Infinity, now.position + extra);
  }

  // ------------------------------------------------------------- recibir

  private accept(s: Snapshot, via: Via): void {
    if (s.room !== this.room) return;
    const cur = this.snapshot;
    // Una foto vieja que llega tarde por otro canal no pisa la buena.
    if (cur && s.rev < cur.rev) return;
    const isNewer = !cur || s.rev > cur.rev || s.sentAt > cur.sentAt;
    if (!isNewer) return;
    this.snapshot = s;
    this.receivedAt = Date.now();
    this.aliveAt = this.receivedAt;
    this.via = via;
    this.httpSaysMissing = false;
    this.activeUntil = Date.now() + HTTP_ACTIVE_WINDOW_MS;
    if (s.closed) this.closed = true;

    // Pendientes resueltas: ya están en la cola o sonando.
    const present = new Set([...s.queue.map((e) => trackKey(e.track)), ...(s.now ? [trackKey(s.now.track)] : [])]);
    for (const [k, at] of this.pending) if (present.has(k) || Date.now() - at > 20_000) this.pending.delete(k);

    // Avisos para mí.
    const fresh = s.notices.filter((n) => (n.to === this.me || n.to === '*') && !this.seenNotices.has(n.id));
    if (fresh.length) {
      for (const n of fresh) this.seenNotices.add(n.id);
      // Si me rechazaron una petición, deja de estar "enviando".
      if (fresh.some((n) => n.to === this.me)) this.pending.clear();
      this.toasts = [...fresh, ...this.toasts].slice(0, 4);
    }
    void this.maybeFetchLibrary(s);
    this.emit();
  }

  private acceptLibrary(l: LibraryIndex): void {
    if (l.room !== this.room || (this.library && l.rev <= this.library.rev)) return;
    this.library = l;
    this.emit();
  }

  /** Si la foto anuncia una biblioteca más nueva y no llegó por P2P, se pide al relé. */
  private async maybeFetchLibrary(s: Snapshot): Promise<void> {
    const want = s.libraryRev ?? 0;
    if (!want || this.libraryFetching || (this.library && this.library.rev >= want) || this.channels.http === false) return;
    if (this.directOpen()) return; // llegará por el canal directo
    this.libraryFetching = true;
    try {
      const r = await relay.library(this.room);
      if (r.library) this.acceptLibrary(r.library);
    } catch {
      /* se reintenta con la próxima foto */
    } finally {
      this.libraryFetching = false;
    }
  }

  dismissToast(id: string): void {
    this.toasts = this.toasts.filter((t) => t.id !== id);
    this.emit();
  }

  // -------------------------------------------------------------- enviar

  private directOpen(): Link | undefined {
    return this.links.find((l) => (l.kind === 'p2p' || l.kind === 'lan') && l.status() === 'open');
  }

  private envelope(intent: Intent): Envelope {
    return { id: newId('e_'), room: this.room, from: this.me, name: this.name || 'Pasajero', at: Date.now(), intent };
  }

  /** Por el mejor canal disponible: P2P/LAN si están abiertos; si no, HTTP. */
  private async send(intent: Intent): Promise<boolean> {
    if (this.disposed && intent.kind !== 'bye') return false;
    const e = this.envelope(intent);
    const msg: WireMessage = { t: 'intent', e };
    for (const l of this.links) if (l.kind === 'local') l.send(msg);
    const direct = this.directOpen();
    if (direct?.send(msg)) return true;
    if (this.channels.http === false) return false;
    try {
      await relay.push(e);
      // La respuesta del carro llega en ~1-2 s: se adelanta la próxima consulta.
      if (intent.kind !== 'hello' && intent.kind !== 'bye') {
        this.activeUntil = Date.now() + HTTP_ACTIVE_WINDOW_MS;
        this.poll(900);
      }
      return true;
    } catch (err) {
      if (err instanceof RelayError && err.status === 410) {
        this.closed = true;
        this.emit();
      }
      return false;
    }
  }

  private hello(force: boolean): void {
    const every = this.directOpen() ? HELLO_LINK_MS : HELLO_HTTP_MS;
    if (!force && Date.now() - this.lastHello < every) return;
    this.lastHello = Date.now();
    void this.send({ kind: 'hello', name: this.name || 'Pasajero' });
  }

  async request(track: Track): Promise<boolean> {
    this.pending.set(trackKey(track), Date.now());
    this.emit();
    const ok = await this.send({ kind: 'request', track });
    if (!ok) {
      this.pending.delete(trackKey(track));
      this.toasts = [{ id: newId('n_'), to: this.me, text: 'No se pudo enviar: sin conexión con el carro', at: Date.now() }, ...this.toasts].slice(0, 4);
      this.emit();
    }
    return ok;
  }

  vote(queueId: string, value: VoteValue): Promise<boolean> {
    return this.send({ kind: 'vote', queueId, value });
  }

  /** «Sonar ya»: de la cola (queueId) o de la búsqueda (track). Sólo vale si el carro lo permite. */
  playNow(target: { queueId: string } | { track: Track }): Promise<boolean> {
    return this.send({ kind: 'play_now', ...target });
  }

  control(action: ControlAction): Promise<boolean> {
    return this.send({ kind: 'control', action });
  }

  rename(name: string): void {
    this.name = name;
    this.hello(true);
    this.emit();
  }

  // ------------------------------------------------------------- respaldo HTTP

  private pollInterval(): number {
    const live = this.status() === 'live';
    if (live && this.directOpen() && this.via !== 'http') return 30_000;
    if (!this.snapshot) return 2000;
    return Date.now() < this.activeUntil ? 2000 : 5000;
  }

  private poll(delay: number): void {
    if (this.disposed || this.closed || this.channels.http === false) return;
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.pollTimer = setTimeout(async () => {
      try {
        const r = await relay.state(this.room, this.snapshot?.rev);
        if (!r.exists) {
          if (r.closed) this.closed = true;
          else this.httpSaysMissing = true;
        } else if ('snapshot' in r && r.snapshot) {
          this.accept(r.snapshot, 'http');
          // La foto puede ser vieja (carro desaparecido): la vida la marca su antigüedad.
          if (this.via === 'http' && r.age !== null) this.aliveAt = Date.now() - r.age * 1000;
        } else if ('unchanged' in r && this.snapshot && this.via === 'http' && r.age !== null) {
          this.aliveAt = Date.now() - r.age * 1000;
        }
      } catch {
        /* sin red: se reintenta */
      }
      this.emit();
      this.poll(this.pollInterval());
    }, delay);
  }
}
