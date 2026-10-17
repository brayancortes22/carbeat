import React from 'react';
import { Trash2, BookmarkPlus, Sparkles, FolderHeart, HardDrive, Globe, Zap, Power } from 'lucide-react';
import { AutopilotMode } from '../../../core/ai/ai-autopilot-service';

interface HostQueueActionsProps {
  queueCount: number;
  isAutopilotActive: boolean;
  autopilotMode: AutopilotMode;
  onToggleAutopilot: () => void;
  onCycleAutopilotMode: () => void;
  onPurgeQueue: () => void;
  onSaveAllToLibrary: () => void;
  onOpenLibrary: () => void;
}

export const HostQueueActions: React.FC<HostQueueActionsProps> = ({
  queueCount,
  isAutopilotActive,
  autopilotMode,
  onToggleAutopilot,
  onCycleAutopilotMode,
  onPurgeQueue,
  onSaveAllToLibrary,
  onOpenLibrary,
}) => {
  const getModeBadge = () => {
    if (!isAutopilotActive) {
      return {
        label: 'Apagado',
        icon: <Power className="w-3.5 h-3.5 text-slate-500" />,
        style: 'bg-white/5 border-white/10 text-slate-400',
      };
    }
    if (autopilotMode === 'local') {
      return {
        label: 'Solo Local',
        icon: <HardDrive className="w-3.5 h-3.5 text-emerald-400" />,
        style: 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-sm shadow-emerald-500/20',
      };
    }
    if (autopilotMode === 'cloud') {
      return {
        label: 'Solo Nube',
        icon: <Globe className="w-3.5 h-3.5 text-purple-400" />,
        style: 'bg-purple-500/20 border-purple-500/50 text-purple-300 shadow-sm shadow-purple-500/20',
      };
    }
    return {
      label: 'Híbrido',
      icon: <Zap className="w-3.5 h-3.5 text-amber-400" />,
      style: 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-sm shadow-amber-500/20',
    };
  };

  const badge = getModeBadge();

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-white/[0.02] border border-white/5 my-2">
      {/* Botones de Gestión de Biblioteca y Cola */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={onOpenLibrary}
          title="Ver mi música guardada y archivos locales"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-xs font-semibold transition-all active:scale-95 cursor-pointer"
        >
          <FolderHeart className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Mi Biblioteca</span>
        </button>

        {queueCount > 0 && (
          <>
            <button
              onClick={onSaveAllToLibrary}
              title="Guardar las canciones de la cola en mi biblioteca personal"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/20 text-xs font-semibold transition-all active:scale-95 cursor-pointer"
            >
              <BookmarkPlus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Guardar Cola</span>
            </button>

            <button
              onClick={onPurgeQueue}
              title="Borrar de un tacazo las canciones pedidas por los pasajeros"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-semibold transition-all active:scale-95 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Vaciar</span>
            </button>
          </>
        )}
      </div>

      {/* Switch y Selector de Modos de Autopilot IA */}
      <div className="flex items-center gap-1.5">
        {/* Botón Encender / Apagar */}
        <button
          onClick={onToggleAutopilot}
          className={`p-1.5 rounded-lg border transition-all active:scale-95 cursor-pointer ${
            isAutopilotActive
              ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
              : 'bg-white/5 border-white/10 text-slate-500 hover:text-white'
          }`}
          title={isAutopilotActive ? 'Apagar Autopilot IA' : 'Encender Autopilot IA'}
        >
          <Sparkles className={`w-3.5 h-3.5 ${isAutopilotActive ? 'text-amber-400 animate-spin' : ''}`} />
        </button>

        {/* Botón Ciclar Modo: Híbrido -> Local -> Nube */}
        <button
          onClick={isAutopilotActive ? onCycleAutopilotMode : onToggleAutopilot}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all active:scale-95 cursor-pointer ${badge.style}`}
          title={
            isAutopilotActive
              ? `Modo IA actual: ${badge.label}. Clic para cambiar entre Híbrido, Solo Local y Solo Nube.`
              : 'Clic para activar Autopilot IA'
          }
        >
          {badge.icon}
          <span>IA: {badge.label}</span>
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isAutopilotActive ? 'bg-current shadow-[0_0_8px_currentColor]' : 'bg-slate-600'
            }`}
          />
        </button>
      </div>
    </div>
  );
};
