import React, { useState, useEffect, useRef } from 'react';
import { Track } from '../../../types/track.types';
import { Search, Plus, Music, Check, Loader2, Sparkles } from 'lucide-react';
import { TrackCover } from '../../../components/ui/TrackCover';
import { TOP_TRENDING_TRACKS } from '../../../core/network/music-search-service';

interface CatalogBrowserProps {
  catalog: Track[];
  onQueueTrack: (track: Track) => void;
}

export const CatalogBrowser: React.FC<CatalogBrowserProps> = ({ catalog, onQueueTrack }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Búsqueda en vivo con debounce de 350ms
  useEffect(() => {
    const query = searchTerm.trim();
    if (!query) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/yt/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const songs = (await res.json()) as Track[];
          if (Array.isArray(songs)) {
            // Deduplicar estrictamente por título + artista
            const seen = new Set<string>();
            const deduplicated = songs.filter((s) => {
              const key = `${s.title.toLowerCase().trim()}_${s.artist.toLowerCase().trim()}`;
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            });
            setSearchResults(deduplicated);
          }
        }
      } catch (err) {
        console.warn('[CatalogBrowser] Error en búsqueda en vivo:', err);
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchTerm]);

  const handleQueueClick = (track: Track) => {
    setRequestingId(track.id);
    onQueueTrack(track);
    setTimeout(() => setRequestingId(null), 1200);
  };

  // Canciones a mostrar: resultados de búsqueda activa o catálogo/tendencias iniciales
  const displayTracks: Track[] = searchTerm.trim()
    ? searchResults
    : catalog.length > 0
    ? catalog
    : TOP_TRENDING_TRACKS;

  return (
    <div className="flex flex-col h-full space-y-3">
      {/* Buscador Universal en Vivo */}
      <div className="relative">
        <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar cualquier canción o artista en YouTube..."
          className="w-full bg-slate-900/80 border border-slate-700/60 rounded-xl pl-10 pr-10 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/80 transition-colors"
        />
        {isSearching && (
          <Loader2 className="absolute right-3.5 top-3 w-4 h-4 text-cyan-400 animate-spin" />
        )}
      </div>

      {/* Título de la sección */}
      <div className="flex items-center justify-between text-xs text-slate-400 px-1">
        <span>
          {searchTerm.trim()
            ? `Resultados para "${searchTerm}" (${displayTracks.length})`
            : catalog.length > 0
            ? `Catálogo de la Sala (${displayTracks.length})`
            : 'Éxitos Recomendados para el Viaje'}
        </span>
        {!searchTerm.trim() && (
          <span className="flex items-center gap-1 text-[11px] text-cyan-400">
            <Sparkles className="w-3 h-3" /> Tendencias
          </span>
        )}
      </div>

      {/* Lista de Canciones con Deduplicación */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
        {displayTracks.length === 0 ? (
          <div className="text-center py-12 text-xs text-slate-500">
            <Music className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-slate-400 font-semibold mb-1">
              {isSearching ? 'Buscando en YouTube Music...' : 'No se encontraron canciones'}
            </p>
            <p className="text-slate-600">Prueba con otro artista o nombre de canción.</p>
          </div>
        ) : (
          displayTracks.map((track) => {
            const isRequesting = requestingId === track.id;

            return (
              <div
                key={track.id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-cyan-500/30 transition-all group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <TrackCover src={track.coverUrl} alt={track.title} className="w-10 h-10 rounded-lg shrink-0" />
                  <div className="min-w-0 text-left">
                    <h4 className="text-sm font-semibold text-white truncate">{track.title}</h4>
                    <p className="text-xs text-slate-400 truncate">{track.artist}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-2">
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
