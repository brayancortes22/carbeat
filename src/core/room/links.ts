// Enlaces en tiempo real entre el carro y los pasajeros. Todos hablan WireMessage.
//   p2p   WebRTC con PeerJS (señalización en su servidor público). Camino principal.
//   lan   WebSocket al relé local (desarrollo o portátil en el carro).
//   local BroadcastChannel: otra pestaña del mismo navegador (simulador, pruebas).
// El respaldo HTTP no es un enlace: lo gestiona cada sesión con su propio ritmo.

import { Peer, type DataConnection } from 'peerjs';
import { parseWire, type WireMessage } from '../../../shared/protocol';

export type LinkKind = 'p2p' | 'lan' | 'local';
export type LinkStatus = 'off' | 'connecting' | 'open' | 'error';

export interface LinkEvents {
  onMessage(msg: WireMessage, via: LinkKind): void;
  onStatus(): void;
  /** Sólo carro: un pasajero acaba de abrir un canal P2P (se le manda la foto al momento). */
  onPeerOpen?(send: (msg: WireMessage) => void): void;
}

export interface Link {
  readonly kind: LinkKind;
  status(): LinkStatus;
  /** Carro: a todos. Pasajero: al carro. Devuelve true si salió por algún canal abierto. */
  send(msg: WireMessage): boolean;
  peerCount(): number;
  close(): void;
}

export const hostPeerId = (room: string) => `carbeat2-${room.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

const RETRY_MS = [1500, 3000, 5000, 8000, 12000];

// ------------------------------------------------------------------ P2P carro

export function createHostP2P(room: string, ev: LinkEvents): Link {
  let peer: Peer | null = null;
  let status: LinkStatus = 'connecting';
  let closed = false;
  let attempt = 0;
  const conns = new Map<string, DataConnection>();

  const set = (s: LinkStatus) => {
    status = s;
    ev.onStatus();
  };

  const start = () => {
    if (closed) return;
    peer = new Peer(hostPeerId(room), { debug: 0 });
    peer.on('open', () => {
      attempt = 0;
      set('open');
    });
    peer.on('connection', (conn) => {
      conn.on('open', () => {
        conns.set(conn.peer, conn);
        ev.onStatus();
        ev.onPeerOpen?.((m) => conn.open && conn.send(m));
      });
      conn.on('data', (data) => {
        const msg = parseWire(data);
        if (msg?.t === 'intent') ev.onMessage(msg, 'p2p');
      });
      const drop = () => {
        conns.delete(conn.peer);
        ev.onStatus();
      };
      conn.on('close', drop);
      conn.on('error', drop);
    });
    peer.on('disconnected', () => {
      // Se perdió la señalización, no los canales ya abiertos: se reconecta sin destruir.
      if (!closed && peer && !peer.destroyed) peer.reconnect();
    });
    peer.on('error', (err: { type?: string }) => {
      if (closed) return;
      // unavailable-id: el servidor aún recuerda el id de una recarga anterior. Se reintenta.
      if (err.type === 'unavailable-id' || err.type === 'network' || err.type === 'server-error' || err.type === 'socket-error') {
        set('connecting');
        peer?.destroy();
        const wait = RETRY_MS[Math.min(attempt++, RETRY_MS.length - 1)];
        setTimeout(start, wait);
        if (attempt > 6) set('error');
      }
    });
  };
  start();

  return {
    kind: 'p2p',
    status: () => status,
    peerCount: () => conns.size,
    send(msg) {
      let sent = false;
      for (const c of conns.values()) {
        if (c.open) {
          try {
            c.send(msg);
            sent = true;
          } catch {
            /* canal caído: lo limpia su evento close */
          }
        }
      }
      return sent;
    },
    close() {
      closed = true;
      for (const c of conns.values()) c.close();
      conns.clear();
      peer?.destroy();
      status = 'off';
    },
  };
}

// ---------------------------------------------------------------- P2P pasajero

export function createRiderP2P(room: string, ev: LinkEvents): Link {
  let peer: Peer | null = null;
  let conn: DataConnection | null = null;
  let status: LinkStatus = 'connecting';
  let closed = false;
  let attempt = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const set = (s: LinkStatus) => {
    if (status !== s) {
      status = s;
      ev.onStatus();
    }
  };

  const retry = () => {
    if (closed || timer) return;
    set('connecting');
    const wait = RETRY_MS[Math.min(attempt++, RETRY_MS.length - 1)];
    timer = setTimeout(() => {
      timer = null;
      connect();
    }, wait);
  };

  const connect = () => {
    if (closed || !peer || peer.destroyed) return;
    if (peer.disconnected) {
      peer.reconnect();
      return;
    }
    conn?.close();
    const c = peer.connect(hostPeerId(room), { reliable: true });
    conn = c;
    c.on('open', () => {
      attempt = 0;
      set('open');
    });
    c.on('data', (data) => {
      const msg = parseWire(data);
      if (msg?.t === 'snapshot') ev.onMessage(msg, 'p2p');
    });
    c.on('close', () => {
      if (conn === c) retry();
    });
    c.on('error', () => {
      if (conn === c) retry();
    });
  };

  peer = new Peer({ debug: 0 });
  peer.on('open', connect);
  peer.on('disconnected', () => !closed && peer?.reconnect());
  peer.on('error', (err: { type?: string }) => {
    if (closed) return;
    // peer-unavailable: el carro todavía no está (o ya no está). Se sigue intentando.
    if (err.type === 'peer-unavailable' || err.type === 'network' || err.type === 'server-error' || err.type === 'socket-error') retry();
    if (attempt > 8) set('error');
  });

  return {
    kind: 'p2p',
    status: () => status,
    peerCount: () => (conn?.open ? 1 : 0),
    send(msg) {
      if (!conn?.open) return false;
      try {
        conn.send(msg);
        return true;
      } catch {
        return false;
      }
    },
    close() {
      closed = true;
      if (timer) clearTimeout(timer);
      conn?.close();
      peer?.destroy();
      status = 'off';
    },
  };
}

// ------------------------------------------------------------------- red local

export function createLanLink(
  url: string,
  params: { room: string; role: 'host' | 'rider'; client: string; token?: string },
  ev: LinkEvents,
): Link {
  let ws: WebSocket | null = null;
  let status: LinkStatus = 'connecting';
  let closed = false;
  let attempt = 0;

  const set = (s: LinkStatus) => {
    if (status !== s) {
      status = s;
      ev.onStatus();
    }
  };

  const open = () => {
    if (closed) return;
    const q = new URLSearchParams({ room: params.room, role: params.role, client: params.client });
    if (params.token) q.set('token', params.token);
    const sock = new WebSocket(`${url}?${q.toString()}`);
    ws = sock;
    sock.onopen = () => {
      attempt = 0;
      set('open');
    };
    sock.onmessage = (e) => {
      try {
        const msg = parseWire(JSON.parse(String(e.data)));
        if (msg) ev.onMessage(msg, 'lan');
      } catch {
        /* basura */
      }
    };
    sock.onclose = (e) => {
      if (closed || ws !== sock) return;
      // 4409: otro carro tiene el código en este relé. No tiene sentido reintentar.
      if (e.code === 4409 || e.code === 4400) {
        set('error');
        return;
      }
      set('connecting');
      setTimeout(open, RETRY_MS[Math.min(attempt++, RETRY_MS.length - 1)]);
    };
  };
  open();

  return {
    kind: 'lan',
    status: () => status,
    peerCount: () => (status === 'open' ? 1 : 0),
    send(msg) {
      if (ws?.readyState !== WebSocket.OPEN) return false;
      ws.send(JSON.stringify(msg));
      return true;
    },
    close() {
      closed = true;
      ws?.close();
      status = 'off';
    },
  };
}

// ------------------------------------------------------- pestañas del navegador

export function createLocalLink(room: string, role: 'host' | 'rider', ev: LinkEvents): Link {
  if (typeof BroadcastChannel === 'undefined') {
    return { kind: 'local', status: () => 'off', peerCount: () => 0, send: () => false, close: () => {} };
  }
  const bc = new BroadcastChannel(`carbeat2-${room}`);
  bc.onmessage = (e) => {
    const msg = parseWire(e.data);
    if (!msg) return;
    // El carro sólo escucha intenciones; los pasajeros sólo fotos.
    if ((role === 'host' && msg.t === 'intent') || (role === 'rider' && msg.t === 'snapshot')) ev.onMessage(msg, 'local');
  };
  return {
    kind: 'local',
    status: () => 'open',
    peerCount: () => 0,
    send(msg) {
      bc.postMessage(msg);
      return false; // no garantiza que haya nadie escuchando
    },
    close() {
      bc.close();
    },
  };
}
