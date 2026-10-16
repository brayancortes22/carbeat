import React from 'react';
import { ArrowLeft, Globe, FolderPlus, Library, FolderHeart } from 'lucide-react';
import { CARBEAT_VERSION } from '../../../core/version';
import { VersionBadge } from '../../../components/ui/VersionBadge';

interface HostHeaderProps {
  catalogCount: number;
  isAnnouncing: boolean;
  onCloseRoom: () => void;
  onOpenSearch: () => void;
  onOpenLibrary: () => void;
  onFolderSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const HostHeader: React.FC<HostHeaderProps> = ({
  catalogCount,
  isAnnouncing,
  onCloseRoom,
  onOpenSearch,
  onOpenLibrary,
  onFolderSelect,
}) => {
  return (
    <header className="flex items-center justify-between pb-4 border-b border-white/5 flex-wrap gap-2">
      <button
        onClick={onCloseRoom}
        className="flex items-center gap-2 text-xs font-bold text-red-400 hover:text-red-300 transition-colors cursor-pointer px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 active:scale-95"
      >
        <ArrowLeft className="w-4 h-4" /> Cerrar Sala
      </button>

      <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
        {/* Indicador de anuncio de descubrimiento */}
        <span className={`flex items-center gap-1 text-xs ${isAnnouncing ? 'text-emerald-400' : 'text-slate-500'}`}>
          <div
            className={`w-1.5 h-1.5 rounded-full ${isAnnouncing ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`}
          />
          <span className="hidden sm:inline">{isAnnouncing ? 'Anunciando en red' : 'Esperando red'}</span>
        </span>

        {/* Indicador dinámico de versión */}
        <VersionBadge version={CARBEAT_VERSION} compact />

        {/* Biblioteca del Chofer */}
        <button
          onClick={onOpenLibrary}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-xs font-semibold transition-all active:scale-95 cursor-pointer"
        >
          <FolderHeart className="w-3.5 h-3.5" />
          <span>Mi Música</span>
        </button>

        {/* Buscar en la Web */}
        <button
          onClick={onOpenSearch}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-md shadow-cyan-500/20 transition-all active:scale-95 cursor-pointer"
        >
          <Globe className="w-3.5 h-3.5" />
          <span>Buscar en Web</span>
        </button>

        {/* Cargar USB / Carpeta local */}
        <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 text-xs font-semibold cursor-pointer transition-all active:scale-95">
          <FolderPlus className="w-3.5 h-3.5 text-cyan-400" />
          <span>Cargar USB</span>
          <input
            type="file"
            multiple
            accept="audio/*,.mp3,.flac,.m4a"
            onChange={onFolderSelect}
            className="hidden"
          />
        </label>

        {/* Contador de temas */}
        <div className="flex items-center gap-1.5">
          <Library className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-mono text-slate-300">{catalogCount} temas</span>
        </div>
      </div>
    </header>
  );
};
