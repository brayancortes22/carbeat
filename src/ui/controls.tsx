import { forwardRef, useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ChevronDown, ChevronUp, Disc3 } from 'lucide-react';
import type { Notice } from '../../shared/protocol';
import { Odometer } from './kit';

// ------------------------------------------------------------------ teclas

type KeyVariant = 'primary' | 'ghost' | 'danger' | 'quiet';

const KEY_BASE =
  'relative inline-flex items-center justify-center gap-2 font-display font-semibold uppercase tracking-[0.12em] transition-[transform,box-shadow,background,color] duration-200 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40';

const KEY_VARIANT: Record<KeyVariant, string> = {
  // Tecla retroiluminada: el cian sale de dentro, no es un degradado plano.
  primary:
    'bg-[linear-gradient(180deg,#123a46,#0a2029)] text-ice border border-cyan/45 shadow-[inset_0_1px_0_rgb(255_255_255/0.12),0_0_0_1px_rgb(0_0_0/0.6),0_0_22px_-6px_rgb(34_211_238/0.75)] hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.16),0_0_0_1px_rgb(0_0_0/0.6),0_0_30px_-4px_rgb(34_211_238/0.9)]',
  ghost:
    'bg-[linear-gradient(180deg,#1a232c,#11171d)] text-ink border border-white/8 shadow-[inset_0_1px_0_rgb(255_255_255/0.06),0_1px_0_rgb(0_0_0/0.6)] hover:border-cyan/30 hover:text-ice',
  danger:
    'bg-[linear-gradient(180deg,#3a1513,#220c0b)] text-[#ffd2cf] border border-danger/45 shadow-[inset_0_1px_0_rgb(255_255_255/0.08),0_0_18px_-8px_rgb(255_69_58/0.8)]',
  quiet: 'text-dim hover:text-ice',
};

const KEY_SIZE = { sm: 'h-9 px-3 text-xs rounded-lg', md: 'h-11 px-4 text-sm rounded-xl', lg: 'h-14 px-6 text-base rounded-2xl' } as const;

export const Key = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: KeyVariant; size?: keyof typeof KEY_SIZE }>(
  function Key({ variant = 'ghost', size = 'md', className = '', ...rest }, ref) {
    return <button ref={ref} className={`${KEY_BASE} ${KEY_VARIANT[variant]} ${KEY_SIZE[size]} ${className}`} {...rest} />;
  },
);

/** Botón redondo de volante (anterior / play / siguiente). */
export function WheelButton({ label, children, onClick, big = false, disabled }: { label: string; children: ReactNode; onClick?: () => void; big?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`relative inline-flex shrink-0 items-center justify-center rounded-full border transition-[transform,box-shadow] duration-200 active:scale-95 disabled:opacity-35 ${
        big
          ? 'h-16 w-16 border-cyan/50 bg-[radial-gradient(circle_at_50%_30%,#16465a,#0a1c24)] text-ice shadow-[0_0_0_4px_#0b1116,0_0_0_5px_rgb(34_211_238/0.25),0_0_32px_-6px_rgb(34_211_238/0.8)]'
          : 'h-12 w-12 border-white/10 bg-[radial-gradient(circle_at_50%_30%,#232e38,#11171d)] text-ink shadow-[0_0_0_3px_#0b1116] hover:text-ice'
      }`}
    >
      {children}
    </button>
  );
}

// -------------------------------------------------------------- voto basculante

/**
 * Interruptor basculante de tablero (como el de los elevavidrios): el lado que votaste queda
 * hundido y el interruptor entero se inclina hacia él. Cada mitad cede bajo el dedo al pulsar,
 * y la puntuación rueda como un odómetro en la ventanita del centro.
 */
export function Rocker({ score, mine, onVote, disabled }: { score: number; mine: -1 | 0 | 1; onVote: (v: -1 | 0 | 1) => void; disabled?: boolean }) {
  const reduce = useReducedMotion();
  // Positivo: la mitad de arriba se hunde (se aleja del que mira).
  const tilt = reduce ? 0 : mine === 1 ? 17 : mine === -1 ? -17 : 0;
  const tap = reduce ? undefined : { scale: 0.86, y: 1.5 };
  const half =
    'relative flex h-11 w-full items-center justify-center transition-[color,background] duration-200 disabled:opacity-40';
  return (
    <div className="relative" style={{ perspective: 220 }} role="group" aria-label="Votar">
      <motion.div
        className="relative flex w-11 flex-col items-center overflow-hidden rounded-[13px] border border-white/10 bg-[linear-gradient(180deg,#222c36_0%,#121920_46%,#0b1015_54%,#1a222a_100%)] shadow-[0_0_0_2px_#05080b,0_8px_14px_-6px_rgb(0_0_0/0.95),inset_0_1px_0_rgb(255_255_255/0.09)]"
        animate={{ rotateX: tilt }}
        transition={{ type: 'spring', stiffness: 460, damping: 17 }}
      >
        {/* Sombra que se mueve con la inclinación: el lado hundido se oscurece */}
        <span
          className={`pointer-events-none absolute inset-0 transition-opacity duration-300 ${mine === 1 ? 'bg-[linear-gradient(180deg,rgb(0_0_0/0.45),transparent_55%)] opacity-100' : mine === -1 ? 'bg-[linear-gradient(0deg,rgb(0_0_0/0.45),transparent_55%)] opacity-100' : 'opacity-0'}`}
          aria-hidden="true"
        />
        <motion.button
          type="button"
          whileTap={tap}
          className={`${half} ${mine === 1 ? 'text-cyan-soft' : 'text-faint hover:text-ice'}`}
          aria-pressed={mine === 1}
          aria-label={mine === 1 ? 'Quitar voto a favor' : 'Votar a favor'}
          disabled={disabled}
          onClick={() => onVote(mine === 1 ? 0 : 1)}
        >
          <ChevronUp className="h-[18px] w-[18px]" strokeWidth={2.8} style={mine === 1 ? { filter: 'drop-shadow(0 0 5px rgb(34 211 238 / 0.95))' } : undefined} />
          <span
            className={`absolute top-1 right-1.5 h-1 w-1 rounded-full ${mine === 1 ? 'bg-cyan-soft shadow-[0_0_6px_rgb(34_211_238)]' : 'bg-white/10'}`}
            aria-hidden="true"
          />
        </motion.button>
        <span
          className={`readout relative flex h-6 w-[calc(100%-8px)] items-center justify-center rounded-[5px] bg-black/60 text-[0.9rem] font-bold shadow-[inset_0_1px_3px_rgb(0_0_0/0.9)] ${score > 0 ? 'text-ice [text-shadow:0_0_8px_rgb(34_211_238/0.7)]' : score < 0 ? 'text-danger' : 'text-dim'}`}
        >
          <span className="sr-only">{score} votos</span>
          {/* El signo va en la letra del texto: el "+" de Anybody estrecha parece un subíndice. */}
          <span aria-hidden="true" className="inline-flex items-center">
            {score !== 0 && <span className="mr-px font-sans text-[0.85em] leading-none">{score > 0 ? '+' : '−'}</span>}
            <Odometer value={Math.abs(score)} />
          </span>
        </span>
        <motion.button
          type="button"
          whileTap={tap}
          className={`${half} ${mine === -1 ? 'text-danger' : 'text-faint hover:text-[#ffb3ad]'}`}
          aria-pressed={mine === -1}
          aria-label={mine === -1 ? 'Quitar voto en contra' : 'Votar en contra'}
          disabled={disabled}
          onClick={() => onVote(mine === -1 ? 0 : -1)}
        >
          <ChevronDown className="h-[18px] w-[18px]" strokeWidth={2.8} style={mine === -1 ? { filter: 'drop-shadow(0 0 5px rgb(255 69 58 / 0.95))' } : undefined} />
          <span
            className={`absolute right-1.5 bottom-1 h-1 w-1 rounded-full ${mine === -1 ? 'bg-danger shadow-[0_0_6px_rgb(255_69_58)]' : 'bg-white/10'}`}
            aria-hidden="true"
          />
        </motion.button>
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------- portada

/**
 * Portada con dos intentos: la URL de la pista y, si falla, la miniatura de YouTube del vídeo.
 * `eager` para la del cuadro de instrumentos: la carga diferida esperaba a que la pestaña
 * estuviera visible y se quedaba en blanco al volver.
 */
export function Cover({ src, alt, className = '', videoId, eager = false }: { src?: string; alt: string; className?: string; videoId?: string; eager?: boolean }) {
  const [attempt, setAttempt] = useState(0);
  useEffect(() => setAttempt(0), [src, videoId]);
  const candidates = [src, videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : undefined].filter(Boolean) as string[];
  const current = candidates[attempt];
  if (!current) {
    return (
      <div className={`flex items-center justify-center bg-[radial-gradient(circle_at_50%_40%,#123341,#071116)] text-cyan/60 ${className}`} aria-hidden={alt ? undefined : true}>
        <Disc3 className="h-1/2 w-1/2" strokeWidth={1.2} />
      </div>
    );
  }
  return (
    <img
      src={current}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setAttempt((a) => a + 1)}
      className={`object-cover ${className}`}
    />
  );
}

// ---------------------------------------------------------------- avisos

export function Toasts({ items, onDismiss }: { items: Notice[]; onDismiss: (id: string) => void }) {
  useEffect(() => {
    if (!items.length) return;
    const t = setTimeout(() => onDismiss(items[items.length - 1].id), 4200);
    return () => clearTimeout(t);
  }, [items, onDismiss]);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(var(--sat)+12px)] z-50 flex flex-col items-center gap-2 px-4" aria-live="polite">
      <AnimatePresence initial={false}>
        {items.map((n) => (
          <motion.button
            key={n.id}
            type="button"
            layout
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, transition: { duration: 0.2 } }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            onClick={() => onDismiss(n.id)}
            className="lcd pointer-events-auto max-w-sm rounded-xl px-4 py-2.5 text-left text-sm text-ice"
          >
            <span className="label-cluster mr-2 text-amber">Aviso</span>
            {n.text}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}
