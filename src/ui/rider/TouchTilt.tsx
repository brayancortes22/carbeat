import type { CSSProperties, PointerEvent, ReactNode } from 'react';
import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react';

/*
 * Inclinación 3D que también responde al dedo.
 *
 * Por qué no el Tilt del kit: aquel sólo sigue al ratón y en táctil se queda quieto, y el
 * pasajero usa el celular. Aquí, con ratón sigue al puntero; con el dedo, la pieza "se hunde"
 * bajo el punto que tocas mientras lo mantienes y vuelve con un muelle al soltar.
 * Si el dedo empieza a desplazar la página, el navegador cancela el puntero y la pieza vuelve:
 * no roba el scroll.
 */
export function TouchTilt({
  children,
  className = '',
  max = 10,
  glare = true,
  baseX = 0,
  baseY = 0,
  style,
  radius = 'inherit',
}: {
  children: ReactNode;
  className?: string;
  /** Grados máximos de inclinación. */
  max?: number;
  glare?: boolean;
  /** Inclinación en reposo (perspectiva fija, p. ej. una tarjeta apoyada en el tablero). */
  baseX?: number;
  baseY?: number;
  style?: CSSProperties;
  radius?: string;
}) {
  const reduce = useReducedMotion();
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const sx = useSpring(px, { stiffness: 170, damping: 17 });
  const sy = useSpring(py, { stiffness: 170, damping: 17 });
  const rotateY = useTransform(sx, [0, 1], [baseY - max, baseY + max]);
  const rotateX = useTransform(sy, [0, 1], [baseX + max, baseX - max]);
  const gx = useTransform(sx, (v) => v * 100);
  const gy = useTransform(sy, (v) => v * 100);
  const glareBg = useMotionTemplate`radial-gradient(circle at ${gx}% ${gy}%, rgb(207 250 254 / 0.24), transparent 52%)`;

  if (reduce) {
    return (
      <div className={className} style={{ ...style, perspective: 900 }}>
        <div className="relative h-full w-full" style={{ transform: `rotateX(${baseX}deg) rotateY(${baseY}deg)`, borderRadius: radius }}>
          {children}
        </div>
      </div>
    );
  }

  const aim = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    px.set(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)));
    py.set(Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)));
  };
  const rest = () => {
    px.set(0.5);
    py.set(0.5);
  };

  return (
    <div
      className={className}
      style={{ ...style, perspective: 900 }}
      onPointerMove={(e) => {
        // Con ratón sigue siempre; con el dedo sólo mientras está apoyado.
        if (e.pointerType === 'mouse' || e.buttons) aim(e);
      }}
      onPointerDown={(e) => {
        if (e.pointerType !== 'mouse') aim(e);
      }}
      onPointerUp={(e) => {
        if (e.pointerType !== 'mouse') rest();
      }}
      onPointerCancel={rest}
      onPointerLeave={rest}
    >
      <motion.div className="relative h-full w-full" style={{ rotateX, rotateY, transformStyle: 'preserve-3d', borderRadius: radius }}>
        {children}
        {glare && <motion.div className="pointer-events-none absolute inset-0" style={{ background: glareBg, borderRadius: radius }} aria-hidden="true" />}
      </motion.div>
    </div>
  );
}
