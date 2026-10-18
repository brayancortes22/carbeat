import { useId, useState, type CSSProperties } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

/*
 * Botón de arranque tipo "ENGINE START / STOP": encender el carro = abrir la sala.
 * Aro cromado moleteado con un brillo que gira despacio, anillo de luz que se carga un poco al
 * pasar el ratón y se completa al pulsar (medio segundo, como el giro de la llave), y una onda
 * expansiva al arrancar. Con movimiento reducido arranca al instante y sin brillos que giren.
 */

const KNURL = Array.from({ length: 72 }, (_, i) => i * 5);

// Brillo del cromo: sólo se ve en el aro exterior (la máscara recorta el centro).
const SHEEN: CSSProperties = {
  background: 'conic-gradient(from 0deg, transparent 0deg, rgb(207 250 254 / 0.38) 18deg, transparent 52deg, transparent 180deg, rgb(207 250 254 / 0.16) 200deg, transparent 230deg)',
  WebkitMask: 'radial-gradient(circle, transparent 86%, #000 87.5%)',
  mask: 'radial-gradient(circle, transparent 86%, #000 87.5%)',
};

export function StartButton({ onStart, label = 'Encender', sub = 'la cabina', size = 168 }: { onStart: () => void; label?: string; sub?: string; size?: number }) {
  const [firing, setFiring] = useState(false);
  const [hover, setHover] = useState(false);
  const reduce = useReducedMotion();
  const uid = useId().replace(/:/g, '');
  const r = 46;
  const circ = 2 * Math.PI * r;

  const fire = () => {
    if (firing) return;
    setFiring(true);
    setTimeout(onStart, reduce ? 0 : 560);
  };

  const offset = firing ? 0 : hover ? circ * 0.5 : circ * 0.72;

  return (
    <button
      type="button"
      onClick={fire}
      onPointerEnter={(e) => e.pointerType === 'mouse' && setHover(true)}
      onPointerLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      className="group relative shrink-0 rounded-full focus-visible:outline-offset-8"
      style={{ width: size, height: size }}
      aria-label={`${label} ${sub}`}
    >
      {/* Halo que respira mientras espera */}
      <span
        className={`absolute inset-[-16%] rounded-full bg-[radial-gradient(circle,rgb(34_211_238/0.34),transparent_64%)] transition-opacity duration-500 animate-[ring-breathe_3.2s_ease-in-out_infinite] ${firing ? 'opacity-100' : 'opacity-80'}`}
        aria-hidden="true"
      />
      {/* Onda expansiva al arrancar */}
      <AnimatePresence>
        {firing && !reduce && (
          <motion.span
            className="absolute inset-0 rounded-full border-2 border-cyan shadow-[0_0_24px_rgb(34_211_238/0.8)]"
            initial={{ scale: 1, opacity: 0.95 }}
            animate={{ scale: 1.75, opacity: 0 }}
            transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden="true">
        <defs>
          <linearGradient id={`${uid}-chrome`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#6b7b88" />
            <stop offset="35%" stopColor="#1a222a" />
            <stop offset="62%" stopColor="#4a5866" />
            <stop offset="100%" stopColor="#141b21" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="49.2" fill={`url(#${uid}-chrome)`} />
        {/* Moleteado del aro, como el de una perilla real */}
        <g stroke="rgb(0 0 0 / 0.5)" strokeWidth="0.55">
          {KNURL.map((a) => (
            <line key={a} x1="50" y1="1.4" x2="50" y2="3.6" transform={`rotate(${a} 50 50)`} />
          ))}
        </g>
        <circle cx="50" cy="50" r="44.6" fill="#070b0f" />
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgb(34 211 238 / 0.14)" strokeWidth="2.2" />
        <motion.circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="var(--color-cyan)"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: reduce ? circ * 0.72 : circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: firing ? 0.55 : 0.6, ease: [0.16, 1, 0.3, 1] }}
          style={{ filter: 'drop-shadow(0 0 4px rgb(34 211 238 / 0.9))' }}
        />
      </svg>

      {/* Brillo que gira por el cromo */}
      <span className="pointer-events-none absolute inset-0 rounded-full animate-[spin_7s_linear_infinite] motion-reduce:hidden" style={SHEEN} aria-hidden="true" />

      {/* Cara del botón: se hunde al pulsar */}
      <span
        className={`absolute inset-[15.5%] flex flex-col items-center justify-center rounded-full bg-[radial-gradient(circle_at_50%_28%,#1a2b35,#070b0e_72%)] shadow-[inset_0_2px_6px_rgb(255_255_255/0.07),inset_0_-8px_16px_rgb(0_0_0/0.85),0_0_0_1px_rgb(0_0_0/0.6)] transition-transform duration-200 group-active:scale-[0.95] ${firing ? 'scale-[0.95]' : ''}`}
      >
        <span className={`mb-0.5 h-1 w-1 rounded-full transition-colors duration-300 ${firing ? 'bg-go shadow-[0_0_8px_rgb(52_211_153/0.9)]' : 'bg-cyan/40'}`} aria-hidden="true" />
        <span className="label-cluster text-[0.55rem] text-cyan-soft/70">Start · Stop</span>
        <span className={`font-display text-2xl leading-tight font-bold tracking-[0.08em] uppercase transition-[color,text-shadow] duration-300 ${firing || hover ? 'glow-text' : 'text-ice'}`}>{label}</span>
        <span className="label-cluster text-[0.6rem]">{sub}</span>
      </span>
    </button>
  );
}
