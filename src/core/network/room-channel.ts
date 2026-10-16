import { RoomEventType, RoomMessage } from '../../types/room.types';

type MessageHandler = (msg: RoomMessage) => void;

export class RoomChannel {
  private roomId: string;
  private ws: WebSocket | null = null;
  private broadcast: BroadcastChannel | null = null;
  private handlers: Set<MessageHandler> = new Set();
  private isConnected = false;
  private isClosed = false;

  constructor(roomId: string, wsUrl?: string) {
    this.roomId = roomId;
    this.initBroadcast();
    if (wsUrl) {
      this.initWebSocket(wsUrl);
    }
  }

  private initBroadcast(): void {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcast = new BroadcastChannel(`carbeat_room_${this.roomId}`);
        this.broadcast.onmessage = (event) => {
          this.dispatch(event.data as RoomMessage);
        };
      } catch (err) {
        console.warn('[RoomChannel] BroadcastChannel init error:', err);
      }
    }
  }

  private initWebSocket(url: string): void {
    try {
      this.ws = new WebSocket(`${url}?room=${encodeURIComponent(this.roomId)}`);
      this.ws.onopen = () => {
        this.isConnected = true;
      };
      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as RoomMessage;
          this.dispatch(msg);
        } catch (e) {
          console.error('[RoomChannel] JSON parse error', e);
        }
      };
      this.ws.onclose = () => {
        this.isConnected = false;
      };
    } catch (e) {
      console.warn('[RoomChannel] WebSocket fallback to BroadcastChannel', e);
    }
  }

  public send<T>(type: RoomEventType, senderId: string, senderName: string, payload: T): void {
    if (this.isClosed) return;

    const msg: RoomMessage<T> = {
      type,
      roomId: this.roomId,
      senderId,
      senderName,
      timestamp: Date.now(),
      payload,
    };

    // Enviar a WebSocket si está activo
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(msg));
      } catch (err) {
        console.warn('[RoomChannel] WS send failed:', err);
      }
    }

    // Difundir en canal local con protección ante canales cerrados
    try {
      if (!this.broadcast) {
        this.initBroadcast();
      }
      this.broadcast?.postMessage(msg);
    } catch (err) {
      console.warn('[RoomChannel] Broadcast postMessage recovered:', err);
      // Reintentar reiniciando el canal
      try {
        this.initBroadcast();
        this.broadcast?.postMessage(msg);
      } catch {
        // Ignorar de forma segura sin quebrar React
      }
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
      } catch (err) {
        console.error('[RoomChannel] Error in message handler:', err);
      }
    });
  }

  public close(): void {
    this.isClosed = true;
    if (this.ws) {
      try { this.ws.close(); } catch {}
      this.ws = null;
    }
    if (this.broadcast) {
      try { this.broadcast.close(); } catch {}
      this.broadcast = null;
    }
    this.handlers.clear();
  }

  public getStatus(): boolean {
    return this.isConnected || !!this.broadcast;
  }
}
