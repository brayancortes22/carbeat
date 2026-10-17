import { Track, QueueItem } from '../src/types/track.types';

interface RoomEvent {
  id: string;
  type: string;
  senderId?: string;
  senderName?: string;
  timestamp: number;
  payload: any;
}

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
  pendingEvents: RoomEvent[];
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
  const INACTIVE_TIMEOUT_MS = 60000; // 60 segundos tolerante para conexiones celulares
  const DJ_TIMEOUT_MS = 25000; // 25 segundos para considerar DJ inactivo

  // Limpiar salas inactivas (>60 segundos sin señal del host)
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
        const activeDjs = Object.entries(r.djs).filter(([_, time]) => now - time < DJ_TIMEOUT_MS);
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

  // 2. GET: Consulta de estado de sala y entrega de eventos
  if (req.method === 'GET') {
    const roomId = ((req.query?.roomId as string) || '').toUpperCase().trim();
    const role = (req.query?.role as string) || 'dj';
    const since = parseInt((req.query?.since as string) || '0', 10);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    const existing = roomsStore.get(roomId);

    if (!existing || now - existing.hostLastSeen > INACTIVE_TIMEOUT_MS) {
      if (existing) roomsStore.delete(roomId);
      return res.status(200).json({
        exists: false,
        error: `La sala "${roomId}" no existe o el vehículo está desconectado.`,
      });
    }

    // Filtrar DJs activos
    const activeDjEntries = Object.entries(existing.djs).filter(([_, t]) => now - t < DJ_TIMEOUT_MS);
    const activeDjNames = activeDjEntries.map(([name]) => name);

    // Eventos pendientes para el Host (enviados por los DJs)
    const eventsForHost = role === 'host'
      ? (existing.pendingEvents || []).filter((e) => e.timestamp > since)
      : [];

    // Limpiar eventos con más de 45 segundos
    existing.pendingEvents = (existing.pendingEvents || []).filter((e) => now - e.timestamp < 45000);

    return res.status(200).json({
      exists: true,
      ...existing,
      activeDjs: activeDjNames,
      djCount: activeDjNames.length,
      events: eventsForHost,
    });
  }

  // 3. POST: Mutaciones, Registro de Host, Heartbeats y Cola
  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const { type, payload, senderId, senderName } = body;
      const targetRoomId = (body.roomId || payload?.roomId || (req.query?.roomId as string) || '').toUpperCase().trim();

      if (!targetRoomId) {
        return res.status(400).json({ error: 'Falta roomId' });
      }

      // A) Cierre de Sala por el Chofer (Detener y expulsar a todos)
      if (type === 'CLOSE_ROOM' || type === 'ROOM_CLOSED' || body.action === 'close' || payload?.action === 'close') {
        roomsStore.delete(targetRoomId);
        return res.status(200).json({ ok: true, closed: true, message: 'Sala cerrada por el conductor' });
      }

      // B) Anuncio del Host (Pantalla del Carro) -> Solo aquí se crea o renueva la sala
      if (type === 'HOST_ANNOUNCE') {
        let room = roomsStore.get(targetRoomId);
        if (!room) {
          room = {
            roomId: targetRoomId,
            roomName: payload?.roomName || `CarBeat ${targetRoomId}`,
            hostIp: payload?.hostIp || 'Nube Vercel',
            hostLastSeen: Date.now(),
            currentTrack: null,
            isPlaying: false,
            currentTime: 0,
            duration: 0,
            queue: [],
            djs: {},
            pendingEvents: [],
            lastUpdated: Date.now(),
          };
          roomsStore.set(targetRoomId, room);
        } else {
          room.hostLastSeen = Date.now();
          if (payload?.roomName) room.roomName = payload.roomName;
          if (payload?.hostIp) room.hostIp = payload.hostIp;
          room.lastUpdated = Date.now();
        }
        return res.status(200).json({ ok: true, roomId: targetRoomId });
      }

      // Si la sala no existe en roomsStore, permitir crear sala temporal si es un DJ intentando conectar
      let room = roomsStore.get(targetRoomId);
      if (!room || now - room.hostLastSeen > INACTIVE_TIMEOUT_MS) {
        if (room) roomsStore.delete(targetRoomId);
        return res.status(404).json({ exists: false, error: `La sala "${targetRoomId}" está inactiva o cerrada.` });
      }

      // Inicializar array de eventos si no existe
      if (!room.pendingEvents) room.pendingEvents = [];

      // Función auxiliar para registrar evento en tránsito para el Host
      const enqueueEventForHost = (evtType: string, evtPayload: any) => {
        room!.pendingEvents.push({
          id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          type: evtType,
          senderId: senderId || 'dj',
          senderName: senderName || payload?.djName || 'DJ',
          timestamp: Date.now(),
          payload: evtPayload,
        });
        if (room!.pendingEvents.length > 60) {
          room!.pendingEvents.shift();
        }
      };

      // B) Heartbeat de DJ (Pasajero activo)
      if (type === 'DJ_HEARTBEAT' || type === 'ROOM_JOIN') {
        const name = payload?.djName || senderName || 'DJ';
        room.djs[name] = Date.now();
        enqueueEventForHost(type, { djName: name, ...payload });
        return res.status(200).json({ ok: true, djCount: Object.keys(room.djs).length });
      }

      // C) DJ Abandona la sala
      if (type === 'ROOM_LEAVE') {
        const name = payload?.djName || senderName || 'DJ';
        delete room.djs[name];
        enqueueEventForHost('ROOM_LEAVE', { djName: name });
        return res.status(200).json({ ok: true });
      }

      // Purga de cola por el conductor
      if (type === 'PURGE_QUEUE') {
        room.queue = [];
        room.lastUpdated = Date.now();
        return res.status(200).json(room);
      }

      // D) Pedir canción a la cola (Deduplicación estricta y suma de votos)
      if (type === 'QUEUE_TRACK' && payload?.track) {
        const track: Track = payload.track;
        const requestedBy: string = payload.requestedBy || senderName || 'DJ Pasajero';

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

        // Notificar al Host para que incorpore la canción a su reproductor
        enqueueEventForHost('QUEUE_TRACK', { track, requestedBy, isAutopilot: payload?.isAutopilot });
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
        enqueueEventForHost('VOTE_TRACK', payload);
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
