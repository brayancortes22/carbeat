import React, { useState, useEffect } from 'react';
import { LandingView } from './features/landing/LandingView';
import { HostView } from './features/host/HostView';
import { DjView } from './features/dj/DjView';
import { SimulatorStudioView } from './features/simulator/SimulatorStudioView';
import { AppUpdaterService, UpdateCheckResult } from './core/updater/app-updater';
import { AutoUpdateModal } from './features/landing/components/AutoUpdateModal';

type AppMode = 'landing' | 'host' | 'dj' | 'simulator';

const generateRoomId = (): string => {
  const prefixes = ['BEAT', 'CAR', 'RIDE', 'VIBE', 'AUTO'];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const num = Math.floor(100 + Math.random() * 900);
  return `${prefix}-${num}`;
};

export const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>('landing');
  const [roomId, setRoomId] = useState(() => generateRoomId());
  const [djName, setDjName] = useState('DJ_Copiloto');
  const [hostIp, setHostIp] = useState<string | undefined>(undefined);
  const [hostPort, setHostPort] = useState<number | undefined>(undefined);
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResult | null>(null);

  // Comprobar automáticamente actualizaciones del sistema en segundo plano
  useEffect(() => {
    AppUpdaterService.checkForUpdates().then((res) => {
      if (res && res.hasUpdate) {
        setUpdateInfo(res);
      }
    });
  }, []);

  // Parsear parámetros de URL para simulación, QR y enlaces directos
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view');
    const embedded = params.get('embedded');
    const roomParam = params.get('room');
    const nameParam = params.get('djName');

    if (viewParam === 'simulator') {
      setMode('simulator');
      return;
    }

    if (embedded === 'host') {
      if (roomParam) setRoomId(roomParam.toUpperCase());
      setMode('host');
      return;
    }

    if (embedded === 'dj') {
      if (roomParam) setRoomId(roomParam.toUpperCase());
      if (nameParam) setDjName(nameParam);
      setMode('dj');
      return;
    }

    if (roomParam) {
      setRoomId(roomParam.toUpperCase());
      setMode('dj');
    }
  }, []);

  // Asegurar que al cambiar de pantalla siempre inicie en la parte superior sin cortes
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [mode]);

  const handleSelectHost = () => {
    const freshRoom = generateRoomId();
    setRoomId(freshRoom);
    setMode('host');
  };

  const handleJoinDj = (selectedRoom: string, name: string, ip?: string, port?: number) => {
    setRoomId(selectedRoom);
    setDjName(name);
    setHostIp(ip);
    setHostPort(port);
    setMode('dj');
  };

  const handleBackToLanding = () => {
    setMode('landing');
    setHostIp(undefined);
    setHostPort(undefined);
    if (window.history.pushState) {
      const newUrl = window.location.pathname;
      window.history.pushState({ path: newUrl }, '', newUrl);
    }
  };

  if (mode === 'simulator') {
    return <SimulatorStudioView onExit={handleBackToLanding} />;
  }

  return (
    <div className="min-h-screen bg-[#08090E] text-slate-100 flex flex-col">
      {mode === 'landing' && (
        <LandingView
          onSelectHost={handleSelectHost}
          onJoinDj={handleJoinDj}
          onOpenSimulator={() => setMode('simulator')}
        />
      )}
      {mode === 'host' && (
        <HostView onBackToLanding={handleBackToLanding} roomId={roomId} />
      )}
      {mode === 'dj' && (
        <DjView
          roomId={roomId}
          djName={djName}
          hostIp={hostIp}
          hostPort={hostPort}
          onLeaveRoom={handleBackToLanding}
        />
      )}

      {/* Modal de Auto-Actualización Autónoma */}
      {updateInfo?.hasUpdate && (
        <AutoUpdateModal
          updateInfo={updateInfo}
          onDismiss={() => setUpdateInfo(null)}
        />
      )}
    </div>
  );
};

export default App;
