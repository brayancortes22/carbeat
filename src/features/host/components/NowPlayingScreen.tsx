import React from 'react';
import { Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, Disc } from 'lucide-react';
import { Track } from '../../../types/track.types';
import { Badge } from '../../../components/ui/Badge';
import { AudioVisualizer } from './AudioVisualizer';

interface NowPlayingScreenProps {
  track: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (seconds: number) => void;
  onVolumeChange: (vol: number) => void;
}

export const NowPlayingScreen: React.FC<NowPlayingScreenProps> = ({
  track,
  isPlaying,
  currentTime,
  duration,
  volume,
  onTogglePlay,
  onNext,
  onPrev,
  onSeek,
  onVolumeChange,
}) => {
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remaining = Math.floor(secs % 60);
    return `${mins}:${remaining < 10 ? '0' : ''}${remaining}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex flex-col items-center justify-between h-full p-2 sm:p-5 text-center overflow-hidden">
      {/* Carátula y Metadatos Fluida y Adaptable a Pantalla de Carro (1024x600) */}
      <div className="flex flex-col items-center w-full max-w-sm">
        <div className="relative w-[130px] h-[130px] sm:w-[180px] sm:h-[180px] md:w-[210px] md:h-[210px] rounded-2xl sm:rounded-3xl overflow-hidden border border-white/10 shadow-2xl mb-2 sm:mb-3 bg-slate-900 flex items-center justify-center group shrink-0">
          {track?.coverUrl ? (
            <img
              src={track.coverUrl}
              alt={track.title}
              className={`w-full h-full object-cover transition-transform duration-700 ${isPlaying ? 'scale-105' : 'scale-100 opacity-80'}`}
            />
          ) : (
            <Disc className={`w-14 h-14 sm:w-16 sm:h-16 text-cyan-500/40 ${isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '4s' }} />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent pointer-events-none" />
        </div>

        <div className="space-y-0.5 sm:space-y-1 w-full truncate">
          <div className="flex items-center justify-center gap-2 mb-0.5">
            <Badge variant={track?.source === 'passenger_dj' ? 'purple' : 'cyan'}>
              {track?.source === 'passenger_dj' ? `DJ: ${track.addedBy || 'Pasajero'}` : 'Música Local'}
            </Badge>
          </div>
          <h2 className="text-lg sm:text-xl md:text-2xl font-black text-white truncate px-2">
            {track?.title || 'Sin reproducción'}
          </h2>
          <p className="text-xs sm:text-sm font-medium text-slate-400 truncate">
            {track?.artist || 'Selecciona una canción'}
          </p>

          <AudioVisualizer isPlaying={isPlaying} barCount={16} className="mt-1" />
        </div>
      </div>

      {/* Barra de Progreso */}
      <div className="w-full max-w-md my-4">
        <div
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickPos = (e.clientX - rect.left) / rect.width;
            onSeek(clickPos * duration);
          }}
          className="h-2 w-full bg-slate-800 rounded-full cursor-pointer relative overflow-hidden group"
        >
          <div
            className="h-full bg-gradient-to-r from-cyan-500 to-sky-400 rounded-full transition-all duration-150"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex justify-between text-[11px] text-slate-500 mt-1 font-mono">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controles Ergonómicos de Gran Tamaño (Conducción) */}
      <div className="flex items-center justify-center gap-6 sm:gap-8 w-full max-w-md">
        <button
          onClick={onPrev}
          aria-label="Canción anterior"
          className="p-3.5 rounded-full bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all active:scale-90"
        >
          <SkipBack className="w-6 h-6" />
        </button>

        <button
          onClick={onTogglePlay}
          aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
          className="p-5 rounded-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black shadow-xl shadow-cyan-500/30 transition-all active:scale-95"
        >
          {isPlaying ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current translate-x-0.5" />}
        </button>

        <button
          onClick={onNext}
          aria-label="Siguiente canción"
          className="p-3.5 rounded-full bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all active:scale-90"
        >
          <SkipForward className="w-6 h-6" />
        </button>
      </div>

      {/* Control de Volumen Rápido */}
      <div className="flex items-center gap-3 w-48 mt-4 text-slate-500">
        <button onClick={() => onVolumeChange(volume > 0 ? 0 : 0.8)} className="hover:text-cyan-400">
          {volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={volume}
          onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
          className="w-full accent-cyan-400 h-1 bg-slate-800 rounded-lg cursor-pointer"
        />
      </div>
    </div>
  );
};
