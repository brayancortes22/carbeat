import React, { useState, useEffect, useMemo } from 'react';
import { CatalogBrowser } from './components/CatalogBrowser';
import { QueueVoteList } from './components/QueueVoteList';
import { NewTrackModal } from './components/NewTrackModal';
import { GlassCard } from '../../components/ui/GlassCard';
import { Badge } from '../../components/ui/Badge';
import { RoomChannel } from '../../core/network/room-channel';
import { MOCK_CAR_TRACKS } from '../../core/audio/mock-library';
import { QueueItem, Track } from '../../types/track.types';
import { ArrowLeft, Sparkles, Radio, Check } from 'lucide-react';

interface DjViewProps {
  roomId: string;
  djName: string;
  onLeaveRoom: () => void;
}

export const DjView: React.FC<DjViewProps> = ({ roomId, djName, onLeaveRoom }) => {
  const [catalog, setCatalog] = useState<Track[]>(MOCK_CAR_TRACKS);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [activeView, setActiveView] = useState<'catalog' | 'queue'>('catalog');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const channel = useMemo(() => new RoomChannel(roomId), [roomId]);

  const showToast = (text: string) => {
    setToastMessage(text);
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    // Anunciar entrada a la sala
    channel.send('ROOM_JOIN', djName, djName, { djName });

    const unsub = channel.subscribe((msg) => {
      if (msg.type === 'SYNC_CATALOG') {
        const payload = msg.payload as { catalog?: Track[]; queue?: QueueItem[] };
        if (payload.catalog) setCatalog(payload.catalog);
        if (payload.queue) setQueue(payload.queue);
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
      channel.close();
    };
  }, [channel, djName]);

  const handleQueueTrack = (track: Track) => {
    channel.send('QUEUE_TRACK', djName, djName, { track, requestedBy: djName });
    showToast(`"${track.title}" añadida a la cola`);
  };

  const handleVote = (queueId: string, delta: number) => {
    channel.send('VOTE_TRACK', djName, djName, { queueId, delta });
  };

  const handleAddNewTrack = (track: Track) => {
    setCatalog((prev) => [track, ...prev]);
    channel.send('NEW_TRACK_OFFER', djName, djName, { track });
    channel.send('QUEUE_TRACK', djName, djName, { track, requestedBy: djName });
    showToast(`Canción enviada al carro y puesta en cola`);
  };

  return (
    <div className="min-h-screen bg-[#08090E] p-3 sm:p-5 flex flex-col justify-between max-w-xl mx-auto">
      {/* Header DJ */}
      <header className="flex items-center justify-between pb-3 border-b border-white/5">
        <button
          onClick={onLeaveRoom}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
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

      {/* Selector de pestañas */}
      <div className="grid grid-cols-2 gap-2 my-3">
        <button
          onClick={() => setActiveView('catalog')}
          className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
            activeView === 'catalog'
              ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
              : 'bg-white/[0.03] text-slate-400 hover:text-white border border-white/5'
          }`}
        >
          Explorar Música ({catalog.length})
        </button>
        <button
          onClick={() => setActiveView('queue')}
          className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
            activeView === 'queue'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
              : 'bg-white/[0.03] text-slate-400 hover:text-white border border-white/5'
          }`}
        >
          Cola de Espera ({queue.length})
        </button>
      </div>

      {/* Contenido Principal */}
      <GlassCard className="flex-1 my-1 p-3.5 sm:p-4 overflow-hidden flex flex-col">
        {activeView === 'catalog' ? (
          <CatalogBrowser catalog={catalog} onQueueTrack={handleQueueTrack} />
        ) : (
          <QueueVoteList queue={queue} onVote={handleVote} />
        )}
      </GlassCard>

      {/* Botón Flotante para Aportar Música Nueva */}
      <div className="pt-3">
        <button
          onClick={() => setIsModalOpen(true)}
          className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-500 hover:opacity-95 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-purple-500/25 active:scale-98 transition-all"
        >
          <Sparkles className="w-4 h-4" />
          Aportar Nueva Música al Carro (Con Datos)
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
        <div className="fixed bottom-16 left-1/2 -translate-x-1/2 bg-slate-900 border border-cyan-500/40 text-cyan-300 text-xs py-2 px-4 rounded-full shadow-2xl flex items-center gap-2 z-50 animate-bounce">
          <Check className="w-3.5 h-3.5 text-cyan-400" />
          {toastMessage}
        </div>
      )}
    </div>
  );
};
