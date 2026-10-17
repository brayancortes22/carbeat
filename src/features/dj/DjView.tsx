import React, { useState, useEffect, useCallback } from 'react';
import { CatalogBrowser } from './components/CatalogBrowser';
import { QueueVoteList } from './components/QueueVoteList';
import { NewTrackModal } from './components/NewTrackModal';
import { RoomClosedModal } from './components/RoomClosedModal';
import { DjNowPlayingCard } from './components/DjNowPlayingCard';
import { GlassCard } from '../../components/ui/GlassCard';
import { Badge } from '../../components/ui/Badge';
import { MOCK_CAR_TRACKS } from '../../core/audio/mock-library';
import { QueueItem, Track } from '../../types/track.types';
import { StorageService } from '../../core/storage/storage-service';
import { CARBEAT_VERSION } from '../../core/version';
import { VersionBadge } from '../../components/ui/VersionBadge';
import { ArrowLeft, Sparkles, Radio, Check, Music, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { useDjRoomChannel } from './hooks/useDjRoomChannel';

interface DjViewProps {
  roomId: string;
  djName: string;
  hostIp?: string;
  hostPort?: number;
  onLeaveRoom: () => void;
}

export const DjView: React.FC<DjViewProps> = ({ roomId, djName, hostIp, hostPort, onLeaveRoom }) => {
  const [catalog, setCatalog] = useState<Track[]>(() => StorageService.loadCatalog(MOCK_CAR_TRACKS));
  const [queue, setQueue] = useState<QueueItem[]>(() => StorageService.loadQueue());
  const [activeView, setActiveView] = useState<'catalog' | 'queue'>('catalog');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const { channel, isConnected, isSyncing, isRoomClosed, livePlayback, leaveRoom } = useDjRoomChannel({
    roomId,
    djName,
    hostIp,
    hostPort,
    setCatalog,
    setQueue,
  });

  const showToast = (text: string) => {
    setToastMessage(text);
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    StorageService.saveCatalog(catalog);
  }, [catalog]);

  useEffect(() => {
    StorageService.saveQueue(queue);
  }, [queue]);

  const handleQueueTrack = useCallback((track: Track) => {
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
    leaveRoom();
    onLeaveRoom();
  };

  const handleRemoteToggle = useCallback(() => {
    channel.send('HOST_COMMAND', djName, djName, { command: 'TOGGLE_PLAY' });
  }, [channel, djName]);

  const handleRemoteNext = useCallback(() => {
    channel.send('HOST_COMMAND', djName, djName, { command: 'NEXT_TRACK' });
  }, [channel, djName]);

  const handleRemotePrev = useCallback(() => {
    channel.send('HOST_COMMAND', djName, djName, { command: 'PREV_TRACK' });
  }, [channel, djName]);

  return (
    <div className="h-[100dvh] max-h-[100dvh] w-full bg-[#08090E] p-2.5 sm:p-5 flex flex-col justify-between max-w-xl mx-auto overflow-hidden">
      {/* Header DJ */}
      <header className="flex items-center justify-between pb-3 border-b border-white/5">
        <button
          onClick={handleLeave}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Salir
        </button>
        <div className="flex items-center gap-2">
          {isConnected ? (
            <Badge variant="emerald" className="text-[10px]">
              <Wifi className="w-3 h-3" /> Conectado
            </Badge>
          ) : isSyncing ? (
            <Badge variant="amber" className="text-[10px]">
              <RefreshCw className="w-3 h-3 animate-spin" /> Sincronizando...
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

      {/* Tarjeta En Vivo con Control Remoto para el Pasajero */}
      <DjNowPlayingCard
        playback={livePlayback}
        onTogglePlay={handleRemoteToggle}
        onNext={handleRemoteNext}
        onPrev={handleRemotePrev}
      />

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
          Explorar Música
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
          <CatalogBrowser
            catalog={catalog}
            currentTrackId={livePlayback.currentTrack?.id}
            currentTrackTitle={livePlayback.currentTrack?.title}
            onQueueTrack={handleQueueTrack}
          />
        ) : (
          <QueueVoteList queue={queue} onVote={handleVote} currentDjId={djName} />
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

      <NewTrackModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAddTrack={handleAddNewTrack}
        djName={djName}
      />

      <RoomClosedModal
        isOpen={isRoomClosed}
        onExit={onLeaveRoom}
      />

      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-slate-900 border border-cyan-500/40 text-cyan-300 text-xs py-2 px-4 rounded-full shadow-2xl flex items-center gap-2 z-50 animate-bounce">
          <Check className="w-3.5 h-3.5 text-cyan-400" />
          {toastMessage}
        </div>
      )}
    </div>
  );
};
