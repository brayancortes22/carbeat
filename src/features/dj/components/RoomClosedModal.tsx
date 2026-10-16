import React from 'react';
import { DoorClosed, ArrowLeft } from 'lucide-react';

interface RoomClosedModalProps {
  isOpen: boolean;
  onExit: () => void;
}

export const RoomClosedModal: React.FC<RoomClosedModalProps> = ({ isOpen, onExit }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
      <div className="w-full max-w-sm rounded-2xl bg-[#0c0d14] border border-red-500/30 p-6 flex flex-col items-center text-center shadow-2xl shadow-red-950/40">
        <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-4 text-red-400">
          <DoorClosed className="w-7 h-7" />
        </div>
        <h3 className="text-lg font-bold text-white mb-2">Sala Cerrada</h3>
        <p className="text-xs text-slate-400 mb-6 leading-relaxed">
          El chofer ha finalizado el viaje y ha cerrado la sala de música. Serás redirigido al inicio.
        </p>
        <button
          onClick={onExit}
          className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-red-600/30 transition-all active:scale-95 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver al Inicio</span>
        </button>
      </div>
    </div>
  );
};
