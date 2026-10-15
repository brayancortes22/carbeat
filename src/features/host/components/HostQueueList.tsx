import React from 'react';
import { QueueItem } from '../../../types/track.types';
import { Badge } from '../../../components/ui/Badge';
import { Trash2, ThumbsUp, Music } from 'lucide-react';

interface HostQueueListProps {
  queue: QueueItem[];
  onRemoveItem: (queueId: string) => void;
}

export const HostQueueList: React.FC<HostQueueListProps> = ({ queue, onRemoveItem }) => {
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
            <p className="text-[10px] text-slate-600 mt-1">Los DJs pueden pedir canciones desde su celular.</p>
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
                    <Badge variant={item.track.source === 'passenger_dj' ? 'purple' : 'slate'} className="text-[9px] py-0 px-1.5">
                      {item.requestedBy}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <div className="flex items-center gap-1 text-xs font-mono text-cyan-400 bg-cyan-950/40 border border-cyan-800/40 px-2 py-0.5 rounded-md">
                  <ThumbsUp className="w-3 h-3" />
                  <span>{item.votes}</span>
                </div>
                <button
                  onClick={() => onRemoveItem(item.queueId)}
                  title="Eliminar de la cola"
                  className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
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
