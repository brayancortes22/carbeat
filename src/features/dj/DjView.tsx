import React, { useState, useEffect, useMemo } from 'react';
import { CatalogBrowser } from './components/CatalogBrowser';
import { QueueVoteList } from './components/QueueVoteList';
import { NewTrackModal } from './components/NewTrackModal';
import { GlassCard } from '../../components/ui/GlassCard';
import { Badge } from '../../components/ui/Badge';
import { TrackCover } from '../../components/ui/TrackCover';
import { RoomChannel } from '../../core/network/room-channel';
import { MOCK_CAR_TRACKS } from '../../core/audio/mock-library';
import { QueueItem, Track } from '../../types/track.types';
import { ArrowLeft, Sparkles, Radio, Check, Volume2, Music } from 'lucide-react';

interface DjViewProps {
  roomId: string;
  djName: string;
  onLeaveRoom: () => void;
}

interface LivePlaybackState {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
}

export const DjView: React.FC<DjViewProps> = ({ roomId, djName, onLeaveRoom }) => {
  const [catalog, setCatalog] = useState<Track[]>(MOCK_CAR_TRACKS);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [activeView, setActiveView] = useState<'catalog' | 'queue'>('catalog');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [livePlayback, setLivePlayback] = useState<LivePlaybackState>({
    currentTrack: MOCK_CAR_TRACKS[0], // Mostrar canción activa inicial
    isPlaying: false,
    currentTime: 0,
    duration: 355,
  });

  const channel = useMemo(() => new RoomChannel(roomId), [roomId]);

  const showToast = (text: string) => {
    setToastMessage(text);
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    return () => {
      channel.close();
    };
  }, [channel]);

  useEffect(() => {
    // Anunciar entrada a la sala al Host
    channel.send('ROOM_JOIN', djName, djName, { djName });

    const unsub = channel.subscribe((msg) => {
      if (msg.type === 'SYNC_CATALOG') {
        const payload = msg.payload as { catalog?: Track[]; queue?: QueueItem[]; currentTrack?: Track | null };
        if (payload.catalog) setCatalog(payload.catalog);
        if (payload.queue) setQueue(payload.queue);
        if (payload.currentTrack !== undefined) {
          setLivePlayback((prev) => ({ ...prev, currentTrack: payload.currentTrack || null }));
        }
      } else if (msg.type === 'PLAYBACK_STATE') {
        const payload = msg.payload as LivePlaybackState;
        setLivePlayback(payload);
      } else if (msg.type === 'QUEUE_TRACK') {
        const payload = msg.payload as { track: Track; requestedBy: string };
        const newItem: QueueItem = {
          queueId: `queue_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          track: payload.track,
          votes: 1,
          requestedBy: payload.requestedBy,
          requestedAt: Date.now(),
        };
        setQueue((prev) => [...prev, newItem].sort((a, b) => b.votes - a.votes));
      } else if (msg.type === 'VOTE_TRACK') {
        const payload = msg.payload as { queueId: string; delta: number };
        setQueue((prev) =>
          prev
            .map((item) => (item.queueId === payload.queueId ? { ...item, votes: Math.max(0, item.votes + payload.delta) } : item))
            .sort((a, b) => b.votes - a.votes)
        );
      }
    });

    return () => {
      unsub();
    };
  }, [channel, djName]);

  const handleQueueTrack = (track: Track) => {
    const newItem: QueueItem = {
      queueId: `queue_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      track,
      votes: 1,
      requestedBy: djName,
      requestedAt: Date.now(),
    };
    setQueue((prev) => [...prev, newItem].sort((a, b) => b.votes - a.votes));
    channel.send('QUEUE_TRACK', djName, djName, { track, requestedBy: djName });
    showToast(`"${track.title}" agregada a la cola del carro`);
  };

  const handleVote = (queueId: string, delta: number) => {
    channel.send('VOTE_TRACK', djName, djName, { queueId, delta });
  };

  const handleAddNewTrack = (track: Track) => {
    setCatalog((prev) => [track, ...prev]);
    const newItem: QueueItem = {
      queueId: `queue_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      track,
      votes: 1,
      requestedBy: djName,
      requestedAt: Date.now(),
    };
    setQueue((prev) => [...prev, newItem].sort((a, b) => b.votes - a.votes));
    channel.send('NEW_TRACK_OFFER', djName, djName, { track });
    channel.send('QUEUE_TRACK', djName, djName, { track, requestedBy: djName });
    showToast(`"${track.title}" enviada al carro y puesta en cola`);
  };

  const progressPercent = livePlayback.duration > 0
    ? (livePlayback.currentTime / livePlayback.duration) * 100
    : 0;

  return (
    <div className="min-h-screen bg-[#08090E] p-3 sm:p-5 flex flex-col justify-between max-w-xl mx-auto pb-4">
      {/* Header DJ */}
      <header className="flex items-center justify-between pb-3 border-b border-white/5">
        <button
          onClick={onLeaveRoom}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Salir
        </button>
        <div className="flex items-center gap-2">
          <Badge variant="purple" className="text-[10px]">
            <Radio className="w-3 h-3 animate-pulse" /> {roomId}
          </Badge>
          <span className="text-xs font-semibold text-white">{djName}</span>
        </div>
      </header>

      {/* Tarjeta En Vivo: Sonando en la Pantalla del Carro */}
      <div className="my-2.5 p-3 rounded-2xl bg-gradient-to-r from-cyan-950/40 to-slate-900/60 border border-cyan-500/30 flex flex-col gap-2 shadow-xl shadow-cyan-950/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <TrackCover
              src={livePlayback.currentTrack?.coverUrl}
              alt="Car Playing"
              className="w-11 h-11 rounded-xl shadow-md"
            />
            <div className="min-w-0 text-left">
              <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-cyan-400 animate-pulse" /> Sonando en el Carro
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
        <div className="h-1.5 w-full bg-slate-800/80 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 to-sky-400 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
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
