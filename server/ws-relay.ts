// Relé WebSocket para red local (portátil o PC haciendo de servidor dentro del carro) y para
// desarrollo. Es el camino más rápido cuando todos están en el mismo Wi-Fi.
//
// Reglas: un solo carro por código (el primero que se registra con su token); las fotos sólo
// las puede emitir ese carro; las intenciones de los pasajeros sólo van al carro.

import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer, WebSocket } from 'ws';
import { parseWire } from '../shared/protocol.js';
import { isRoomCode } from '../shared/room-code.js';

export const WS_PATH = '/ws-room';

interface RoomPeers {
  token: string;
  host: WebSocket | null;
  riders: Map<string, WebSocket>;
  lastSnapshot: string | null;
  lastLibrary: string | null;
}

export function createWsRelay() {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 128 * 1024 });
  const rooms = new Map<string, RoomPeers>();

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const room = (url.searchParams.get('room') ?? '').toUpperCase();
    const role = url.searchParams.get('role');
    const client = url.searchParams.get('client') ?? '';
    const token = url.searchParams.get('token') ?? '';
    if (!isRoomCode(room) || (role !== 'host' && role !== 'rider') || !client) {
      ws.close(4400, 'parámetros inválidos');
      return;
    }

    let peers = rooms.get(room);
    if (role === 'host') {
      if (token.length < 24) return ws.close(4401, 'falta token');
      if (peers && peers.token !== token) return ws.close(4409, 'código en uso');
      if (!peers) {
        peers = { token, host: null, riders: new Map(), lastSnapshot: null, lastLibrary: null };
        rooms.set(room, peers);
      }
      peers.host?.close(4000, 'reemplazado');
      peers.host = ws;
    } else {
      if (!peers) {
        // El pasajero puede llegar antes que el carro: se crea la sala vacía y espera.
        peers = { token: '', host: null, riders: new Map(), lastSnapshot: null, lastLibrary: null };
        rooms.set(room, peers);
      }
      peers.riders.get(client)?.close(4000, 'reemplazado');
      peers.riders.set(client, ws);
      if (peers.lastSnapshot) ws.send(peers.lastSnapshot);
      if (peers.lastLibrary) ws.send(peers.lastLibrary);
    }
    const p = peers;

    ws.on('message', (data) => {
      const raw = data.toString();
      let msg;
      try {
        msg = parseWire(JSON.parse(raw));
      } catch {
        return;
      }
      if (!msg) return;
      if (role === 'host') {
        const isSnap = msg.t === 'snapshot' && msg.s.room === room;
        const isLib = msg.t === 'library' && msg.l.room === room;
        if (isSnap) p.lastSnapshot = raw;
        if (isLib) p.lastLibrary = raw;
        if (isSnap || isLib) for (const r of p.riders.values()) if (r.readyState === WebSocket.OPEN) r.send(raw);
      } else if (msg.t === 'intent' && msg.e.room === room && msg.e.from === client) {
        if (p.host?.readyState === WebSocket.OPEN) p.host.send(raw);
      }
    });

    ws.on('close', () => {
      if (role === 'host' && p.host === ws) p.host = null;
      if (role === 'rider' && p.riders.get(client) === ws) p.riders.delete(client);
      if (!p.host && p.riders.size === 0) rooms.delete(room);
    });
    ws.on('error', () => ws.close());
  });

  return {
    /** Engancha al evento 'upgrade' de un servidor http. Devuelve true si era suyo. */
    handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): boolean {
      if (!req.url?.startsWith(WS_PATH)) return false;
      wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
      return true;
    },
    close() {
      for (const c of wss.clients) c.terminate();
      wss.close();
      rooms.clear();
    },
    stats() {
      return { rooms: rooms.size, clients: wss.clients.size };
    },
  };
}
