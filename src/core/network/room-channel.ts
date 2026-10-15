import { RoomEventType, RoomMessage } from '../../types/room.types';

type MessageHandler = (msg: RoomMessage) => void;

export class RoomChannel {
  private roomId: string;
  private ws: WebSocket | null = null;
  private broadcast: BroadcastChannel | null = null;
  private handlers: Set<MessageHandler> = new Set();
  private isConnected = false;

  constructor(roomId: string, wsUrl?: string) {
    this.roomId = roomId;
    this.initBroadcast();
    if (wsUrl) {
      this.initWebSocket(wsUrl);
    }
  }

  private initBroadcast(): void {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.broadcast = new BroadcastChannel(`carbeat_room_${this.roomId}`);
      this.broadcast.onmessage = (event) => {
        this.dispatch(event.data as RoomMessage);
      };
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
      this.ws.send(JSON.stringify(msg));
    }

    // Difundir en canal local (pestañas locales / offline sandbox)
    if (this.broadcast) {
      this.broadcast.postMessage(msg);
    }
  }

  public subscribe(handler: MessageHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  private dispatch(msg: RoomMessage): void {
    this.handlers.forEach((h) => h(msg));
  }

  public close(): void {
    if (this.ws) this.ws.close();
    if (this.broadcast) this.broadcast.close();
    this.handlers.clear();
  }

  public getStatus(): boolean {
    return this.isConnected || !!this.broadcast;
  }
}
