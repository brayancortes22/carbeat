import React from 'react';
import { Volume2 } from 'lucide-react';
import { TrackCover } from '../../../components/ui/TrackCover';
import { Badge } from '../../../components/ui/Badge';
import { Track } from '../../../types/track.types';

interface LivePlaybackState {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
}

interface DjNowPlayingCardProps {
  playback: LivePlaybackState;
}

export const DjNowPlayingCard: React.FC<DjNowPlayingCardProps> = ({ playback }) => {
  const progressPercent = playback.duration > 0
    ? (playback.currentTime / playback.duration) * 100
    : 0;

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remaining = Math.floor(secs % 60);
    return `${mins}:${remaining < 10 ? '0' : ''}${remaining}`;
  };

  return (
    <div className="my-2.5 p-3 rounded-2xl bg-gradient-to-r from-cyan-950/40 to-slate-900/60 border border-cyan-500/30 flex flex-col gap-2 shadow-xl shadow-cyan-950/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative">
            <TrackCover
              src={playback.currentTrack?.coverUrl}
              alt="Car Playing"
              className="w-11 h-11 rounded-xl shadow-md"
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
        <Badge variant={playback.isPlaying ? 'emerald' : 'slate'} className="text-[9px] shrink-0">
          {playback.isPlaying ? 'En Vivo' : 'En Pausa'}
        </Badge>
      </div>

      <div className="space-y-1">
        <div className="h-1.5 w-full bg-slate-800/80 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 to-sky-400 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-slate-500 font-mono">
          <span>{formatTime(playback.currentTime)}</span>
          <span>{formatTime(playback.duration)}</span>
        </div>
      </div>
    </div>
  );
};
