import { useEffect, useId, useMemo, useRef, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { motion, useMotionValueEvent, useReducedMotion, useSpring, useTransform } from 'motion/react';

/*
 * Indicador analógico de cuadro de instrumentos.
 * Barrido de 260° (de -130° a +130°, 0° = las 12). La aguja es naranja como en los tableros
 * reales; el cian queda para la retroiluminación del dial.
 */

const START = -130;
const SWEEP = 260;
const C = 100;

const polar = (deg: number, r: number) => {
  const a = (deg * Math.PI) / 180;
  return { x: C + r * Math.sin(a), y: C - r * Math.cos(a) };
};

function arcPath(r: number, from = START, to = START + SWEEP): string {
  const s = polar(from, r);
  const e = polar(to, r);
  const large = to - from > 180 ? 1 : 0;
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

export interface GaugeProps {
  /** Valor actual entre 0 y 1. */
  value: number;
  label: string;
  /** Texto grande del centro (lectura digital). */
  readout: ReactNode;
  /** Unidad bajo la lectura. */
  unit?: string;
  /** Rótulos de las marcas mayores, de 0 a 1 repartidos uniformemente. */
  majors: string[];
  minorPerMajor?: number;
  /** A partir de aquí (0-1) el dial se pinta en rojo. */
  redFrom?: number;
  /** Hasta aquí llega la zona roja (por defecto, el final del dial). */
  redTo?: number;
  /** Marca de fin (0-1): p. ej. dónde acaba la canción si la escala va más allá. */
  endMark?: number;
  /**
   * Barrido de prueba al encender, como en un carro. `'hold'` deja la aguja en reposo
   * (la cabina aún está tapada por la secuencia de encendido) y al pasar a `true` barre.
   */
  ignition?: boolean | 'hold';
  /** Si se pasa, el usuario puede arrastrar la aguja (y usar las flechas). */
  onChange?: (value: number) => void;
  ariaValueText?: string;
  className?: string;
  children?: ReactNode;
}

export function Gauge({
  value,
  label,
  readout,
  unit,
  majors,
  minorPerMajor = 4,
  redFrom,
  redTo = 1,
  endMark,
  ignition = false,
  onChange,
  ariaValueText,
  className = '',
  children,
}: GaugeProps) {
  const uid = useId().replace(/:/g, '');
  const reduce = useReducedMotion();
  const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const spring = useSpring(ignition && !reduce ? 0 : clamped, { stiffness: 90, damping: 16, mass: 0.9 });
  const lit = useTransform(spring, (v) => Math.max(0.0001, v));
  // La aguja gira con un transform SVG explícito alrededor del centro del dial. (Con el
  // origen de motion para SVG, que se calcula sobre la caja de la propia aguja, salía
  // disparada fuera del dial.)
  const needleRef = useRef<SVGGElement>(null);
  const setNeedle = (v: number) => needleRef.current?.setAttribute('transform', `rotate(${(START + v * SWEEP).toFixed(2)} ${C} ${C})`);
  useMotionValueEvent(spring, 'change', setNeedle);
  useEffect(() => setNeedle(spring.get()), []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fases del autotest: en reposo bajo la secuencia de encendido, barrido al tope y vuelta,
  // y después la aguja sigue al valor. El seguimiento y el barrido van en efectos separados:
  // si compartieran efecto, cada tic del tiempo reiniciaría el barrido y no acabaría nunca.
  const phase = useRef<'hold' | 'sweep' | 'live'>(!ignition || reduce ? 'live' : ignition === 'hold' ? 'hold' : 'sweep');
  const target = useRef(clamped);
  target.current = clamped;

  useEffect(() => {
    if (phase.current === 'live') spring.set(clamped);
  }, [clamped, spring]);

  useEffect(() => {
    if (!ignition || reduce) {
      phase.current = 'live';
      spring.set(target.current);
      return;
    }
    if (ignition === 'hold') {
      if (phase.current !== 'live') {
        phase.current = 'hold';
        spring.set(0);
      }
      return;
    }
    if (phase.current === 'live') return;
    phase.current = 'sweep';
    spring.set(1);
    const t = setTimeout(() => {
      phase.current = 'live';
      spring.set(target.current);
    }, 1050);
    return () => clearTimeout(t);
  }, [ignition, reduce, spring]);

  const ticks = useMemo(() => {
    const out: { x1: number; y1: number; x2: number; y2: number; major: boolean; red: boolean; label?: string; lx?: number; ly?: number }[] = [];
    const segments = (majors.length - 1) * minorPerMajor;
    for (let i = 0; i <= segments; i++) {
      const f = i / segments;
      const deg = START + f * SWEEP;
      const major = i % minorPerMajor === 0;
      const a = polar(deg, 86);
      const b = polar(deg, major ? 74 : 80);
      const t = { x1: a.x, y1: a.y, x2: b.x, y2: b.y, major, red: redFrom !== undefined && f >= redFrom - 1e-6 && f <= redTo + 1e-6 } as (typeof out)[number];
      if (major) {
        const l = polar(deg, 62);
        t.label = majors[i / minorPerMajor];
        t.lx = l.x;
        t.ly = l.y;
      }
      out.push(t);
    }
    return out;
  }, [majors, minorPerMajor, redFrom, redTo]);

  const endA = polar(START + (endMark ?? 0) * SWEEP, 92);
  const endB = polar(START + (endMark ?? 0) * SWEEP, 72);

  // ---- interacción (volumen)
  const svgRef = useRef<SVGSVGElement>(null);
  const valueFromPointer = (e: PointerEvent<SVGSVGElement>) => {
    const box = svgRef.current?.getBoundingClientRect();
    if (!box) return null;
    const x = e.clientX - (box.left + box.width / 2);
    const y = e.clientY - (box.top + box.height / 2);
    let deg = (Math.atan2(x, -y) * 180) / Math.PI; // 0 arriba, horario
    if (deg < START - 20) deg += 360;
    return Math.max(0, Math.min(1, (deg - START) / SWEEP));
  };
  const onPointer = (e: PointerEvent<SVGSVGElement>) => {
    if (!onChange || (e.type === 'pointermove' && e.buttons === 0)) return;
    if (e.type === 'pointerdown') e.currentTarget.setPointerCapture(e.pointerId);
    const v = valueFromPointer(e);
    if (v !== null) onChange(v);
  };
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (!onChange) return;
    const step = e.shiftKey ? 0.1 : 0.05;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') onChange(Math.min(1, clamped + step));
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') onChange(Math.max(0, clamped - step));
    else if (e.key === 'Home') onChange(0);
    else if (e.key === 'End') onChange(1);
    else return;
    e.preventDefault();
  };

  const interactive = !!onChange;

  return (
    <div className={`relative aspect-square select-none ${className}`} style={{ containerType: 'inline-size' }}>
      <svg
        ref={svgRef}
        viewBox="0 0 200 200"
        className={`h-full w-full overflow-visible ${interactive ? 'cursor-grab touch-none active:cursor-grabbing' : ''}`}
        role={interactive ? 'slider' : 'img'}
        tabIndex={interactive ? 0 : undefined}
        aria-label={label}
        aria-valuemin={interactive ? 0 : undefined}
        aria-valuemax={interactive ? 100 : undefined}
        aria-valuenow={interactive ? Math.round(clamped * 100) : undefined}
        aria-valuetext={ariaValueText}
        onPointerDown={interactive ? onPointer : undefined}
        onPointerMove={interactive ? onPointer : undefined}
        onKeyDown={interactive ? onKey : undefined}
      >
        <defs>
          <radialGradient id={`face-${uid}`} cx="50%" cy="42%" r="62%">
            <stop offset="0%" stopColor="#0d161d" />
            <stop offset="70%" stopColor="#070b0f" />
            <stop offset="100%" stopColor="#030507" />
          </radialGradient>
          <linearGradient id={`bezel-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b4855" />
            <stop offset="45%" stopColor="#151c23" />
            <stop offset="100%" stopColor="#2a3540" />
          </linearGradient>
          <linearGradient id={`needle-${uid}`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#ff3d1f" />
            <stop offset="100%" stopColor="#ff9a5a" />
          </linearGradient>
          <filter id={`glow-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id={`soft-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="5" />
          </filter>
          {/* Sombra de la aguja sobre la esfera: separa la aguja del dial, como en uno físico. */}
          <filter id={`shadow-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="2.2" dy="3" stdDeviation="1.6" floodColor="#000" floodOpacity="0.85" />
          </filter>
          {/* Reflejo curvo del cristal del cuadro. */}
          <linearGradient id={`glass-${uid}`} x1="0" y1="0" x2="0.35" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.14" />
            <stop offset="45%" stopColor="#ffffff" stopOpacity="0.03" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <radialGradient id={`backlight-${uid}`} cx="50%" cy="55%" r="55%">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.10" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Bisel metálico y esfera */}
        <circle cx={C} cy={C} r={99} fill={`url(#bezel-${uid})`} />
        <circle cx={C} cy={C} r={95} fill={`url(#face-${uid})`} />
        <circle cx={C} cy={C} r={95} fill={`url(#backlight-${uid})`} />
        <circle cx={C} cy={C} r={95} fill="none" stroke="rgb(0 0 0 / 0.8)" strokeWidth={2} />

        {/* Pista y arco iluminado hasta el valor */}
        <path d={arcPath(88)} fill="none" stroke="rgb(34 211 238 / 0.08)" strokeWidth={3} strokeLinecap="round" />
        <motion.path
          d={arcPath(88)}
          fill="none"
          stroke="rgb(34 211 238 / 0.55)"
          strokeWidth={5}
          strokeLinecap="round"
          filter={`url(#soft-${uid})`}
          style={{ pathLength: lit }}
        />
        <motion.path d={arcPath(88)} fill="none" stroke="var(--color-cyan)" strokeWidth={2.2} strokeLinecap="round" style={{ pathLength: lit }} />
        {redFrom !== undefined && redTo > redFrom && (
          <path d={arcPath(88, START + redFrom * SWEEP, START + redTo * SWEEP)} fill="none" stroke="var(--color-danger)" strokeOpacity={0.7} strokeWidth={2.2} />
        )}
        {endMark !== undefined && endMark > 0 && endMark < 1 && (
          // Fin de la canción: una marca que corta el dial; lo que queda después ya no se alcanza.
          <g>
            <path d={arcPath(88, START + endMark * SWEEP)} fill="none" stroke="rgb(2 7 10 / 0.75)" strokeWidth={6} />
            <line x1={endA.x} y1={endA.y} x2={endB.x} y2={endB.y} stroke="var(--color-danger)" strokeWidth={2.4} strokeLinecap="round" />
          </g>
        )}

        {/* Marcas y números */}
        {ticks.map((t, i) => (
          <g key={i}>
            <line
              x1={t.x1}
              y1={t.y1}
              x2={t.x2}
              y2={t.y2}
              stroke={t.red ? 'var(--color-danger)' : t.major ? 'var(--color-ice)' : 'rgb(139 162 176 / 0.55)'}
              strokeWidth={t.major ? 2 : 1}
              strokeLinecap="round"
            />
            {t.label !== undefined && (
              <text
                x={t.lx}
                y={t.ly}
                textAnchor="middle"
                dominantBaseline="central"
                fill={t.red ? 'var(--color-danger)' : 'rgb(207 250 254 / 0.85)'}
                style={{ font: '700 13px var(--font-display)', fontStretch: '76%' }}
              >
                {t.label}
              </text>
            )}
          </g>
        ))}

        {/* Aguja */}
        <g ref={needleRef} transform={`rotate(${START} ${C} ${C})`}>
          <g filter={`url(#shadow-${uid})`}>
            <polygon points="97.6,108 102.4,108 100.8,22 99.2,22" fill={`url(#needle-${uid})`} filter={`url(#glow-${uid})`} />
          </g>
        </g>
        {/* Ventana de la lectura digital, en el hueco inferior del dial: ahí la aguja no pasa nunca. */}
        <rect x={63} y={143} width={74} height={31} rx={7} fill="#02070a" stroke="rgb(34 211 238 / 0.18)" strokeWidth={1} />
        <rect x={64.5} y={144.5} width={71} height={6} rx={3} fill="rgb(255 255 255 / 0.025)" />
        <circle cx={C} cy={C} r={10} fill="#0b1015" stroke="#2a3540" strokeWidth={2} />
        <circle cx={C} cy={C} r={3.5} fill="#ff5a36" />
        {/* Cristal: un arco de luz en la mitad superior */}
        <path d="M 14 92 A 86 86 0 0 1 186 92 Q 100 58 14 92 Z" fill={`url(#glass-${uid})`} pointerEvents="none" />
      </svg>

      {/* Lectura digital en su ventana (y=143..174 de 200) y la unidad debajo */}
      <div className="pointer-events-none absolute inset-x-[31.5%] top-[71.5%] flex h-[15.5%] items-center justify-center">
        <span className="dotmatrix text-[11.5cqw] leading-none">{readout}</span>
      </div>
      {unit && (
        <div className="pointer-events-none absolute inset-x-0 top-[88.5%] text-center leading-none">
          <span className="label-cluster text-[clamp(0.45rem,3.6cqw,0.68rem)] tracking-[0.16em]">{unit}</span>
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 top-[31%] text-center">
        <span className="label-cluster text-[clamp(0.5rem,4.4cqw,0.75rem)] text-cyan-soft/75">{label}</span>
      </div>
      {children}
    </div>
  );
}
