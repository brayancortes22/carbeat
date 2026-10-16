// Sistema de Descubrimiento de Hosts vía WebSocket + BroadcastChannel
// El Host anuncia su presencia periódicamente.
// Los DJs escuchan y muestran los hosts encontrados.

export interface DiscoveredHost {
  roomId: string;
  roomName: string;
  hostIp: string;
  port: number;
  lastSeen: number;
  djCount: number;
}

const discoveredHosts = new Map<string, DiscoveredHost>();
let scanCallback: ((hosts: DiscoveredHost[]) => void) | null = null;
let cleanupInterval: ReturnType<typeof setInterval> | null = null;
let wsAnnounceInterval: ReturnType<typeof setInterval> | null = null;
let announceWs: WebSocket | null = null;
let scanWs: WebSocket | null = null;
let currentDjCount = 0;
let announcerId = '';

const DISCOVERY_CHANNEL = 'carbeat_host_discovery';

function generateAnnouncerId(): string {
  return `ann_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * El Host anuncia su presencia periódicamente.
 * Usa BroadcastChannel para pestañas hermanas y WebSocket para dispositivos remotos.
 */
export function startHostAnnouncer(
  roomId: string,
  roomName: string,
  hostIp: string,
  djCount: number
): void {
  stopHostAnnouncer();

  currentDjCount = djCount;
  announcerId = generateAnnouncerId();

  const announce = () => {
    const announcement = {
      type: 'HOST_ANNOUNCE',
      roomId,
      roomName,
      hostIp,
      djCount: currentDjCount,
      timestamp: Date.now(),
      announcerId,
    };

    // Anunciar por BroadcastChannel (pestañas hermanas)
    try {
      const bc = new BroadcastChannel(DISCOVERY_CHANNEL);
      bc.postMessage(announcement);
      bc.close();
    } catch {
      // BroadcastChannel no disponible
    }

    // Anunciar por WebSocket (dispositivos remotos)
    if (announceWs && announceWs.readyState === WebSocket.OPEN) {
      try {
        announceWs.send(JSON.stringify(announcement));
      } catch {
        // Error enviando
      }
    }
  };

  // Configurar conexión WebSocket para anuncios
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const discoveryUrl = `${proto}//${window.location.host}/ws-discovery`;

  const connect = () => {
    try {
      announceWs = new WebSocket(discoveryUrl);

      announceWs.onopen = () => {
        announce();
        wsAnnounceInterval = setInterval(announce, 2000);
      };

      announceWs.onclose = () => {
        if (wsAnnounceInterval) {
          clearInterval(wsAnnounceInterval);
          wsAnnounceInterval = null;
        }
        setTimeout(connect, 2000);
      };

      announceWs.onerror = () => {
        // Error de conexión, intentará reconectar
      };
    } catch {
      // WebSocket no disponible
    }
  };

  connect();

  // Limpiar hosts viejos
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    let changed = false;
    for (const [key, host] of discoveredHosts.entries()) {
      if (now - host.lastSeen > 5000) {
        discoveredHosts.delete(key);
        changed = true;
      }
    }
    if (changed) notifyScanCallback();
  }, 2000);
}

export function stopHostAnnouncer(): void {
  if (wsAnnounceInterval) {
    clearInterval(wsAnnounceInterval);
    wsAnnounceInterval = null;
  }
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
  if (announceWs) {
    try { announceWs.close(); } catch { /* ignore */ }
    announceWs = null;
  }
  currentDjCount = 0;
  announcerId = '';
}

/**
 * Los DJs escuchan anuncios de hosts cercanos.
 */
export function startHostScanner(
  callback: (hosts: DiscoveredHost[]) => void
): void {
  stopHostScanner();
  scanCallback = callback;

  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const discoveryUrl = `${proto}//${window.location.host}/ws-discovery`;

  const connect = () => {
    try {
      scanWs = new WebSocket(discoveryUrl);

      scanWs.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'HOST_ANNOUNCE') {
            if (data.announcerId === announcerId) return;
            const host: DiscoveredHost = {
              roomId: data.roomId,
              roomName: data.roomName,
              hostIp: data.hostIp,
              port: data.port || 5173,
              lastSeen: Date.now(),
              djCount: data.djCount || 0,
            };
            discoveredHosts.set(host.roomId, host);
            notifyScanCallback();
          }
        } catch {
          // Mensaje inválido, ignorar
        }
      };

      scanWs.onclose = () => {
        setTimeout(() => {
          if (scanCallback) {
            connect();
          }
        }, 2000);
      };

      scanWs.onerror = () => {
        // Error de conexión, intentará reconectar
      };
    } catch {
      // WebSocket no disponible
    }
  };

  // También escuchar por BroadcastChannel (pestañas hermanas)
  try {
    const bc = new BroadcastChannel(DISCOVERY_CHANNEL);
    bc.onmessage = (event) => {
      try {
        const data = event.data;
        if (data.type === 'HOST_ANNOUNCE') {
          if (data.announcerId === announcerId) return;
          const host: DiscoveredHost = {
            roomId: data.roomId,
            roomName: data.roomName,
            hostIp: data.hostIp,
            port: data.port || 5173,
            lastSeen: Date.now(),
            djCount: data.djCount || 0,
          };
          discoveredHosts.set(host.roomId, host);
          notifyScanCallback();
        }
      } catch {
        // Mensaje inválido, ignorar
      }
    };
  } catch {
    // BroadcastChannel no disponible
  }

  connect();
  notifyScanCallback();
}

export function stopHostScanner(): void {
  scanCallback = null;
  discoveredHosts.clear();
  if (scanWs) {
    try { scanWs.close(); } catch { /* ignore */ }
    scanWs = null;
  }
}

function notifyScanCallback(): void {
  if (scanCallback) {
    scanCallback(Array.from(discoveredHosts.values()));
  }
}

export function getDiscoveredHosts(): DiscoveredHost[] {
  return Array.from(discoveredHosts.values());
}

export function getLocalHost(): string {
  if (typeof window === 'undefined') return 'localhost';
  return window.location.hostname;
}

export function getWsUrl(): string {
  if (typeof window === 'undefined') return '';
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws-rooms`;
}
