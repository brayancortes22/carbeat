import React from 'react';
import { Trash2, BookmarkPlus, Sparkles, FolderHeart } from 'lucide-react';

interface HostQueueActionsProps {
  queueCount: number;
  isAutopilotActive: boolean;
  onToggleAutopilot: () => void;
  onPurgeQueue: () => void;
  onSaveAllToLibrary: () => void;
  onOpenLibrary: () => void;
}

export const HostQueueActions: React.FC<HostQueueActionsProps> = ({
  queueCount,
  isAutopilotActive,
  onToggleAutopilot,
  onPurgeQueue,
  onSaveAllToLibrary,
  onOpenLibrary,
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-white/[0.02] border border-white/5 my-2">
      {/* Botones de Gestión de Biblioteca y Cola */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={onOpenLibrary}
          title="Ver mi música guardada"
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

      {/* Switch de Autopilot IA */}
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleAutopilot}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 cursor-pointer ${
            isAutopilotActive
              ? 'bg-amber-500/20 border border-amber-500/50 text-amber-300 shadow-sm shadow-amber-500/20'
              : 'bg-white/5 border border-white/10 text-slate-400 hover:text-white'
          }`}
          title={
            isAutopilotActive
              ? 'Autopilot IA Activo: encola canciones relacionadas automáticamente'
              : 'Activar Autopilot IA para que el carro nunca se quede en silencio'
          }
        >
          <Sparkles className={`w-3.5 h-3.5 ${isAutopilotActive ? 'text-amber-400 animate-spin' : 'text-slate-400'}`} />
          <span>Autopilot IA</span>
          <span
            className={`w-2 h-2 rounded-full ${
              isAutopilotActive ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]' : 'bg-slate-600'
            }`}
          />
        </button>
      </div>
    </div>
  );
};
