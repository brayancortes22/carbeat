import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { CARBEAT_VERSION } from '../../shared/version';
import { KineticTitle } from '../ui/kit';
import { MiniGauge, PhonePulse, RoadFloor } from '../ui/rider/OnboardingArt';
import { TouchTilt } from '../ui/rider/TouchTilt';
import { Wordmark } from '../ui/Wordmark';
import { native } from './native';
import type { Role } from './AppRoot';

const OPTIONS: { role: Role; title: string; body: string; art: ReactNode; cta: string; key: string }[] = [
  {
    role: 'car',
    title: 'Soy la pantalla del carro',
    body: 'La tablet o el celular conectado a los parlantes. Pone la música y muestra el QR.',
    art: <MiniGauge />,
    cta: 'Modo carro',
    key: 'A',
  },
  {
    role: 'rider',
    title: 'Soy un pasajero',
    body: 'Escaneo el QR del carro, pido canciones y voto desde aquí.',
    art: <PhonePulse />,
    cta: 'Modo pasajero',
    key: 'B',
  },
];

/**
 * Primera vez que se abre la app: ¿qué es este dispositivo? Se puede cambiar luego.
 * Las dos tarjetas están apoyadas en perspectiva, como piezas del salpicadero; se inclinan bajo
 * el dedo y su ilustración flota por delante (translateZ) para que el 3D se note al moverlas.
 */
export function Onboarding({ onChoose }: { onChoose: (r: Role) => void }) {
  const reduce = useReducedMotion();
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-[radial-gradient(120%_60%_at_50%_0%,#0d2632,transparent_65%)] px-5 pt-[calc(var(--sat)+24px)] pb-[calc(var(--sab)+20px)]">
      <RoadFloor />
      <div className="relative flex items-center justify-between">
        <Wordmark />
        <span className="label-cluster text-[0.62rem] text-faint">v{CARBEAT_VERSION}</span>
      </div>
      <KineticTitle words={['¿Qué', 'es', 'este', 'dispositivo?']} accentFrom={2} className="relative mt-9 text-[clamp(2rem,9.4vw,3.4rem)]" />
      <motion.p
        className="relative mt-3 text-dim"
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.6 }}
      >
        Lo puedes cambiar cuando quieras desde los ajustes.
      </motion.p>

      <div className="relative mt-7 grid content-start gap-4 sm:grid-cols-2" style={{ perspective: 1100 }}>
        {OPTIONS.map((o, i) => (
          <motion.div
            key={o.role}
            initial={reduce ? false : { opacity: 0, rotateX: 55, y: 60, scale: 0.92 }}
            animate={{ opacity: 1, rotateX: 0, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 120, damping: 16, delay: 0.35 + i * 0.12 }}
            style={{ transformOrigin: '50% 100%' }}
          >
            {/* El botón va dentro de la inclinación (un <div> dentro de <button> no es HTML válido). */}
            <TouchTilt max={9} baseX={7} radius="26px">
              {/* Fondo aparte: overflow-hidden aplana el 3D, así que el contenido va en una capa
                  hermana con preserve-3d para que la ilustración pueda flotar por delante. */}
              <span className="dash-panel grain absolute inset-0 overflow-hidden rounded-[26px]" aria-hidden="true">
                <span className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-cyan/60 to-transparent" />
              </span>
              <button
                type="button"
                onClick={() => {
                  void native.haptic('success');
                  onChoose(o.role);
                }}
                className="group relative flex w-full items-center gap-4 rounded-[26px] p-5 text-left focus-visible:outline-offset-4"
                style={{ transformStyle: 'preserve-3d' }}
              >
                <span className="relative h-[92px] w-[92px] shrink-0" style={{ transform: 'translateZ(34px)' }} aria-hidden="true">
                  {o.art}
                </span>
                <span className="relative min-w-0 flex-1" style={{ transform: 'translateZ(18px)' }}>
                  <span className="dotmatrix mb-1 block text-xs opacity-70" aria-hidden="true">
                    MODO {o.key}
                  </span>
                  <span className="type-wide block text-[1.32rem] leading-[1.02] text-ink">{o.title}</span>
                  <span className="mt-1.5 block text-[0.92rem] leading-snug text-dim">{o.body}</span>
                  <span className="label-cluster mt-3 inline-flex items-center gap-1.5 text-cyan-soft transition-[gap] group-hover:gap-2.5">
                    {o.cta} <span aria-hidden="true">→</span>
                  </span>
                </span>
              </button>
            </TouchTilt>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
