import React, { useState } from 'react';
import { X, Search, Sparkles, Send, Play, Pause, Disc } from 'lucide-react';
import { Track } from '../../../types/track.types';
import { MusicSearchService } from '../../../core/network/music-search-service';

interface NewTrackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTrack: (track: Track) => void;
  djName: string;
}

export const NewTrackModal: React.FC<NewTrackModalProps> = ({
  isOpen,
  onClose,
  onAddTrack,
  djName,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [onlineResults, setOnlineResults] = useState<Track[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [previewTrackId, setPreviewTrackId] = useState<string | null>(null);
  const [audioPreview] = useState(() => new Audio());

  if (!isOpen) return null;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    const results = await MusicSearchService.searchOnline(searchQuery, djName);
    setOnlineResults(results);
    setIsSearching(false);
  };

  const togglePreview = (track: Track) => {
    if (previewTrackId === track.id) {
      audioPreview.pause();
      setPreviewTrackId(null);
    } else {
      audioPreview.src = track.audioUrl;
      audioPreview.play().catch(console.warn);
      setPreviewTrackId(track.id);
    }
  };

  const handleSelect = (track: Track) => {
    audioPreview.pause();
    onAddTrack(track);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-lg bg-slate-900 border border-purple-500/30 rounded-2xl p-4 sm:p-5 shadow-2xl flex flex-col max-h-[85vh] text-left">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm sm:text-base">Buscar Música Online (Con Datos)</h3>
              <p className="text-[11px] text-slate-400">Pide canciones globales y envíalas al carro</p>
            </div>
          </div>
          <button onClick={() => { audioPreview.pause(); onClose(); }} className="text-slate-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulario de Búsqueda Online */}
        <form onSubmit={handleSearch} className="flex gap-2 my-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar artista, canción o género..."
              className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-purple-500"
            />
          </div>
          <button
            type="submit"
            disabled={isSearching}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shrink-0 cursor-pointer disabled:opacity-50"
          >
            {isSearching ? 'Buscando...' : 'Buscar'}
          </button>
        </form>

        {/* Resultados de Búsqueda */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar min-h-[220px]">
          {onlineResults.length === 0 ? (
            <div className="h-44 flex flex-col items-center justify-center text-center text-slate-500 text-xs">
              <Disc className="w-8 h-8 opacity-40 mb-2" />
              Escribe un artista o canción para buscar con tus datos móviles.
            </div>
          ) : (
            onlineResults.map((track) => (
              <div
                key={track.id}
                className="flex items-center justify-between p-2 rounded-xl bg-white/[0.02] border border-white/5 hover:border-purple-500/30 transition-all"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <button
                    type="button"
                    onClick={() => togglePreview(track)}
                    className="w-9 h-9 rounded-lg bg-slate-800 shrink-0 relative overflow-hidden flex items-center justify-center group"
                  >
                    {track.coverUrl && <img src={track.coverUrl} alt={track.title} className="w-full h-full object-cover" />}
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white">
                      {previewTrackId === track.id ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                    </div>
                  </button>
                  <div className="min-w-0">
                    <h4 className="text-xs sm:text-sm font-semibold text-white truncate">{track.title}</h4>
                    <p className="text-[11px] text-slate-400 truncate">{track.artist}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleSelect(track)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shrink-0 active:scale-95 transition-all shadow-md shadow-purple-500/20"
                >
                  <Send className="w-3 h-3" /> Enviar
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
