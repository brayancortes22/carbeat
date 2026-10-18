import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { QueueEntry } from '../../shared/protocol';
import { Odometer } from './kit';

/*
 * Computadora de viaje: la franja de datos bajo el cuadro, como la del carro. Sólo datos
 * reales de la sesión: lo siguiente en la cola, tiempo con la cabina encendida, canciones que
 * han sonado, cuántas esperan (y cuánto suman, si se conocen todas las duraciones) y quién va
 * a bordo. Los números ruedan como un odómetro en vez de saltar.
 */

export function queueSeconds(queue: QueueEntry[]): number | null {
  let total = 0;
  for (const e of queue) {
    if (!(e.track.duration > 0)) return null;
    total += e.track.duration;
  }
  return total;
}

export function TripComputer({
  next,
  elapsedMs,
  played,
  riders,
  queued,
  queuedSeconds = null,
  showNext = true,
  compact = false,
  className = '',
}: {
  next?: QueueEntry;
  elapsedMs: number;
  played: number;
  riders: number;
  /** Canciones en espera. */
  queued?: number;
  /** Lo que suman, en segundos (null si alguna duración no se conoce). */
  queuedSeconds?: number | null;
  /** Con la autopista 3D encendida «Siguiente» ya está en el parabrisas. */
  showNext?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const mins = Math.floor(elapsedMs / 60000);
  const elapsed = `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, '0')}`;
  const big = compact ? 'text-xl' : 'text-[1.7rem]';
  // leading-none: con el interlineado normal los dos puntos de «0:12» quedaban más bajos que
  // las cifras (se veía en las capturas). Y el brillo va como filtro sobre todo el número: con
  // text-shadow cada cifra recortaba su brillo en una caja visible.
  const num = `readout leading-none font-bold text-ice [filter:drop-shadow(0_0_7px_rgb(34_211_238/calc(0.5*var(--glow))))] ${big}`;
  const cols = showNext ? (compact ? 'grid-cols-[2fr_repeat(4,1fr)]' : 'grid-cols-2 sm:grid-cols-[2fr_repeat(4,1fr)]') : 'grid-cols-4';

  return (
    <div className={`lcd grid gap-px overflow-hidden rounded-[20px] ${cols} ${className}`} aria-label="Computadora de viaje">
      {showNext && (
        <Cell label="Siguiente" compact={compact} wide>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={next?.queueId ?? 'nada'} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3 }} className="min-w-0">
              {next ? (
                <>
                  <p className={`truncate font-display leading-tight font-bold text-ink uppercase ${compact ? 'text-base' : 'text-lg'}`}>{next.track.title}</p>
                  {!compact && <p className="truncate text-sm text-dim">{next.track.artist}</p>}
                </>
              ) : (
                <p className="text-sm text-faint">Cola vacía</p>
              )}
            </motion.div>
          </AnimatePresence>
        </Cell>
      )}
      <Cell label="En ruta" compact={compact}>
        <Odometer value={elapsed} className={num} />
        <span className="label-cluster ml-1 text-[0.58rem]">h</span>
      </Cell>
      <Cell label="Sonaron" compact={compact}>
        <Odometer value={played} className={num} />
      </Cell>
      <Cell label="En cola" compact={compact}>
        <Odometer value={queued ?? 0} className={num} />
        {queuedSeconds !== null && queuedSeconds > 0 && (
          <span className="label-cluster ml-1.5 truncate text-[0.58rem]" aria-label={`${Math.round(queuedSeconds / 60)} minutos de música en cola`}>
            {Math.round(queuedSeconds / 60)} min
          </span>
        )}
      </Cell>
      <Cell label="A bordo" compact={compact}>
        <Odometer value={riders} className={num} />
      </Cell>
    </div>
  );
}

function Cell({ label, children, compact, wide = false }: { label: string; children: ReactNode; compact: boolean; wide?: boolean }) {
  return (
    <div className={`min-w-0 bg-black/20 ${compact ? 'px-3 py-1.5' : 'px-4 py-3'} ${wide && !compact ? 'col-span-2 sm:col-span-1' : ''}`}>
      <p className={`label-cluster text-[0.6rem] text-cyan-soft/70 ${compact ? 'mb-0' : 'mb-1'}`}>{label}</p>
      <div className="flex min-w-0 items-baseline">{children}</div>
    </div>
  );
}
