import React, { useState, useEffect } from 'react';
import { X, Music, Play, Plus, Trash2, BookmarkCheck, HardDrive, FolderPlus } from 'lucide-react';
import { Track } from '../../../types/track.types';
import { StorageService } from '../../../core/storage/storage-service';
import { LocalAudioDatabase } from '../../../core/audio/local-audio-db';
import { LocalScanner } from '../../../core/audio/local-scanner';
import { TrackCover } from '../../../components/ui/TrackCover';

interface DriverLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlayNow: (track: Track) => void;
  onAddToQueue: (track: Track) => void;
  onCatalogUpdated?: (tracks: Track[]) => void;
}

export const DriverLibraryModal: React.FC<DriverLibraryModalProps> = ({
  isOpen,
  onClose,
  onPlayNow,
  onAddToQueue,
  onCatalogUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'saved' | 'tablet'>('tablet');
  const [library, setLibrary] = useState<Track[]>([]);
  const [tabletTracks, setTabletTracks] = useState<Track[]>([]);

  const refreshData = async () => {
    setLibrary(StorageService.loadDriverLibrary());
    const stored = await LocalAudioDatabase.loadAllTracks();
    setTabletTracks(stored);
  };

  useEffect(() => {
    if (isOpen) {
      refreshData();
    }
  }, [isOpen]);

  const handleDeleteSaved = (trackId: string) => {
    const updated = StorageService.removeFromDriverLibrary(trackId);
    setLibrary(updated);
  };

  const handleDeleteTabletTrack = async (trackId: string) => {
    await LocalAudioDatabase.removeTrack(trackId);
    const updated = await LocalAudioDatabase.loadAllTracks();
    setTabletTracks(updated);
    if (onCatalogUpdated) onCatalogUpdated(updated);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const scanned = await LocalScanner.scanAudioFiles(e.target.files);
      if (scanned.length > 0) {
        const allStored = await LocalAudioDatabase.loadAllTracks();
        setTabletTracks(allStored);
        if (onCatalogUpdated) onCatalogUpdated(allStored);
      }
    }
  };

  if (!isOpen) return null;

  const currentList = activeTab === 'saved' ? library : tabletTracks;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md">
      <div className="w-full max-w-lg bg-slate-900 border border-cyan-500/30 rounded-2xl p-4 sm:p-5 shadow-2xl flex flex-col max-h-[85vh] text-left">
        {/* Cabecera */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
              {activeTab === 'saved' ? <BookmarkCheck className="w-5 h-5" /> : <HardDrive className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Música del Chofer</h3>
              <p className="text-xs text-slate-400">
                {activeTab === 'saved'
                  ? `Guardadas en viajes (${library.length})`
                  : `Archivos en memoria de la Tablet (${tabletTracks.length})`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pestañas de Navegación */}
        <div className="grid grid-cols-2 gap-2 my-3">
          <button
            onClick={() => setActiveTab('tablet')}
            className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'tablet'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'bg-white/[0.03] text-slate-400 hover:text-white border border-white/5'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>Música en Tablet</span>
            <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[10px]">{tabletTracks.length}</span>
          </button>
          <button
            onClick={() => setActiveTab('saved')}
            className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'saved'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'bg-white/[0.03] text-slate-400 hover:text-white border border-white/5'
            }`}
          >
            <BookmarkCheck className="w-3.5 h-3.5" />
            <span>Guardadas</span>
            <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[10px]">{library.length}</span>
          </button>
        </div>

        {/* Barra de Acciones para Cargar Canciones Locales */}
        {activeTab === 'tablet' && (
          <div className="mb-2">
            <label className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-bold cursor-pointer transition-all active:scale-98">
              <FolderPlus className="w-4 h-4 text-cyan-400" />
              <span>Añadir canciones (.mp3, .flac, .wav) de la Tablet</span>
              <input
                type="file"
                multiple
                accept="audio/*,.mp3,.flac,.m4a,.wav,.ogg,.aac"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
        )}

        {/* Lista de Canciones */}
        <div className="flex-1 overflow-y-auto space-y-2 py-1 pr-1 custom-scrollbar">
          {currentList.length === 0 ? (
            <div className="text-center py-10 text-xs text-slate-500">
              <Music className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-slate-300 font-semibold mb-1">
                {activeTab === 'saved' ? 'No tienes canciones guardadas' : 'No hay música cargada en la tablet'}
              </p>
              <p className="text-slate-500 text-[11px] max-w-xs mx-auto">
                {activeTab === 'saved'
                  ? 'Guarda pistas favoritas durante los viajes para reproducirlas sin internet.'
                  : 'Carga archivos de audio de tu dispositivo o memoria USB para que suenen sin conexión.'}
              </p>
            </div>
          ) : (
            currentList.map((track) => (
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
                    onClick={() => (activeTab === 'saved' ? handleDeleteSaved(track.id) : handleDeleteTabletTrack(track.id))}
                    title="Eliminar pista"
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
