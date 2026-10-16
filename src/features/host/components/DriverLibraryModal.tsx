import React, { useState, useEffect } from 'react';
import { X, Music, Play, Plus, Trash2, BookmarkCheck } from 'lucide-react';
import { Track } from '../../../types/track.types';
import { StorageService } from '../../../core/storage/storage-service';
import { TrackCover } from '../../../components/ui/TrackCover';

interface DriverLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlayNow: (track: Track) => void;
  onAddToQueue: (track: Track) => void;
}

export const DriverLibraryModal: React.FC<DriverLibraryModalProps> = ({
  isOpen,
  onClose,
  onPlayNow,
  onAddToQueue,
}) => {
  const [library, setLibrary] = useState<Track[]>([]);

  useEffect(() => {
    if (isOpen) {
      setLibrary(StorageService.loadDriverLibrary());
    }
  }, [isOpen]);

  const handleDelete = (trackId: string) => {
    const updated = StorageService.removeFromDriverLibrary(trackId);
    setLibrary(updated);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md">
      <div className="w-full max-w-lg bg-slate-900 border border-cyan-500/30 rounded-2xl p-4 sm:p-5 shadow-2xl flex flex-col max-h-[85vh] text-left">
        {/* Cabecera */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
              <BookmarkCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Biblioteca del Chofer</h3>
              <p className="text-xs text-slate-400">Canciones guardadas de tus viajes ({library.length})</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Lista de Canciones Guardadas */}
        <div className="flex-1 overflow-y-auto space-y-2 py-3 pr-1 custom-scrollbar">
          {library.length === 0 ? (
            <div className="text-center py-12 text-xs text-slate-500">
              <Music className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-slate-300 font-semibold mb-1">Tu biblioteca está vacía</p>
              <p className="text-slate-500">
                Cuando los pasajeros pongan buena música o busques canciones, pulsa "Guardar" para conservarlas aquí.
              </p>
            </div>
          ) : (
            library.map((track) => (
              <div
                key={track.id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-cyan-500/30 transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <TrackCover src={track.coverUrl} alt={track.title} className="w-10 h-10 rounded-lg shrink-0" />
                  <div className="min-w-0 text-left">
                    <h4 className="text-sm font-semibold text-white truncate">{track.title}</h4>
                    <p className="text-xs text-slate-400 truncate">{track.artist}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  <button
                    onClick={() => {
                      onPlayNow(track);
                      onClose();
                    }}
                    title="Reproducir de inmediato en el carro"
                    className="p-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                  </button>
                  <button
                    onClick={() => onAddToQueue(track)}
                    title="Poner en cola del carro"
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-cyan-300 transition-all active:scale-95 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(track.id)}
                    title="Eliminar de mi biblioteca"
                    className="p-2 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
