import React from 'react';
import { QueueItem } from '../../../types/track.types';
import { ThumbsUp, ThumbsDown, Flame } from 'lucide-react';
import { TrackOriginBadge } from '../../host/components/TrackOriginBadge';

interface QueueVoteListProps {
  queue: QueueItem[];
  onVote: (queueId: string, delta: number) => void;
  currentDjId?: string;
}

export const QueueVoteList: React.FC<QueueVoteListProps> = ({ queue, onVote, currentDjId = '' }) => {
  // Salvaguarda visual defensiva: garantizar que jamás se renderice una pista duplicada
  const seen = new Set<string>();
  const cleanList = queue.filter((item) => {
    if (!item?.track?.title) return false;
    const key = `${item.track.title.toLowerCase().trim()}_${(item.track.artist || '').toLowerCase().trim()}`;
    if (seen.has(key) || seen.has(item.track.id) || seen.has(item.queueId)) return false;
    seen.add(key);
    seen.add(item.track.id);
    seen.add(item.queueId);
    return true;
  });

  const normalizedDj = currentDjId.trim().toLowerCase();

  return (
    <div className="flex flex-col h-full space-y-2">
      <div className="flex items-center justify-between pb-2 border-b border-white/10">
        <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
          <Flame className="w-4 h-4 text-amber-400" /> Próximas en sonar ({cleanList.length})
        </h3>
        <span className="text-[10px] text-slate-500">1 voto por persona • Toca para alternar</span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
        {cleanList.length === 0 ? (
          <div className="h-32 flex flex-col items-center justify-center text-center text-slate-500 text-xs">
            <p>No hay canciones en la cola.</p>
            <p className="text-[10px] text-slate-600 mt-0.5">Explora el catálogo y pide la primera.</p>
          </div>
        ) : (
          cleanList.map((item, idx) => {
            const userVote = normalizedDj && item.votedBy ? item.votedBy[normalizedDj] || 0 : 0;
            const hasUpvoted = userVote === 1;
            const hasDownvoted = userVote === -1;

            return (
              <div
                key={item.queueId}
                className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/15 transition-all"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-xs font-mono font-bold text-slate-500 w-3.5">{idx + 1}</span>
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold text-white truncate">{item.track.title}</h4>
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <span className="truncate">{item.track.artist}</span>
                      <span>•</span>
                      <TrackOriginBadge requestedBy={item.requestedBy} isAutopilot={item.isAutopilot} />
                    </div>
                  </div>
                </div>

                {/* Controles de Votación con Toggle y Resaltado */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => onVote(item.queueId, 1)}
                    title={hasUpvoted ? 'Quitar mi voto (+1)' : 'Votar a favor (+1)'}
                    className={`p-1.5 rounded-lg transition-all active:scale-90 cursor-pointer ${
                      hasUpvoted
                        ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/30'
                        : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400'
                    }`}
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-xs font-mono font-bold text-cyan-300 w-5 text-center">
                    {item.votes}
                  </span>
                  <button
                    onClick={() => onVote(item.queueId, -1)}
                    title={hasDownvoted ? 'Quitar mi voto (-1)' : 'Votar en contra (-1)'}
                    className={`p-1.5 rounded-lg transition-all active:scale-90 cursor-pointer ${
                      hasDownvoted
                        ? 'bg-red-500 text-white font-bold shadow-md shadow-red-500/30'
                        : 'bg-red-500/10 hover:bg-red-500/20 text-red-400'
                    }`}
                  >
                    <ThumbsDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
