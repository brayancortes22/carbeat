import React from 'react';
import { ArrowLeft, RefreshCw, ZoomIn, Layers, Radio } from 'lucide-react';

interface SimulatorControlsProps {
  roomId: string;
  zoom: number;
  setZoom: (z: number) => void;
  onResetRoom: () => void;
  onExit: () => void;
}

export const SimulatorControls: React.FC<SimulatorControlsProps> = ({
  roomId,
  zoom,
  setZoom,
  onResetRoom,
  onExit,
}) => {
  return (
    <header className="sticky top-0 z-50 bg-[#07080D]/90 backdrop-blur-xl border-b border-white/10 px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-3">
        <button
          onClick={onExit}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 text-xs font-bold transition-all active:scale-95"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Volver a la App</span>
        </button>

        <div className="h-4 w-px bg-white/10 hidden sm:block" />

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-xs sm:text-sm font-extrabold text-white tracking-tight flex items-center gap-2">
              <span>CarBeat Multi-Device Studio</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-mono">
                QA WORKBENCH
              </span>
            </h1>
            <p className="text-[10px] text-slate-400 hidden md:block">
              Simulador en vivo de cabina y acompañantes interconectados
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {/* Sala conectada */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-mono">
          <Radio className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
          <span>SALA: {roomId}</span>
        </div>

        {/* Selector de Zoom */}
        <div className="flex items-center gap-1 bg-black/40 border border-white/10 rounded-xl p-1">
          <ZoomIn className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
          {[
            { label: '65%', val: 0.65 },
            { label: '75%', val: 0.75 },
            { label: '85%', val: 0.85 },
            { label: '100%', val: 1.0 },
          ].map((item) => (
            <button
              key={item.label}
              onClick={() => setZoom(item.val)}
              className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                zoom === item.val
                  ? 'bg-cyan-500 text-slate-950 shadow-sm shadow-cyan-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Reiniciar simulación */}
        <button
          onClick={onResetRoom}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-400 hover:from-cyan-400 hover:to-sky-300 text-slate-950 font-extrabold text-xs transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] active:scale-95"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Nueva Sala</span>
        </button>
      </div>
    </header>
  );
};
