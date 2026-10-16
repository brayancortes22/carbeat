import React, { useState, useEffect } from 'react';
import { Radio, Wifi, BatteryCharging, Layers } from 'lucide-react';
import { CARBEAT_VERSION } from '../../../core/version';
import { VersionBadge } from '../../../components/ui/VersionBadge';

interface CockpitHeaderProps {
  onOpenSimulator?: () => void;
}

export const CockpitHeader: React.FC<CockpitHeaderProps> = ({ onOpenSimulator }) => {
  const [time, setTime] = useState<string>('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    };
    update();
    const timer = setInterval(update, 10000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="w-full max-w-5xl mx-auto flex items-center justify-between py-3 px-4 border-b border-white/[0.06] text-xs text-slate-400">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
          <span className="font-semibold text-slate-200 uppercase tracking-wider text-[11px]">Cabina Online</span>
        </div>
        <span className="text-white/20">•</span>
        <span className="font-mono text-cyan-400">{time || '12:00'}</span>
      </div>

      <div className="flex items-center gap-2.5">
        {onOpenSimulator && (
          <button
            onClick={onOpenSimulator}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[11px] font-bold transition-all active:scale-95 shadow-sm shadow-cyan-500/10 cursor-pointer"
            title="Abrir Simulador Multi-Dispositivo (Tablet + iPhone + Galaxy)"
          >
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden md:inline">Simulador Multi-Dispositivo</span>
            <span className="md:hidden">Simulador</span>
          </button>
        )}
        <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/[0.03] border border-white/5 text-[11px] text-slate-300">
          <Radio className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
          <span>FM/WebRTC</span>
        </div>
        <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/[0.03] border border-white/5 text-[11px] text-slate-300">
          <Wifi className="w-3.5 h-3.5 text-cyan-400" />
          <span>Hotspot Activo</span>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/[0.03] border border-white/5 text-[11px] text-emerald-400">
          <BatteryCharging className="w-3.5 h-3.5" />
          <span>100%</span>
        </div>
        <VersionBadge version={CARBEAT_VERSION} compact />
      </div>
    </header>
  );
};
