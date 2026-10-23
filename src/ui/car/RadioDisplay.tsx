import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { BookmarkCheck, BookmarkPlus, Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import type { Track } from '../../../shared/track';
import { Cover, WheelButton, formatTime } from '../controls';
import { DotMatrix } from '../kit';
import { LedBar } from '../music';
import { TtIcon } from '../Telltale';
import './car.css';

/*
 * Pantalla central del cuadro con alma de radio de carro: título en matriz de puntos (se
 * desplaza si no cabe), artista y quién la pidió. Al cambiar de canción «sintoniza»: un
 * barrido de luz y ruido de puntos cruzan la pantalla mientras el título se resuelve letra a
 * letra, y la portada gira como la cara de un cubo hacia la nueva.
 */

const TUNE_MS = 720;
const NOISE = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#*+=';

/** Título que se «sintoniza»: caracteres al azar que se van fijando de izquierda a derecha. */
function useTunedText(text: string, tuning: boolean): string {
  const [out, setOut] = useState(text);
  useEffect(() => {
    if (!tuning) {
      setOut(text);
      return;
    }
    const start = performance.now();
    let last = 0;
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / TUNE_MS);
      // Unas 22 actualizaciones por segundo bastan para el efecto y no re-renderizan cada fotograma.
      if (now - last > 45 || p === 1) {
        last = now;
        const reveal = Math.floor(p * text.length);
        let s = '';
        for (let i = 0; i < text.length; i++) s += i < reveal || text[i] === ' ' ? text[i] : NOISE[Math.floor(Math.random() * NOISE.length)];
        setOut(s);
      }
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, tuning]);
  return out;
}

export interface RadioDisplayProps {
  track: Track | null;
  isPlaying: boolean;
  position: number;
  duration: number;
  requestedBy?: string;
  favorite?: boolean;
  onToggle?: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  onFavorite?: () => void;
  /** Pantalla corta (APK en horizontal): portada y márgenes más pequeños. */
  compact?: boolean;
}

export function RadioDisplay({ track, isPlaying, position, duration, requestedBy, favorite = false, onToggle, onNext, onPrev, onFavorite, compact = false }: RadioDisplayProps) {
  const reduce = useReducedMotion();
  const [tuning, setTuning] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const lastId = useRef<string | null>(track?.id ?? null);
  const timer = useRef(0);
  const handleFav = () => {
    if (!onFavorite) return;
    onFavorite();
    setSavedToast(true);
    window.setTimeout(() => setSavedToast(false), 2000);
  };

  // El temporizador vive en una ref (no en la limpieza del efecto): si el efecto se repitiera
  // por otra causa con la misma canción, la sintonización se quedaría encendida para siempre.
  useEffect(() => {
    const id = track?.id ?? null;
    if (id === lastId.current) return;
    lastId.current = id;
    if (!id || reduce) return;
    setTuning(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setTuning(false), TUNE_MS);
  }, [track?.id, reduce]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const title = useTunedText((track?.title ?? '').toUpperCase(), tuning);
  const remaining = Math.max(0, duration - position);
  const auto = requestedBy === 'Piloto automático';
  const cover = compact ? 'h-[76px] w-[76px]' : 'h-24 w-24 @3xl:h-[112px] @3xl:w-[112px]';
  const half = compact ? 38 : 56;

  return (
    <div className={`lcd relative mx-auto flex w-full max-w-[440px] flex-col overflow-hidden rounded-[22px] ${compact ? 'gap-2 px-3 py-2.5' : 'gap-3.5 p-4'}`}>
      {savedToast && (
        <div className="absolute top-2 left-1/2 z-30 -translate-x-1/2 rounded-full border border-cyan/50 bg-[#07131b]/95 px-3.5 py-1 text-xs font-bold text-ice shadow-[0_0_15px_rgba(34,211,238,0.5)]">
          ⭐ ¡Guardada en Mi Música!
        </div>
      )}
      {/* Cabecera de la radio: estado y origen */}
      <div className="flex items-center gap-2">
        <span
          className={`h-1.5 w-1.5 rounded-full ${isPlaying && track ? 'bg-cyan shadow-[0_0_8px_rgb(34_211_238/0.95)]' : 'bg-faint'} ${isPlaying && track && !reduce ? 'animate-pulse' : ''}`}
          aria-hidden="true"
        />
        <p className="label-cluster text-[0.62rem] text-cyan-soft/85" aria-live="polite">
          {tuning ? 'Sintonizando…' : !track ? 'En espera' : isPlaying ? 'Sonando' : 'En pausa'}
        </p>
        {track?.source === 'local_car' && <span className="label-cluster ml-auto text-[0.58rem] text-amber">Del carro · sin datos</span>}
      </div>

      {track ? (
        <div className={`flex items-center ${compact ? 'gap-3' : 'gap-4'}`}>
          {/* Portada: cara de un cubo que gira hacia la nueva al cambiar de canción */}
          <div className={`relative shrink-0 [perspective:640px] ${cover}`}>
            <AnimatePresence initial={false} mode="popLayout">
              <motion.div
                key={track.id}
                className="absolute inset-0 [backface-visibility:hidden]"
                style={{ transformOrigin: `50% 50% -${half}px` }}
                initial={reduce ? false : { rotateY: 90, opacity: 0.3 }}
                animate={{ rotateY: 0, opacity: 1 }}
                exit={reduce ? { opacity: 0 } : { rotateY: -90, opacity: 0.3 }}
                transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
              >
                <Cover src={track.coverUrl} videoId={track.videoId} eager alt={`Portada de ${track.title}`} className="h-full w-full rounded-xl" />
                <div className="pointer-events-none absolute inset-0 rounded-xl bg-[linear-gradient(135deg,rgb(255_255_255/0.16),transparent_42%)] ring-1 ring-cyan/25 ring-inset" aria-hidden="true" />
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="sr-only">{track.title}</h2>
            <div aria-hidden="true">
              <DotMatrix className={`${compact ? 'text-[1.3rem]' : 'text-[1.6rem] @3xl:text-[1.75rem]'} leading-[1.1]`}>{title}</DotMatrix>
            </div>
            <p className={`truncate font-display font-semibold tracking-wide text-dim [font-stretch:86%] ${compact ? 'mt-0.5 text-[0.95rem]' : 'mt-1 text-lg'}`}>{track.artist}</p>
            {requestedBy && (
              <p className={`mt-1.5 inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-0.5 ${auto ? 'border-go/35 text-go' : 'border-cyan/30 text-cyan-soft'}`}>
                {auto && (
                  <span className="[&_svg]:h-3.5 [&_svg]:w-3.5" aria-hidden="true">
                    <TtIcon.Cruise />
                  </span>
                )}
                <span className="label-cluster truncate text-[0.6rem] text-current">{auto ? 'Piloto automático' : `Pidió ${requestedBy}`}</span>
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className={`text-center ${compact ? 'py-1' : 'py-4'}`}>
          <DotMatrix className={compact ? 'text-[1.6rem]' : 'text-[2.2rem]'}>LISTO</DotMatrix>
          <p className="mt-1.5 text-sm text-dim">Pide una canción desde un celular o búscala aquí.</p>
        </div>
      )}

      <div>
        <LedBar value={duration ? position / duration : 0} segments={compact ? 28 : 32} />
        <div className="readout mt-1 flex justify-between text-xs text-faint">
          <span>{formatTime(position)}</span>
          <span>-{formatTime(remaining)}</span>
        </div>
      </div>

      <div className={`flex items-center justify-center ${compact ? 'gap-3' : 'gap-4'}`}>
        {onFavorite && (
          <button
            type="button"
            onClick={handleFav}
            disabled={!track}
            aria-pressed={favorite}
            aria-label={favorite ? 'Quitar de Mi música' : 'Guardar en Mi música'}
            className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors disabled:opacity-30 ${favorite ? 'text-cyan' : 'text-faint hover:text-ice'}`}
          >
            {favorite ? <BookmarkCheck className="h-5 w-5" /> : <BookmarkPlus className="h-5 w-5" />}
          </button>
        )}
        <WheelButton label="Anterior" onClick={onPrev} disabled={!onPrev}>
          <SkipBack className="h-5 w-5" fill="currentColor" />
        </WheelButton>
        <WheelButton label={isPlaying ? 'Pausar' : 'Reproducir'} onClick={onToggle} big disabled={!onToggle || !track}>
          {isPlaying ? <Pause className="h-7 w-7" fill="currentColor" /> : <Play className="ml-1 h-7 w-7" fill="currentColor" />}
        </WheelButton>
        <WheelButton label="Siguiente" onClick={onNext} disabled={!onNext}>
          <SkipForward className="h-5 w-5" fill="currentColor" />
        </WheelButton>
        {onFavorite && <span className="h-10 w-10" aria-hidden="true" />}
      </div>

      {/* Sintonización: ruido de puntos y una banda de luz que cruza la pantalla */}
      {tuning && (
        <>
          <span className="mfd-tune-noise pointer-events-none absolute inset-0" aria-hidden="true" />
          <span className="mfd-tune-sweep pointer-events-none absolute inset-0" aria-hidden="true" />
        </>
      )}
    </div>
  );
}
