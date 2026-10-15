import React from 'react';
import { Download, MonitorPlay, Smartphone, CheckCircle2 } from 'lucide-react';
import { GlassCard } from '../../../components/ui/GlassCard';
import { Badge } from '../../../components/ui/Badge';

export const ApkDownloadCard: React.FC = () => {
  return (
    <GlassCard className="max-w-2xl mx-auto my-6 border-cyan-500/20 bg-gradient-to-b from-cyan-950/20 to-transparent">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="space-y-2 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-2">
            <Badge variant="cyan">APK Oficial</Badge>
            <span className="text-xs text-slate-400">Versión 1.0.0 (Arm64 / Universal)</span>
          </div>
          <h3 className="text-xl font-bold text-white flex items-center justify-center sm:justify-start gap-2">
            <MonitorPlay className="w-5 h-5 text-cyan-400" />
            Descargar para la Pantalla del Carro
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 max-w-md">
            Instálala en la pantalla Android de tu vehículo o en cualquier teléfono Android para usarlo como Reproductor Maestro.
          </p>
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 pt-1">
            <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Sin Google Play</span>
            <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Instalación por USB</span>
            <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Compatible con Android 7+</span>
          </div>
        </div>

        <div className="flex flex-col gap-2 w-full sm:w-auto shrink-0">
          <a
            href="/downloads/carbeat-latest.apk"
            download
            className="flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold shadow-lg shadow-cyan-500/25 transition-all active:scale-95 text-sm"
          >
            <Download className="w-4 h-4" />
            Descargar APK (32 MB)
          </a>
          <span className="text-[10px] text-center text-slate-500 flex items-center justify-center gap-1">
            <Smartphone className="w-3 h-3" /> También funciona en tu teléfono
          </span>
        </div>
      </div>
    </GlassCard>
  );
};
