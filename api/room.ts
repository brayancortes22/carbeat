import { Track, QueueItem } from '../src/types/track.types';

interface RoomState {
  roomId: string;
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  queue: QueueItem[];
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

  const roomId = ((req.query?.roomId as string) || 'BEAT-784').toUpperCase();

  // Obtener o inicializar sala
  if (!roomsStore.has(roomId)) {
    roomsStore.set(roomId, {
      roomId,
      currentTrack: null,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      queue: [],
      lastUpdated: Date.now(),
    });
  }

  const room = roomsStore.get(roomId)!;

  // GET: Obtener estado actual de la sala
  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.status(200).json(room);
  }

  // POST: Mutaciones y sincronización
  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const { type, payload } = body;

      if (type === 'QUEUE_TRACK' && payload?.track) {
        const track: Track = payload.track;
        const requestedBy: string = payload.requestedBy || 'DJ Pasajero';

        // Evitar duplicar la misma canción en la cola
        const alreadyInQueue = room.queue.some(
          (item) => item.track.id === track.id || item.track.title.toLowerCase() === track.title.toLowerCase()
        );

        if (!alreadyInQueue) {
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
            room.queue.sort((a, b) => b.votes - a.votes);
          }
        }
        room.lastUpdated = Date.now();
        return res.status(200).json(room);
      }

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

      if (type === 'SYNC_STATE' && payload) {
        if (payload.currentTrack !== undefined) room.currentTrack = payload.currentTrack;
        if (payload.isPlaying !== undefined) room.isPlaying = payload.isPlaying;
        if (payload.currentTime !== undefined) room.currentTime = payload.currentTime;
        if (payload.duration !== undefined) room.duration = payload.duration;
        if (Array.isArray(payload.queue)) room.queue = payload.queue;
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
