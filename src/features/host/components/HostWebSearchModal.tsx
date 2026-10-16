import React, { useState } from 'react';
import { X, Search, Globe, Play, Plus, Disc, Loader2 } from 'lucide-react';
import { Track } from '../../../types/track.types';
import { MusicSearchService } from '../../../core/network/music-search-service';
import { MusicSourceType } from '../../../core/providers/omni-music-gateway';
import { TrackCover } from '../../../components/ui/TrackCover';

interface HostWebSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlayNow: (track: Track) => void;
  onAddToQueue: (track: Track) => void;
}

export const HostWebSearchModal: React.FC<HostWebSearchModalProps> = ({
  isOpen,
  onClose,
  onPlayNow,
  onAddToQueue,
}) => {
  const [query, setQuery] = useState('');
  const [source, setSource] = useState<MusicSourceType>('all');
  const [results, setResults] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSearch = async (e?: React.FormEvent, selectedSource = source) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    const searchTracks = await MusicSearchService.searchOnline(query, 'Pantalla del Carro', selectedSource);
    setResults(searchTracks);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md">
      <div className="w-full max-w-2xl bg-slate-900 border border-cyan-500/30 rounded-2xl p-4 sm:p-6 shadow-2xl flex flex-col max-h-[85vh] text-left">
        {/* Cabecera del Modal */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400">
              <Globe className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-white text-lg">Buscar Música en la Web</h3>
              <p className="text-xs text-slate-400">YouTube Music, Apple/Spotify y streams online</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Selector de Fuente OmniRoute */}
        <div className="flex gap-2 my-2.5 text-xs">
          {[
            { id: 'all', label: '⚡ Todas (OmniRoute)' },
            { id: 'youtube', label: '▶ YouTube Music' },
            { id: 'apple', label: '🎵 Apple / Spotify' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setSource(tab.id as MusicSourceType);
                handleSearch(undefined, tab.id as MusicSourceType);
              }}
              className={`px-3 py-1.5 rounded-lg font-medium cursor-pointer transition-all ${
                source === tab.id
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Barra de Búsqueda */}
        <form onSubmit={(e) => handleSearch(e)} className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ej: Vicente Fernández, Diomedes, Shakira, Queen, Feid..."
              className="w-full bg-slate-800/90 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm shrink-0 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Buscar
          </button>
        </form>

        {/* Lista de Resultados */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar min-h-[260px]">
          {results.length === 0 && !loading && (
            <div className="h-56 flex flex-col items-center justify-center text-center text-slate-500 text-xs">
              <Disc className="w-10 h-10 opacity-30 mb-2" />
              Escribe el nombre de tu música favorita para buscarla en la web.
            </div>
          )}

          {results.map((track) => (
            <div
              key={track.id}
              className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:border-cyan-500/30 transition-all"
            >
              <div className="flex items-center gap-3 min-w-0">
                <TrackCover src={track.coverUrl} alt={track.title} className="w-12 h-12 rounded-lg shrink-0" />
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-white truncate">{track.title}</h4>
                  <p className="text-xs text-slate-400 truncate">{track.artist}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    onPlayNow(track);
                    onClose();
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-all active:scale-95 cursor-pointer shadow-md shadow-cyan-500/20"
                >
                  <Play className="w-3.5 h-3.5 fill-current" /> Reproducir
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onAddToQueue(track);
                    onClose();
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white font-semibold text-xs border border-white/10 transition-all active:scale-95 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Encolar
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
