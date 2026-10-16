import { useEffect, useMemo, useRef, useState } from 'react';
import { RoomChannel } from '../../../core/network/room-channel';
import { QueueItem, Track } from '../../../types/track.types';
import { StorageService } from '../../../core/storage/storage-service';
import { globalAudioEngine } from '../../../core/audio/audio-player';

interface UseHostRoomChannelProps {
  roomId: string;
  catalog: Track[];
  setCatalog: React.Dispatch<React.SetStateAction<Track[]>>;
  queue: QueueItem[];
  setQueue: React.Dispatch<React.SetStateAction<QueueItem[]>>;
  playerState: ReturnType<typeof globalAudioEngine.getState>;
}

export function useHostRoomChannel({
  roomId,
  catalog,
  setCatalog,
  queue,
  setQueue,
  playerState,
}: UseHostRoomChannelProps) {
  const channel = useMemo(() => new RoomChannel(roomId, true), [roomId]);
  const [connectedDjs, setConnectedDjs] = useState<string[]>([]);
  const djHeartbeatsRef = useRef<Map<string, number>>(new Map());

  const queueRef = useRef(queue);
  const catalogRef = useRef(catalog);
  const playerStateRef = useRef(playerState);
  queueRef.current = queue;
  catalogRef.current = catalog;
  playerStateRef.current = playerState;

  // Limpiar DJs desconectados (>8s sin latido)
  useEffect(() => {
    const cleaner = setInterval(() => {
      const now = Date.now();
      let changed = false;
      for (const [name, lastSeen] of djHeartbeatsRef.current.entries()) {
        if (now - lastSeen > 8000) {
          djHeartbeatsRef.current.delete(name);
          changed = true;
        }
      }
      if (changed) {
        setConnectedDjs(Array.from(djHeartbeatsRef.current.keys()));
      }
    }, 2500);
    return () => clearInterval(cleaner);
  }, []);

  // Escuchar mensajes entrantes de los DJs
  useEffect(() => {
    const unsub = channel.subscribe((msg) => {
      if (msg.type === 'QUEUE_TRACK') {
        const payload = msg.payload as { track: Track; requestedBy: string; isAutopilot?: boolean };
        const updatedCatalog = StorageService.deduplicateTracks([payload.track, ...catalogRef.current]);
        catalogRef.current = updatedCatalog;
        setCatalog(updatedCatalog);

        const existingIndex = queueRef.current.findIndex(
          (item) =>
            item.track.id === payload.track.id ||
            item.track.title.toLowerCase().trim() === payload.track.title.toLowerCase().trim()
        );

        if (existingIndex >= 0) {
          const updated = [...queueRef.current];
          updated[existingIndex] = {
            ...updated[existingIndex],
            votes: updated[existingIndex].votes + 1,
          };
          const sorted = StorageService.deduplicateQueue(updated);
          queueRef.current = sorted;
          setQueue(sorted);
          broadcastSync(sorted, updatedCatalog);
          return;
        }

        const newItem: QueueItem = {
          queueId: `queue_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          track: payload.track,
          votes: 1,
          requestedBy: payload.requestedBy || 'DJ Pasajero',
          requestedAt: Date.now(),
          isAutopilot: payload.isAutopilot || false,
        };

        const currentPlayingTrack = playerStateRef.current.currentTrack;
        let finalQueue: QueueItem[];

        if (!currentPlayingTrack) {
          globalAudioEngine.loadTrack(newItem.track, true);
          finalQueue = queueRef.current;
        } else {
          finalQueue = StorageService.deduplicateQueue([...queueRef.current, newItem]);
        }

        queueRef.current = finalQueue;
        setQueue(finalQueue);
        broadcastSync(finalQueue, updatedCatalog);
      } else if (msg.type === 'VOTE_TRACK') {
        const payload = msg.payload as { queueId: string; delta: number };
        const updatedQueue = queueRef.current
          .map((item) => (item.queueId === payload.queueId ? { ...item, votes: Math.max(0, item.votes + payload.delta) } : item))
          .sort((a, b) => b.votes - a.votes);
        queueRef.current = updatedQueue;
        setQueue(updatedQueue);
        broadcastSync(updatedQueue, catalogRef.current);
      } else if (msg.type === 'ROOM_JOIN' || (msg.type as any) === 'DJ_HEARTBEAT') {
        if (msg.senderName) {
          djHeartbeatsRef.current.set(msg.senderName, Date.now());
          setConnectedDjs(Array.from(djHeartbeatsRef.current.keys()));
        }
        broadcastSync(queueRef.current, catalogRef.current);
      } else if ((msg.type as any) === 'ROOM_LEAVE') {
        if (msg.senderName) {
          djHeartbeatsRef.current.delete(msg.senderName);
          setConnectedDjs(Array.from(djHeartbeatsRef.current.keys()));
        }
      }
    });

    return () => unsub();
  }, [channel, setCatalog, setQueue]);

  const broadcastSync = (currentQueue = queueRef.current, currentCat = catalogRef.current) => {
    channel.send('SYNC_CATALOG', 'host', 'Pantalla Carro', {
      catalog: currentCat,
      queue: currentQueue,
      currentTrack: playerStateRef.current.currentTrack,
      isPlaying: playerStateRef.current.isPlaying,
      currentTime: playerStateRef.current.currentTime,
      duration: playerStateRef.current.duration,
    });
  };

  const closeRoom = async (onDone: () => void) => {
    globalAudioEngine.pause();
    channel.send('CLOSE_ROOM', 'host', 'Pantalla Carro', {
      reason: 'El chofer ha cerrado la sala',
    });
    try {
      await fetch('/api/room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'close', roomId }),
      });
    } catch {
      // noop
    }
    StorageService.clearQueue();
    channel.close();
    onDone();
  };

  return {
    channel,
    connectedDjs,
    broadcastSync,
    closeRoom,
  };
}
