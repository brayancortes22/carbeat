import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { CatalogBrowser } from './components/CatalogBrowser';
import { QueueVoteList } from './components/QueueVoteList';
import { NewTrackModal } from './components/NewTrackModal';
import { GlassCard } from '../../components/ui/GlassCard';
import { Badge } from '../../components/ui/Badge';
import { TrackCover } from '../../components/ui/TrackCover';
import { RoomChannel } from '../../core/network/room-channel';
import { MOCK_CAR_TRACKS } from '../../core/audio/mock-library';
import { QueueItem, Track } from '../../types/track.types';
import { StorageService } from '../../core/storage/storage-service';
import { CARBEAT_VERSION } from '../../core/version';
import { VersionBadge } from '../../components/ui/VersionBadge';
import { ArrowLeft, Sparkles, Radio, Check, Volume2, Music, Wifi, WifiOff, RefreshCw } from 'lucide-react';

interface DjViewProps {
  roomId: string;
  djName: string;
  hostIp?: string; // IP del host del carro para conectar por red
  hostPort?: number; // Puerto del host del carro
  onLeaveRoom: () => void;
}

interface LivePlaybackState {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
}

export const DjView: React.FC<DjViewProps> = ({ roomId, djName, hostIp, hostPort, onLeaveRoom }) => {
  const [catalog, setCatalog] = useState<Track[]>(() => StorageService.loadCatalog(MOCK_CAR_TRACKS));
  const [queue, setQueue] = useState<QueueItem[]>(() => StorageService.loadQueue());
  const [activeView, setActiveView] = useState<'catalog' | 'queue'>('catalog');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(true);
  const [livePlayback, setLivePlayback] = useState<LivePlaybackState>({
    currentTrack: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
  });

  // Construir URL del WebSocket: si hay hostIp, conectar al carro remoto; si no, usar localhost
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

  const showToast = (text: string) => {
    setToastMessage(text);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Cerrar canal al desmontar
  useEffect(() => {
    return () => {
      channel.close();
    };
  }, [channel]);

  // Suscribirse a mensajes del Host
  useEffect(() => {
    setIsSyncing(true);
    setIsConnected(false);

    // Anunciar entrada a la sala al Host
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
        const payload = msg.payload as LivePlaybackState;
        setLivePlayback(payload);
        setIsConnected(true);
        setIsSyncing(false);
      } else if (msg.type === 'QUEUE_TRACK') {
        const payload = msg.payload as { track: Track; requestedBy: string };
        setQueue((prev) => {
          const existingIndex = prev.findIndex(
            (item) =>
              item.track.id === payload.track.id ||
              item.track.title.toLowerCase().trim() === payload.track.title.toLowerCase().trim()
          );
          if (existingIndex >= 0) {
            const updated = [...prev];
            updated[existingIndex] = {
              ...updated[existingIndex],
              votes: updated[existingIndex].votes + 1,
            };
            return StorageService.deduplicateQueue(updated);
          }
          const newItem: QueueItem = {
            queueId: `queue_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            track: payload.track,
            votes: 1,
            requestedBy: payload.requestedBy,
            requestedAt: Date.now(),
          };
          return StorageService.deduplicateQueue([...prev, newItem]);
        });
        setIsConnected(true);
      } else if (msg.type === 'VOTE_TRACK') {
        const payload = msg.payload as { queueId: string; delta: number };
        setQueue((prev) =>
          prev
            .map((item) => (item.queueId === payload.queueId ? { ...item, votes: Math.max(0, item.votes + payload.delta) } : item))
            .sort((a, b) => b.votes - a.votes)
        );
        setIsConnected(true);
      }
    });

    // Reintentar conexión cada 3 segundos si no hay respuesta
    const reconnectInterval = setInterval(() => {
      if (!isConnectedRef.current) {
        channel.send('ROOM_JOIN', djName, djName, { djName });
      }
    }, 3000);

    // Enviar latido de DJ cada 3 segundos para mantener presencia en vivo en la pantalla del carro
    const heartbeatInterval = setInterval(() => {
      channel.send('DJ_HEARTBEAT' as any, djName, djName, { djName });
      fetch('/api/room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'DJ_HEARTBEAT', payload: { djName } }),
      }).catch(() => {});
    }, 3000);

    return () => {
      unsub();
      clearInterval(reconnectInterval);
      clearInterval(heartbeatInterval);
      channel.send('ROOM_LEAVE' as any, djName, djName, { djName });
      fetch('/api/room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'ROOM_LEAVE', payload: { djName } }),
      }).catch(() => {});
    };
  }, [channel, djName]);

  // Persistir catálogo ante cambios recibidos
  useEffect(() => {
    StorageService.saveCatalog(catalog);
  }, [catalog]);

  // Persistir cola ante cambios recibidos
  useEffect(() => {
    StorageService.saveQueue(queue);
  }, [queue]);

  const handleQueueTrack = useCallback((track: Track) => {
    setQueue((prev) => {
      const existingIndex = prev.findIndex(
        (item) =>
          item.track.id === track.id ||
          item.track.title.toLowerCase().trim() === track.title.toLowerCase().trim()
      );
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          votes: updated[existingIndex].votes + 1,
        };
        return StorageService.deduplicateQueue(updated);
      }

      const newItem: QueueItem = {
        queueId: `queue_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        track,
        votes: 1,
        requestedBy: djName,
        requestedAt: Date.now(),
      };
      return StorageService.deduplicateQueue([...prev, newItem]);
    });

    channel.send('QUEUE_TRACK', djName, djName, { track, requestedBy: djName });
    showToast(`"${track.title}" enviada al carro`);
  }, [channel, djName]);

  const handleVote = useCallback((queueId: string, delta: number) => {
    channel.send('VOTE_TRACK', djName, djName, { queueId, delta });
  }, [channel, djName]);

  const handleAddNewTrack = useCallback((track: Track) => {
    setCatalog((prev) => StorageService.deduplicateTracks([track, ...prev]));
    handleQueueTrack(track);
  }, [handleQueueTrack]);

  const handleLeave = () => {
    channel.send('ROOM_LEAVE' as any, djName, djName, { djName });
    fetch('/api/room', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'ROOM_LEAVE', payload: { djName } }),
    }).catch(() => {});
    onLeaveRoom();
  };

  const progressPercent = livePlayback.duration > 0
    ? (livePlayback.currentTime / livePlayback.duration) * 100
    : 0;

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remaining = Math.floor(secs % 60);
    return `${mins}:${remaining < 10 ? '0' : ''}${remaining}`;
  };

  return (
    <div className="min-h-screen bg-[#08090E] p-3 sm:p-5 flex flex-col justify-between max-w-xl mx-auto pb-4">
      {/* Header DJ */}
      <header className="flex items-center justify-between pb-3 border-b border-white/5">
        <button
          onClick={handleLeave}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Salir
        </button>
        <div className="flex items-center gap-2">
          {/* Indicador de conexión */}
          {isSyncing ? (
            <Badge variant="amber" className="text-[10px]">
              <RefreshCw className="w-3 h-3 animate-spin" /> Sincronizando...
            </Badge>
          ) : isConnected ? (
            <Badge variant="emerald" className="text-[10px]">
              <Wifi className="w-3 h-3" /> Conectado
            </Badge>
          ) : (
            <Badge variant="amber" className="text-[10px]">
              <WifiOff className="w-3 h-3" /> Sin conexión
            </Badge>
          )}
          <Badge variant="purple" className="text-[10px]">
            <Radio className="w-3 h-3 animate-pulse" /> {roomId}
          </Badge>
          <VersionBadge version={CARBEAT_VERSION} compact />
          <span className="text-xs font-semibold text-white">{djName}</span>
        </div>
      </header>

      {/* Tarjeta En Vivo: Sonando en la Pantalla del Carro */}
      <div className="my-2.5 p-3 rounded-2xl bg-gradient-to-r from-cyan-950/40 to-slate-900/60 border border-cyan-500/30 flex flex-col gap-2 shadow-xl shadow-cyan-950/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative">
              <TrackCover
                src={livePlayback.currentTrack?.coverUrl}
                alt="Car Playing"
                className="w-11 h-11 rounded-xl shadow-md"
              />
              {livePlayback.isPlaying && (
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center">
                  <Volume2 className="w-2.5 h-2.5 text-white" />
                </div>
              )}
            </div>
            <div className="min-w-0 text-left">
              <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Volume2 className={`w-3.5 h-3.5 text-cyan-400 ${livePlayback.isPlaying ? 'animate-pulse' : ''}`} />
                Sonando en el Carro
              </span>
              <h4 className="text-sm font-bold text-white truncate">
                {livePlayback.currentTrack?.title || 'En espera de reproducción'}
              </h4>
              <p className="text-xs text-slate-400 truncate">
                {livePlayback.currentTrack?.artist || 'Selecciona o pide una canción'}
              </p>
            </div>
          </div>
          <Badge variant={livePlayback.isPlaying ? 'emerald' : 'slate'} className="text-[9px] shrink-0">
            {livePlayback.isPlaying ? 'En Vivo' : 'En Pausa'}
          </Badge>
        </div>
        {/* Barra de progreso con tiempo */}
        <div className="space-y-1">
          <div className="h-1.5 w-full bg-slate-800/80 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-sky-400 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>{formatTime(livePlayback.currentTime)}</span>
            <span>{formatTime(livePlayback.duration)}</span>
          </div>
        </div>
      </div>

      {/* Selector de pestañas */}
      <div className="grid grid-cols-2 gap-2 my-1.5">
        <button
          onClick={() => setActiveView('catalog')}
          className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeView === 'catalog'
              ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
              : 'bg-white/[0.03] text-slate-400 hover:text-white border border-white/5'
          }`}
        >
          Explorar Música ({catalog.length})
        </button>
        <button
          onClick={() => setActiveView('queue')}
          className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeView === 'queue'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
              : 'bg-white/[0.03] text-slate-400 hover:text-white border border-white/5'
          }`}
        >
          <Music className="w-3.5 h-3.5" />
          <span>Cola de Espera</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full bg-white/20 text-[10px]">{queue.length}</span>
        </button>
      </div>

      {/* Contenido Principal */}
      <GlassCard className="flex-1 my-1 p-3.5 sm:p-4 overflow-hidden flex flex-col min-h-[300px]">
        {activeView === 'catalog' ? (
          <CatalogBrowser catalog={catalog} onQueueTrack={handleQueueTrack} />
        ) : (
          <QueueVoteList queue={queue} onVote={handleVote} />
        )}
      </GlassCard>

      {/* Botón Destacado para Buscar Música Online con Datos */}
      <div className="pt-2">
        <button
          onClick={() => setIsModalOpen(true)}
          className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-500 hover:opacity-95 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-purple-500/25 active:scale-98 transition-all cursor-pointer"
        >
          <Sparkles className="w-4 h-4" />
          Buscar Música Online (Top & Datos)
        </button>
      </div>

      {/* Modal para Nueva Música */}
      <NewTrackModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAddTrack={handleAddNewTrack}
        djName={djName}
      />

      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-slate-900 border border-cyan-500/40 text-cyan-300 text-xs py-2 px-4 rounded-full shadow-2xl flex items-center gap-2 z-50 animate-bounce">
          <Check className="w-3.5 h-3.5 text-cyan-400" />
          {toastMessage}
        </div>
      )}
    </div>
  );
};
