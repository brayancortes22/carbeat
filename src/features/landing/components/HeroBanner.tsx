import React from 'react';
import { Disc3, Radio, Sparkles } from 'lucide-react';
import { Badge } from '../../../components/ui/Badge';

export const HeroBanner: React.FC = () => {
  return (
    <div className="text-center max-w-3xl mx-auto pt-8 pb-6 px-4">
      <div className="inline-flex items-center gap-2 mb-4">
        <Badge variant="cyan">
          <Sparkles className="w-3.5 h-3.5" />
          Sistema de Audio Colaborativo
        </Badge>
        <Badge variant="purple">
          <Radio className="w-3.5 h-3.5 animate-pulse" />
          Cabina & Fiestas
        </Badge>
      </div>

      <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white mb-4">
        Controla la música del carro{' '}
        <span className="bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-400 bg-clip-text text-transparent">
          sin límites
        </span>
      </h1>

      <p className="text-slate-400 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
        Convierte la pantalla de tu carro o parlante en un Jukebox colaborativo. 
        Tus pasajeros eligen canciones desde su celular (Android o iPhone) sin gastar tus datos y 100% offline en carretera.
      </p>

      <div className="flex items-center justify-center gap-3 mt-6 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <Disc3 className="w-3.5 h-3.5 text-cyan-400" /> Cero suscripciones obligatorias
        </span>
        <span>•</span>
        <span>Funciona en carretera sin señal</span>
        <span>•</span>
        <span>Multiplataforma</span>
      </div>
    </div>
  );
};
