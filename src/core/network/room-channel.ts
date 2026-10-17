import { RoomEventType, RoomMessage } from '../../types/room.types';
import { PeerChannel } from './peer-channel';
import { apiUrl, getApiBaseUrl } from './api-config';

type MessageHandler = (msg: RoomMessage) => void;

const CLIENT_ID = `client_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

export function getDefaultWsUrl(): string {
  if (typeof window === 'undefined') return '';
  // Si estamos en la APK nativa (Capacitor), no hay WebSocket local en la tableta
  if (getApiBaseUrl() !== '') {
    return '';
  }
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  if (window.location.port === '5173') {
    return `${proto}//${window.location.hostname}:5174/ws-rooms`;
  }
  return `${proto}//${window.location.host}/ws-rooms`;
}

/**
 * Canal Híbrido Multi-Capa con Fallback Serverless en Vercel:
 * 1. WebSocket local (para red local/hotspot).
 * 2. WebRTC P2P DataChannel (PeerJS).
 * 3. HTTP Serverless Relay (/api/room en Vercel, 100% tolerante a firewalls).
 * 4. BroadcastChannel local (inter-pestañas).
 */
export class RoomChannel {
  private roomId: string;
  private ws: WebSocket | null = null;
  private peerChannel: PeerChannel | null = null;
  private broadcast: BroadcastChannel | null = null;
  private handlers: Set<MessageHandler> = new Set();
  private seenMessages: Set<string> = new Set();
  private isClosed = false;
  private httpPollInterval: ReturnType<typeof setInterval> | null = null;
  private pendingWsMessages: string[] = [];

  constructor(roomId: string, isHost = false, wsUrl: string = getDefaultWsUrl()) {
    this.roomId = roomId;
    this.initBroadcast();
    this.initPeerChannel(isHost);
    this.initHttpRelay(isHost);
    if (wsUrl) {
      this.initWebSocket(wsUrl);
    }
  }

  private initBroadcast(): void {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcast = new BroadcastChannel(`carbeat_room_${this.roomId}`);
        this.broadcast.onmessage = (event) => {
          const msg = event.data as RoomMessage & { _clientId?: string };
          if (msg._clientId === CLIENT_ID) return;
          this.handleIncoming(msg);
        };
      } catch (err) {
        console.warn('[RoomChannel] BroadcastChannel init error:', err);
      }
    }
  }

  private initPeerChannel(isHost: boolean): void {
    try {
      this.peerChannel = new PeerChannel(this.roomId, isHost);
      this.peerChannel.onMessage((data) => {
        if (data && typeof data === 'object' && data.type) {
          const msg = data as RoomMessage & { _clientId?: string };
          if (msg._clientId === CLIENT_ID) return;
          this.handleIncoming(msg);
        }
      });
    } catch (err) {
      console.warn('[RoomChannel] PeerChannel init error:', err);
    }
  }

  private isOnline = false;

  private initHttpRelay(isHost: boolean): void {
    if (typeof window === 'undefined') return;

    let lastSince = Date.now() - 5000;

    const poll = async () => {
      if (this.isClosed) return;
      try {
        const queryRole = isHost ? `&role=host&since=${lastSince}` : '&role=dj';
        const res = await fetch(apiUrl(`/api/room?roomId=${encodeURIComponent(this.roomId)}${queryRole}`));
        if (res.ok) {
          this.isOnline = true;
          this.dispatch({
            type: 'SOCKET_STATUS' as any,
            roomId: this.roomId,
            senderId: 'http_relay',
            senderName: 'Vercel Relay',
            timestamp: Date.now(),
            payload: { connected: true }
          });
          const room = await res.json();
          if (room && room.exists !== false) {
            // 1. Entregar eventos pendientes en cola (peticiones de canciones, votos, etc.)
            if (isHost && Array.isArray(room.events)) {
              for (const evt of room.events) {
                if (evt.timestamp > lastSince) {
                  lastSince = Math.max(lastSince, evt.timestamp);
                  this.handleIncoming({
                    type: evt.type,
                    roomId: this.roomId,
                    senderId: evt.senderId || 'dj',
                    senderName: evt.senderName || 'DJ',
                    timestamp: evt.timestamp,
                    payload: evt.payload,
                  });
                }
              }
            }

            // 2. Notificar actualización de DJs conectados
            if (Array.isArray(room.activeDjs)) {
              this.dispatch({
                type: 'ACTIVE_DJS_UPDATE' as any,
                roomId: this.roomId,
                senderId: 'serverless_relay',
                senderName: 'Vercel Relay',
                timestamp: Date.now(),
                payload: { djs: room.activeDjs, count: room.djCount ?? room.activeDjs.length }
              });
            }

            // 3. Sincronizar catálogo y estado con los DJs
            if (!isHost && room.lastUpdated) {
              this.handleIncoming({
                type: 'SYNC_CATALOG',
                roomId: this.roomId,
                senderId: 'serverless_relay',
                senderName: 'Vercel Relay',
                timestamp: room.lastUpdated,
                payload: {
                  catalog: room.queue ? room.queue.map((q: any) => q.track) : [],
                  queue: room.queue || [],
                  currentTrack: room.currentTrack,
                  isPlaying: room.isPlaying,
                  currentTime: room.currentTime,
                  duration: room.duration,
                },
              });
            }
          }
        }
      } catch {
        /* ignore */
      }
    };

    // Frecuencia optimizada para latencia ultra-baja en cabina
    this.httpPollInterval = setInterval(poll, isHost ? 700 : 900);
    setTimeout(poll, 50);

    // Permitir forzar sincronización instantánea tras enviar un evento
    (this as any)._triggerImmediateSync = () => setTimeout(poll, 60);
  }

  private initWebSocket(url: string): void {
    try {
      this.ws = new WebSocket(`${url}?room=${encodeURIComponent(this.roomId)}`);
      this.ws.onopen = () => {
        this.isOnline = true;
        while (this.pendingWsMessages.length > 0) {
          const raw = this.pendingWsMessages.shift();
          if (raw && this.ws && this.ws.readyState === 1) {
            try {
              this.ws.send(raw);
            } catch {
              /* ignore */
            }
          }
        }
        // Notificar al estado local que el socket está en línea inmediatamente
        this.dispatch({
          type: 'SOCKET_STATUS' as any,
          roomId: this.roomId,
          senderId: 'ws_connected',
          senderName: 'WebSocket Local',
          timestamp: Date.now(),
          payload: { connected: true }
        });
      };
      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as RoomMessage;
          this.handleIncoming(msg);
        } catch {
          /* ignore */
        }
      };
      this.ws.onclose = () => {
        if (!this.isClosed) {
          setTimeout(() => {
            if (!this.isClosed) this.initWebSocket(url);
          }, 3000);
        }
      };
    } catch {
      /* ignore */
    }
  }

  private handleIncoming(msg: RoomMessage): void {
    const dedupeKey = `${msg.type}_${msg.senderId}_${msg.timestamp}`;
    if (this.seenMessages.has(dedupeKey)) return;
    this.seenMessages.add(dedupeKey);

    if (this.seenMessages.size > 200) {
      const first = this.seenMessages.values().next().value;
      if (first) this.seenMessages.delete(first);
    }

    this.dispatch(msg);
  }

  public send<T>(type: RoomEventType, senderId: string, senderName: string, payload: T): void {
    if (this.isClosed) return;

    const msg: RoomMessage<T> & { _clientId?: string } = {
      type,
      roomId: this.roomId,
      senderId,
      senderName,
      timestamp: Date.now(),
      payload,
      _clientId: CLIENT_ID,
    };

    // 1. WebSocket local
    const rawMsg = JSON.stringify(msg);
    if (this.ws) {
      if (this.ws.readyState === 1) {
        try {
          this.ws.send(rawMsg);
        } catch {
          /* ignore */
        }
      } else if (this.ws.readyState === 0) {
        this.pendingWsMessages.push(rawMsg);
      }
    }

    // 2. WebRTC P2P
    if (this.peerChannel) {
      try {
        this.peerChannel.send(msg);
      } catch {
        /* ignore */
      }
    }

    // 3. Vercel Serverless Relay
    try {
      fetch(apiUrl(`/api/room?roomId=${encodeURIComponent(this.roomId)}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          roomId: this.roomId,
          senderId,
          senderName,
          payload,
        }),
      })
        .then(() => {
          if (typeof (this as any)._triggerImmediateSync === 'function') {
            (this as any)._triggerImmediateSync();
          }
        })
        .catch(() => {});
    } catch {
      /* ignore */
    }

    // 4. BroadcastChannel
    try {
      this.broadcast?.postMessage(msg);
    } catch {
      /* ignore */
    }
  }

  public isConnected(): boolean {
    return (this.ws && this.ws.readyState === 1) || this.isOnline;
  }

  public subscribe(handler: MessageHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  private dispatch(msg: RoomMessage): void {
    this.handlers.forEach((h) => {
      try {
        h(msg);
      } catch {
        /* ignore */
      }
    });
  }

  public close(): void {
    this.isClosed = true;
    if (this.httpPollInterval) {
      clearInterval(this.httpPollInterval);
      this.httpPollInterval = null;
    }
    if (this.ws) {
      try { this.ws.close(); } catch { /* ignore */ }
      this.ws = null;
    }
    if (this.peerChannel) {
      try { this.peerChannel.close(); } catch { /* ignore */ }
      this.peerChannel = null;
    }
    if (this.broadcast) {
      try { this.broadcast.close(); } catch { /* ignore */ }
      this.broadcast = null;
    }
    this.handlers.clear();
    this.seenMessages.clear();
  }
}
