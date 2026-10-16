import React, { useState, useMemo } from 'react';
import { Track } from '../../../types/track.types';
import { Search, Plus, Music, Check } from 'lucide-react';
import { Badge } from '../../../components/ui/Badge';
import { TrackCover } from '../../../components/ui/TrackCover';

interface CatalogBrowserProps {
  catalog: Track[];
  onQueueTrack: (track: Track) => void;
}

export const CatalogBrowser: React.FC<CatalogBrowserProps> = ({ catalog, onQueueTrack }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'local' | 'passengers'>('all');
  const [requestingId, setRequestingId] = useState<string | null>(null);

  const filteredTracks = useMemo(() => {
    return catalog.filter((track) => {
      const matchesSearch =
        track.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        track.artist.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (track.album && track.album.toLowerCase().includes(searchTerm.toLowerCase()));

      if (!matchesSearch) return false;
      if (activeTab === 'local') return track.source === 'local_car';
      if (activeTab === 'passengers') return track.source === 'passenger_dj';
      return true;
    });
  }, [catalog, searchTerm, activeTab]);

  const handleQueueClick = (track: Track) => {
    setRequestingId(track.id);
    onQueueTrack(track);
    setTimeout(() => setRequestingId(null), 1200);
  };

  return (
    <div className="flex flex-col h-full space-y-3">
      {/* Buscador Rápido */}
      <div className="relative">
        <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar canción, artista o álbum..."
          className="w-full bg-slate-900/80 border border-slate-700/60 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/80 transition-colors"
        />
      </div>

      {/* Filtros por pestaña */}
      <div className="flex items-center gap-2 text-xs">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${activeTab === 'all' ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-800/60 text-slate-400 hover:text-white'}`}
        >
          Todas ({catalog.length})
        </button>
        <button
          onClick={() => setActiveTab('local')}
          className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${activeTab === 'local' ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-800/60 text-slate-400 hover:text-white'}`}
        >
          Música del Carro
        </button>
        <button
          onClick={() => setActiveTab('passengers')}
          className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${activeTab === 'passengers' ? 'bg-purple-500 text-white font-bold' : 'bg-slate-800/60 text-slate-400 hover:text-white'}`}
        >
          Aportes DJ
        </button>
      </div>

      {/* Lista de Canciones Disponibles */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
        {filteredTracks.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-500">
            <Music className="w-8 h-8 mx-auto mb-2 opacity-40" />
            No se encontraron canciones con ese nombre.
          </div>
        ) : (
          filteredTracks.map((track) => {
            const isRequesting = requestingId === track.id;

            return (
              <div
                key={track.id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-cyan-500/30 transition-all group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <TrackCover src={track.coverUrl} alt={track.title} className="w-10 h-10 rounded-lg" />
                  <div className="min-w-0 text-left">
                    <h4 className="text-sm font-semibold text-white truncate">{track.title}</h4>
                    <p className="text-xs text-slate-400 truncate">{track.artist}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {track.source === 'passenger_dj' && (
                    <Badge variant="purple" className="text-[9px] py-0 px-1.5 hidden sm:inline-flex">
                      {track.addedBy || 'DJ'}
                    </Badge>
                  )}
                  <button
                    onClick={() => handleQueueClick(track)}
                    disabled={isRequesting}
                    title="Pedir canción"
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg font-semibold text-xs transition-all active:scale-95 cursor-pointer ${
                      isRequesting
                        ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30'
                        : 'bg-cyan-500/10 hover:bg-cyan-500 text-cyan-400 hover:text-slate-950 border border-cyan-500/20'
                    }`}
                  >
                    {isRequesting ? (
                      <>
                        <Check className="w-3.5 h-3.5" /> En cola
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" /> Pedir
                      </>
                    )}
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
