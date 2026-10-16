import React, { useState, useEffect } from 'react';
import { DownloadCloud, Sparkles, X } from 'lucide-react';
import { CARBEAT_VERSION } from '../../../core/version';
import { getApiBaseUrl } from '../../../core/network/api-config';

export const UpdateNotificationBanner: React.FC = () => {
  const [isDismissed, setIsDismissed] = useState(false);
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    // Detectar si está corriendo dentro de la APK de Android o PWA
    const isApp = getApiBaseUrl() !== '' || window.matchMedia('(display-mode: standalone)').matches;
    setIsNative(isApp);
  }, []);

  if (isDismissed) return null;

  return (
    <div className="w-full max-w-4xl mx-auto mb-4 px-4">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-cyan-950/70 via-slate-900/80 to-purple-950/70 border border-cyan-500/30 p-3 sm:p-4 backdrop-blur-xl shadow-[0_0_25px_rgba(6,182,212,0.15)] flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0">
            <Sparkles className="w-4 h-4 animate-pulse" />
          </div>
          <div className="min-w-0 text-left">
            <p className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
              <span>CarBeat {CARBEAT_VERSION}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono">
                EN VIVO
              </span>
            </p>
            <p className="text-[11px] text-slate-300 truncate">
              {isNative
                ? 'App conectada a la nube en tiempo real. Mantén la última versión instalada.'
                : 'Sincronización multi-dispositivo y cabina automotriz lista.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
          <a
            href="https://carbeat-pi.vercel.app/downloads/carbeat-latest.apk"
            download
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-400 hover:from-cyan-400 hover:to-sky-300 text-slate-950 font-extrabold text-xs transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] active:scale-95"
          >
            <DownloadCloud className="w-3.5 h-3.5" />
            <span>Descargar Actualización APK</span>
          </a>
          <button
            onClick={() => setIsDismissed(true)}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
            title="Cerrar aviso"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
