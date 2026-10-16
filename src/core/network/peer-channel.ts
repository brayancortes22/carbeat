import { Peer, DataConnection } from 'peerjs';

export type PeerMessageHandler = (data: any) => void;

/**
 * Canal P2P WebRTC mediante PeerJS (OmniRoute Tier 2)
 * Permite sincronización en tiempo real entre pantalla de Carro y DJs
 * incluso en Vercel, redes móviles o sin backend de WebSockets dedicado.
 */
export class PeerChannel {
  private peer: Peer | null = null;
  private connections: Map<string, DataConnection> = new Map();
  private hostConnection: DataConnection | null = null;
  private handlers: Set<PeerMessageHandler> = new Set();
  private isHost: boolean;
  private hostPeerId: string;
  private isClosed = false;

  constructor(roomId: string, isHost = false) {
    this.isHost = isHost;
    // Sanitizar ID de sala para compatibilidad estricta con PeerJS
    const cleanId = roomId.toLowerCase().replace(/[^a-z0-9]/g, '');
    this.hostPeerId = `carbeat-room-${cleanId}`;
    this.init();
  }

  private init(): void {
    if (typeof window === 'undefined') return;

    try {
      if (this.isHost) {
        // El Host registra un Peer ID fijo basado en el código de la sala
        this.peer = new Peer(this.hostPeerId, {
          debug: 0,
        });

        this.peer.on('connection', (conn) => {
          this.setupHostConnection(conn);
        });
      } else {
        // El DJ genera un Peer ID aleatorio y se conecta al Host
        this.peer = new Peer({
          debug: 0,
        });

        this.peer.on('open', () => {
          this.connectToHost();
        });
      }

      this.peer.on('error', (err: any) => {
        // Si el ID ya existe en Host (ej. recarga rápida), ignorar o reintentar
        if (err.type !== 'unavailable-id') {
          console.warn('[PeerChannel] Error WebRTC:', err.type || err);
        }
      });
    } catch (e) {
      console.warn('[PeerChannel] Fallo inicializando WebRTC:', e);
    }
  }

  private setupHostConnection(conn: DataConnection): void {
    conn.on('open', () => {
      this.connections.set(conn.peer, conn);
    });

    conn.on('data', (data) => {
      this.dispatch(data);
      // Retransmitir a los demás DJs conectados (Malla P2P gestionada por Host)
      for (const [peerId, clientConn] of this.connections.entries()) {
        if (peerId !== conn.peer && clientConn.open) {
          try {
            clientConn.send(data);
          } catch {
            /* ignore */
          }
        }
      }
    });

    conn.on('close', () => {
      this.connections.delete(conn.peer);
    });

    conn.on('error', () => {
      this.connections.delete(conn.peer);
    });
  }

  private connectToHost(): void {
    if (!this.peer || this.isClosed || this.isHost) return;

    try {
      const conn = this.peer.connect(this.hostPeerId, {
        reliable: true,
      });

      conn.on('open', () => {
        this.hostConnection = conn;
      });

      conn.on('data', (data) => {
        this.dispatch(data);
      });

      conn.on('close', () => {
        this.hostConnection = null;
        this.retryConnect();
      });

      conn.on('error', () => {
        this.hostConnection = null;
        this.retryConnect();
      });
    } catch {
      this.retryConnect();
    }
  }

  private retryConnect(): void {
    if (this.isClosed || this.isHost) return;
    setTimeout(() => {
      if (!this.isClosed && !this.hostConnection?.open) {
        this.connectToHost();
      }
    }, 3000);
  }

  public send(data: any): void {
    if (this.isClosed) return;

    if (this.isHost) {
      for (const conn of this.connections.values()) {
        if (conn.open) {
          try {
            conn.send(data);
          } catch {
            /* ignore */
          }
        }
      }
    } else if (this.hostConnection && this.hostConnection.open) {
      try {
        this.hostConnection.send(data);
      } catch {
        /* ignore */
      }
    }
  }

  public onMessage(handler: PeerMessageHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  private dispatch(data: any): void {
    this.handlers.forEach((h) => {
      try {
        h(data);
      } catch (err) {
        console.error('[PeerChannel] Error en handler:', err);
      }
    });
  }

  public close(): void {
    this.isClosed = true;
    for (const conn of this.connections.values()) {
      try {
        conn.close();
      } catch {
        /* ignore */
      }
    }
    this.connections.clear();
    if (this.hostConnection) {
      try {
        this.hostConnection.close();
      } catch {
        /* ignore */
      }
      this.hostConnection = null;
    }
    if (this.peer) {
      try {
        this.peer.destroy();
      } catch {
        /* ignore */
      }
      this.peer = null;
    }
    this.handlers.clear();
  }
}
