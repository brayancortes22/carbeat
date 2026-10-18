import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useAnimate, useReducedMotion } from 'motion/react';
import { Disc3 } from 'lucide-react';

/*
 * "La portada vuela a la cola": al pedir una canción, una copia de su portada sale de la fila
 * y cae en la pestaña Cola, que da un salto al recibirla. Le dice al pasajero dónde quedó su
 * pedido sin un aviso de texto.
 *
 * Es un bus mínimo (lanzar → capa que dibuja): quien pide (la búsqueda, la música del carro) no
 * necesita saber dónde está la pestaña, y la pantalla que la dibuja no necesita saber quién pide.
 */

type Rect = { x: number; y: number; w: number; h: number };
type Launch = { id: number; src?: string; from: Rect };
type Flight = Launch & { to: { x: number; y: number }; el: Element };

const listeners = new Set<(f: Launch) => void>();
let seq = 0;

/** Lanza la portada desde `fromEl` (o desde el centro de la pantalla si no hay elemento). */
export function launchFlight(fromEl?: Element | null, src?: string): void {
  const r = fromEl?.getBoundingClientRect();
  const from: Rect = r && r.width > 0 ? { x: r.left, y: r.top, w: r.width, h: r.height } : { x: window.innerWidth / 2 - 24, y: window.innerHeight / 2 - 24, w: 48, h: 48 };
  const f = { id: ++seq, src, from };
  listeners.forEach((l) => l(f));
}

/**
 * `target` se consulta en el momento de pedir (no al dibujar): si no suena nada, la canción va
 * a sonar ya y la pantalla puede mandar la portada al dial en vez de a la cola.
 */
export function FlightLayer({ target, onLand }: { target: () => Element | null | undefined; onLand: (el: Element | null) => void }) {
  const reduce = useReducedMotion();
  const [flights, setFlights] = useState<Flight[]>([]);
  const [bursts, setBursts] = useState<{ id: number; x: number; y: number }[]>([]);
  // Siempre la última versión, sin volver a suscribirse en cada render.
  const latest = useRef({ target, onLand });
  latest.current = { target, onLand };

  useEffect(() => {
    const l = (f: Launch) => {
      const el = latest.current.target() ?? null;
      const t = el?.getBoundingClientRect();
      // Sin movimiento (o sin destino visible) sólo salta el contador.
      if (reduce || !el || !t || t.width === 0) {
        latest.current.onLand(el);
        return;
      }
      setFlights((fs) => [...fs, { ...f, el, to: { x: t.left + t.width / 2, y: t.top + t.height / 2 } }]);
    };
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, [reduce]);

  const land = (f: Flight) => {
    setFlights((fs) => fs.filter((x) => x.id !== f.id));
    setBursts((b) => [...b, { id: f.id, x: f.to.x, y: f.to.y }]);
    latest.current.onLand(f.el);
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-[70] overflow-hidden" aria-hidden="true">
      {flights.map((f) => {
        const size = 52;
        const sx = f.from.x + f.from.w / 2;
        const sy = f.from.y + f.from.h / 2;
        const dx = f.to.x - sx;
        const dy = f.to.y - sy;
        // Parábola: sube un poco antes de caer en la pestaña (más si la pestaña está abajo).
        const peak = Math.min(0, dy) - (dy < 0 ? 36 : 110);
        const s0 = Math.max(0.5, f.from.w / size);
        return (
          <motion.div
            key={f.id}
            className="absolute"
            style={{ left: sx - size / 2, top: sy - size / 2, width: size, height: size }}
            initial={{ x: 0, y: 0, scale: s0, rotate: 0 }}
            animate={{ x: [0, dx * 0.42, dx], y: [0, peak, dy], scale: [s0, 1.3, 0.34], rotate: [0, -18, 10] }}
            transition={{ duration: 0.78, times: [0, 0.4, 1], ease: ['easeOut', 'easeIn'] }}
            onAnimationComplete={() => land(f)}
          >
            <div className="h-full w-full overflow-hidden rounded-full bg-cabin shadow-[0_0_0_2px_rgb(103_232_249/0.85),0_0_26px_2px_rgb(34_211_238/0.8),0_12px_24px_-6px_rgb(0_0_0/0.9)]">
              {f.src ? (
                <img src={f.src} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-cyan">
                  <Disc3 className="h-2/3 w-2/3" strokeWidth={1.4} />
                </span>
              )}
            </div>
          </motion.div>
        );
      })}
      <AnimatePresence>
        {bursts.map((b) => (
          <motion.span
            key={b.id}
            className="absolute h-16 w-16 rounded-full border-2 border-cyan-soft shadow-[0_0_20px_rgb(34_211_238/0.8)]"
            style={{ left: b.x - 32, top: b.y - 32 }}
            initial={{ scale: 0.2, opacity: 1 }}
            animate={{ scale: 1.5, opacity: 0 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            onAnimationComplete={() => setBursts((all) => all.filter((x) => x.id !== b.id))}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

/** Salto de un contador (la pestaña Cola al recibir la portada). No remonta el hijo: el
 * odómetro de dentro sigue rodando desde el número anterior. */
export function useBump() {
  const [scope, animate] = useAnimate<HTMLSpanElement>();
  const reduce = useReducedMotion();
  const bump = useCallback(() => {
    if (!scope.current || reduce) return;
    void animate(scope.current, { scale: [1, 1.5, 0.9, 1], y: [0, -6, 1, 0] }, { duration: 0.6, ease: 'easeOut' });
  }, [animate, scope, reduce]);
  return [scope, bump] as const;
}
