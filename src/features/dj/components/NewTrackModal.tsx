import React, { useState, useEffect } from 'react';
import { X, Search, Sparkles, Play, Pause, Flame, Loader2, CheckCircle2, Car, Radio } from 'lucide-react';
import { Track } from '../../../types/track.types';
import { MusicSearchService, TOP_TRENDING_TRACKS } from '../../../core/network/music-search-service';
import { MusicSourceType } from '../../../core/providers/omni-music-gateway';
import { TrackCover } from '../../../components/ui/TrackCover';
import { Badge } from '../../../components/ui/Badge';

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
  const [source, setSource] = useState<MusicSourceType>('all');
  const [results, setResults] = useState<Track[]>(TOP_TRENDING_TRACKS);
  const [isSearching, setIsSearching] = useState(false);
  const [previewTrackId, setPreviewTrackId] = useState<string | null>(null);
  const [audioPreview] = useState(() => new Audio());
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sendStep, setSendStep] = useState<'resolving' | 'downloading' | 'sending' | 'done' | null>(null);

  useEffect(() => {
    if (isOpen) {
      setResults(TOP_TRENDING_TRACKS.map((t) => ({ ...t, addedBy: djName })));
    }
  }, [isOpen, djName]);

  if (!isOpen) return null;

  const handleSearch = async (e?: React.FormEvent, selectedSource = source) => {
    if (e) e.preventDefault();
    setIsSearching(true);
    const searchTracks = await MusicSearchService.searchOnline(searchQuery, djName, selectedSource);
    setResults(searchTracks);
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

  const handleSendToCar = async (track: Track) => {
    audioPreview.pause();
    setSendingId(track.id);

    // Animación precisa de 4 pasos de transferencia en tiempo real
    setSendStep('resolving');
    await new Promise((r) => setTimeout(r, 450));

    setSendStep('downloading');
    await new Promise((r) => setTimeout(r, 550));

    setSendStep('sending');
    await new Promise((r) => setTimeout(r, 500));

    setSendStep('done');
    onAddTrack(track);

    setTimeout(() => {
      setSendingId(null);
      setSendStep(null);
      onClose();
    }, 650);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md">
      <div className="w-full max-w-lg bg-slate-900 border border-purple-500/30 rounded-2xl p-4 sm:p-5 shadow-2xl flex flex-col max-h-[85vh] text-left">
        {/* Cabecera del modal */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm sm:text-base">Música Online (Con Datos)</h3>
              <p className="text-[11px] text-slate-400">YouTube Music, Apple/Spotify y Top Viral</p>
            </div>
          </div>
          <button onClick={() => { audioPreview.pause(); onClose(); }} className="text-slate-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selector de Fuente OmniRoute */}
        <div className="flex gap-1.5 my-2.5 overflow-x-auto pb-1 text-[11px]">
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
              className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap cursor-pointer transition-all ${
                source === tab.id
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-slate-800/80 text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Formulario de Búsqueda */}
        <form onSubmit={(e) => handleSearch(e)} className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar canción, artista o género..."
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

        {/* Título de Resultados / Tendencias */}
        <div className="flex items-center gap-1.5 pb-2 text-xs font-semibold text-slate-400">
          <Flame className="w-3.5 h-3.5 text-amber-400" />
          <span>{searchQuery.trim() ? `Resultados (${results.length})` : '🔥 Top Musical en Tendencia'}</span>
        </div>

        {/* Lista de Canciones */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar min-h-[220px]">
          {results.map((track) => {
            const isThisSending = sendingId === track.id;

            return (
              <div
                key={track.id}
                className="flex items-center justify-between p-2 rounded-xl bg-white/[0.02] border border-white/5 hover:border-purple-500/30 transition-all"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <button
                    type="button"
                    onClick={() => togglePreview(track)}
                    className="w-10 h-10 rounded-lg bg-slate-800 shrink-0 relative overflow-hidden flex items-center justify-center cursor-pointer"
                  >
                    <TrackCover src={track.coverUrl} alt={track.title} className="w-full h-full" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white">
                      {previewTrackId === track.id ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                    </div>
                  </button>
                  <div className="min-w-0">
                    <h4 className="text-xs sm:text-sm font-semibold text-white truncate">{track.title}</h4>
                    <p className="text-[11px] text-slate-400 truncate">{track.artist}</p>
                  </div>
                </div>

                <div className="shrink-0 ml-2">
                  {isThisSending ? (
                    <Badge variant="cyan" className="text-[10px] py-1 px-2.5 animate-pulse flex items-center gap-1">
                      {sendStep === 'resolving' && <><Radio className="w-3 h-3 animate-spin" /> Conectando stream...</>}
                      {sendStep === 'downloading' && <><Loader2 className="w-3 h-3 animate-spin" /> Descargando audio...</>}
                      {sendStep === 'sending' && <><Car className="w-3 h-3 animate-bounce" /> Transmitiendo al carro...</>}
                      {sendStep === 'done' && <><CheckCircle2 className="w-3 h-3 text-emerald-400" /> ¡En la cola!</>}
                    </Badge>
                  ) : (
                    <button
                      type="button"
                      disabled={sendingId !== null}
                      onClick={() => handleSendToCar(track)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs active:scale-95 transition-all shadow-md shadow-purple-500/20 cursor-pointer disabled:opacity-50"
                    >
                      <Car className="w-3.5 h-3.5" /> Enviar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
