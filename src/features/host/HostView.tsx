import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { NowPlayingScreen } from './components/NowPlayingScreen';
import { RoomQrBadge } from './components/RoomQrBadge';
import { HostQueueList } from './components/HostQueueList';
import { GlassCard } from '../../components/ui/GlassCard';
import { globalAudioEngine } from '../../core/audio/audio-player';
import { MOCK_CAR_TRACKS } from '../../core/audio/mock-library';
import { RoomChannel } from '../../core/network/room-channel';
import { QueueItem, Track } from '../../types/track.types';
import { ArrowLeft, Library } from 'lucide-react';

interface HostViewProps {
  onBackToLanding: () => void;
  roomId?: string;
}

export const HostView: React.FC<HostViewProps> = ({ onBackToLanding, roomId = 'BEAT-784' }) => {
  const [catalog, setCatalog] = useState<Track[]>(MOCK_CAR_TRACKS);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [playerState, setPlayerState] = useState(globalAudioEngine.getState());
  const [connectedDjs, setConnectedDjs] = useState<string[]>(['Sebas (Celular)']);

  const channel = useMemo(() => new RoomChannel(roomId), [roomId]);

  // Manejar el avance a la siguiente canción
  const handleNext = useCallback(() => {
    if (queue.length > 0) {
      const nextItem = queue[0];
      setQueue((prev) => prev.slice(1));
      globalAudioEngine.loadTrack(nextItem.track);
    } else if (catalog.length > 0) {
      // Si la cola está vacía, reproducir aleatorio del catálogo local
      const randomIdx = Math.floor(Math.random() * catalog.length);
      globalAudioEngine.loadTrack(catalog[randomIdx]);
    }
  }, [queue, catalog]);

  // Suscribirse a cambios de audio y configurar avance automático
  useEffect(() => {
    const unsub = globalAudioEngine.subscribe(setPlayerState);
    globalAudioEngine.setOnEnded(() => handleNext());
    return unsub;
  }, [handleNext]);

  // Cargar primera canción si no hay ninguna
  useEffect(() => {
    if (!playerState.currentTrack && catalog.length > 0) {
      globalAudioEngine.loadTrack(catalog[0], false);
    }
  }, [catalog, playerState.currentTrack]);

  // Escuchar mensajes entrantes de los DJs
  useEffect(() => {
    const unsubChannel = channel.subscribe((msg) => {
      if (msg.type === 'QUEUE_TRACK') {
        const payload = msg.payload as { track: Track; requestedBy: string };
        const newItem: QueueItem = {
          queueId: `queue_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          track: payload.track,
          votes: 1,
          requestedBy: payload.requestedBy || 'DJ Anónimo',
          requestedAt: Date.now(),
        };
        setQueue((prev) => [...prev, newItem].sort((a, b) => b.votes - a.votes));
      } else if (msg.type === 'VOTE_TRACK') {
        const payload = msg.payload as { queueId: string; delta: number };
        setQueue((prev) =>
          prev
            .map((item) => (item.queueId === payload.queueId ? { ...item, votes: Math.max(0, item.votes + payload.delta) } : item))
            .sort((a, b) => b.votes - a.votes)
        );
      } else if (msg.type === 'NEW_TRACK_OFFER') {
        const payload = msg.payload as { track: Track };
        setCatalog((prev) => [payload.track, ...prev]);
      } else if (msg.type === 'ROOM_JOIN') {
        if (msg.senderName && !connectedDjs.includes(msg.senderName)) {
          setConnectedDjs((prev) => [...prev, msg.senderName!]);
        }
        // Responder enviando catálogo y cola
        channel.send('SYNC_CATALOG', 'host', 'Pantalla Carro', { catalog, queue, currentTrack: playerState.currentTrack });
      }
    });

    return () => {
      unsubChannel();
      channel.close();
    };
  }, [channel, catalog, queue, playerState.currentTrack, connectedDjs]);

  return (
    <div className="min-h-screen bg-[#07080D] p-3 sm:p-6 flex flex-col justify-between">
      {/* Barra Superior de Cabina */}
      <header className="flex items-center justify-between pb-4 border-b border-white/5">
        <button
          onClick={onBackToLanding}
          className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Salir del Modo Carro
        </button>
        <div className="flex items-center gap-2">
          <Library className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-mono text-slate-300">{catalog.length} temas locales</span>
        </div>
      </header>

      {/* Grid Principal de Conducción */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 my-auto py-4">
        {/* Panel Izquierdo: QR y Conexión de Pasajeros */}
        <div className="lg:col-span-3 flex flex-col justify-center">
          <RoomQrBadge roomId={roomId} connectedCount={connectedDjs.length} />
        </div>

        {/* Panel Central: Reproductor de Gran Tamaño (Conducción) */}
        <div className="lg:col-span-5">
          <GlassCard glow className="h-full flex items-center justify-center p-6 border-cyan-500/30">
            <NowPlayingScreen
              track={playerState.currentTrack}
              isPlaying={playerState.isPlaying}
              currentTime={playerState.currentTime}
              duration={playerState.duration}
              volume={playerState.volume}
              onTogglePlay={() => globalAudioEngine.toggle()}
              onNext={handleNext}
              onPrev={() => globalAudioEngine.seek(0)}
              onSeek={(s) => globalAudioEngine.seek(s)}
              onVolumeChange={(v) => globalAudioEngine.setVolume(v)}
            />
          </GlassCard>
        </div>

        {/* Panel Derecho: Cola Dinámica de Pasajeros */}
        <div className="lg:col-span-4">
          <GlassCard className="h-full max-h-[520px] overflow-hidden flex flex-col">
            <HostQueueList queue={queue} onRemoveItem={(id) => setQueue((prev) => prev.filter((i) => i.queueId !== id))} />
          </GlassCard>
        </div>
      </div>

      <footer className="text-center text-[10px] text-slate-600 font-mono">
        CarBeat Host Audio Active • Latencia de cabina &lt; 5ms
      </footer>
    </div>
  );
};
