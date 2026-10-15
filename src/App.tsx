import React, { useState, useEffect } from 'react';
import { LandingView } from './features/landing/LandingView';
import { HostView } from './features/host/HostView';
import { DjView } from './features/dj/DjView';

type AppMode = 'landing' | 'host' | 'dj';

export const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>('landing');
  const [roomId, setRoomId] = useState('BEAT-784');
  const [djName, setDjName] = useState('DJ_Copiloto');

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

  const handleJoinDj = (selectedRoom: string, name: string) => {
    setRoomId(selectedRoom);
    setDjName(name);
    setMode('dj');
  };

  const handleBackToLanding = () => {
    setMode('landing');
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
        <DjView roomId={roomId} djName={djName} onLeaveRoom={handleBackToLanding} />
      )}
    </main>
  );
};

export default App;
