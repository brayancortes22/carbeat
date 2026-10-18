import type { CSSProperties, ReactNode } from 'react';
import './rider.css';

/*
 * Pantalla de radar: haz cónico que barre, anillos de distancia y ecos que se encienden justo
 * cuando el haz pasa por ellos y se apagan despacio, como el fósforo de un radar.
 *
 * Los ecos se sincronizan sin JavaScript: haz y eco comparten periodo y el eco empieza con un
 * retraso de (ángulo / 360) × periodo, que es cuando el haz llega a su ángulo.
 */

export type Blip = { angle: number; radius: number };

const TONES = {
  cyan: { ring: 'rgb(34 211 238 / 0.22)', cross: 'rgb(34 211 238 / 0.12)', face: 'radial-gradient(circle at 50% 45%, #0c2129, #060d11 62%, #03070a)', core: '#67e8f9' },
  danger: { ring: 'rgb(255 69 58 / 0.28)', cross: 'rgb(255 69 58 / 0.14)', face: 'radial-gradient(circle at 50% 45%, #251010, #110707 62%, #070303)', core: '#ff453a' },
} as const;

export function Radar({
  size,
  tone = 'cyan',
  sweeping = true,
  period = 3,
  blips = [],
  pings = false,
  children,
  className = '',
}: {
  size: number;
  tone?: keyof typeof TONES;
  sweeping?: boolean;
  /** Segundos por vuelta del haz. */
  period?: number;
  blips?: Blip[];
  /** Ondas de sonar saliendo del centro. */
  pings?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  const t = TONES[tone];
  return (
    <span
      className={`relative block shrink-0 rounded-full ${className}`}
      style={{ width: size, height: size, '--radar-period': `${period}s` } as CSSProperties}
      aria-hidden={children ? undefined : true}
    >
      {/* Bisel metálico */}
      <span className="bezel absolute inset-0 rounded-full shadow-[0_18px_40px_-14px_rgb(0_0_0/0.95)]" aria-hidden="true" />
      <span className="absolute inset-[4px] overflow-hidden rounded-full" style={{ background: t.face, boxShadow: 'inset 0 0 0 1px rgb(0 0 0 / 0.8), inset 0 6px 24px rgb(0 0 0 / 0.7)' }} aria-hidden="true">
        {/* Anillos de distancia y cruz */}
        {[0.25, 0.5, 0.75].map((r) => (
          <span key={r} className="absolute rounded-full" style={{ inset: `${(1 - r) * 50}%`, border: `1px solid ${t.ring}` }} />
        ))}
        <span className="absolute inset-y-0 left-1/2 w-px" style={{ background: t.cross }} />
        <span className="absolute inset-x-0 top-1/2 h-px" style={{ background: t.cross }} />
        {/* Marcas de rumbo cada 30° en el borde */}
        {Array.from({ length: 12 }, (_, i) => (
          <span key={i} className="absolute top-0 left-1/2 h-1/2 w-px origin-bottom" style={{ transform: `translateX(-50%) rotate(${i * 30}deg)` }}>
            <span className="block h-[5%] w-px" style={{ background: t.ring }} />
          </span>
        ))}
        {sweeping && <span className="radar-beam" data-tone={tone} />}
        {pings && [0, 0.8, 1.6].map((d) => <span key={d} className="radar-ping" style={{ animationDelay: `${d}s`, borderColor: t.ring }} />)}
        {blips.map((b, i) => {
          const a = (b.angle * Math.PI) / 180;
          return (
            <span
              key={i}
              className="radar-blip"
              style={{
                left: `${50 + Math.sin(a) * b.radius * 50}%`,
                top: `${50 - Math.cos(a) * b.radius * 50}%`,
                animationDelay: `${((((b.angle % 360) + 360) % 360) / 360) * period}s`,
                animationPlayState: sweeping ? 'running' : 'paused',
              }}
            />
          );
        })}
        {/* Reflejo del cristal */}
        <span className="absolute inset-0 rounded-full bg-[linear-gradient(160deg,rgb(255_255_255/0.1),transparent_38%)]" />
      </span>
      {children && <span className="absolute inset-0 flex flex-col items-center justify-center">{children}</span>}
      {!children && <span className="absolute top-1/2 left-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: t.core, boxShadow: `0 0 12px ${t.core}` }} aria-hidden="true" />}
    </span>
  );
}

/** Ángulo y distancia estables a partir de un texto (p. ej. la placa): el mismo carro sale
 * siempre en el mismo punto del radar. No indica distancia real. */
export function blipFor(text: string): Blip {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const u = (h >>> 0) / 4294967295;
  return { angle: Math.round(u * 360), radius: 0.42 + ((h >>> 8) % 100) / 300 };
}
