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
import { LocalAudioDatabase } from '../../core/audio/local-audio-db';
import { apiUrl } from '../../core/network/api-config';
import { startHostAnnouncer, stopHostAnnouncer } from '../../core/network/host-discovery';
import { StorageService } from '../../core/storage/storage-service';
import { queueCacher } from '../../core/audio/queue-cacher';
import { folderWatcher } from '../../core/audio/folder-watcher';
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
  const [watchedFolder, setWatchedFolder] = useState<string>('');

  const queueRef = useRef(queue);
  const catalogRef = useRef(catalog);
  const historyRef = useRef<Track[]>([]);
  const lastPrevClickRef = useRef<number>(0);
  queueRef.current = queue;
  catalogRef.current = catalog;

  // Manejar el avance a la siguiente canción
  const handleNext = useCallback(() => {
    const current = globalAudioEngine.getState().currentTrack;
    if (current) {
      historyRef.current.push(current);
      if (historyRef.current.length > 50) historyRef.current.shift();
    }
    const currentQueue = queueRef.current;
    const currentCatalog = catalogRef.current;
    if (currentQueue.length > 0) {
      const nextItem = currentQueue[0];
      setQueue((prev) => prev.slice(1));
      globalAudioEngine.loadTrack(nextItem.track, true);
    } else if (currentCatalog.length > 0) {
      const currentIdx = current ? currentCatalog.findIndex((t) => t.id === current.id) : -1;
      const nextIdx = currentIdx >= 0 ? (currentIdx + 1) % currentCatalog.length : 0;
      globalAudioEngine.loadTrack(currentCatalog[nextIdx], true);
    }
  }, []);

  // Manejar retroceso a la canción anterior con historial real y fallback de catálogo
  const handlePrev = useCallback(() => {
    const currentState = globalAudioEngine.getState();
    const now = Date.now();
    const isRapidClick = now - lastPrevClickRef.current < 2500;
    lastPrevClickRef.current = now;

    // Si lleva más de 3 segundos y es el primer clic, reiniciar inicio de pista
    if (currentState.currentTime > 3 && !isRapidClick) {
      globalAudioEngine.seek(0);
      return;
    }

    // 1. Prioridad: Desapilar pista previa del historial real
    if (historyRef.current.length > 0) {
      const prevTrack = historyRef.current.pop()!;
      globalAudioEngine.loadTrack(prevTrack, true);
      return;
    }

    // 2. Fallback: Pista anterior en el catálogo del vehículo
    const currentCatalog = catalogRef.current;
    if (currentCatalog.length > 0) {
      const current = currentState.currentTrack;
      const currentIdx = current ? currentCatalog.findIndex((t) => t.id === current.id) : -1;
      const prevIdx = currentIdx > 0 ? currentIdx - 1 : currentCatalog.length - 1;
      globalAudioEngine.loadTrack(currentCatalog[prevIdx], true);
    }
  }, []);

  const { channel, connectedDjs, broadcastSync, enqueueTrack, closeRoom } = useHostRoomChannel({
    roomId,
    catalog,
    setCatalog,
    queue,
    setQueue,
    playerState,
    onNext: handleNext,
    onPrev: handlePrev,
  });

  // Cargar música de IndexedDB y restaurar vigilancia de carpeta física al arrancar
  useEffect(() => {
    LocalAudioDatabase.loadAllTracks().then((localTracks) => {
      if (localTracks.length > 0) {
        setCatalog((prev) => StorageService.deduplicateTracks([...localTracks, ...prev]));
      }
    });

    // Intentar restaurar la carpeta que el chofer ya había vinculado
    folderWatcher.restoreWatchedFolder((newTracks) => {
      if (newTracks.length > 0) {
        setCatalog((prev) => {
          const merged = StorageService.deduplicateTracks([...newTracks, ...prev]);
          broadcastSync(queueRef.current, merged);
          return merged;
        });
      }
    }).then((restored) => {
      if (restored) {
        setWatchedFolder(folderWatcher.getFolderName());
      }
    });

    return () => {
      folderWatcher.stop();
    };
  }, []);

  const handlePickWatchedFolder = async () => {
    const success = await folderWatcher.pickAndWatchFolder((newTracks) => {
      if (newTracks.length > 0) {
        setCatalog((prev) => {
          const merged = StorageService.deduplicateTracks([...newTracks, ...prev]);
          broadcastSync(queueRef.current, merged);
          return merged;
        });
      }
    });
    if (success) {
      setWatchedFolder(folderWatcher.getFolderName());
    }
  };

  // Pre-calentar y almacenar en caché en segundo plano la siguiente canción en la cola
  // Pre-calentar y almacenar en caché en segundo plano la siguiente canción en la cola
  useEffect(() => {
    if (queue.length > 0) {
      queueCacher.preloadNextInQueue(queue);
    }
  }, [queue]);

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
    fetch(apiUrl('/api/server-info'))
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
    enqueueTrack(track, 'IA Autopilot', true);
  }, [enqueueTrack]);

  const { isAutopilotActive, toggleAutopilot } = useHostAutopilot({
    currentTrack: playerState.currentTrack,
    catalog,
    queue,
    onEnqueueTrack: handleEnqueueAutopilot,
  });

  const handlePlayNow = (track: Track) => {
    const current = globalAudioEngine.getState().currentTrack;
    if (current && current.id !== track.id) {
      historyRef.current.push(current);
    }
    const newCatalog = StorageService.deduplicateTracks([track, ...catalogRef.current]);
    setCatalog(newCatalog);
    globalAudioEngine.loadTrack(track, true);
  };

  const handleAddToQueueFromDriver = (track: Track) => {
    enqueueTrack(track, 'Conductor', false);
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
    <div className="min-h-screen w-full bg-[#07080D] p-3 sm:p-5 flex flex-col justify-between">
      <HostHeader
        catalogCount={catalog.length}
        isAnnouncing={isAnnouncing}
        watchedFolderName={watchedFolder}
        onCloseRoom={() => closeRoom(onBackToLanding)}
        onOpenSearch={() => setIsSearchModalOpen(true)}
        onOpenLibrary={() => setIsLibraryOpen(true)}
        onPickWatchedFolder={handlePickWatchedFolder}
        onFolderSelect={handleFolderSelect}
      />

      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 lg:gap-4 flex-1 my-auto py-2">
        <div className="md:col-span-4 lg:col-span-3 flex flex-col justify-center order-2 md:order-1">
          <RoomQrBadge roomId={roomId} connectedCount={connectedDjs.length} />
        </div>

        <div className="md:col-span-8 lg:col-span-5 order-1 md:order-2">
          <GlassCard glow className="h-full min-h-[300px] flex items-center justify-center p-3 sm:p-5 border-cyan-500/30">
            <NowPlayingScreen
              track={playerState.currentTrack}
              isPlaying={playerState.isPlaying}
              currentTime={playerState.currentTime}
              duration={playerState.duration}
              volume={playerState.volume}
              onTogglePlay={() => globalAudioEngine.toggle()}
              onNext={handleNext}
              onPrev={handlePrev}
              onSeek={(s) => globalAudioEngine.seek(s)}
              onVolumeChange={(v) => globalAudioEngine.setVolume(v)}
              onSaveCurrentToLibrary={() => {
                if (playerState.currentTrack) {
                  StorageService.addToDriverLibrary(playerState.currentTrack);
                }
              }}
            />
          </GlassCard>
        </div>

        <div className="md:col-span-12 lg:col-span-4 flex flex-col order-3">
          <GlassCard className="h-full min-h-[260px] max-h-[500px] overflow-hidden flex flex-col p-3">
            <HostQueueActions
              queueCount={queue.length}
              isAutopilotActive={isAutopilotActive}
              onToggleAutopilot={toggleAutopilot}
              onPurgeQueue={handlePurgeQueue}
              onSaveAllToLibrary={handleSaveAllToLibrary}
              onOpenLibrary={() => setIsLibraryOpen(true)}
            />
            <div className="flex-1 overflow-hidden mt-2">
              <HostQueueList
                queue={queue}
                onRemoveItem={(id) => setQueue((prev) => prev.filter((i) => i.queueId !== id))}
                onSaveToLibrary={(track) => {
                  StorageService.addToDriverLibrary(track);
                  alert(`"${track.title}" guardada en tu biblioteca personal de chofer.`);
                }}
              />
            </div>
          </GlassCard>
        </div>
      </div>

      <footer className="text-center text-[10px] text-slate-600 font-mono py-1">
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
        onCatalogUpdated={(newTracks) => {
          setCatalog(newTracks);
          broadcastSync(queueRef.current, newTracks);
        }}
      />
    </div>
  );
};
