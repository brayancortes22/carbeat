import { motion, useReducedMotion } from 'motion/react';
import { ArrowDownToLine } from 'lucide-react';
import { CARBEAT_VERSION } from '../../../shared/version';
import { DotMatrix, Tilt } from '../../ui/kit';
import { TtIcon } from '../../ui/Telltale';
import { Wordmark } from '../../ui/Wordmark';
import { SPECS } from './content';
import { StretchTitle } from './Story';

const EASE = [0.16, 1, 0.3, 1] as const;

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

/** Llave (para "El que manda"): dibujada como los testigos, no de librería. */
function KeyIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" {...stroke}>
      <circle cx="8" cy="12" r="3.6" />
      <path d="M11.6 12H20M17 12v3M20 12v2.2" />
    </svg>
  );
}

const ICONS = [TtIcon.Link, TtIcon.Seats, TtIcon.Speaker, TtIcon.Cruise, KeyIcon];

/**
 * Ficha técnica como el autotest de un tablero: al entrar en pantalla cada testigo se enciende
 * por turno y una línea de luz recorre su fila. Los datos son los mismos de siempre (SPECS).
 */
function SpecList() {
  const reduce = useReducedMotion();
  return (
    <dl className="lcd relative self-start overflow-hidden rounded-[24px] px-5 py-2 sm:px-7">
      {SPECS.map(([k, v], i) => {
        const Icon = ICONS[i] ?? TtIcon.Link;
        return (
          <motion.div
            key={k}
            className="relative grid grid-cols-[40px_1fr] gap-x-4 border-b border-white/[0.05] py-5 last:border-b-0 sm:grid-cols-[44px_168px_1fr] sm:items-baseline"
            initial={reduce ? false : 'off'}
            whileInView="on"
            viewport={{ once: true, amount: 0.7 }}
          >
            {!reduce && (
              <motion.span
                className="spec-sweep"
                variants={{ off: { x: '-100%', opacity: 0 }, on: { x: '100%', opacity: [0, 1, 0] } }}
                transition={{ duration: 1.1, delay: 0.15 + i * 0.12, ease: 'easeInOut' }}
                aria-hidden="true"
              />
            )}
            <motion.span
              className="row-span-2 flex h-10 w-10 items-center justify-center self-start rounded-full border border-white/[0.06] bg-black/40 sm:row-span-1 sm:self-center"
              variants={{
                off: { color: 'var(--color-faint)', filter: 'drop-shadow(0 0 0px rgb(34 211 238 / 0))' },
                on: { color: 'var(--color-cyan)', filter: 'drop-shadow(0 0 7px rgb(34 211 238 / 0.75))' },
              }}
              transition={{ duration: 0.35, delay: 0.2 + i * 0.12 }}
              aria-hidden="true"
            >
              <Icon />
            </motion.span>
            <dt className="label-cluster text-cyan-soft/85">{k}</dt>
            <motion.dd
              className="mt-1 leading-relaxed text-ink/85 sm:mt-0"
              variants={{ off: { opacity: 0, x: 12 }, on: { opacity: 1, x: 0 } }}
              transition={{ duration: 0.6, delay: 0.25 + i * 0.12, ease: EASE }}
            >
              {v}
            </motion.dd>
          </motion.div>
        );
      })}
    </dl>
  );
}

/** El APK como tarjeta llave: se inclina con el ratón y refleja la luz como un cristal. */
function ApkCard() {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 40, rotateZ: -4 }}
      whileInView={{ opacity: 1, y: 0, rotateZ: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 1, ease: EASE }}
    >
      <Tilt className="rounded-[26px]" max={9}>
        <a
          href="/downloads/carbeat-latest.apk"
          className="key-card group relative block overflow-hidden rounded-[26px] p-6 transition-shadow duration-300 hover:shadow-[0_0_0_1px_rgb(34_211_238/0.45),0_0_60px_-20px_rgb(34_211_238/0.8)] sm:p-7"
        >
          <div className="flex items-start justify-between gap-4">
            <Wordmark />
            <span className="key-chip relative h-8 w-11 rounded-md" aria-hidden="true" />
          </div>
          <p className="mt-8 label-cluster text-cyan-soft/80">Descarga directa</p>
          <p className="mt-2 font-display text-[1.6rem] leading-tight font-bold tracking-wide text-ink uppercase">App para Android</p>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-dim">Interfaz propia para la tablet del carro y para los pasajeros.</p>
          <div className="lcd lcd-grid relative mt-6 flex items-center justify-between gap-3 rounded-xl px-4 py-3">
            <DotMatrix className="min-w-0 flex-1 text-base">carbeat-latest.apk</DotMatrix>
            <span className="readout shrink-0 text-sm font-bold tracking-wider text-cyan-soft">v{CARBEAT_VERSION}</span>
          </div>
          <span className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-cyan/45 bg-[linear-gradient(180deg,#123a46,#0a2029)] font-display text-sm font-semibold tracking-[0.14em] text-ice uppercase shadow-[inset_0_1px_0_rgb(255_255_255/0.12),0_0_22px_-6px_rgb(34_211_238/0.75)] transition-shadow group-hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.16),0_0_32px_-4px_rgb(34_211_238/0.95)]">
            <ArrowDownToLine className="h-4 w-4 transition-transform duration-300 group-hover:translate-y-0.5" aria-hidden="true" />
            Descargar APK
          </span>
        </a>
      </Tilt>
    </motion.div>
  );
}

export function Specs() {
  return (
    <section className="relative mx-auto max-w-7xl px-5 pt-24 pb-20 sm:px-10 sm:pt-32" aria-labelledby="ficha">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.35fr] lg:gap-16">
        <div className="flex flex-col gap-10">
          <div>
            <h2 id="ficha" className="label-cluster flex items-center gap-3 text-cyan-soft">
              <span className="h-px w-8 bg-cyan/60" aria-hidden="true" />
              Ficha técnica
            </h2>
            <StretchTitle text="Lo que hay bajo el capó" as="p" accentFrom={3} className="mt-5 text-[clamp(2.1rem,4.6vw,3.6rem)] leading-[0.95] text-ink" />
          </div>
          <div className="max-w-md">
            <ApkCard />
          </div>
        </div>
        <SpecList />
      </div>
    </section>
  );
}
