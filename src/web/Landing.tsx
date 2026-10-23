import { lazy, Suspense, useCallback, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { ArrowRight, Download, Loader2, Radar } from 'lucide-react';
import { normalizeRoomCode } from '../../shared/room-code';
import { CARBEAT_VERSION } from '../../shared/version';
import { relay } from '../core/room/relay-client';
import { getDisplayName, setDisplayName } from '../core/room/identity';
import { StartButton } from '../ui/StartButton';
import { Key } from '../ui/controls';
import { KineticTitle } from '../ui/kit';
import { Wordmark } from '../ui/Wordmark';
import { HEADLINE, HEADLINE_ACCENT, STEPS } from './landing/content';
import { ChapterCard, GearRail } from './landing/Story';
import { Specs } from './landing/Specs';
import './landing/landing.css';

const NightDrive = lazy(() => import('../ui/three/NightDrive'));

/** El 3D pesa cientos de kB: no se descarga con ahorro de datos ni en redes lentas. */
function canAfford3D(): boolean {
  const c = (navigator as unknown as { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (c?.saveData) return false;
  if (c?.effectiveType && ['slow-2g', '2g', '3g'].includes(c.effectiveType)) return false;
  return true;
}

/** Celular o tableta táctil: escena ligera (sin posprocesado, menos partículas). */
function isLite(): boolean {
  return window.matchMedia('(max-width: 767px), (pointer: coarse)').matches;
}

const STATIC_SKY = 'absolute inset-0 bg-[radial-gradient(120%_70%_at_50%_100%,#0b2a35,#020407_70%)]';
const EASE = [0.16, 1, 0.3, 1] as const;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/**
 * Progreso del scroll (0..1) → capítulo (0..3). Entre dos capítulos hay una meseta: la cámara
 * se detiene mientras su tarjeta está centrada y sólo viaja en el tramo intermedio.
 */
function toChapter(p: number, stops: number[]): number {
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    if (p <= b) {
      const span = b - a;
      const lo = a + span * 0.16;
      const hi = b - span * 0.16;
      return i + clamp01((p - lo) / Math.max(1e-6, hi - lo));
    }
  }
  return stops.length - 1;
}

/** Distancia vertical de un elemento a un ancestro posicionado (sin transformaciones). */
function offsetWithin(el: HTMLElement, ancestor: HTMLElement): number {
  let y = 0;
  let node: HTMLElement | null = el;
  while (node && node !== ancestor) {
    y += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return y;
}

export function Landing({ onHost, onJoin }: { onHost: () => void; onJoin: (room: string, name: string) => void }) {
  const [code, setCode] = useState('');
  const [name, setName] = useState(() => getDisplayName());
  const [error, setError] = useState<string | null>(null);
  const [nearby, setNearby] = useState<{ room: string; name: string }[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [show3D] = useState(canAfford3D);
  const [lite] = useState(isLite);
  const reduce = useReducedMotion();

  // ------------------------------------------------ historia guiada por el scroll
  const track = useRef<HTMLDivElement>(null);
  const cards = useRef<(HTMLElement | null)[]>([]);
  // Progreso en el que cada tarjeta queda en su sitio (se mide: depende del alto real).
  const stops = useRef<number[]>([0, 0.33, 0.66, 1]);
  const { scrollYProgress } = useScroll({ target: track, offset: ['start start', 'end end'] });
  const chapter = useTransform(scrollYProgress, (p) => toChapter(p, stops.current));
  // Oscurecer el lado del texto: izquierda en el héroe y en el capítulo 2, derecha en 1 y 3.
  const leftShade = useTransform(chapter, [0, 1, 2, 3], [1, 0, 1, 0]);
  const rightShade = useTransform(chapter, [0, 1, 2, 3], [0, 1, 0, 1]);
  // Funciones y no rangos: con rangos, motion lo acelera con ScrollTimeline nativo y con un
  // objetivo más alto que la pantalla calcula mal el tramo (el velo final salía opaco arriba).
  const endFade = useTransform(scrollYProgress, (p) => clamp01((p - 0.9) / 0.1));
  const cueOpacity = useTransform(scrollYProgress, (p) => 1 - clamp01(p / 0.05));
  // El selector de marchas aparece al empezar la historia (en el héroe chocaría con la consola).
  const railOpacity = useTransform(scrollYProgress, (p) => clamp01((p - 0.02) / 0.05) * (1 - clamp01((p - 0.96) / 0.04)));
  // Pasada la historia la escena queda tapada por el velo: se oculta y deja de dibujar.
  const [storyOn, setStoryOn] = useState(true);
  useMotionValueEvent(scrollYProgress, 'change', (p) => setStoryOn(p < 0.999));

  useLayoutEffect(() => {
    const el = track.current;
    if (!el) return;
    const measure = () => {
      const vh = window.innerHeight;
      const range = Math.max(1, el.offsetHeight - vh);
      // En el celular la tarjeta va abajo y la escena arriba: se detiene más alta en pantalla.
      const anchor = window.innerWidth < 768 ? 0.64 : 0.5;
      const s = [0];
      for (const c of cards.current) {
        if (!c) continue;
        const center = offsetWithin(c, el) + c.offsetHeight / 2;
        s.push(clamp01((center - anchor * vh) / range));
      }
      if (s.length === 4) stops.current = s;
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  const goTo = useCallback(
    (i: number) => {
      const el = track.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      const range = el.offsetHeight - window.innerHeight;
      window.scrollTo({ top: top + (stops.current[i] ?? 0) * range, behavior: reduce ? 'auto' : 'smooth' });
    },
    [reduce],
  );

  // ------------------------------------------------------------- subirse / encender
  const join = (raw: string, e?: FormEvent) => {
    e?.preventDefault();
    const room = normalizeRoomCode(raw);
    if (!room) {
      setError('Ese código no parece una placa de CarBeat (ejemplo: VIBE-7KQ3).');
      return;
    }
    setDisplayName(name);
    onJoin(room, name.trim() || 'Pasajero');
  };

  const scan = async () => {
    setScanning(true);
    setError(null);
    try {
      const r = await relay.nearby();
      setNearby(r.rooms);
    } catch {
      setNearby([]);
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="relative min-h-dvh bg-asphalt">
      {/* ================================================= historia (3D fijo detrás)
          fixed y no sticky: index.css pone overflow-x en body y eso anula sticky. Alto lvh
          constante para que el lienzo no cambie de tamaño al esconderse la barra del móvil. */}
      <div
        className="pointer-events-none fixed top-0 left-0 h-[100lvh] w-full overflow-hidden"
        style={{ visibility: storyOn ? 'visible' : 'hidden' }}
        aria-hidden="true"
      >
          {show3D ? (
            <Suspense fallback={<div className={STATIC_SKY} />}>
              <NightDrive className="absolute inset-0" chapter={chapter} lite={lite} active={storyOn} />
            </Suspense>
          ) : (
            <div className={STATIC_SKY} />
          )}
          {/* Legibilidad: arriba para la cabecera, y el lado donde va el texto */}
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgb(2_4_7/0.72),rgb(2_4_7/0.08)_30%,transparent_62%,rgb(2_4_7/0.35))]" />
          <motion.div
            className="pointer-events-none absolute inset-y-0 left-0 hidden w-[58%] bg-[linear-gradient(90deg,rgb(2_4_7/0.72),rgb(2_4_7/0.3)_55%,transparent)] md:block"
            style={{ opacity: leftShade }}
          />
          <motion.div
            className="pointer-events-none absolute inset-y-0 right-0 hidden w-[58%] bg-[linear-gradient(270deg,rgb(2_4_7/0.72),rgb(2_4_7/0.3)_55%,transparent)] md:block"
            style={{ opacity: rightShade }}
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%] bg-[linear-gradient(0deg,rgb(2_4_7/0.85),transparent)] md:hidden" />
          {/* Al terminar la historia la escena se funde con la ficha técnica */}
          <motion.div className="pointer-events-none absolute inset-0 bg-asphalt" style={{ opacity: endFade }} />
      </div>

      <div ref={track} className="relative z-10">
        <div>
          {/* ---------------------------------------------------------- héroe */}
          <section className="relative flex min-h-[100svh] flex-col" aria-labelledby="titular">
            <header className="safe-pad flex items-center justify-between px-5 pt-5 sm:px-10 sm:pt-7">
              <Wordmark />
              <a
                href="/downloads/carbeat-latest.apk"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-4 py-2 font-display text-sm font-semibold tracking-wide text-dim backdrop-blur-sm transition-colors hover:border-cyan/40 hover:text-ice"
              >
                <Download className="h-4 w-4" aria-hidden="true" /> App Android
              </a>
            </header>

            <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col justify-between gap-10 px-5 pt-8 pb-10 sm:px-10 lg:flex-row lg:items-end lg:pb-16">
              <div className="max-w-[44rem] lg:self-start lg:pt-[3vh]">
                <motion.p
                  initial={reduce ? false : { opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 1, delay: 0.1, ease: EASE }}
                  className="label-cluster mb-5 flex items-center gap-3 text-cyan-soft"
                >
                  <span className="h-px w-8 bg-cyan/70 shadow-[0_0_8px_rgb(34_211_238/0.9)]" aria-hidden="true" />
                  Rocola colaborativa para viajes en carro
                </motion.p>
                <div id="titular">
                  <KineticTitle words={HEADLINE} accentFrom={HEADLINE_ACCENT} className="text-[clamp(2.15rem,5.3vw,5.1rem)] text-ink" />
                </div>
                <motion.p
                  initial={reduce ? false : { opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.9, delay: 0.95, ease: EASE }}
                  className="mt-6 max-w-md text-lg leading-relaxed text-ink/80"
                >
                  El carro pone los parlantes. Los pasajeros piden y votan desde su celular, sin instalar nada.
                </motion.p>
              </div>

              {/* Consola central. En el DOM (y en el celular) primero subirse: la mayoría son pasajeros. */}
              <motion.div
                initial={reduce ? false : { opacity: 0, y: 34, rotateX: 10 }}
                animate={{ opacity: 1, y: 0, rotateX: 0 }}
                transition={{ duration: 1.1, delay: 0.65, ease: EASE }}
                style={{ transformPerspective: 1000 }}
                // Sin grano en modo ligero: su mezcla "overlay" sobre un lienzo animado obliga a
                // recomponer cada fotograma (medido: unos 5 FPS menos en 390×844).
                className={`dash-panel ${lite ? '' : 'grain'} ambient-sweep relative w-full max-w-[580px] rounded-[30px] p-5 sm:p-6 lg:shrink-0`}
              >
                <div className="flex flex-col gap-6 sm:flex-row-reverse sm:items-stretch">
                  <form onSubmit={(e) => join(code, e)} className="flex w-full flex-1 flex-col gap-3" noValidate aria-labelledby="subirme">
                    <p id="subirme" className="label-cluster flex items-center gap-2 text-ink/80">
                      <span className="h-1.5 w-1.5 rounded-full bg-cyan shadow-[0_0_8px_rgb(34_211_238/0.9)]" aria-hidden="true" />
                      Subirme como pasajero
                    </p>
                    <label className="relative block">
                      <span className="sr-only">Placa de la sala</span>
                      {/* Tornillos de la placa */}
                      <span className="pointer-events-none absolute top-1/2 left-2.5 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-cyan/30" aria-hidden="true" />
                      <span className="pointer-events-none absolute top-1/2 right-2.5 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-cyan/30" aria-hidden="true" />
                      <input
                        value={code}
                        onChange={(e) => {
                          setCode(e.target.value.toUpperCase());
                          setError(null);
                        }}
                        placeholder="VIBE-7KQ3"
                        autoComplete="off"
                        autoCapitalize="characters"
                        spellCheck={false}
                        maxLength={11}
                        className="plate-input readout h-16 w-full rounded-xl border border-cyan/40 text-center text-[1.95rem] font-bold tracking-[0.14em] text-ice [text-shadow:0_0_14px_rgb(34_211_238/0.55)] placeholder:text-cyan/20 placeholder:[text-shadow:none] focus:border-cyan focus:outline-none"
                        aria-invalid={!!error}
                        aria-describedby={error ? 'join-error' : 'placa-ayuda'}
                      />
                    </label>
                    <span id="placa-ayuda" className="sr-only">
                      El código aparece en la pantalla del carro, por ejemplo VIBE-7KQ3.
                    </span>
                    <label className="block">
                      <span className="sr-only">Tu nombre</span>
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Tu nombre (opcional)"
                        maxLength={32}
                        autoComplete="nickname"
                        className="lcd h-11 w-full rounded-xl px-3 text-ink placeholder:text-faint focus:border-cyan/50 focus:outline-none"
                      />
                    </label>
                    {error && (
                      <p id="join-error" role="alert" className="text-sm text-amber">
                        {error}
                      </p>
                    )}
                    <Key type="submit" variant="primary" size="md" className="group w-full">
                      Subirme <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
                    </Key>
                    <button type="button" onClick={scan} className="inline-flex min-h-11 items-center justify-center gap-2 py-2 text-sm text-dim transition-colors hover:text-ice">
                      {scanning ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Radar className="h-4 w-4" aria-hidden="true" />}
                      Buscar carros en esta red
                    </button>
                    {nearby && (
                      <ul className="flex flex-col gap-1.5" aria-label="Carros en esta red">
                        {nearby.length === 0 && <li className="text-center text-sm text-faint">Ninguno. Pide la placa al conductor o escanea su QR.</li>}
                        {nearby.map((r) => (
                          <li key={r.room}>
                            <button
                              type="button"
                              onClick={() => join(r.room)}
                              className="flex w-full items-center justify-between rounded-lg border border-white/8 px-3 py-2 text-left transition-colors hover:border-cyan/40"
                            >
                              <span className="text-sm text-ink">{r.name}</span>
                              <span className="readout text-sm font-bold tracking-widest text-cyan">{r.room}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </form>

                  <div className="flex items-center gap-3 sm:flex-col sm:justify-center" aria-hidden="true">
                    <span className="h-px flex-1 bg-[linear-gradient(90deg,transparent,rgb(255_255_255/0.12))] sm:h-auto sm:w-px sm:bg-[linear-gradient(180deg,transparent,rgb(255_255_255/0.12))]" />
                    <span className="label-cluster rounded-full border border-white/10 px-2 py-1 text-[0.6rem] text-faint">o</span>
                    <span className="h-px flex-1 bg-[linear-gradient(270deg,transparent,rgb(255_255_255/0.12))] sm:h-auto sm:w-px sm:bg-[linear-gradient(0deg,transparent,rgb(255_255_255/0.12))]" />
                  </div>

                  <div className="flex flex-col items-center gap-3 sm:w-[42%]">
                    <StartButton onStart={onHost} label="Encender" sub="el carro" size={156} />
                    <p className="max-w-[210px] text-center text-xs leading-relaxed text-faint">
                      Esta pantalla será el reproductor: la que va conectada a los parlantes.
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>

            <motion.button
              type="button"
              onClick={() => goTo(1)}
              style={{ opacity: cueOpacity }}
              className="mx-auto mb-6 hidden flex-col items-center gap-3 text-faint transition-colors hover:text-ice md:flex"
            >
              <span className="label-cluster">Cómo funciona</span>
              <span className="scroll-rail" aria-hidden="true" />
            </motion.button>
          </section>

          {/* ------------------------------------------------- capítulos de la historia */}
          <h2 className="sr-only">Cómo funciona</h2>
          {STEPS.map((s, i) => (
            <section
              key={s.n}
              className={`relative flex min-h-[150vh] items-center px-5 sm:px-10 lg:pl-28 ${i === 1 ? 'justify-start lg:pr-28' : 'justify-end lg:pr-52'} max-md:justify-center`}
            >
              <ChapterCard
                ref={(el) => {
                  cards.current[i] = el;
                }}
                step={s}
                index={i + 1}
                total={STEPS.length}
                chapter={chapter}
              />
            </section>
          ))}
        </div>
      </div>

      <GearRail steps={STEPS} chapter={chapter} opacity={railOpacity} onGo={goTo} />

      {/* ====================================================== ficha técnica */}
      <div className="relative z-10 bg-asphalt">
      <Specs />

      <footer className="border-t border-white/[0.05] px-5 py-8 sm:px-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 text-center text-sm text-faint sm:flex-row sm:text-left">
          <Wordmark compact />
          <span>
            CarBeat v{CARBEAT_VERSION} · creado por Brayan Stid Cortés Lombana
          </span>
        </div>
      </footer>
      </div>
    </div>
  );
}
