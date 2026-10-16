import { Track, QueueItem } from '../src/types/track.types';

interface RoomState {
  roomId: string;
  roomName: string;
  hostIp: string;
  hostLastSeen: number;
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  queue: QueueItem[];
  djs: Record<string, number>; // djName -> lastSeen timestamp
  lastUpdated: number;
}

// Almacén en memoria de salas activas para Vercel Serverless
const roomsStore = new Map<string, RoomState>();

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const action = (req.query?.action as string) || '';
  const now = Date.now();
  const INACTIVE_TIMEOUT_MS = 10000; // 10 segundos sin señal = sala inactiva

  // Limpiar salas inactivas (>10 segundos sin señal del host)
  for (const [id, r] of roomsStore.entries()) {
    if (now - r.hostLastSeen > INACTIVE_TIMEOUT_MS) {
      roomsStore.delete(id);
    }
  }

  // 1. Descubrimiento de Carros en Vivo (Escáner Wi-Fi / Red)
  if (action === 'discover') {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    const activeRooms: any[] = [];
    for (const r of roomsStore.values()) {
      if (now - r.hostLastSeen <= INACTIVE_TIMEOUT_MS) {
        // Purgar DJs inactivos (más de 6 segundos sin latido)
        const activeDjs = Object.entries(r.djs).filter(([_, time]) => now - time < 6000);
        activeRooms.push({
          roomId: r.roomId,
          roomName: r.roomName || `CarBeat ${r.roomId}`,
          hostIp: r.hostIp || 'Nube Vercel',
          djCount: activeDjs.length,
          lastSeen: r.hostLastSeen,
        });
      }
    }
    return res.status(200).json(activeRooms);
  }

  const roomId = ((req.query?.roomId as string) || 'BEAT-784').toUpperCase();

  // 2. GET: Consulta de estado de sala y verificación de existencia
  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    const existing = roomsStore.get(roomId);

    // Si la sala no existe o su host lleva más de 10s desconectado
    if (!existing || now - existing.hostLastSeen > INACTIVE_TIMEOUT_MS) {
      if (existing) roomsStore.delete(roomId);
      return res.status(200).json({
        exists: false,
        error: `La sala "${roomId}" no existe o el vehículo está desconectado.`,
      });
    }

    // Purgar DJs inactivos
    const activeDjCount = Object.values(existing.djs).filter((t) => now - t < 6000).length;

    return res.status(200).json({
      exists: true,
      ...existing,
      djCount: activeDjCount,
    });
  }

  // 3. POST: Mutaciones, Registro de Host, Heartbeats y Cola
  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const { type, payload } = body;

      // Obtener o registrar sala
      if (!roomsStore.has(roomId)) {
        roomsStore.set(roomId, {
          roomId,
          roomName: `CarBeat ${roomId}`,
          hostIp: 'Nube Vercel',
          hostLastSeen: Date.now(),
          currentTrack: null,
          isPlaying: false,
          currentTime: 0,
          duration: 0,
          queue: [],
          djs: {},
          lastUpdated: Date.now(),
        });
      }

      const room = roomsStore.get(roomId)!;

      // A) Cierre de Sala por el Chofer (Detener y expulsar a todos)
      if (type === 'CLOSE_ROOM' || type === 'ROOM_CLOSED' || body.action === 'close' || payload?.action === 'close') {
        roomsStore.delete(roomId);
        return res.status(200).json({ ok: true, closed: true, message: 'Sala cerrada por el conductor' });
      }

      // B) Purga de un tacazo de la cola de peticiones
      if (type === 'PURGE_QUEUE') {
        room.queue = [];
        room.lastUpdated = Date.now();
        return res.status(200).json(room);
      }

      // C) Anuncio del Host (Pantalla del Carro)
      if (type === 'HOST_ANNOUNCE') {
        room.hostLastSeen = Date.now();
        if (payload?.roomName) room.roomName = payload.roomName;
        if (payload?.hostIp) room.hostIp = payload.hostIp;
        room.lastUpdated = Date.now();
        return res.status(200).json({ ok: true, roomId });
      }

      // B) Heartbeat de DJ (Pasajero activo)
      if (type === 'DJ_HEARTBEAT' && payload?.djName) {
        room.djs[payload.djName] = Date.now();
        return res.status(200).json({ ok: true });
      }

      // C) DJ Abandona la sala
      if (type === 'ROOM_LEAVE' && payload?.djName) {
        delete room.djs[payload.djName];
        return res.status(200).json({ ok: true });
      }

      // D) Pedir canción a la cola (Deduplicación estricta y suma de votos)
      if (type === 'QUEUE_TRACK' && payload?.track) {
        const track: Track = payload.track;
        const requestedBy: string = payload.requestedBy || 'DJ Pasajero';

        // Buscar si ya existe la pista en la cola
        const existingItem = room.queue.find(
          (item) =>
            item.track.id === track.id ||
            item.track.title.toLowerCase().trim() === track.title.toLowerCase().trim()
        );

        if (existingItem) {
          existingItem.votes += 1;
        } else {
          const newItem: QueueItem = {
            queueId: `q_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            track,
            votes: 1,
            requestedBy,
            requestedAt: Date.now(),
          };

          if (!room.currentTrack) {
            room.currentTrack = track;
            room.isPlaying = true;
            room.currentTime = 0;
            room.duration = track.duration || 210;
          } else {
            room.queue.push(newItem);
          }
        }

        room.queue.sort((a, b) => b.votes - a.votes);
        room.lastUpdated = Date.now();
        return res.status(200).json(room);
      }

      // E) Votación de canciones
      if (type === 'VOTE_TRACK' && payload?.queueId) {
        room.queue = room.queue
          .map((item) =>
            item.queueId === payload.queueId
              ? { ...item, votes: Math.max(0, item.votes + (payload.delta || 1)) }
              : item
          )
          .sort((a, b) => b.votes - a.votes);
        room.lastUpdated = Date.now();
        return res.status(200).json(room);
      }

      // F) Sincronización del Host
      if ((type === 'SYNC_CATALOG' || type === 'SYNC_STATE' || type === 'PLAYBACK_STATE') && payload) {
        room.hostLastSeen = Date.now();
        if (payload.currentTrack !== undefined) room.currentTrack = payload.currentTrack;
        if (payload.isPlaying !== undefined) room.isPlaying = payload.isPlaying;
        if (payload.currentTime !== undefined) room.currentTime = payload.currentTime;
        if (payload.duration !== undefined) room.duration = payload.duration;
        if (Array.isArray(payload.queue)) {
          // Deduplicar estrictamente la cola recibida del host
          const seen = new Set<string>();
          room.queue = payload.queue
            .filter((item: any) => {
              if (!item?.track?.title) return false;
              const key = `${item.track.title.toLowerCase().trim()}_${(item.track.artist || '').toLowerCase().trim()}`;
              if (seen.has(key) || seen.has(item.track.id)) return false;
              seen.add(key);
              seen.add(item.track.id);
              return true;
            })
            .sort((a: any, b: any) => b.votes - a.votes);
        }
        room.lastUpdated = Date.now();
        return res.status(200).json(room);
      }

      return res.status(200).json(room);
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Error procesando acción' });
    }
  }

  return res.status(405).json({ error: 'Método no permitido' });
}
