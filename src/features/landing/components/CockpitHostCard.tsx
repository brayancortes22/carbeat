import React from 'react';
import { MonitorPlay, ArrowRight, Music, Sparkles } from 'lucide-react';
import { GlassCard } from '../../../components/ui/GlassCard';
import { Badge } from '../../../components/ui/Badge';

interface CockpitHostCardProps {
  onSelectHost: () => void;
}

export const CockpitHostCard: React.FC<CockpitHostCardProps> = ({ onSelectHost }) => {
  return (
    <GlassCard className="flex flex-col justify-between hover:border-cyan-500/50 group transition-all duration-300 relative overflow-hidden">
      {/* Resplandor ambiental de fondo */}
      <div className="absolute -top-16 -left-16 w-44 h-44 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-cyan-500/20 transition-all duration-500" />

      <div className="space-y-4 relative z-10">
        <div className="flex items-center justify-between">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 group-hover:scale-105 group-hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all">
            <MonitorPlay className="w-6 h-6" />
          </div>
          <Badge variant="cyan" className="text-[10px] tracking-wider">
            Pantalla Principal
          </Badge>
        </div>

        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">
            Pantalla del Carro / Host
          </h2>
          <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
            Abre este modo en la pantalla del vehículo, tablet o equipo conectado a los parlantes. Reproduce audio master y proyecta el QR.
          </p>
        </div>

        {/* Mini Preview de Cabina & Espectro de Audio */}
        <div className="p-3.5 rounded-xl bg-black/40 border border-white/[0.06] flex items-center justify-between gap-3 shadow-inner">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300 shrink-0">
              <Music className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">CarBeat Hi-Fi Master</p>
              <p className="text-[10px] text-cyan-400 flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" /> Autopilot DJ Activo
              </p>
            </div>
          </div>

          {/* Barras de espectro de audio animadas */}
          <div className="flex items-end gap-1 h-5 shrink-0 px-1">
            {[40, 90, 60, 100, 75, 45, 85].map((h, i) => (
              <span
                key={i}
                className="w-1 bg-cyan-400 rounded-full transition-all duration-300"
                style={{
                  height: `${h}%`,
                  animation: `soundwave-bar 1.${i + 2}s ease-in-out infinite alternate`,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      <button
        onClick={onSelectHost}
        className="mt-6 w-full flex items-center justify-center gap-2.5 py-3.5 px-5 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-400 hover:from-cyan-400 hover:to-sky-300 text-slate-950 font-extrabold text-sm transition-all shadow-[0_0_25px_rgba(6,182,212,0.35)] hover:shadow-[0_0_35px_rgba(6,182,212,0.5)] active:scale-[0.98] cursor-pointer"
      >
        <span>Iniciar como Reproductor</span>
        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
      </button>
    </GlassCard>
  );
};
