import React from 'react';
import { Volume2, Play, Pause, SkipForward, SkipBack } from 'lucide-react';
import { TrackCover } from '../../../components/ui/TrackCover';
import { Track } from '../../../types/track.types';

interface LivePlaybackState {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
}

interface DjNowPlayingCardProps {
  playback: LivePlaybackState;
  onTogglePlay?: () => void;
  onNext?: () => void;
  onPrev?: () => void;
}

export const DjNowPlayingCard: React.FC<DjNowPlayingCardProps> = ({
  playback,
  onTogglePlay,
  onNext,
  onPrev,
}) => {
  const progressPercent = playback.duration > 0
    ? (playback.currentTime / playback.duration) * 100
    : 0;

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remaining = Math.floor(secs % 60);
    return `${mins}:${remaining < 10 ? '0' : ''}${remaining}`;
  };

  return (
    <div className="my-2 p-3 rounded-2xl bg-gradient-to-r from-cyan-950/40 via-slate-900/60 to-purple-950/30 border border-cyan-500/30 flex flex-col gap-2.5 shadow-xl shadow-cyan-950/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative">
            <TrackCover
              src={playback.currentTrack?.coverUrl}
              alt="Car Playing"
              className="w-12 h-12 rounded-xl shadow-md shrink-0"
            />
            {playback.isPlaying && (
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center">
                <Volume2 className="w-2.5 h-2.5 text-white" />
              </div>
            )}
          </div>
          <div className="min-w-0 text-left">
            <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Volume2 className={`w-3.5 h-3.5 text-cyan-400 ${playback.isPlaying ? 'animate-pulse' : ''}`} />
              Sonando en el Carro
            </span>
            <h4 className="text-sm font-bold text-white truncate">
              {playback.currentTrack?.title || 'En espera de reproducción'}
            </h4>
            <p className="text-xs text-slate-400 truncate">
              {playback.currentTrack?.artist || 'Selecciona o pide una canción'}
            </p>
          </div>
        </div>

        {/* Controles Remotos de Cabina para el Pasajero/Copiloto */}
        <div className="flex items-center gap-1 shrink-0">
          {onPrev && (
            <button
              onClick={onPrev}
              title="Volver canción anterior"
              className="p-2 rounded-xl bg-white/[0.05] hover:bg-white/10 text-slate-300 hover:text-white transition-all active:scale-90 cursor-pointer"
            >
              <SkipBack className="w-4 h-4" />
            </button>
          )}

          {onTogglePlay && (
            <button
              onClick={onTogglePlay}
              title={playback.isPlaying ? 'Pausar música del carro' : 'Reanudar música del carro'}
              className="p-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black shadow-md shadow-cyan-500/30 transition-all active:scale-95 cursor-pointer"
            >
              {playback.isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current translate-x-0.5" />}
            </button>
          )}

          {onNext && (
            <button
              onClick={onNext}
              title="Pasar a siguiente canción"
              className="p-2 rounded-xl bg-white/[0.05] hover:bg-white/10 text-slate-300 hover:text-white transition-all active:scale-90 cursor-pointer"
            >
              <SkipForward className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Barra de Tiempo y Progreso en Vivo */}
      <div className="space-y-1">
        <div className="h-1.5 w-full bg-slate-800/80 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 to-sky-400 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-slate-500 font-mono">
          <span>{formatTime(playback.currentTime)}</span>
          <span className="text-cyan-400/80 font-bold">{playback.isPlaying ? '● Reproduciendo' : '⏸ En Pausa'}</span>
          <span>{formatTime(playback.duration)}</span>
        </div>
      </div>
    </div>
  );
};
