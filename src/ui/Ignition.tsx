import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { TtIcon } from './Telltale';

/*
 * Secuencia de encendido, como el autotest de un tablero real al girar la llave:
 * todos los testigos se encienden a la vez, la pantalla escribe CARBEAT en matriz de puntos y
 * una línea de luz barre la cabina. Dura ~1,7 s y se puede saltar tocando.
 * (El barrido de agujas lo hacen los propios indicadores con `ignition`.)
 */

const LAMPS: { icon: keyof typeof TtIcon; tone: string }[] = [
  { icon: 'Link', tone: 'text-go' },
  { icon: 'Cloud', tone: 'text-cyan' },
  { icon: 'Lan', tone: 'text-cyan' },
  { icon: 'Seats', tone: 'text-amber' },
  { icon: 'Cruise', tone: 'text-go' },
  { icon: 'Speaker', tone: 'text-danger' },
];

const WORD = 'CARBEAT';

export function Ignition({ onDone }: { onDone?: () => void }) {
  const reduce = useReducedMotion();
  const [visible, setVisible] = useState(!reduce);
  const [typed, setTyped] = useState(0);

  useEffect(() => {
    if (reduce) {
      onDone?.();
      return;
    }
    const timers = [
      ...WORD.split('').map((_, i) => setTimeout(() => setTyped(i + 1), 280 + i * 70)),
      setTimeout(() => setVisible(false), 1650),
    ];
    return () => timers.forEach(clearTimeout);
  }, [reduce, onDone]);

  return (
    <AnimatePresence onExitComplete={onDone}>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[60] flex cursor-pointer flex-col items-center justify-center gap-8 bg-asphalt"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.45 } }}
          onClick={() => setVisible(false)}
          role="presentation"
        >
          <div className="flex gap-5" aria-hidden="true">
            {LAMPS.map((l, i) => {
              const Icon = TtIcon[l.icon];
              return (
                <motion.span
                  key={l.icon}
                  className={`flex h-9 w-9 items-center justify-center ${l.tone} [filter:drop-shadow(0_0_8px_currentColor)] [&_svg]:h-7 [&_svg]:w-7`}
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: [0, 1, 1, 0.15], scale: [0.6, 1.08, 1, 1] }}
                  transition={{ duration: 1.4, times: [0, 0.15, 0.7, 1], delay: i * 0.04 }}
                >
                  <Icon />
                </motion.span>
              );
            })}
          </div>
          <div className="relative">
            <p className="dotmatrix text-[clamp(3rem,11vw,7rem)] leading-none" aria-label="CarBeat">
              {WORD.slice(0, typed)}
              <span className="opacity-0">{WORD.slice(typed)}</span>
            </p>
          </div>
          <motion.span
            className="h-px w-[min(70vw,640px)] origin-left bg-gradient-to-r from-transparent via-cyan to-transparent shadow-[0_0_18px_rgb(34_211_238/0.9)]"
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: [0, 1, 0.4] }}
            transition={{ duration: 1.2, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
            aria-hidden="true"
          />
          <p className="label-cluster text-faint">Toca para saltar</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
