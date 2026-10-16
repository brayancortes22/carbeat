import React from 'react';
import { Disc3, Sparkles, Shield, Cpu } from 'lucide-react';

export const HeroBanner: React.FC = () => {
  return (
    <div className="text-center max-w-4xl mx-auto pt-6 pb-4 px-4">
      <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/10 shadow-inner">
        <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
        <span className="text-xs font-semibold text-slate-300 tracking-wide uppercase">
          Sistema de Audio Colaborativo de Cabina
        </span>
      </div>

      <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white mb-3 leading-[1.1]">
        Controla la música del carro{' '}
        <span className="bg-gradient-to-r from-cyan-400 via-sky-300 to-purple-400 bg-clip-text text-transparent drop-shadow-[0_0_35px_rgba(6,182,212,0.3)]">
          sin límites
        </span>
      </h1>

      <p className="text-slate-400 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed font-normal">
        Convierte la pantalla de tu vehículo en un centro musical interactivo.
        Los pasajeros proponen y votan temas desde su celular sin descargas obligatorias y 100% offline en carretera.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-4 mt-5 text-[11px] text-slate-400 font-medium">
        <span className="flex items-center gap-1.5">
          <Disc3 className="w-3.5 h-3.5 text-cyan-400" /> Cero suscripciones
        </span>
        <span className="text-white/20">•</span>
        <span className="flex items-center gap-1.5">
          <Cpu className="w-3.5 h-3.5 text-purple-400" /> Autopilot DJ con IA
        </span>
        <span className="text-white/20">•</span>
        <span className="flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-emerald-400" /> Sincronización WebRTC
        </span>
      </div>
    </div>
  );
};
