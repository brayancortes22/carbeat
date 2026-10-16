import React, { useState, useEffect, useCallback, useRef } from 'react';
import { NowPlayingScreen } from './components/NowPlayingScreen';
import { RoomQrBadge } from './components/RoomQrBadge';
import { HostQueueList } from './components/HostQueueList';
import { HostHeader } from './components/HostHeader';
import { HostQueueActions } from './components/HostQueueActions';
import { DriverLibraryModal } from './components/DriverLibraryModal';
import { HostWebSearchModal } from './components/HostWebSearchModal';
import { GlassCard } from '../../components/ui/GlassCard';
import { globalAudioEngine } from '../../core/audio/audio-player';
import { MOCK_CAR_TRACKS } from '../../core/audio/mock-library';
import { Track } from '../../types/track.types';
import { LocalScanner } from '../../core/audio/local-scanner';
import { startHostAnnouncer, stopHostAnnouncer } from '../../core/network/host-discovery';
import { StorageService } from '../../core/storage/storage-service';
import { useHostRoomChannel } from './hooks/useHostRoomChannel';
import { useHostAutopilot } from './hooks/useHostAutopilot';

interface HostViewProps {
  onBackToLanding: () => void;
  roomId?: string;
}

export const HostView: React.FC<HostViewProps> = ({ onBackToLanding, roomId = 'BEAT-784' }) => {
  const [catalog, setCatalog] = useState<Track[]>(() => StorageService.loadCatalog(MOCK_CAR_TRACKS));
  const [queue, setQueue] = useState(() => StorageService.loadQueue());
  const [playerState, setPlayerState] = useState(globalAudioEngine.getState());
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isAnnouncing, setIsAnnouncing] = useState(false);
  const [hostLanIp, setHostLanIp] = useState(window.location.hostname);

  const { channel, connectedDjs, broadcastSync, closeRoom } = useHostRoomChannel({
    roomId,
    catalog,
    setCatalog,
    queue,
    setQueue,
    playerState,
  });

  const queueRef = useRef(queue);
  const catalogRef = useRef(catalog);
  queueRef.current = queue;
  catalogRef.current = catalog;

  // Manejar el avance a la siguiente canción
  const handleNext = useCallback(() => {
    const currentQueue = queueRef.current;
    const currentCatalog = catalogRef.current;
    if (currentQueue.length > 0) {
      const nextItem = currentQueue[0];
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
    return () => unsub();
  }, [channel, handleNext]);

  // Guardar en almacenamiento local
  useEffect(() => {
    StorageService.saveCatalog(catalog);
  }, [catalog]);

  useEffect(() => {
    StorageService.saveQueue(queue);
  }, [queue]);

  // Cargar primera canción si no hay ninguna
  useEffect(() => {
    if (!playerState.currentTrack && catalog.length > 0) {
      globalAudioEngine.loadTrack(catalog[0], false);
    }
  }, [catalog, playerState.currentTrack]);

  // IP LAN y Anuncio en Red local
  useEffect(() => {
    fetch('/api/server-info')
      .then((res) => res.json())
      .then((data) => {
        if (data.ips?.[0]) setHostLanIp(data.ips[0]);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setIsAnnouncing(true);
    startHostAnnouncer(roomId, `Carro ${roomId}`, hostLanIp, connectedDjs.length);
    return () => {
      setIsAnnouncing(false);
      stopHostAnnouncer();
    };
  }, [roomId, hostLanIp, connectedDjs.length]);

  // Autopilot IA: Encolar canción de 1 en 1 sin saturar la red
  const handleEnqueueAutopilot = useCallback((track: Track) => {
    channel.send('QUEUE_TRACK', 'host', 'IA Autopilot ⚡', {
      track,
      requestedBy: 'IA Autopilot',
      isAutopilot: true,
    });
  }, [channel]);

  const { isAutopilotActive, toggleAutopilot } = useHostAutopilot({
    currentTrack: playerState.currentTrack,
    queue,
    onEnqueueTrack: handleEnqueueAutopilot,
  });

  const handlePlayNow = (track: Track) => {
    const newCatalog = StorageService.deduplicateTracks([track, ...catalogRef.current]);
    setCatalog(newCatalog);
    globalAudioEngine.loadTrack(track, true);
  };

  const handleAddToQueueFromDriver = (track: Track) => {
    channel.send('QUEUE_TRACK', 'host', 'Conductor 🚗', {
      track,
      requestedBy: 'Conductor',
      isAutopilot: false,
    });
  };

  const handlePurgeQueue = () => {
    if (window.confirm('¿Deseas vaciar todas las canciones pedidas por los pasajeros de un tacazo?')) {
      setQueue([]);
      StorageService.clearQueue();
      broadcastSync([], catalogRef.current);
    }
  };

  const handleSaveAllToLibrary = () => {
    queue.forEach((item) => StorageService.addToDriverLibrary(item.track));
    alert(`${queue.length} canciones guardadas en tu biblioteca personal.`);
  };

  const handleFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const scanned = await LocalScanner.scanAudioFiles(e.target.files);
      if (scanned.length > 0) {
        const merged = StorageService.deduplicateTracks([...scanned, ...catalogRef.current]);
        setCatalog(merged);
        broadcastSync(queueRef.current, merged);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#07080D] p-3 sm:p-6 flex flex-col justify-between">
      <HostHeader
        catalogCount={catalog.length}
        isAnnouncing={isAnnouncing}
        onCloseRoom={() => closeRoom(onBackToLanding)}
        onOpenSearch={() => setIsSearchModalOpen(true)}
        onOpenLibrary={() => setIsLibraryOpen(true)}
        onFolderSelect={handleFolderSelect}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 my-auto py-4">
        <div className="lg:col-span-3 flex flex-col justify-center">
          <RoomQrBadge roomId={roomId} connectedCount={connectedDjs.length} />
        </div>

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

        <div className="lg:col-span-4 flex flex-col">
          <GlassCard className="h-full max-h-[540px] overflow-hidden flex flex-col p-3">
            <HostQueueActions
              queueCount={queue.length}
              isAutopilotActive={isAutopilotActive}
              onToggleAutopilot={toggleAutopilot}
              onPurgeQueue={handlePurgeQueue}
              onSaveAllToLibrary={handleSaveAllToLibrary}
              onOpenLibrary={() => setIsLibraryOpen(true)}
            />
            <div className="flex-1 overflow-hidden mt-2">
              <HostQueueList queue={queue} onRemoveItem={(id) => setQueue((prev) => prev.filter((i) => i.queueId !== id))} />
            </div>
          </GlassCard>
        </div>
      </div>

      <footer className="text-center text-[10px] text-slate-600 font-mono">
        CarBeat Cabina Activa • Audio Master Local • Modo Pasajeros / Chofer Sincronizado
      </footer>

      <HostWebSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        onPlayNow={handlePlayNow}
        onAddToQueue={handleAddToQueueFromDriver}
      />

      <DriverLibraryModal
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        onPlayNow={handlePlayNow}
        onAddToQueue={handleAddToQueueFromDriver}
      />
    </div>
  );
};
