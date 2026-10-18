import { memo, useEffect, useId, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { trackKey, type Track } from '../../../shared/track';
import { Odometer } from '../kit';
import { Cover, formatTime } from '../controls';
import { TouchTilt } from './TouchTilt';
import './rider.css';

/*
 * "Lo que suena" del pasajero: la portada es un disco con grosor dentro de un velocímetro cuyo
 * recorrido es la canción (0 a la duración, con una marca por minuto, como en el cuadro).
 *
 * - Las marcas se encienden hasta donde va la canción y un índice naranja (el color de la aguja
 *   del tablero) señala el punto exacto.
 * - El disco se inclina con el dedo o el ratón (TouchTilt) y gira despacio mientras suena; se
 *   detiene en pausa. Al llegar una canción nueva, da la vuelta en 3D como una moneda.
 * - Todo lo que se mueve es transform u opacity.
 * - El arco y el índice avanzan a saltos de medio segundo SIN transición: en una canción de
 *   5 min cada salto es de 0,4°, invisible, y así no hay trabajo en cada fotograma. Antes se
 *   animaban (motion + filtro SVG) y con la CPU frenada ×4 el p95 subía a 12,1 ms (medido).
 *   Sólo un salto grande (canción nueva, adelantar) se anima.
 */

const START = -130;
const SWEEP = 260;
const C = 100;

const polar = (deg: number, r: number) => {
  const a = (deg * Math.PI) / 180;
  return { x: C + r * Math.sin(a), y: C - r * Math.cos(a) };
};

function arc(r: number, from: number, to: number): string {
  const s = polar(from, r);
  const e = polar(to, r);
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

type Tick = { f: number; major: boolean; label?: string };

/** Marcas según la duración real: una mayor por minuto en canciones normales; más espaciadas
 * en mezclas largas para que no se amontonen. Sin duración, marcas uniformes sin números. */
function dialTicks(duration: number): Tick[] {
  if (!(duration > 0)) return Array.from({ length: 33 }, (_, i) => ({ f: i / 32, major: i % 4 === 0 }));
  const mins = duration / 60;
  const step = mins <= 8 ? 1 : mins <= 16 ? 2 : mins <= 40 ? 5 : mins <= 90 ? 10 : 30;
  const minor = step === 5 ? 5 : 4;
  const unit = (step * 60) / minor;
  const out: Tick[] = [];
  for (let k = 0; k * unit <= duration + 0.001 && out.length < 90; k++) {
    const major = k % minor === 0;
    out.push({ f: (k * unit) / duration, major, label: major ? String((k / minor) * step) : undefined });
  }
  return out;
}

/** El autotest se hace una vez por sesión: repetirlo cada vez que se vuelve a "Ahora" cansaría. */
let selfTested = false;

export function CoverDial({
  track,
  position,
  duration,
  playing,
  size,
  showTime = false,
}: {
  track: Track | null;
  position: number;
  duration: number;
  playing: boolean;
  size: number;
  /** Lectura de tiempo con odómetro en el hueco inferior del dial (versión grande). */
  showTime?: boolean;
}) {
  const uid = useId().replace(/:/g, '');
  const reduce = useReducedMotion();
  const real = duration > 0 ? Math.max(0, Math.min(1, position / duration)) : 0;
  // Autotest de encendido, como el barrido de agujas al girar la llave: el recorrido se llena
  // entero y vuelve a su sitio. Sólo la primera vez y sin movimiento reducido.
  const [test, setTest] = useState<0 | 1 | null>(() => (selfTested ? null : 0));
  useEffect(() => {
    if (test === null) return;
    if (reduce) {
      setTest(null);
      return;
    }
    selfTested = true;
    const up = requestAnimationFrame(() => setTest(1));
    const down = setTimeout(() => setTest(null), 800);
    return () => {
      cancelAnimationFrame(up);
      clearTimeout(down);
    };
  }, [reduce]); // eslint-disable-line react-hooks/exhaustive-deps
  const testing = test !== null;
  const progress = test ?? real;
  const ticks = useMemo(() => dialTicks(duration), [duration]);
  const labels = size >= 200;
  const deg = START + progress * SWEEP;
  const prev = useRef(progress);
  const jump = Math.abs(progress - prev.current) > 0.02 && !reduce;
  useEffect(() => {
    prev.current = progress;
  }, [progress]);
  const glide = jump ? 'stroke-dashoffset 0.5s cubic-bezier(0.16,1,0.3,1)' : 'none';
  // Disco más grande cuando no hay números alrededor.
  const discInset = labels ? 19 : 14;
  return (
    <div
      data-dial
      className="relative shrink-0 select-none"
      style={{ width: size, height: size }}
      role="img"
      aria-label={track ? `Progreso de la canción: ${formatTime(position)} de ${formatTime(duration)}` : 'No suena nada'}
    >
      <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
        <defs>
          <linearGradient id={`bz-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3f4d5a" />
            <stop offset="48%" stopColor="#11171d" />
            <stop offset="100%" stopColor="#2b3742" />
          </linearGradient>
          <radialGradient id={`face-${uid}`} cx="50%" cy="40%" r="62%">
            <stop offset="0%" stopColor="#0e1a22" />
            <stop offset="72%" stopColor="#070b0f" />
            <stop offset="100%" stopColor="#030507" />
          </radialGradient>
        </defs>

        {/* Bisel y esfera */}
        <circle cx={C} cy={C} r={99.5} fill={`url(#bz-${uid})`} />
        <circle cx={C} cy={C} r={96} fill={`url(#face-${uid})`} />
        <circle cx={C} cy={C} r={96} fill="none" stroke="rgb(0 0 0 / 0.8)" strokeWidth="1.2" />

        {/* Pista del recorrido y recorrido encendido */}
        <path d={arc(91.5, START, START + SWEEP)} fill="none" stroke="rgb(34 211 238 / 0.1)" strokeWidth="3" strokeLinecap="round" />
        {/* Halo (trazo ancho y tenue) + trazo: brillo sin filtro SVG, que repinta caro */}
        {[
          { w: 8, o: 0.22 },
          { w: 3, o: 1 },
        ].map((l) => (
          <path
            key={l.w}
            d={arc(91.5, START, START + SWEEP)}
            fill="none"
            stroke={l.w > 3 ? '#22d3ee' : '#67e8f9'}
            strokeWidth={l.w}
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray="1 1"
            style={{ strokeDashoffset: 1 - Math.max(0.002, progress), transition: glide, opacity: `calc(${l.o} * var(--glow, 1))` }}
          />
        ))}

        {/* Marcas: encendidas hasta donde va la canción */}
        {ticks.map((t, i) => {
          const d = START + t.f * SWEEP;
          const a = polar(d, 86);
          const b = polar(d, t.major ? 77 : 82);
          const lit = t.f <= progress + 1e-6 && (!!track || testing);
          return (
            <line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={lit ? '#a5f3fc' : t.major ? 'rgb(139 162 176 / 0.55)' : 'rgb(139 162 176 / 0.28)'}
              strokeWidth={t.major ? 2.2 : 1.2}
              strokeLinecap="round"
            />
          );
        })}
        {/* Fin de la canción: marca roja, como la zona roja del tacómetro */}
        {duration > 0 && (
          <line {...(() => {
            const a = polar(START + SWEEP, 87);
            const b = polar(START + SWEEP, 76);
            return { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
          })()} stroke="#ff5a36" strokeWidth="2.4" strokeLinecap="round" />
        )}
        {labels &&
          ticks
            .filter((t) => t.label !== undefined)
            .map((t) => {
              const p = polar(START + t.f * SWEEP, 68.5);
              const lit = t.f <= progress + 1e-6 && (!!track || testing);
              return (
                <text
                  key={t.label}
                  x={p.x}
                  y={p.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontWeight="700"
                  fontSize="9.5"
                  fill={lit ? '#cffafe' : '#6b8190'}
                  style={{ fontFamily: '"Anybody Variable", sans-serif', fontStretch: '80%' }}
                >
                  {t.label}
                </text>
              );
            })}

        {/* Índice naranja: el punto exacto de la canción */}
        {(track || testing) && (
          <g
            style={{
              transform: `rotate(${deg}deg)`,
              transformOrigin: '100px 100px',
              transformBox: 'view-box',
              transition: jump ? 'transform 0.5s cubic-bezier(0.16,1,0.3,1)' : 'none',
            }}
          >
            <path d="M100 15.5 L94.6 4.4 L105.4 4.4 Z" fill="#ff5a36" opacity="0.3" />
            <path d="M100 13.5 L96.2 5.6 L103.8 5.6 Z" fill="#ff7a52" />
          </g>
        )}
      </svg>

      <Disc track={track} playing={playing} inset={discInset} />

      {showTime && (
        <div className="pointer-events-none absolute inset-x-0 bottom-[3%] flex flex-col items-center leading-none" aria-hidden="true">
          <span className="readout text-[clamp(1.25rem,6.5vw,1.6rem)] font-bold text-ice [filter:drop-shadow(0_0_7px_rgb(34_211_238/0.6))]">
            <LiveOdometer value={formatTime(position)} />
          </span>
          <span className="label-cluster mt-1 text-[0.55rem] text-faint">de {formatTime(duration)}</span>
        </div>
      )}
    </div>
  );
}

/** El odómetro sólo cambia una vez por segundo: memorizado, se salta los repintados de medio segundo. */
export const LiveOdometer = memo(Odometer);

/**
 * Disco con grosor, inclinable. Memorizado: el dial se repinta cada medio segundo con el
 * avance, pero el disco sólo cambia con la canción o al pausar.
 */
const Disc = memo(function Disc({ track, playing, inset }: { track: Track | null; playing: boolean; inset: number }) {
  const reduce = useReducedMotion();
  const key = track ? trackKey(track) : 'vacio';
  return (
    <TouchTilt className="absolute" style={{ inset: `${inset}%` }} max={13} radius="9999px">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={key}
          className="absolute inset-0"
          style={{ transformStyle: 'preserve-3d' }}
          initial={reduce ? { opacity: 0 } : { rotateY: -92, scale: 0.9 }}
          animate={reduce ? { opacity: 1 } : { rotateY: 0, scale: 1, transition: { type: 'spring', stiffness: 170, damping: 15 } }}
          exit={reduce ? { opacity: 0 } : { rotateY: 92, scale: 0.9, transition: { duration: 0.28, ease: [0.5, 0, 0.9, 0.4] } }}
        >
          {/* Canto del disco: capas apiladas en Z; se ve al inclinarlo */}
          {[1, 2, 3, 4, 5].map((z) => (
            <span
              key={z}
              className="absolute inset-0 rounded-full"
              style={{ transform: `translateZ(${-z * 1.6}px)`, background: z === 5 ? '#05080b' : `rgb(${58 - z * 7} ${72 - z * 8} ${84 - z * 9})` }}
              aria-hidden="true"
            />
          ))}
          <div
            className="absolute inset-0 overflow-hidden rounded-full"
            style={{
              transform: 'translateZ(1px)',
              boxShadow: '0 22px 34px -12px rgb(0 0 0 / 0.95), 0 0 0 1.5px rgb(207 250 254 / 0.16), 0 0 34px -10px rgb(34 211 238 / 0.55)',
            }}
          >
            <div className="disc-spin absolute inset-0" data-paused={!playing}>
              <Cover src={track?.coverUrl} videoId={track?.videoId} eager alt={track ? `Portada de ${track.title}` : ''} className="h-full w-full" />
            </div>
            <div className="disc-sheen pointer-events-none absolute inset-0 rounded-full" aria-hidden="true" />
            {/* Eje central, como un CD en el reproductor del carro */}
            <span
              className="absolute top-1/2 left-1/2 h-[17%] w-[17%] -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                background: 'radial-gradient(circle, #05070a 0 34%, #9fb3c0 36%, #3a4955 52%, #c4d3dc 64%, rgb(20 28 35 / 0.9) 70%, transparent 74%)',
                boxShadow: '0 0 0 1px rgb(0 0 0 / 0.4)',
              }}
              aria-hidden="true"
            />
          </div>
        </motion.div>
      </AnimatePresence>
    </TouchTilt>
  );
}, sameDisc);

/** Cada foto del carro trae un objeto de pista nuevo aunque sea la misma canción: se compara por clave. */
function sameDisc(a: { track: Track | null; playing: boolean; inset: number }, b: { track: Track | null; playing: boolean; inset: number }) {
  return (
    a.playing === b.playing &&
    a.inset === b.inset &&
    (a.track ? trackKey(a.track) : '') === (b.track ? trackKey(b.track) : '') &&
    a.track?.coverUrl === b.track?.coverUrl &&
    a.track?.title === b.track?.title
  );
}
