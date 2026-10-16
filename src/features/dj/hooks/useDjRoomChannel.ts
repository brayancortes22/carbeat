import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { RoomChannel, getDefaultWsUrl } from '../../../core/network/room-channel';
import { QueueItem, Track } from '../../../types/track.types';
import { StorageService } from '../../../core/storage/storage-service';
import { apiUrl } from '../../../core/network/api-config';

export interface LivePlaybackState {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
}

interface UseDjRoomChannelProps {
  roomId: string;
  djName: string;
  hostIp?: string;
  hostPort?: number;
  setCatalog: React.Dispatch<React.SetStateAction<Track[]>>;
  setQueue: React.Dispatch<React.SetStateAction<QueueItem[]>>;
  onRoomClosed?: () => void;
}

export function useDjRoomChannel({
  roomId,
  djName,
  hostIp,
  hostPort,
  setCatalog,
  setQueue,
  onRoomClosed,
}: UseDjRoomChannelProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(true);
  const [isRoomClosed, setIsRoomClosed] = useState(false);
  const [livePlayback, setLivePlayback] = useState<LivePlaybackState>({
    currentTrack: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
  });

  const wsUrl = useMemo(() => {
    const effectiveIp =
      (hostIp === 'localhost' || hostIp === '127.0.0.1') && window.location.hostname !== 'localhost'
        ? window.location.hostname
        : hostIp;
    if (effectiveIp && hostPort) {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${proto}//${effectiveIp}:${hostPort}/ws-rooms`;
    }
    return getDefaultWsUrl();
  }, [hostIp, hostPort]);

  const channel = useMemo(() => new RoomChannel(roomId, false, wsUrl), [roomId, wsUrl]);
  const isConnectedRef = useRef(isConnected);
  isConnectedRef.current = isConnected;

  const triggerClose = useCallback(() => {
    setIsRoomClosed(true);
    if (onRoomClosed) onRoomClosed();
  }, [onRoomClosed]);

  useEffect(() => {
    if (channel.isConnected()) {
      setIsConnected(true);
      setIsSyncing(false);
    } else {
      setIsSyncing(true);
      setIsConnected(false);
    }

    channel.send('ROOM_JOIN', djName, djName, { djName });

    const unsub = channel.subscribe((msg) => {
      if ((msg.type as any) === 'SOCKET_STATUS') {
        const payload = msg.payload as { connected: boolean };
        if (payload?.connected) {
          setIsConnected(true);
          setIsSyncing(false);
        }
      } else if (msg.type === 'SYNC_CATALOG') {
        const payload = msg.payload as {
          catalog?: Track[];
          queue?: QueueItem[];
          currentTrack?: Track | null;
          isPlaying?: boolean;
          currentTime?: number;
          duration?: number;
        };
        if (payload.catalog) setCatalog(StorageService.deduplicateTracks(payload.catalog));
        if (payload.queue) setQueue(StorageService.deduplicateQueue(payload.queue));
        if (payload.currentTrack !== undefined || payload.isPlaying !== undefined) {
          setLivePlayback((prev) => ({
            currentTrack: payload.currentTrack !== undefined ? payload.currentTrack : prev.currentTrack,
            isPlaying: payload.isPlaying !== undefined ? payload.isPlaying : prev.isPlaying,
            currentTime: payload.currentTime !== undefined ? payload.currentTime : prev.currentTime,
            duration: payload.duration !== undefined ? payload.duration : prev.duration,
          }));
        }
        setIsConnected(true);
        setIsSyncing(false);
      } else if (msg.type === 'PLAYBACK_STATE') {
        setLivePlayback(msg.payload as LivePlaybackState);
        setIsConnected(true);
        setIsSyncing(false);
      } else if (msg.type === 'CLOSE_ROOM') {
        triggerClose();
      }
    });

    const statusCheckInterval = setInterval(() => {
      if (channel.isConnected() && !isConnectedRef.current) {
        setIsConnected(true);
        setIsSyncing(false);
      }
    }, 500);

    const reconnectInterval = setInterval(() => {
      if (!isConnectedRef.current) {
        channel.send('ROOM_JOIN', djName, djName, { djName });
      }
    }, 3000);

    const heartbeatInterval = setInterval(() => {
      channel.send('DJ_HEARTBEAT' as any, djName, djName, { djName });
      fetch(apiUrl('/api/room'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'DJ_HEARTBEAT', payload: { djName } }),
      }).catch(() => {});
    }, 3000);

    // Polling de verificación de estado de sala en el servidor
    // SOLO cerrar la sala si el chofer la cerró explícitamente (data.closed === true)
    // NUNCA cerrar por microcortes de red, reintentos o respuestas transitorias
    const roomCheckInterval = setInterval(async () => {
      try {
        const res = await fetch(apiUrl(`/api/room?roomId=${encodeURIComponent(roomId)}`));
        if (res.ok) {
          const data = await res.json();
          if (data.closed === true) {
            triggerClose();
          }
        }
      } catch {
        // Tolerante a microcortes en red móvil / túneles
      }
    }, 4000);

    return () => {
      unsub();
      clearInterval(statusCheckInterval);
      clearInterval(reconnectInterval);
      clearInterval(heartbeatInterval);
      clearInterval(roomCheckInterval);
    };
  }, [channel, djName, roomId, setCatalog, setQueue, triggerClose]);

  const leaveRoom = useCallback(() => {
    channel.send('ROOM_LEAVE' as any, djName, djName, { djName });
    fetch(apiUrl('/api/room'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'ROOM_LEAVE', payload: { djName } }),
    }).catch(() => {});
    channel.close();
  }, [channel, djName]);

  return {
    channel,
    isConnected,
    isSyncing,
    isRoomClosed,
    livePlayback,
    leaveRoom,
  };
}
