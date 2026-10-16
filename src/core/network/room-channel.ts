import { RoomEventType, RoomMessage } from '../../types/room.types';

type MessageHandler = (msg: RoomMessage) => void;

export function getDefaultWsUrl(): string {
  if (typeof window === 'undefined') return '';
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws-rooms`;
}

export class RoomChannel {
  private roomId: string;
  private ws: WebSocket | null = null;
  private broadcast: BroadcastChannel | null = null;
  private handlers: Set<MessageHandler> = new Set();
  private pendingQueue: string[] = [];
  private isConnected = false;
  private isClosed = false;

  constructor(roomId: string, wsUrl: string = getDefaultWsUrl()) {
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
        console.log('[RoomChannel] WS conectado a la sala:', this.roomId);
        // Vaciar inmediatamente todos los mensajes acumulados mientras conectaba
        while (this.pendingQueue.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
          const pending = this.pendingQueue.shift();
          if (pending) this.ws.send(pending);
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as RoomMessage;
          this.dispatch(msg);
        } catch (e) {
          console.error('[RoomChannel] Error parseando JSON de WS:', e);
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        if (!this.isClosed) {
          setTimeout(() => {
            if (!this.isClosed) this.initWebSocket(url);
          }, 1500);
        }
      };

      this.ws.onerror = (err) => {
        console.warn('[RoomChannel] WS connection issue:', err);
      };
    } catch (e) {
      console.warn('[RoomChannel] Fallo iniciando WebSocket:', e);
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

    const rawString = JSON.stringify(msg);

    // Si el socket ya está abierto, enviar inmediatamente
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(rawString);
      } catch (err) {
        console.warn('[RoomChannel] Error enviando por WS:', err);
        this.pendingQueue.push(rawString);
      }
    } else {
      // Si aún está conectando, encolar para enviar apenas abra
      this.pendingQueue.push(rawString);
    }

    // Difundir también en canal local por si hay pestañas hermanas
    try {
      if (!this.broadcast) {
        this.initBroadcast();
      }
      this.broadcast?.postMessage(msg);
    } catch {
      // Ignorar de forma segura
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
        console.error('[RoomChannel] Error en handler:', err);
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
    this.pendingQueue = [];
  }

  public getStatus(): boolean {
    return this.isConnected || !!this.broadcast;
  }
}
