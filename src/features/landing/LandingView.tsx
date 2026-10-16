import React, { useState } from 'react';
import { HeroBanner } from './components/HeroBanner';
import { ApkDownloadCard } from './components/ApkDownloadCard';
import { GlassCard } from '../../components/ui/GlassCard';
import { Badge } from '../../components/ui/Badge';
import { MonitorPlay, Music2, QrCode, ArrowRight, ShieldCheck, Radar } from 'lucide-react';
import { HostScannerModal } from '../dj/components/HostScannerModal';
import { CARBEAT_VERSION } from '../../core/version';
import { VersionBadge } from '../../components/ui/VersionBadge';

interface LandingViewProps {
  onSelectHost: () => void;
  onJoinDj: (roomId: string, djName: string, hostIp?: string, hostPort?: number) => void;
}

interface DiscoveredHost {
  roomId: string;
  roomName: string;
  hostIp: string;
  port: number;
  djCount: number;
}

export const LandingView: React.FC<LandingViewProps> = ({ onSelectHost, onJoinDj }) => {
  const [roomIdInput, setRoomIdInput] = useState('BEAT-784');
  const [djNameInput, setDjNameInput] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomIdInput.trim()) return;
    const name = djNameInput.trim() || `DJ_${Math.floor(Math.random() * 900 + 100)}`;
    onJoinDj(roomIdInput.trim().toUpperCase(), name, undefined, undefined);
  };

  const handleConnectDiscovered = (host: DiscoveredHost) => {
    setIsScannerOpen(false);
    const name = djNameInput.trim() || `DJ_${Math.floor(Math.random() * 900 + 100)}`;
    onJoinDj(host.roomId, name, host.hostIp, host.port);
  };

  return (
    <div className="min-h-screen flex flex-col justify-between p-4 sm:p-8">
      <div>
        <HeroBanner />

        {/* Sección de Selección de Modo */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto my-8">
          {/* Tarjeta Host (Pantalla del Carro) */}
          <GlassCard className="flex flex-col justify-between hover:border-cyan-500/40 group">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition-transform">
                  <MonitorPlay className="w-6 h-6" />
                </div>
                <Badge variant="cyan">Modo Carro</Badge>
              </div>
              <h2 className="text-2xl font-bold text-white">Pantalla del Carro / Host</h2>
              <p className="text-sm text-slate-400">
                Abre este modo en la pantalla del vehículo o en el dispositivo conectado a los parlantes. Reproducirá la música y mostrará el código QR a los pasajeros.
              </p>
            </div>

            <button
              onClick={onSelectHost}
              className="mt-6 w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold transition-all shadow-lg shadow-cyan-500/20 active:scale-95 cursor-pointer"
            >
              Iniciar como Reproductor
              <ArrowRight className="w-4 h-4" />
            </button>
          </GlassCard>

          {/* Tarjeta DJ (Celulares y Pasajeros) */}
          <GlassCard className="flex flex-col justify-between hover:border-purple-500/40 group">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 group-hover:scale-105 transition-transform">
                  <Music2 className="w-6 h-6" />
                </div>
                <Badge variant="purple">Modo Pasajero</Badge>
              </div>
              <h2 className="text-2xl font-bold text-white">Unirme como DJ</h2>
              <p className="text-sm text-slate-400">
                Ideal para iPhones, iPads o celulares de pasajeros. Ingresa el código que muestra la pantalla del carro y comienza a pedir canciones.
              </p>

              <form onSubmit={handleJoinSubmit} className="space-y-3 pt-2">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Código de Sala (En la pantalla)</label>
                  <input
                    type="text"
                    value={roomIdInput}
                    onChange={(e) => setRoomIdInput(e.target.value.toUpperCase())}
                    placeholder="EJ: BEAT-784"
                    className="w-full bg-slate-900/60 border border-slate-700/60 rounded-xl px-3.5 py-2.5 text-sm font-mono text-cyan-300 focus:outline-none focus:border-purple-500/80 transition-colors uppercase"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Tu Nombre o Alias (Opcional)</label>
                  <input
                    type="text"
                    value={djNameInput}
                    onChange={(e) => setDjNameInput(e.target.value)}
                    placeholder="Ej: Sebas, Andrés, Copiloto..."
                    className="w-full bg-slate-900/60 border border-slate-700/60 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-purple-500/80 transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold transition-all shadow-lg shadow-purple-500/20 active:scale-95 cursor-pointer"
                >
                  <QrCode className="w-4 h-4" />
                  Conectarme a la Sala
                </button>

                <div className="relative my-3 flex items-center">
                  <div className="flex-grow border-t border-white/10"></div>
                  <span className="flex-shrink-0 mx-3 text-[10px] text-slate-500 font-semibold uppercase tracking-wider">o escanea la red</span>
                  <div className="flex-grow border-t border-t border-white/10"></div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsScannerOpen(true)}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-bold text-xs hover:bg-cyan-500/20 transition-all active:scale-95 cursor-pointer"
                >
                  <Radar className="w-4 h-4" />
                  Escanear Carros Cercanos (Wi-Fi)
                </button>
              </form>
            </div>
          </GlassCard>
        </div>

        {/* Tarjeta de descarga de APK */}
        <ApkDownloadCard />
      </div>

      <footer className="text-center py-6 text-xs text-slate-600 border-t border-slate-800/40 flex items-center justify-center gap-2">
        <ShieldCheck className="w-4 h-4 text-cyan-500/50" />
        CarBeat Engine • Diseñado para cabinas vehiculares • Offline Ready
        <VersionBadge version={CARBEAT_VERSION} />
      </footer>

      {/* Modal de Escaneo de Hosts Cercanos */}
      <HostScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onConnect={handleConnectDiscovered}
      />
    </div>
  );
};
