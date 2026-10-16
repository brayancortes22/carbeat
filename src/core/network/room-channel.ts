import { RoomEventType, RoomMessage } from '../../types/room.types';
import { PeerChannel } from './peer-channel';

type MessageHandler = (msg: RoomMessage) => void;

const CLIENT_ID = `client_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

export function getDefaultWsUrl(): string {
  if (typeof window === 'undefined') return '';
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
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

  constructor(roomId: string, isHost = false, wsUrl: string = getDefaultWsUrl()) {
    this.roomId = roomId;
    this.initBroadcast();
    this.initPeerChannel(isHost);
    this.initHttpRelay();
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

  private initHttpRelay(): void {
    if (typeof window === 'undefined') return;

    const poll = async () => {
      if (this.isClosed) return;
      try {
        const res = await fetch(`/api/room?roomId=${encodeURIComponent(this.roomId)}`);
        if (res.ok) {
          const room = await res.json();
          if (room && room.lastUpdated) {
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
      } catch {
        /* ignore */
      }
    };

    this.httpPollInterval = setInterval(poll, 1500);
    setTimeout(poll, 200);
  }

  private initWebSocket(url: string): void {
    try {
      this.ws = new WebSocket(`${url}?room=${encodeURIComponent(this.roomId)}`);
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
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(msg));
      } catch {
        /* ignore */
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
      fetch(`/api/room?roomId=${encodeURIComponent(this.roomId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, payload }),
      }).catch(() => {});
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
