import React, { useState, useEffect } from 'react';
import { LandingView } from './features/landing/LandingView';
import { HostView } from './features/host/HostView';
import { DjView } from './features/dj/DjView';

type AppMode = 'landing' | 'host' | 'dj';

export const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>('landing');
  const [roomId, setRoomId] = useState('BEAT-784');
  const [djName, setDjName] = useState('DJ_Copiloto');
  const [hostIp, setHostIp] = useState<string | undefined>(undefined);
  const [hostPort, setHostPort] = useState<number | undefined>(undefined);

  // Si el usuario entra por un link con QR (?room=BEAT-XXX)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      setRoomId(roomParam.toUpperCase());
      setMode('dj');
    }
  }, []);

  const handleSelectHost = () => {
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
    // Limpiar query param si existía
    if (window.history.pushState) {
      const newUrl = window.location.pathname;
      window.history.pushState({ path: newUrl }, '', newUrl);
    }
  };

  return (
    <main className="min-h-screen bg-[#08090E] text-slate-100 flex flex-col justify-center">
      {mode === 'landing' && (
        <LandingView onSelectHost={handleSelectHost} onJoinDj={handleJoinDj} />
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
    </main>
  );
};

export default App;
