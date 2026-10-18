import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';

/*
 * Testigo del tablero: un icono que se enciende sólo cuando significa algo.
 * Colores con el mismo código que un carro: verde = activo, ámbar = atención, rojo = fallo.
 * Al encenderse parpadea un instante antes de quedarse fijo, como una bombilla real al
 * recibir corriente; así un cambio de estado se nota sin tener que mirar fijo.
 */

export type TelltaleState = 'off' | 'on' | 'info' | 'warn' | 'alert' | 'blink';

const TONE: Record<TelltaleState, string> = {
  off: 'text-faint/45',
  on: 'text-go [filter:drop-shadow(0_0_6px_rgb(52_211_153/calc(0.75*var(--glow))))]',
  info: 'text-cyan [filter:drop-shadow(0_0_6px_rgb(34_211_238/calc(0.8*var(--glow))))]',
  warn: 'text-amber [filter:drop-shadow(0_0_6px_rgb(255_176_32/calc(0.75*var(--glow))))]',
  alert: 'text-danger [filter:drop-shadow(0_0_6px_rgb(255_69_58/calc(0.8*var(--glow))))]',
  blink: 'text-amber animate-[telltale-blink_1.1s_steps(1)_infinite] [filter:drop-shadow(0_0_6px_rgb(255_176_32/calc(0.75*var(--glow))))]',
};

const STATE_TEXT: Record<TelltaleState, string> = {
  off: 'apagado',
  on: 'activo',
  info: 'activo',
  warn: 'atención',
  alert: 'fallo',
  blink: 'conectando',
};

export function Telltale({ state, label, children, value }: { state: TelltaleState; label: string; children: ReactNode; value?: ReactNode }) {
  const reduce = useReducedMotion();
  const lit = state !== 'off';
  return (
    <span className="group relative inline-flex items-center gap-1.5" title={label}>
      <span className="relative inline-flex h-6 w-6 items-center justify-center" aria-hidden="true">
        {/* Bombilla apagada siempre visible debajo: en un tablero real el testigo se intuye
            aunque no tenga corriente. */}
        <span className={`absolute inset-0 flex items-center justify-center ${TONE.off}`}>{children}</span>
        {lit && (
          <motion.span
            // Cambiar la clave reinicia el parpadeo en cada cambio de color (p. ej. ámbar → verde).
            key={state}
            className={`absolute inset-0 flex items-center justify-center transition-[color,filter] duration-300 ${TONE[state]}`}
            initial={reduce ? false : { opacity: 0.1 }}
            animate={{ opacity: reduce ? 1 : [0.1, 1, 0.3, 1, 0.65, 1] }}
            transition={{ duration: 0.45, times: [0, 0.16, 0.32, 0.5, 0.68, 1], ease: 'linear' }}
          >
            {children}
          </motion.span>
        )}
      </span>
      {value !== undefined && <span className={`readout text-sm font-semibold ${lit ? 'text-ink' : 'text-faint'}`}>{value}</span>}
      <span className="sr-only">
        {label}: {STATE_TEXT[state]}
      </span>
    </span>
  );
}

/* Iconos de testigo dibujados a mano: los genéricos de librería no parecen de tablero. */
const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export const TtIcon = {
  /** Enlace directo P2P: dos eslabones. */
  Link: () => (
    <svg viewBox="0 0 24 24" className="h-5 w-5" {...stroke}>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    </svg>
  ),
  /** Relé en la nube. */
  Cloud: () => (
    <svg viewBox="0 0 24 24" className="h-5 w-5" {...stroke}>
      <path d="M7 18h10.5a3.5 3.5 0 0 0 .4-7A5.5 5.5 0 0 0 7.3 9.6 4.2 4.2 0 0 0 7 18Z" />
      <path d="M12 12.5v3.5m-1.6-1.6L12 16l1.6-1.6" />
    </svg>
  ),
  /** Red local del carro. */
  Lan: () => (
    <svg viewBox="0 0 24 24" className="h-5 w-5" {...stroke}>
      <path d="M4 10a12 12 0 0 1 16 0" />
      <path d="M7 13.5a7.5 7.5 0 0 1 10 0" />
      <path d="M10 17a3 3 0 0 1 4 0" />
      <circle cx="12" cy="20" r="0.6" fill="currentColor" />
    </svg>
  ),
  /** Pasajeros: dos asientos vistos de frente, con su apoyacabezas (el testigo de ocupación). */
  Seats: () => (
    <svg viewBox="0 0 24 24" className="h-5 w-5" {...stroke}>
      <rect x="4.2" y="3" width="5.2" height="3" rx="1.3" />
      <path d="M3.8 8.2h6l-.7 8.3H4.5z" />
      <path d="M3.4 19.5h6.8" />
      <rect x="14.6" y="3" width="5.2" height="3" rx="1.3" />
      <path d="M14.2 8.2h6l-.7 8.3h-4.6z" />
      <path d="M13.8 19.5h6.8" />
    </svg>
  ),
  /** Piloto automático: el testigo de control de crucero (velocímetro con flecha). */
  Cruise: () => (
    <svg viewBox="0 0 24 24" className="h-5 w-5" {...stroke}>
      <path d="M5.2 16.5A8 8 0 1 1 18.8 16.5" />
      <path d="M12 12l3.5-3" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" />
      <path d="M16.5 18.5h4m-2-2v4" />
    </svg>
  ),
  /** Altavoz. */
  Speaker: () => (
    <svg viewBox="0 0 24 24" className="h-5 w-5" {...stroke}>
      <path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z" />
      <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
    </svg>
  ),
};
