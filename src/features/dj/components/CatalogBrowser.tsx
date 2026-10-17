import React, { useState, useEffect, useRef } from 'react';
import { Track } from '../../../types/track.types';
import { Search, Plus, Music, Check, Loader2, X, RotateCw, Smartphone, Car, Cpu } from 'lucide-react';
import { TrackCover } from '../../../components/ui/TrackCover';
import { getFreshTrendingTracks, MusicSearchService } from '../../../core/network/music-search-service';
import { NetworkHealthService, NetworkHealthStatus } from '../../../core/network/network-health';
import { apiUrl } from '../../../core/network/api-config';

interface CatalogBrowserProps {
  catalog: Track[];
  currentTrackId?: string;
  currentTrackTitle?: string;
  onQueueTrack: (track: Track) => void;
}

export const CatalogBrowser: React.FC<CatalogBrowserProps> = ({
  catalog,
  currentTrackId,
  currentTrackTitle,
  onQueueTrack,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const [trendingTracks, setTrendingTracks] = useState<Track[]>(() => getFreshTrendingTracks(8));
  const [dataRoute, setDataRoute] = useState<'auto' | 'phone' | 'car'>('auto');
  const [netHealth, setNetHealth] = useState<NetworkHealthStatus | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Evaluar periódicamente la calidad de red para el modo 'auto'
  useEffect(() => {
    NetworkHealthService.getHealth().then(setNetHealth);
    const interval = setInterval(() => {
      NetworkHealthService.getHealth().then(setNetHealth);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleRefreshTrending = () => {
    setTrendingTracks(getFreshTrendingTracks(8));
  };

  // Búsqueda en vivo con debounce de 350ms en la nube (YouTube + OmniRoute)
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
        const res = await fetch(apiUrl(`/api/yt/search?q=${encodeURIComponent(query)}`));
        if (res.ok) {
          const songs = (await res.json()) as Track[];
          if (Array.isArray(songs) && songs.length > 0) {
            const seen = new Set<string>();
            const deduplicated = songs.filter((s) => {
              const key = `${s.title.toLowerCase().trim()}_${s.artist.toLowerCase().trim()}`;
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            });
            setSearchResults(deduplicated);
            return;
          }
        }

        const fallbackSongs = await MusicSearchService.searchOnline(query, 'DJ Móvil');
        setSearchResults(fallbackSongs);
      } catch (err) {
        console.warn('[CatalogBrowser] Error en búsqueda en vivo, usando fallback:', err);
        try {
          const fallbackSongs = await MusicSearchService.searchOnline(query, 'DJ Móvil');
          setSearchResults(fallbackSongs);
        } catch {
          setSearchResults([]);
        }
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

  const [filterSource, setFilterSource] = useState<'all' | 'local_car' | 'trending'>('all');

  // Canciones a mostrar: resultados de búsqueda o catálogo enriquecido siempre con tendencias
  const displayTracks = React.useMemo(() => {
    const norm = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    const isCurrentPlaying = (t: Track) => {
      if (!t) return false;
      if (currentTrackId && (t.id === currentTrackId || (t.videoId && currentTrackId.includes(t.videoId)))) return true;
      if (currentTrackTitle) {
        const normT = norm(t.title);
        const normCur = norm(currentTrackTitle);
        if (normT && normCur && (normT === normCur || normT.includes(normCur) || normCur.includes(normT))) return true;
      }
      return false;
    };

    if (searchTerm.trim()) {
      return searchResults.filter((s) => !isCurrentPlaying(s));
    }

    const seen = new Set<string>();
    const result: Track[] = [];

    // 1. Agregar temas del catálogo del carro (excluyendo el que suena)
    if (filterSource === 'all' || filterSource === 'local_car') {
      catalog.forEach((t) => {
        if (!isCurrentPlaying(t)) {
          const key = `${norm(t.title)}_${norm(t.artist)}`;
          if (!seen.has(key)) {
            seen.add(key);
            result.push(t);
          }
        }
      });
    }

    // 2. Complementar con las tendencias recomendadas del viaje rotativas
    if (filterSource === 'all' || filterSource === 'trending') {
      trendingTracks.forEach((t) => {
        if (!isCurrentPlaying(t)) {
          const key = `${norm(t.title)}_${norm(t.artist)}`;
          if (!seen.has(key)) {
            seen.add(key);
            result.push(t);
          }
        }
      });
    }

    return result;
  }, [searchTerm, searchResults, catalog, currentTrackId, currentTrackTitle, filterSource, trendingTracks]);

  return (
    <div className="flex flex-col h-full space-y-3">
      {/* Buscador Universal en Vivo Móvil */}
      <div className="relative">
        <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
        <input
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck="false"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar cualquier canción o artista en YouTube..."
          className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl pl-10 pr-10 py-2.5 text-xs sm:text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 transition-colors shadow-inner"
        />
        {searchTerm.trim() && !isSearching && (
          <button
            type="button"
            onClick={() => setSearchTerm('')}
            className="absolute right-3.5 top-2.5 p-0.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        {isSearching && (
          <Loader2 className="absolute right-3.5 top-3 w-4 h-4 text-cyan-400 animate-spin" />
        )}
      </div>

      {/* Selector de Origen de Datos y Filtro de Carpetas */}
      <div className="flex items-center justify-between gap-2 text-xs flex-wrap">
        <div className="flex items-center gap-1 bg-white/[0.03] p-1 rounded-lg border border-white/5">
          <button
            onClick={() => setFilterSource('all')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
              filterSource === 'all' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Todo
          </button>
          <button
            onClick={() => setFilterSource('local_car')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
              filterSource === 'local_car' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Carro Local
          </button>
          <button
            onClick={() => setFilterSource('trending')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
              filterSource === 'trending' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Tendencias
          </button>
        </div>

        {/* Indicador de Red de Descarga Inteligente y Auto-Detección */}
        <div className="flex items-center gap-1.5">
          {filterSource === 'trending' && (
            <button
              onClick={handleRefreshTrending}
              title="Refrescar y rotar recomendaciones de tendencias"
              className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-cyan-400 hover:text-white transition-all active:scale-95 cursor-pointer"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={() =>
              setDataRoute((prev) => {
                if (prev === 'auto') return 'phone';
                if (prev === 'phone') return 'car';
                return 'auto';
              })
            }
            title={
              dataRoute === 'auto'
                ? `Auto-Detección Activa: Usando la mejor red detectada (${netHealth?.label || 'Analizando...'})`
                : dataRoute === 'phone'
                ? 'Forzado: Consumiendo datos del celular'
                : 'Forzado: Consumiendo datos de la pantalla del carro'
            }
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] transition-all cursor-pointer ${
              dataRoute === 'auto'
                ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-300'
                : dataRoute === 'phone'
                ? 'bg-purple-500/10 border-purple-500/40 text-purple-300'
                : 'bg-white/5 border-white/10 text-slate-300'
            }`}
          >
            <span className="text-slate-500">Datos:</span>
            {dataRoute === 'auto' && (
              <span className="font-bold text-cyan-400 flex items-center gap-1">
                <Cpu className="w-3 h-3 text-cyan-400" />
                <span>Auto ({netHealth?.effectiveType === 'wifi' ? '🚗 Wi-Fi' : '📱 4G'})</span>
              </span>
            )}
            {dataRoute === 'phone' && (
              <span className="font-bold text-purple-400 flex items-center gap-1">
                <Smartphone className="w-3 h-3" />
                <span>Celular</span>
              </span>
            )}
            {dataRoute === 'car' && (
              <span className="font-bold text-slate-300 flex items-center gap-1">
                <Car className="w-3 h-3" />
                <span>Carro</span>
              </span>
            )}
          </button>
        </div>
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
