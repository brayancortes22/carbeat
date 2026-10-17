import React, { useState } from 'react';
import { CockpitHeader } from './components/CockpitHeader';
import { HeroBanner } from './components/HeroBanner';
import { CockpitHostCard } from './components/CockpitHostCard';
import { CockpitDjCard } from './components/CockpitDjCard';
import { ApkDownloadCard } from './components/ApkDownloadCard';
import { UpdateNotificationBanner } from './components/UpdateNotificationBanner';
import { HostScannerModal } from '../dj/components/HostScannerModal';
import { CARBEAT_VERSION } from '../../core/version';
import { VersionBadge } from '../../components/ui/VersionBadge';
import { ShieldCheck } from 'lucide-react';
import { apiUrl } from '../../core/network/api-config';

interface LandingViewProps {
  onSelectHost: () => void;
  onJoinDj: (roomId: string, djName: string, hostIp?: string, hostPort?: number) => void;
  onOpenSimulator?: () => void;
}

interface DiscoveredHost {
  roomId: string;
  roomName: string;
  hostIp: string;
  port: number;
  djCount: number;
}

export const LandingView: React.FC<LandingViewProps> = ({
  onSelectHost,
  onJoinDj,
  onOpenSimulator,
}) => {
  const [roomIdInput, setRoomIdInput] = useState(() => {
    return localStorage.getItem('carbeat_last_room') || '';
  });
  const [djNameInput, setDjNameInput] = useState(() => {
    return localStorage.getItem('carbeat_last_dj_name') || '';
  });
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isCheckingRoom, setIsCheckingRoom] = useState(false);
  const [roomError, setRoomError] = useState<string | null>(null);

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = roomIdInput.trim().toUpperCase();
    if (!code) return;

    setIsCheckingRoom(true);
    setRoomError(null);

    try {
      const res = await fetch(apiUrl(`/api/room?roomId=${encodeURIComponent(code)}`));
      if (res.ok) {
        const data = await res.json();
        if (data && data.closed === true) {
          setRoomError(data.error || `La sala "${code}" fue cerrada por el conductor.`);
          setIsCheckingRoom(false);
          return;
        }
      }
    } catch {
      // Ignorar error de red si no hay internet (permite fallback offline P2P)
    } finally {
      setIsCheckingRoom(false);
    }

    const name = djNameInput.trim() || `DJ_${Math.floor(Math.random() * 900 + 100)}`;
    localStorage.setItem('carbeat_last_room', code);
    localStorage.setItem('carbeat_last_dj_name', name);
    onJoinDj(code, name, undefined, undefined);
  };

  const handleConnectDiscovered = (host: DiscoveredHost) => {
    setIsScannerOpen(false);
    setRoomError(null);
    const name = djNameInput.trim() || `DJ_${Math.floor(Math.random() * 900 + 100)}`;
    onJoinDj(host.roomId, name, host.hostIp, host.port);
  };

  return (
    <div className="min-h-screen bg-[#07080D] flex flex-col justify-between selection:bg-cyan-500 selection:text-slate-950">
      <div>
        <CockpitHeader />
        <HeroBanner />
        <UpdateNotificationBanner />

        {/* Sección de Selección de Modo (Dual-Cockpit Cards) */}
        <main className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto px-4 my-6">
          <CockpitHostCard onSelectHost={onSelectHost} />
          <CockpitDjCard
            roomIdInput={roomIdInput}
            setRoomIdInput={setRoomIdInput}
            djNameInput={djNameInput}
            setDjNameInput={setDjNameInput}
            handleJoinSubmit={handleJoinSubmit}
            isCheckingRoom={isCheckingRoom}
            roomError={roomError}
            onOpenScanner={() => setIsScannerOpen(true)}
          />
        </main>

        {/* Tarjeta de descarga de APK */}
        <div className="max-w-5xl mx-auto px-4 mb-8">
          <ApkDownloadCard />
        </div>
      </div>

      <footer className="text-center py-5 text-xs text-slate-500 border-t border-white/[0.06] flex items-center justify-center gap-2 flex-wrap">
        <ShieldCheck className="w-4 h-4 text-cyan-400" />
        <span>CarBeat Engine • Diseñado para cabinas vehiculares • Offline Ready</span>
        <VersionBadge version={CARBEAT_VERSION} />
        {onOpenSimulator && (
          <button
            onClick={onOpenSimulator}
            className="text-slate-600 hover:text-cyan-400 text-[10px] ml-2 cursor-pointer transition-colors"
            title="Estudio de Simulación Multi-Dispositivo"
          >
            • Simulador
          </button>
        )}
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
