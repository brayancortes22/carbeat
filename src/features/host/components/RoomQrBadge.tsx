import React, { useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { GlassCard } from '../../../components/ui/GlassCard';
import { Badge } from '../../../components/ui/Badge';
import { Users, Wifi } from 'lucide-react';

interface RoomQrBadgeProps {
  roomId: string;
  connectedCount: number;
}

export const RoomQrBadge: React.FC<RoomQrBadgeProps> = ({ roomId, connectedCount }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (canvasRef.current) {
      const roomUrl = `${window.location.origin}/?room=${encodeURIComponent(roomId)}`;
      QRCode.toCanvas(canvasRef.current, roomUrl, {
        width: 140,
        margin: 1,
        color: {
          dark: '#00F0FF',
          light: '#090A0F',
        },
      }).catch(console.error);
    }
  }, [roomId]);

  return (
    <GlassCard className="flex flex-col items-center text-center p-4 bg-slate-950/40 border-cyan-500/20">
      <div className="flex items-center justify-between w-full mb-2">
        <Badge variant="cyan" className="text-[10px]">
          <Wifi className="w-3 h-3 animate-pulse" /> Sala Activa
        </Badge>
        <span className="flex items-center gap-1 text-xs text-slate-400">
          <Users className="w-3.5 h-3.5 text-cyan-400" /> {connectedCount} DJs
        </span>
      </div>

      <div className="p-2 bg-slate-900 rounded-xl border border-cyan-500/30 shadow-inner mb-2">
        <canvas ref={canvasRef} className="rounded-lg" />
      </div>

      <span className="text-[10px] text-slate-400 uppercase tracking-widest">Código de Cabina</span>
      <span className="text-xl font-mono font-black text-cyan-300 tracking-wider select-all">
        {roomId}
      </span>
      <span className="text-[10px] text-slate-500 mt-1">Escanea con iPhone o Android</span>
    </GlassCard>
  );
};
