import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Power } from 'lucide-react';
import type { RiderView } from '../core/room/rider-session';
import { Key } from './controls';
import { DotMatrix } from './kit';
import { Radar, type Blip } from './rider/Radar';

/*
 * Lo que ve el pasajero antes de tener la primera foto del carro, o cuando la sala ya no
 * existe. Estados honestos: buscando, no encontrado, cerrado. Nada de "conectado" falso.
 *
 * El radar barre mientras se busca de verdad (estado "connecting" o "not-found", que sigue
 * reintentando). Los ecos son decorativos: no representan carros detectados.
 */

const ECHOES: Blip[] = [
  { angle: 48, radius: 0.62 },
  { angle: 152, radius: 0.38 },
  { angle: 251, radius: 0.72 },
];

export function RiderGate({ view, onExit, children }: { view: RiderView; onExit: () => void; children: ReactNode }) {
  if (view.status === 'closed') {
    return (
      <Message
        mode="closed"
        lcd="SALA CERRADA"
        title="El conductor apagó la cabina"
        body="La sala se cerró. Gracias por poner música en el viaje."
        action={
          <Key variant="primary" onClick={onExit}>
            Volver al inicio
          </Key>
        }
      />
    );
  }
  if (!view.snapshot) {
    const missing = view.status === 'not-found';
    return (
      <Message
        mode={missing ? 'missing' : 'search'}
        lcd={missing ? `SIN ECO · ${view.room}` : `BUSCANDO · ${view.room}`}
        title={missing ? 'No encontramos ese carro' : 'Buscando el carro…'}
        body={
          missing
            ? `Revisa la placa ${view.room} con el conductor. Seguimos intentando por si la pantalla del carro tarda en encender.`
            : 'Conectando con la pantalla del carro. Si tarda, comprueba que el carro esté encendido en CarBeat.'
        }
        action={
          <Key onClick={onExit} variant={missing ? 'primary' : 'ghost'}>
            Cambiar de sala
          </Key>
        }
      />
    );
  }
  return <>{children}</>;
}

function Message({ mode, lcd, title, body, action }: { mode: 'search' | 'missing' | 'closed'; lcd: string; title: string; body: string; action: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-12 text-center" role="status" aria-live="polite">
      <motion.div
        initial={reduce ? false : { opacity: 0, scale: 0.85, rotateX: 35 }}
        animate={{ opacity: 1, scale: 1, rotateX: 0 }}
        transition={{ type: 'spring', stiffness: 160, damping: 18 }}
        style={{ perspective: 800 }}
        aria-hidden="true"
      >
        <Radar
          size={208}
          tone={mode === 'search' ? 'cyan' : 'danger'}
          sweeping={mode !== 'closed'}
          period={mode === 'missing' ? 4.2 : 2.6}
          blips={mode === 'search' ? ECHOES : []}
          pings={mode === 'search'}
        >
          {mode === 'closed' ? <Power className="h-10 w-10 text-danger [filter:drop-shadow(0_0_10px_rgb(255_69_58/0.8))]" strokeWidth={1.8} /> : undefined}
        </Radar>
      </motion.div>
      <div className="lcd lcd-grid relative w-full max-w-xs rounded-xl px-3 py-2" aria-hidden="true">
        <DotMatrix className={`text-base ${mode === 'search' ? '' : 'text-[#ffd2cf] [text-shadow:0_0_10px_rgb(255_69_58/0.6)]'}`}>{lcd}</DotMatrix>
      </div>
      <div>
        <h2 className="type-wide text-[1.6rem] leading-[1.05] text-ink">{title}</h2>
        <p className="mx-auto mt-2 max-w-sm text-dim">{body}</p>
      </div>
      {action}
    </div>
  );
}
