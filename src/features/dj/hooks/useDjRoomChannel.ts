import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { RoomChannel } from '../../../core/network/room-channel';
import { QueueItem, Track } from '../../../types/track.types';
import { StorageService } from '../../../core/storage/storage-service';

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
    return undefined;
  }, [hostIp, hostPort]);

  const channel = useMemo(() => new RoomChannel(roomId, false, wsUrl), [roomId, wsUrl]);
  const isConnectedRef = useRef(isConnected);
  isConnectedRef.current = isConnected;

  const triggerClose = useCallback(() => {
    setIsRoomClosed(true);
    if (onRoomClosed) onRoomClosed();
  }, [onRoomClosed]);

  useEffect(() => {
    setIsSyncing(true);
    setIsConnected(false);

    channel.send('ROOM_JOIN', djName, djName, { djName });

    const unsub = channel.subscribe((msg) => {
      if (msg.type === 'SYNC_CATALOG') {
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

    const reconnectInterval = setInterval(() => {
      if (!isConnectedRef.current) {
        channel.send('ROOM_JOIN', djName, djName, { djName });
      }
    }, 3000);

    const heartbeatInterval = setInterval(() => {
      channel.send('DJ_HEARTBEAT' as any, djName, djName, { djName });
      fetch('/api/room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'DJ_HEARTBEAT', payload: { djName } }),
      }).catch(() => {});
    }, 3000);

    // Polling de verificación de estado de sala en el servidor
    const roomCheckInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/room?roomId=${encodeURIComponent(roomId)}`);
        if (res.status === 404) {
          triggerClose();
          return;
        }
        const data = await res.json();
        if (data.closed || (data.exists === false && !data.id)) {
          triggerClose();
        }
      } catch {
        // noop
      }
    }, 5000);

    return () => {
      unsub();
      clearInterval(reconnectInterval);
      clearInterval(heartbeatInterval);
      clearInterval(roomCheckInterval);
      channel.send('ROOM_LEAVE' as any, djName, djName, { djName });
      channel.close();
    };
  }, [channel, djName, roomId, setCatalog, setQueue, triggerClose]);

  const leaveRoom = useCallback(() => {
    channel.send('ROOM_LEAVE' as any, djName, djName, { djName });
    fetch('/api/room', {
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
