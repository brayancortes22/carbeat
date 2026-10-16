import React from 'react';
import { QueueItem, Track } from '../../../types/track.types';
import { Trash2, ThumbsUp, Music, BookmarkPlus } from 'lucide-react';
import { TrackOriginBadge } from './TrackOriginBadge';

interface HostQueueListProps {
  queue: QueueItem[];
  onRemoveItem: (queueId: string) => void;
  onSaveToLibrary?: (track: Track) => void;
}

export const HostQueueList: React.FC<HostQueueListProps> = ({
  queue,
  onRemoveItem,
  onSaveToLibrary,
}) => {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
        <h3 className="font-bold text-white text-sm flex items-center gap-2">
          <Music className="w-4 h-4 text-cyan-400" /> Cola de Cabina ({queue.length})
        </h3>
        <span className="text-[11px] text-slate-500">Ordenado por votos</span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
        {queue.length === 0 ? (
          <div className="h-40 flex flex-col items-center justify-center text-center text-slate-500 text-xs">
            <p>La cola está vacía.</p>
            <p className="text-[10px] text-slate-600 mt-1">Los DJs pueden pedir canciones desde su celular o activar Autopilot IA.</p>
          </div>
        ) : (
          queue.map((item, idx) => (
            <div
              key={item.queueId}
              className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/15 transition-all text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xs font-mono font-bold text-slate-500 w-4">{idx + 1}</span>
                <div className="min-w-0">
                  <h4 className="text-sm font-semibold text-white truncate">{item.track.title}</h4>
                  <p className="text-xs text-slate-400 truncate">{item.track.artist}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <TrackOriginBadge track={item.track} requestedBy={item.requestedBy} />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {onSaveToLibrary && (
                  <button
                    onClick={() => onSaveToLibrary(item.track)}
                    title="Guardar en mi biblioteca de chofer"
                    className="p-1.5 rounded-lg text-slate-500 hover:text-cyan-300 hover:bg-cyan-500/10 transition-colors cursor-pointer"
                  >
                    <BookmarkPlus className="w-4 h-4" />
                  </button>
                )}
                <div className="flex items-center gap-1 text-xs font-mono text-cyan-400 bg-cyan-950/40 border border-cyan-800/40 px-2 py-0.5 rounded-md">
                  <ThumbsUp className="w-3 h-3" />
                  <span>{item.votes}</span>
                </div>
                <button
                  onClick={() => onRemoveItem(item.queueId)}
                  title="Eliminar de la cola"
                  className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
