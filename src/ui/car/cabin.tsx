import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import type { HostView } from '../../core/room/host-session';
import { Odometer } from '../kit';
import { Telltale, TtIcon } from '../Telltale';
import { telltales } from '../host-telltales';

/*
 * Piezas comunes de las dos cabinas del carro (web y APK).
 */

/** Consulta de medios reactiva (alto/ancho de la pantalla). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query);
      m.addEventListener('change', cb);
      return () => m.removeEventListener('change', cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/**
 * Secuencia de encendido de la cabina: muestra <Ignition/> y coordina el autotest de agujas.
 * El barrido arranca cuando el telón empieza a desvanecerse (~1,55 s de los 1,65 s que dura
 * la secuencia), no cuando ya se fue: así se ven las agujas subir mientras se aclara la
 * cabina, como en un tablero real. Si se salta tocando, el barrido sale al terminar el fundido.
 */
export function useCabinIgnition() {
  const [showIgnition, setShowIgnition] = useState(true);
  const [ignition, setIgnition] = useState<'hold' | true>('hold');
  useEffect(() => {
    const t = setTimeout(() => setIgnition(true), 1550);
    return () => clearTimeout(t);
  }, []);
  // Estable: Ignition la tiene en las dependencias de su efecto y reiniciaría sus tiempos.
  const onIgnitionDone = useCallback(() => {
    setShowIgnition(false);
    setIgnition(true);
  }, []);
  return { showIgnition, ignition, onIgnitionDone };
}

/** Testigos del carro en su cápsula (conexión, nube, red local, pasajeros, piloto automático). */
export function TelltaleBar({ view, className = '' }: { view: HostView; className?: string }) {
  const t = telltales(view);
  return (
    <div className={`flex items-center gap-3 rounded-full border border-white/[0.07] bg-[#03080c]/80 px-3 py-1.5 ${className}`} aria-label="Testigos del tablero">
      <Telltale state={t.p2p} label="Conexión directa con celulares" value={view.p2pPeers || undefined}>
        <TtIcon.Link />
      </Telltale>
      <Telltale state={t.cloud} label="Respaldo por internet">
        <TtIcon.Cloud />
      </Telltale>
      {view.links.lan !== 'off' && (
        <Telltale state={t.lan} label="Red local">
          <TtIcon.Lan />
        </Telltale>
      )}
      <Telltale state={t.riders ? 'info' : 'off'} label="Pasajeros a bordo" value={t.riders}>
        <TtIcon.Seats />
      </Telltale>
      <Telltale state={t.cruise} label="Piloto automático">
        <TtIcon.Cruise />
      </Telltale>
    </div>
  );
}

/** Reloj del tablero: los minutos ruedan como un odómetro. */
export function CabinClock({ now, className = '' }: { now: number; className?: string }) {
  const d = new Date(now);
  const text = d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
  const m = /^(\d{1,2}:\d{2})\s*(.*)$/.exec(text.replace(/ | /g, ' '));
  return (
    <span className={`readout inline-flex items-baseline gap-1.5 font-semibold text-ice ${className}`} aria-label={`Hora ${text}`}>
      {/* leading-none: si no, los dos puntos quedan por debajo de las cifras. */}
      <Odometer value={m ? m[1] : text} className="leading-none" />
      {m?.[2] && <span className="label-cluster text-[0.6em] text-dim">{m[2]}</span>}
    </span>
  );
}
