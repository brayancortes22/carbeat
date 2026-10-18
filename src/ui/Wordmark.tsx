import { motion, useReducedMotion } from 'motion/react';

/*
 * Marca: un arco de indicador con su aguja + el nombre en la tipografía del cuadro.
 * Al aparecer el arco se dibuja y la aguja barre desde cero con un muelle (como el autotest al
 * girar la llave); al pasar el ratón "acelera". Con movimiento reducido queda quieta.
 */
export function Wordmark({ compact = false }: { compact?: boolean }) {
  const reduce = useReducedMotion();
  return (
    <motion.span className="inline-flex items-center gap-2.5" aria-label="CarBeat" role="img" initial="rest" animate="rest" whileHover={reduce ? undefined : 'rev'}>
      <svg viewBox="0 0 32 32" className="h-8 w-8 overflow-visible" aria-hidden="true">
        <motion.path
          d="M5.5 22.5A12 12 0 1 1 26.5 22.5"
          fill="none"
          stroke="var(--color-cyan)"
          strokeWidth="2.4"
          strokeLinecap="round"
          style={{ filter: 'drop-shadow(0 0 3px rgb(34 211 238 / 0.8))' }}
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        />
        <motion.path
          d="M16 18L23.5 9.5"
          stroke="#ff5a36"
          strokeWidth="2.4"
          strokeLinecap="round"
          // El pivote es el extremo (16,18): esquina inferior izquierda de la caja del trazo.
          style={{ originX: 0, originY: 1 }}
          initial={reduce ? false : { rotate: -150 }}
          variants={{
            rest: { rotate: 0, transition: { type: 'spring', stiffness: 110, damping: 9, delay: 0.2 } },
            rev: { rotate: [0, 42, 30, 38], transition: { duration: 0.7, ease: 'easeOut' } },
          }}
        />
        <circle cx="16" cy="18" r="2.4" fill="#e2f4f9" />
      </svg>
      {!compact && (
        <span className="font-display text-xl leading-none font-bold tracking-[0.2em] text-ink" aria-hidden="true">
          CAR<span className="text-cyan">BEAT</span>
        </span>
      )}
    </motion.span>
  );
}
