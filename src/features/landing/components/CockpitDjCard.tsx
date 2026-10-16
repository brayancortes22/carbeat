import React from 'react';
import { Music2, QrCode, Radar, AlertCircle, Loader2 } from 'lucide-react';
import { GlassCard } from '../../../components/ui/GlassCard';
import { Badge } from '../../../components/ui/Badge';

interface CockpitDjCardProps {
  roomIdInput: string;
  setRoomIdInput: (val: string) => void;
  djNameInput: string;
  setDjNameInput: (val: string) => void;
  handleJoinSubmit: (e: React.FormEvent) => void;
  isCheckingRoom: boolean;
  roomError: string | null;
  onOpenScanner: () => void;
}

export const CockpitDjCard: React.FC<CockpitDjCardProps> = ({
  roomIdInput,
  setRoomIdInput,
  djNameInput,
  setDjNameInput,
  handleJoinSubmit,
  isCheckingRoom,
  roomError,
  onOpenScanner,
}) => {
  return (
    <GlassCard className="flex flex-col justify-between hover:border-purple-500/50 group transition-all duration-300 relative overflow-hidden">
      {/* Resplandor ambiental de fondo */}
      <div className="absolute -top-16 -right-16 w-44 h-44 bg-purple-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-purple-500/20 transition-all duration-500" />

      <div className="space-y-4 relative z-10">
        <div className="flex items-center justify-between">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 group-hover:scale-105 group-hover:shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all">
            <Music2 className="w-6 h-6" />
          </div>
          <Badge variant="purple" className="text-[10px] tracking-wider">
            Modo Pasajero
          </Badge>
        </div>

        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">
            Unirme como DJ
          </h2>
          <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
            Para iPhones y Androids de los acompañantes. Ingresa el código proyectado en el carro y propón canciones al instante.
          </p>
        </div>

        <form onSubmit={handleJoinSubmit} className="space-y-3 pt-1">
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              Código de Sala (En la pantalla)
            </label>
            <input
              type="text"
              value={roomIdInput}
              onChange={(e) => setRoomIdInput(e.target.value.toUpperCase())}
              placeholder="EJ: CAR-412 O BEAT-890"
              className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-mono tracking-wider text-cyan-300 placeholder:text-slate-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 transition-all uppercase"
              required
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              Tu Nombre o Alias (Opcional)
            </label>
            <input
              type="text"
              value={djNameInput}
              onChange={(e) => setDjNameInput(e.target.value)}
              placeholder="Ej: Sebas, Copiloto, Brayan..."
              className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 transition-all"
            />
          </div>

          {roomError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{roomError}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isCheckingRoom}
            className="w-full flex items-center justify-center gap-2 py-3.5 px-5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold text-sm transition-all shadow-[0_0_25px_rgba(168,85,247,0.35)] hover:shadow-[0_0_35px_rgba(168,85,247,0.5)] active:scale-[0.98] cursor-pointer disabled:opacity-60"
          >
            {isCheckingRoom ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verificando Sala en Vivo...</span>
              </>
            ) : (
              <>
                <QrCode className="w-4 h-4" />
                <span>Conectarme a la Sala</span>
              </>
            )}
          </button>

          <div className="relative my-2.5 flex items-center">
            <div className="flex-grow border-t border-white/10" />
            <span className="flex-shrink-0 mx-3 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
              o escanea la red
            </span>
            <div className="flex-grow border-t border-white/10" />
          </div>

          <button
            type="button"
            onClick={onOpenScanner}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 text-cyan-400 hover:text-cyan-300 font-semibold text-xs transition-all active:scale-[0.98] cursor-pointer"
          >
            <Radar className="w-4 h-4 animate-spin-slow text-cyan-400" />
            <span>Escanear Carros Cercanos (Wi-Fi)</span>
          </button>
        </form>
      </div>
    </GlassCard>
  );
};
