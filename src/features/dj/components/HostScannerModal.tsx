import { useEffect, useState, useCallback, useRef } from 'react';
import { X, Radar, Car, Users, Wifi, WifiOff, Loader2 } from 'lucide-react';
import { DiscoveredHost, startHostScanner, stopHostScanner } from '../../../core/network/host-discovery';
import { Badge } from '../../../components/ui/Badge';
import { GlassCard } from '../../../components/ui/GlassCard';

interface HostScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (host: DiscoveredHost) => void;
}

export const HostScannerModal = ({
  isOpen,
  onClose,
  onConnect,
}: HostScannerModalProps) => {
  const [hosts, setHosts] = useState<DiscoveredHost[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const hostsRef = useRef<Map<string, DiscoveredHost>>(new Map());
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scanningRef = useRef(false);

  const handleScan = useCallback(() => {
    // Limpiar estado anterior
    stopScanning();
    setIsScanning(true);
    hostsRef.current.clear();
    setHosts([]);
    scanningRef.current = true;

    startHostScanner((discoveredHosts) => {
      if (!scanningRef.current) return;
      hostsRef.current.clear();
      discoveredHosts.forEach((h) => hostsRef.current.set(h.roomId, h));
      setHosts(Array.from(hostsRef.current.values()));
    });

    // Detener escaneo después de 6 segundos
    timeoutRef.current = setTimeout(() => {
      stopScanning();
      setIsScanning(false);
    }, 6000);
  }, []);

  const stopScanning = () => {
    scanningRef.current = false;
    stopHostScanner();
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  useEffect(() => {
    if (isOpen) {
      handleScan();
    } else {
      stopScanning();
    }
    return () => stopScanning();
  }, [isOpen, handleScan]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md">
      <div className="w-full max-w-md bg-slate-900 border border-cyan-500/30 rounded-2xl p-4 sm:p-5 shadow-2xl flex flex-col max-h-[80vh] text-left">
        {/* Cabecera */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
              <Radar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm sm:text-base">Escanear Carros Cercanos</h3>
              <p className="text-[11px] text-slate-400">Buscando hosts en tu red Wi-Fi...</p>
            </div>
          </div>
          <button onClick={() => { stopScanning(); onClose(); }} className="text-slate-400 hover:text-white p-1 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Estado del escaneo */}
        <div className="py-3">
          {isScanning && hosts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-2 border-cyan-500/30 flex items-center justify-center">
                  <Radar className="w-8 h-8 text-cyan-400 animate-pulse" />
                </div>
                <div className="absolute inset-0 w-16 h-16 rounded-full border-2 border-cyan-500/20 animate-ping" />
              </div>
              <p className="mt-4 text-sm font-semibold text-white">Escaneando red local...</p>
              <p className="text-xs text-slate-500 mt-1">Buscando CarBeat Hosts cercanos</p>
            </div>
          ) : !isScanning && hosts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <WifiOff className="w-12 h-12 text-slate-600 mb-3" />
              <p className="text-sm font-semibold text-slate-400">No se encontraron carros</p>
              <p className="text-xs text-slate-600 mt-1">
                Asegúrate de estar conectado al mismo Wi-Fi que la pantalla del carro.
              </p>
              <button
                onClick={handleScan}
                className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-bold hover:bg-cyan-500/20 transition-all cursor-pointer"
              >
                <Loader2 className="w-3.5 h-3.5" />
                Reintentar Escaneo
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2 mb-3">
              <Wifi className="w-3.5 h-3.5" />
              <span className="font-semibold">{hosts.length} carro(s) encontrado(s) en la red</span>
            </div>
          )}

          {/* Lista de Hosts Descubiertos */}
          {hosts.length > 0 && (
            <div className="space-y-2 mt-3">
              {hosts.map((host) => (
                <GlassCard key={host.roomId} className="p-3 hover:border-cyan-500/40 transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
                        <Car className="w-5 h-5 text-cyan-400" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-white truncate">{host.roomName}</h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="cyan" className="text-[9px] py-0 px-1.5">
                            {host.roomId}
                          </Badge>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {host.hostIp}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-400">
                          <Users className="w-3 h-3" />
                          <span>{host.djCount} DJ(s) conectado(s)</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => { stopScanning(); onConnect(host); }}
                      className="shrink-0 ml-3 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs active:scale-95 transition-all cursor-pointer shadow-md shadow-cyan-500/20"
                    >
                      <Wifi className="w-3.5 h-3.5" />
                      Conectar
                    </button>
                  </div>
                </GlassCard>
              ))}
            </div>
          )}
        </div>

        {/* Botón de reintentar */}
        {!isScanning && (
          <button
            onClick={handleScan}
            className="mt-3 w-full py-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Radar className="w-3.5 h-3.5" />
            Volver a Escanear
          </button>
        )}
      </div>
    </div>
  );
};
