import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react';

/*
 * Piezas de movimiento del sistema v2. Todas respetan prefers-reduced-motion.
 */

// ------------------------------------------------------------------ odómetro

/**
 * Número con dígitos que ruedan como un odómetro. Cada cifra es una columna 0-9 que se
 * desplaza con un muelle; los caracteres que no son dígitos (":" "+" "-") quedan fijos.
 */
export function Odometer({ value, className = '', style }: { value: string | number; className?: string; style?: CSSProperties }) {
  const text = String(value);
  return (
    // leading-none: con interlineado normal los ":" quedaban más bajos que las cifras.
    <span className={`inline-flex items-baseline leading-none tabular-nums ${className}`} style={style} aria-label={text}>
      {text.split('').map((ch, i) =>
        /\d/.test(ch) ? (
          <Digit key={`${text.length - i}`} digit={Number(ch)} />
        ) : (
          <span key={`s${text.length - i}`} aria-hidden="true">
            {ch}
          </span>
        ),
      )}
    </span>
  );
}

function Digit({ digit }: { digit: number }) {
  const reduce = useReducedMotion();
  const spring = useSpring(digit, { stiffness: 260, damping: 26, mass: 0.6 });
  useEffect(() => {
    spring.set(digit);
  }, [digit, spring]);
  const y = useTransform(spring, (v) => `${-v * 10}%`);
  return (
    <span className="relative inline-block h-[1em] overflow-hidden leading-none" aria-hidden="true" style={{ width: '0.62em' }}>
      <motion.span className="absolute inset-x-0 top-0 flex flex-col items-center leading-none" style={{ y: reduce ? `${-digit * 10}%` : y }}>
        {Array.from({ length: 10 }, (_, n) => (
          <span key={n} className="block h-[1em] leading-none">
            {n}
          </span>
        ))}
      </motion.span>
    </span>
  );
}

// ------------------------------------------------- pantalla de radio (marquesina)

/**
 * Texto en matriz de puntos. Si no cabe, se desplaza de ida y vuelta como el título en la
 * pantalla de un radio de carro (con pausa al principio y al final para poder leerlo).
 */
export function DotMatrix({ children, className = '', speed = 38 }: { children: ReactNode; className?: string; speed?: number }) {
  const box = useRef<HTMLSpanElement>(null);
  const inner = useRef<HTMLSpanElement>(null);
  const [shift, setShift] = useState(0);
  const reduce = useReducedMotion();

  useLayoutEffect(() => {
    const measure = () => {
      const b = box.current;
      const i = inner.current;
      if (!b || !i) return;
      const over = i.scrollWidth - b.clientWidth;
      setShift(over > 4 ? -over - 8 : 0);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (box.current) ro.observe(box.current);
    return () => ro.disconnect();
  }, [children]);

  const duration = Math.max(6, Math.abs(shift) / speed + 4);
  return (
    <span ref={box} className={`dotmatrix relative block overflow-hidden whitespace-nowrap ${className}`}>
      <span
        ref={inner}
        className="inline-block"
        style={
          shift && !reduce
            ? ({ '--marquee-shift': `${shift}px`, animation: `marquee ${duration}s ease-in-out infinite alternate` } as CSSProperties)
            : undefined
        }
      >
        {children}
      </span>
    </span>
  );
}

// --------------------------------------------------------- titular cinético

/**
 * Titular cuyas letras entran estrechas y se abren al ancho final (eje wdth de Anybody):
 * "se estiran con la velocidad". Cada palabra con un pequeño retraso.
 */
export function KineticTitle({
  words,
  className = '',
  accentFrom,
  delay = 0.15,
  as: Tag = 'h1',
}: {
  words: string[];
  className?: string;
  /** Índice desde el que las palabras van en cian. */
  accentFrom?: number;
  delay?: number;
  as?: 'h1' | 'h2';
}) {
  const reduce = useReducedMotion();
  return (
    <Tag className={`type-hero ${className}`}>
      {words.map((w, i) => (
        <motion.span
          key={`${w}-${i}`}
          className={`mr-[0.2em] inline-block ${accentFrom !== undefined && i >= accentFrom ? 'glow-text' : ''}`}
          initial={reduce ? false : { opacity: 0, fontStretch: '55%', y: 18, filter: 'blur(8px)' }}
          animate={{ opacity: 1, fontStretch: '132%', y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 1.1, delay: delay + i * 0.075, ease: [0.16, 1, 0.3, 1] }}
        >
          {w}
        </motion.span>
      ))}
    </Tag>
  );
}

// ------------------------------------------------------------ inclinación 3D

/**
 * Inclina su contenido en 3D siguiendo el puntero, con un reflejo de luz que se desplaza
 * como sobre un cristal. En táctil o con movimiento reducido queda quieto.
 */
export function Tilt({ children, className = '', max = 8, glare = true }: { children: ReactNode; className?: string; max?: number; glare?: boolean }) {
  const reduce = useReducedMotion();
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const sx = useSpring(px, { stiffness: 140, damping: 18 });
  const sy = useSpring(py, { stiffness: 140, damping: 18 });
  const rotateY = useTransform(sx, [0, 1], [-max, max]);
  const rotateX = useTransform(sy, [0, 1], [max, -max]);
  const gx = useTransform(sx, (v) => `${v * 100}%`);
  const gy = useTransform(sy, (v) => `${v * 100}%`);
  const glareBg = useTransform([gx, gy], ([x, y]) => `radial-gradient(circle at ${x} ${y}, rgb(207 250 254 / 0.16), transparent 45%)`);

  if (reduce) return <div className={className}>{children}</div>;
  return (
    <div
      className={className}
      style={{ perspective: 1100 }}
      onPointerMove={(e) => {
        if (e.pointerType !== 'mouse') return;
        const r = e.currentTarget.getBoundingClientRect();
        px.set((e.clientX - r.left) / r.width);
        py.set((e.clientY - r.top) / r.height);
      }}
      onPointerLeave={() => {
        px.set(0.5);
        py.set(0.5);
      }}
    >
      <motion.div className="relative h-full w-full" style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}>
        {children}
        {glare && <motion.div className="pointer-events-none absolute inset-0 rounded-[inherit]" style={{ background: glareBg }} aria-hidden="true" />}
      </motion.div>
    </div>
  );
}

// --------------------------------------------------------- atenuación nocturna

/** De 18:30 a 6:00 baja la retroiluminación (html[data-night]), como el reóstato del tablero. */
export function useNightDim(enabled = true): boolean {
  const [night, setNight] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    const check = () => {
      const d = new Date();
      const m = d.getHours() * 60 + d.getMinutes();
      const isNight = m >= 18 * 60 + 30 || m < 6 * 60;
      setNight(isNight);
      document.documentElement.toggleAttribute('data-night', isNight);
    };
    check();
    const t = setInterval(check, 60_000);
    return () => {
      clearInterval(t);
      document.documentElement.removeAttribute('data-night');
    };
  }, [enabled]);
  return night;
}
