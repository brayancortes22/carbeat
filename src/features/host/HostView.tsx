import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { NowPlayingScreen } from './components/NowPlayingScreen';
import { RoomQrBadge } from './components/RoomQrBadge';
import { HostQueueList } from './components/HostQueueList';
import { GlassCard } from '../../components/ui/GlassCard';
import { globalAudioEngine } from '../../core/audio/audio-player';
import { MOCK_CAR_TRACKS } from '../../core/audio/mock-library';
import { RoomChannel } from '../../core/network/room-channel';
import { QueueItem, Track } from '../../types/track.types';
import { ArrowLeft, Library, FolderPlus, Globe } from 'lucide-react';
import { LocalScanner } from '../../core/audio/local-scanner';
import { HostWebSearchModal } from './components/HostWebSearchModal';
import { CARBEAT_VERSION } from '../../core/version';
import { VersionBadge } from '../../components/ui/VersionBadge';
import { startHostAnnouncer, stopHostAnnouncer } from '../../core/network/host-discovery';
import { StorageService } from '../../core/storage/storage-service';

interface HostViewProps {
  onBackToLanding: () => void;
  roomId?: string;
}

export const HostView: React.FC<HostViewProps> = ({ onBackToLanding, roomId = 'BEAT-784' }) => {
  const [catalog, setCatalog] = useState<Track[]>(() => StorageService.loadCatalog(MOCK_CAR_TRACKS));
  const [queue, setQueue] = useState<QueueItem[]>(() => StorageService.loadQueue());
  const [playerState, setPlayerState] = useState(globalAudioEngine.getState());
  const [connectedDjs, setConnectedDjs] = useState<string[]>([]);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isAnnouncing, setIsAnnouncing] = useState(false);

  const channel = useMemo(() => new RoomChannel(roomId), [roomId]);

  // Refs para uso en callbacks sin causar re-renders
  const queueRef = useRef(queue);
  const catalogRef = useRef(catalog);
  const playerStateRef = useRef(playerState);
  queueRef.current = queue;
  catalogRef.current = catalog;
  playerStateRef.current = playerState;

  // Manejar el avance a la siguiente canción
  const handleNext = useCallback(() => {
    const currentQueue = queueRef.current;
    const currentCatalog = catalogRef.current;
    const currentTrackId = playerStateRef.current.currentTrack?.id;
    if (currentQueue.length > 0) {
      const nextItem = currentQueue[0];
      // Si es la misma pista que acaba de terminar, saltarla
      if (nextItem.track.id === currentTrackId && currentQueue.length > 1) {
        const nextNextItem = currentQueue[1];
        setQueue((prev) => prev.slice(2));
        globalAudioEngine.loadTrack(nextNextItem.track, true);
        return;
      }
      setQueue((prev) => prev.slice(1));
      globalAudioEngine.loadTrack(nextItem.track, true);
    } else if (currentCatalog.length > 0) {
      const randomIdx = Math.floor(Math.random() * currentCatalog.length);
      globalAudioEngine.loadTrack(currentCatalog[randomIdx], true);
    }
  }, []);

  // Suscribirse a cambios de audio y difundir a los DJs
  useEffect(() => {
    const unsub = globalAudioEngine.subscribe((state) => {
      setPlayerState(state);
      channel.send('PLAYBACK_STATE', 'host', 'Pantalla Carro', {
        isPlaying: state.isPlaying,
        currentTime: state.currentTime,
        duration: state.duration,
        currentTrack: state.currentTrack,
      });
    });
    globalAudioEngine.setOnEnded(() => handleNext());
    return () => {
      unsub();
    };
  }, [channel, handleNext]);

  // Heartbeat: Enviar progreso cada segundo para sincronizar la barra del celular
  useEffect(() => {
    const interval = setInterval(() => {
      const state = globalAudioEngine.getState();
      channel.send('PLAYBACK_STATE', 'host', 'Pantalla Carro', {
        isPlaying: state.isPlaying,
        currentTime: state.currentTime,
        duration: state.duration,
        currentTrack: state.currentTrack,
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [channel]);

  // Guardar catálogo en localStorage ante cambios
  useEffect(() => {
    StorageService.saveCatalog(catalog);
  }, [catalog]);

  // Guardar cola en localStorage ante cambios
  useEffect(() => {
    StorageService.saveQueue(queue);
  }, [queue]);

  // Cargar primera canción si no hay ninguna
  useEffect(() => {
    if (!playerState.currentTrack && catalog.length > 0) {
      globalAudioEngine.loadTrack(catalog[0], false);
    }
  }, [catalog, playerState.currentTrack]);

  // Cierre limpio de canal solo al desmontar
  useEffect(() => {
    return () => {
      channel.close();
    };
  }, [channel]);

  // Anunciar presencia del Host por WebSocket de descubrimiento (/ws-discovery)
  // Esto permite que los celulares encuentren el carro en la misma red Wi-Fi
  useEffect(() => {
    setIsAnnouncing(true);
    startHostAnnouncer(roomId, `Carro ${roomId}`, window.location.hostname, connectedDjs.length);
    return () => {
      setIsAnnouncing(false);
      stopHostAnnouncer();
    };
  }, [roomId, connectedDjs.length]);

  // Sincronizar cola con DJs cuando cambia
  useEffect(() => {
    channel.send('SYNC_CATALOG', 'host', 'Pantalla Carro', {
      catalog: catalogRef.current,
      queue: queueRef.current,
      currentTrack: playerStateRef.current.currentTrack,
      isPlaying: playerStateRef.current.isPlaying,
      currentTime: playerStateRef.current.currentTime,
      duration: playerStateRef.current.duration,
    });
  }, [queue, channel]);

  // Escuchar mensajes entrantes de los DJs
  useEffect(() => {
    const unsubChannel = channel.subscribe((msg) => {
      if (msg.type === 'QUEUE_TRACK') {
        const payload = msg.payload as { track: Track; requestedBy: string };

        // Asegurar que la nueva pista quede en el catálogo del host
        if (!catalogRef.current.some((t) => t.id === payload.track.id)) {
          const updatedCatalog = [payload.track, ...catalogRef.current];
          catalogRef.current = updatedCatalog;
          setCatalog(updatedCatalog);
        }

        const newItem: QueueItem = {
          queueId: `queue_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          track: payload.track,
          votes: 1,
          requestedBy: payload.requestedBy || 'DJ Anónimo',
          requestedAt: Date.now(),
        };

        const currentPlayingTrack = playerStateRef.current.currentTrack;
        const isCurrentlyPlaying = playerStateRef.current.isPlaying;

        let finalQueue: QueueItem[];
        let nextPlayingTrack = currentPlayingTrack;

        if (!currentPlayingTrack) {
          // Si el carro no tiene canción cargada, comenzar a reproducir de inmediato
          globalAudioEngine.loadTrack(newItem.track, true);
          finalQueue = queueRef.current;
          nextPlayingTrack = newItem.track;
        } else {
          // Si ya hay una canción sonando o cargada, añadir a la cola ordenada por votos
          finalQueue = [...queueRef.current, newItem].sort((a, b) => b.votes - a.votes);
        }

        queueRef.current = finalQueue;
        setQueue(finalQueue);

        // Notificar inmediatamente la cola real y el estado del reproductor a todos los DJs
        channel.send('SYNC_CATALOG', 'host', 'Pantalla Carro', {
          catalog: catalogRef.current,
          queue: finalQueue,
          currentTrack: nextPlayingTrack,
          isPlaying: isCurrentlyPlaying || !currentPlayingTrack,
          currentTime: playerStateRef.current.currentTime,
          duration: playerStateRef.current.duration,
        });
      } else if (msg.type === 'VOTE_TRACK') {
        const payload = msg.payload as { queueId: string; delta: number };
        const updatedQueue = queueRef.current
          .map((item) => (item.queueId === payload.queueId ? { ...item, votes: Math.max(0, item.votes + payload.delta) } : item))
          .sort((a, b) => b.votes - a.votes);
        queueRef.current = updatedQueue;
        setQueue(updatedQueue);
        channel.send('SYNC_CATALOG', 'host', 'Pantalla Carro', {
          catalog: catalogRef.current,
          queue: updatedQueue,
          currentTrack: playerStateRef.current.currentTrack,
          isPlaying: playerStateRef.current.isPlaying,
          currentTime: playerStateRef.current.currentTime,
          duration: playerStateRef.current.duration,
        });
      } else if (msg.type === 'NEW_TRACK_OFFER') {
        const payload = msg.payload as { track: Track };
        const updatedCatalog = [payload.track, ...catalogRef.current];
        catalogRef.current = updatedCatalog;
        setCatalog(updatedCatalog);
        channel.send('SYNC_CATALOG', 'host', 'Pantalla Carro', {
          catalog: updatedCatalog,
          queue: queueRef.current,
          currentTrack: playerStateRef.current.currentTrack,
          isPlaying: playerStateRef.current.isPlaying,
          currentTime: playerStateRef.current.currentTime,
          duration: playerStateRef.current.duration,
        });
      } else if (msg.type === 'ROOM_JOIN') {
        if (msg.senderName) {
          setConnectedDjs((prev) => (prev.includes(msg.senderName!) ? prev : [...prev, msg.senderName!]));
        }
        // Responder inmediatamente enviando catálogo, cola y estado actual de reproducción
        channel.send('SYNC_CATALOG', 'host', 'Pantalla Carro', {
          catalog: catalogRef.current,
          queue: queueRef.current,
          currentTrack: playerStateRef.current.currentTrack,
          isPlaying: playerStateRef.current.isPlaying,
          currentTime: playerStateRef.current.currentTime,
          duration: playerStateRef.current.duration,
        });
      }
    });

    return () => {
      unsubChannel();
    };
  }, [channel]);

  const handleFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const scannedTracks = await LocalScanner.scanAudioFiles(e.target.files);
      if (scannedTracks.length > 0) {
        const newCatalog = [...scannedTracks, ...catalogRef.current];
        setCatalog(newCatalog);
        channel.send('SYNC_CATALOG', 'host', 'Pantalla Carro', {
          catalog: newCatalog,
          queue: queueRef.current,
          currentTrack: playerStateRef.current.currentTrack,
          isPlaying: playerStateRef.current.isPlaying,
          currentTime: playerStateRef.current.currentTime,
          duration: playerStateRef.current.duration,
        });
      }
    }
  };

  const handlePlayNow = (track: Track) => {
    const newCatalog = [track, ...catalogRef.current];
    setCatalog(newCatalog);
    globalAudioEngine.loadTrack(track, true);
    channel.send('PLAYBACK_STATE', 'host', 'Pantalla Carro', {
      isPlaying: true,
      currentTime: 0,
      duration: track.duration || 0,
      currentTrack: track,
    });
  };

  const handleAddToQueue = (track: Track) => {
    const newItem: QueueItem = {
      queueId: `queue_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      track,
      votes: 1,
      requestedBy: 'Conductor (Web)',
      requestedAt: Date.now(),
    };
    const newQueue = [...queueRef.current, newItem].sort((a, b) => b.votes - a.votes);
    setQueue(newQueue);
    const newCatalog = [track, ...catalogRef.current];
    setCatalog(newCatalog);
  };

  return (
    <div className="min-h-screen bg-[#07080D] p-3 sm:p-6 flex flex-col justify-between">
      {/* Barra Superior de Cabina */}
      <header className="flex items-center justify-between pb-4 border-b border-white/5 flex-wrap gap-2">
        <button
          onClick={onBackToLanding}
          className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Salir del Modo Carro
        </button>

        <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
          {/* Indicador de anuncio de descubrimiento */}
          <BadgeDiscovery isAnnouncing={isAnnouncing} />

          {/* Indicador de versión */}
          <VersionBadge version={CARBEAT_VERSION} compact />

          <button
            onClick={() => setIsSearchModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-md shadow-cyan-500/20 transition-all active:scale-95 cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Buscar en la Web</span>
          </button>

          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 text-xs font-semibold cursor-pointer transition-all active:scale-95">
            <FolderPlus className="w-3.5 h-3.5 text-cyan-400" />
            <span>Cargar USB</span>
            <input
              type="file"
              multiple
              accept="audio/*,.mp3,.flac,.m4a"
              onChange={handleFolderSelect}
              className="hidden"
            />
          </label>

          <div className="flex items-center gap-1.5">
            <Library className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-mono text-slate-300">{catalog.length} temas</span>
          </div>
        </div>
      </header>

      {/* Grid Principal de Conducción */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 my-auto py-4">
        {/* Panel Izquierdo: QR y Conexión de Pasajeros */}
        <div className="lg:col-span-3 flex flex-col justify-center">
          <RoomQrBadge roomId={roomId} connectedCount={connectedDjs.length} />
        </div>

        {/* Panel Central: Reproductor de Gran Tamaño (Conducción) */}
        <div className="lg:col-span-5">
          <GlassCard glow className="h-full flex items-center justify-center p-6 border-cyan-500/30">
            <NowPlayingScreen
              track={playerState.currentTrack}
              isPlaying={playerState.isPlaying}
              currentTime={playerState.currentTime}
              duration={playerState.duration}
              volume={playerState.volume}
              onTogglePlay={() => globalAudioEngine.toggle()}
              onNext={handleNext}
              onPrev={() => globalAudioEngine.seek(0)}
              onSeek={(s) => globalAudioEngine.seek(s)}
              onVolumeChange={(v) => globalAudioEngine.setVolume(v)}
            />
          </GlassCard>
        </div>

        {/* Panel Derecho: Cola Dinámica de Pasajeros */}
        <div className="lg:col-span-4">
          <GlassCard className="h-full max-h-[520px] overflow-hidden flex flex-col">
            <HostQueueList queue={queue} onRemoveItem={(id) => setQueue((prev) => prev.filter((i) => i.queueId !== id))} />
          </GlassCard>
        </div>
      </div>

      <footer className="text-center text-[10px] text-slate-600 font-mono">
        CarBeat Host Audio Active • Latencia de cabina &lt; 5ms
      </footer>

      {/* Modal de Búsqueda de Música en la Web para el Carro */}
      <HostWebSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        onPlayNow={handlePlayNow}
        onAddToQueue={handleAddToQueue}
      />
    </div>
  );
};

interface BadgeDiscoveryProps {
  isAnnouncing: boolean;
}

function BadgeDiscovery({ isAnnouncing }: BadgeDiscoveryProps) {
  return (
    <span className={`flex items-center gap-1 text-xs ${isAnnouncing ? 'text-emerald-400' : 'text-slate-500'}`}>
      <div
        className={`w-1.5 h-1.5 rounded-full ${isAnnouncing ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`}
      />
      <span>{isAnnouncing ? 'Anunciando en red' : 'Esperando red'}</span>
    </span>
  );
}
