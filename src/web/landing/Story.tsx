import { forwardRef, useState, type ReactNode } from 'react';
import { motion, useMotionValueEvent, useReducedMotion, useTransform, type MotionValue } from 'motion/react';
import type { Step } from './content';

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Titular de sección que se "estira" al entrar en pantalla (eje de ancho de Anybody), como
 * KineticTitle pero disparado por el scroll y no al montar.
 */
export function StretchTitle({ text, className = '', as: Tag = 'h2', accentFrom }: { text: string; className?: string; as?: 'h2' | 'h3' | 'p'; accentFrom?: number }) {
  const reduce = useReducedMotion();
  const words = text.split(' ');
  return (
    <Tag className={`type-wide ${className}`}>
      {words.map((w, i) => (
        <motion.span
          key={`${w}-${i}`}
          className={`mr-[0.24em] inline-block last:mr-0 ${accentFrom !== undefined && i >= accentFrom ? 'glow-text' : ''}`}
          initial={reduce ? false : { opacity: 0, fontStretch: '62%', x: -10, filter: 'blur(6px)' }}
          whileInView={{ opacity: 1, fontStretch: '118%', x: 0, filter: 'blur(0px)' }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.95, delay: i * 0.07, ease: EASE }}
        >
          {w}
        </motion.span>
      ))}
    </Tag>
  );
}

/** Esquinas de retícula del HUD. */
export function HudCorners() {
  return (
    <>
      <span className="hud-corner tl" aria-hidden="true" />
      <span className="hud-corner tr" aria-hidden="true" />
      <span className="hud-corner bl" aria-hidden="true" />
      <span className="hud-corner br" aria-hidden="true" />
    </>
  );
}

/**
 * Tarjeta de un capítulo: número en matriz de puntos, titular ancho y una barra que se llena
 * mientras la cámara llega a ese capítulo (ligada al scroll, sin re-render).
 */
export const ChapterCard = forwardRef<HTMLElement, { step: Step; index: number; total: number; chapter: MotionValue<number>; children?: ReactNode }>(
  function ChapterCard({ step, index, total, chapter, children }, ref) {
    const reduce = useReducedMotion();
    const fill = useTransform(chapter, [index - 1, index], [0, 1], { clamp: true });
    const lit = useTransform(chapter, [index - 0.55, index, index + 0.55], [0.35, 1, 0.35]);
    return (
      <motion.article
        ref={ref}
        className="hud-card hud-scan w-full max-w-[460px] p-6 sm:p-8"
        initial={reduce ? false : { opacity: 0, y: 46, rotateX: 14, scale: 0.97 }}
        whileInView={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }}
        viewport={{ once: false, amount: 0.35 }}
        transition={{ duration: 0.85, ease: EASE }}
        style={{ transformPerspective: 900 }}
      >
        <HudCorners />
        <div className="flex items-end justify-between gap-4">
          <motion.span className="dotmatrix text-[3.4rem] leading-[0.8] sm:text-[4.2rem]" style={{ opacity: reduce ? 1 : lit }} aria-hidden="true">
            {step.n}
          </motion.span>
          <span className="label-cluster pb-1 text-cyan-soft/80">
            Paso {index} de {total}
          </span>
        </div>
        <StretchTitle text={step.title} as="h3" className="mt-5 text-[clamp(1.55rem,2.6vw,2.15rem)] leading-[0.98] text-ink" />
        <p className="mt-4 text-[1.04rem] leading-relaxed text-ink/80">{step.body}</p>
        {children}
        <div className="mt-6 h-[3px] overflow-hidden rounded-full bg-white/[0.06]" aria-hidden="true">
          <motion.div
            className="h-full origin-left rounded-full bg-[linear-gradient(90deg,var(--color-cyan-deep),var(--color-cyan),var(--color-ice))] shadow-[0_0_12px_rgb(34_211_238/0.8)]"
            style={{ scaleX: reduce ? 1 : fill }}
          />
        </div>
      </motion.article>
    );
  },
);

const GEARS = (steps: Step[]) => [{ gear: 'N', short: 'Cabina' }, ...steps.map((s) => ({ gear: s.gear, short: s.short }))];
const SLOT = 52;

/**
 * Selector de marchas como índice de la historia: N (cabina) y 1-2-3 por capítulo. El pomo
 * se desliza con el scroll; cada marcha es un botón que lleva a su capítulo.
 */
export function GearRail({ steps, chapter, opacity, onGo }: { steps: Step[]; chapter: MotionValue<number>; opacity: MotionValue<number>; onGo: (i: number) => void }) {
  const gears = GEARS(steps);
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  // Sólo re-renderiza al cambiar de marcha (React descarta el mismo valor).
  useMotionValueEvent(chapter, 'change', (v) => setActive(Math.round(v)));
  const knobY = useTransform(chapter, [0, gears.length - 1], [0, (gears.length - 1) * SLOT]);
  const pointerEvents = useTransform(opacity, (o) => (o > 0.2 ? 'auto' : 'none'));
  // Invisible = fuera del orden de Tab (antes recibía 4 paradas de foco sin verse).
  const [hidden, setHidden] = useState(true);
  useMotionValueEvent(opacity, 'change', (o) => setHidden(o < 0.1));

  return (
    <motion.nav
      aria-label="Capítulos: cómo funciona"
      className="fixed top-1/2 right-5 z-30 hidden -translate-y-1/2 lg:block xl:right-8"
      style={{ opacity, pointerEvents }}
      inert={hidden}
      aria-hidden={hidden}
    >
      <div className="relative flex flex-col items-center rounded-full border border-white/[0.07] bg-[linear-gradient(180deg,#0d141a,#070b0e)] px-1.5 py-1.5 shadow-[inset_0_2px_8px_rgb(0_0_0/0.8),0_20px_40px_-20px_rgb(0_0_0/0.9)]">
        {/* Ranura de la palanca */}
        <span className="absolute top-[30px] bottom-[30px] left-1/2 w-[3px] -translate-x-1/2 rounded-full bg-black/70 shadow-[inset_0_1px_2px_rgb(0_0_0/0.9)]" aria-hidden="true" />
        {/* Pomo */}
        <motion.span
          className="absolute top-1.5 left-1.5 h-[52px] w-[52px] rounded-full bg-[radial-gradient(circle_at_50%_30%,#1d4a5a,#0a1c24_70%)] shadow-[0_0_0_1px_rgb(34_211_238/0.45),0_0_22px_-4px_rgb(34_211_238/0.85),inset_0_1px_0_rgb(255_255_255/0.15)]"
          style={{ y: reduce ? active * SLOT : knobY }}
          aria-hidden="true"
        />
        {gears.map((g, i) => (
          <button
            key={g.gear}
            type="button"
            onClick={() => onGo(i)}
            aria-current={active === i ? 'step' : undefined}
            aria-label={i === 0 ? 'Volver al inicio' : `Paso ${i}: ${steps[i - 1].title}`}
            className="group relative z-10 flex h-[52px] w-[52px] items-center justify-center rounded-full"
          >
            <span className={`readout text-lg font-bold transition-colors duration-300 ${active === i ? 'glow-text' : 'text-faint group-hover:text-dim'}`}>{g.gear}</span>
            <span
              className={`label-cluster pointer-events-none absolute right-[62px] whitespace-nowrap transition-all duration-300 ${active === i ? 'translate-x-0 text-cyan-soft opacity-100' : 'translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-80'}`}
            >
              {g.short}
            </span>
          </button>
        ))}
      </div>
    </motion.nav>
  );
}
