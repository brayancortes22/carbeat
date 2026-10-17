import React, { useState } from 'react';
import { Download, Sparkles, CheckCircle, RefreshCw, X, ArrowRight } from 'lucide-react';
import { GlassCard } from '../../../components/ui/GlassCard';
import { AppUpdaterService, UpdateCheckResult } from '../../../core/updater/app-updater';

interface AutoUpdateModalProps {
  updateInfo: UpdateCheckResult;
  onDismiss: () => void;
}

export const AutoUpdateModal: React.FC<AutoUpdateModalProps> = ({ updateInfo, onDismiss }) => {
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [readyToInstall, setReadyToInstall] = useState(false);

  const handleStartUpdate = () => {
    setDownloading(true);
    setDownloadProgress(10);

    const interval = setInterval(() => {
      setDownloadProgress((prev) => {
        if (prev >= 95) {
          clearInterval(interval);
          setReadyToInstall(true);
          setDownloading(false);
          AppUpdaterService.triggerApkDownload(updateInfo.apkUrl);
          return 100;
        }
        return prev + 15;
      });
    }, 200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <GlassCard className="w-full max-w-md p-6 bg-slate-900/90 border-cyan-500/40 shadow-[0_0_50px_rgba(6,182,212,0.25)] relative">
        <button
          onClick={onDismiss}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-500/50 flex items-center justify-center text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.3)]">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              <span>Actualización Disponible</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-mono">
                v{updateInfo.latestVersion}
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Versión actual: <span className="font-mono text-slate-300">v{updateInfo.currentVersion}</span>
            </p>
          </div>
        </div>

        <div className="bg-slate-950/60 rounded-xl p-3 border border-white/5 mb-5 max-h-36 overflow-y-auto">
          <p className="text-[11px] font-semibold text-cyan-400 uppercase tracking-wider mb-1.5">
            Novedades del Sistema:
          </p>
          <ul className="space-y-1 text-xs text-slate-300">
            {updateInfo.features.map((feat, idx) => (
              <li key={idx} className="flex items-start gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span>{feat}</span>
              </li>
            ))}
          </ul>
        </div>

        {downloading && (
          <div className="mb-4">
            <div className="flex justify-between text-xs text-cyan-400 mb-1 font-mono">
              <span>Descargando nueva APK...</span>
              <span>{downloadProgress}%</span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden border border-cyan-500/20">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-300"
                style={{ width: `${downloadProgress}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex gap-2.5">
          <button
            onClick={onDismiss}
            className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
          >
            Recordar luego
          </button>

          {!readyToInstall ? (
            <button
              onClick={handleStartUpdate}
              disabled={downloading}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-400 hover:from-cyan-400 hover:to-sky-300 text-slate-950 font-black text-xs transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)] cursor-pointer active:scale-95 disabled:opacity-50"
            >
              {downloading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Descargando...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Actualizar Ahora</span>
                </>
              )}
            </button>
          ) : (
            <button
              onClick={() => AppUpdaterService.triggerApkDownload(updateInfo.apkUrl)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition-all shadow-[0_0_20px_rgba(16,185,129,0.4)] cursor-pointer active:scale-95"
            >
              <span>Instalar APK</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </GlassCard>
    </div>
  );
};
