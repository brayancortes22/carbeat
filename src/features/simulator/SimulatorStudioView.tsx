import React, { useState, useRef } from 'react';
import { DeviceFrame } from './components/DeviceFrame';
import { SimulatorControls } from './components/SimulatorControls';

interface SimulatorStudioViewProps {
  onExit: () => void;
}

export const SimulatorStudioView: React.FC<SimulatorStudioViewProps> = ({ onExit }) => {
  const [roomId, setRoomId] = useState(() => `CAR-${Math.floor(100 + Math.random() * 900)}`);
  const [zoom, setZoom] = useState(0.75);

  const tabletRef = useRef<HTMLIFrameElement | null>(null);
  const iphoneRef = useRef<HTMLIFrameElement | null>(null);
  const galaxyRef = useRef<HTMLIFrameElement | null>(null);

  const reloadIframe = (ref: React.RefObject<HTMLIFrameElement | null>) => {
    if (ref.current) {
      ref.current.src = ref.current.src;
    }
  };

  const handleResetRoom = () => {
    const newRoom = `CAR-${Math.floor(100 + Math.random() * 900)}`;
    setRoomId(newRoom);
  };

  const hostSrc = `/?embedded=host&room=${roomId}`;
  const iphoneSrc = `/?embedded=dj&room=${roomId}&djName=Copiloto_iPhone`;
  const galaxySrc = `/?embedded=dj&room=${roomId}&djName=Pasajero_Galaxy`;

  return (
    <div className="min-h-screen bg-[#05060A] flex flex-col text-slate-100 overflow-x-auto">
      <SimulatorControls
        roomId={roomId}
        zoom={zoom}
        setZoom={setZoom}
        onResetRoom={handleResetRoom}
        onExit={onExit}
      />

      <main className="flex-1 p-6 flex items-start justify-center">
        <div
          className="flex flex-col xl:flex-row items-center xl:items-start justify-center gap-10 transition-transform duration-300 origin-top"
          style={{ transform: `scale(${zoom})` }}
        >
          {/* DISPOSITIVO 1: PANTALLA PRINCIPAL DEL CARRO / TABLET */}
          <DeviceFrame
            type="tablet"
            title="Pantalla de Cabina / Tablet"
            subtitle="Modo Host • Audio Master & QR"
            badge="CABINA DEL CARRO"
            badgeColor="cyan"
            width={860}
            height={560}
            src={hostSrc}
            iframeRef={tabletRef}
            onReload={() => reloadIframe(tabletRef)}
          />

          {/* DISPOSITIVO 2: IPHONE 15 PRO (COPILOTO) */}
          <DeviceFrame
            type="iphone"
            title="iPhone 15 Pro"
            subtitle="Pasajero 1 • Copiloto"
            badge="DJ COPILOTO"
            badgeColor="purple"
            width={380}
            height={760}
            src={iphoneSrc}
            iframeRef={iphoneRef}
            onReload={() => reloadIframe(iphoneRef)}
          />

          {/* DISPOSITIVO 3: SAMSUNG GALAXY S24 ULTRA (PASAJERO TRASERO) */}
          <DeviceFrame
            type="android"
            title="Samsung Galaxy S24"
            subtitle="Pasajero 2 • Asiento Trasero"
            badge="DJ TRASERO"
            badgeColor="amber"
            width={380}
            height={760}
            src={galaxySrc}
            iframeRef={galaxyRef}
            onReload={() => reloadIframe(galaxyRef)}
          />
        </div>
      </main>
    </div>
  );
};
