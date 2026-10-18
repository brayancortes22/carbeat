import { memo, useMemo, useRef } from 'react';
import { Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import type { Snapshot } from '../../shared/protocol';
import type { Track } from '../../shared/track';
import type { RiderSession, RiderStatus, RiderView } from '../core/room/rider-session';
import { useTicker } from '../hooks';
import { DotMatrix } from './kit';
import { WheelButton, formatTime } from './controls';
import { Tag, keyOf, type PickState } from './music';
import { CoverDial, LiveOdometer } from './rider/CoverDial';
import { useInView } from './rider/useInView';

/*
 * Piezas de la pantalla del pasajero, compartidas por la web y el APK.
 */

const STATUS: Record<RiderStatus, { text: string; tone: string; dot: string }> = {
  connecting: { text: 'Buscando el carro…', tone: 'text-amber', dot: 'bg-amber animate-[telltale-blink_1.1s_steps(1)_infinite]' },
  live: { text: 'En vivo', tone: 'text-go', dot: 'bg-go shadow-[0_0_8px_rgb(52_211_153/0.9)]' },
  reconnecting: { text: 'Reconectando…', tone: 'text-amber', dot: 'bg-amber animate-[telltale-blink_1.1s_steps(1)_infinite]' },
  'not-found': { text: 'Carro no encontrado', tone: 'text-danger', dot: 'bg-danger' },
  closed: { text: 'Sala cerrada', tone: 'text-danger', dot: 'bg-danger' },
};

const VIA: Record<string, string> = { p2p: 'directo', lan: 'red local', local: 'esta pantalla', http: 'por internet' };

/** Testigo de conexión: lámpara + texto, como los del cuadro. */
export function StatusChip({ view }: { view: RiderView }) {
  const s = STATUS[view.status];
  return (
    <span
      className={`inline-flex min-w-0 items-center gap-2 rounded-full border border-white/[0.07] bg-[linear-gradient(180deg,#0d1318,#070a0d)] px-3 py-1 font-display text-sm font-semibold tracking-wide shadow-[inset_0_1px_0_rgb(255_255_255/0.05)] ${s.tone}`}
      role="status"
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${s.dot}`} aria-hidden="true" />
      <span className="truncate">
        {s.text}
        {view.status === 'live' && view.via && <span className="text-faint"> · {VIA[view.via]}</span>}
      </span>
    </span>
  );
}

/** Compatibilidad: portada dentro del arco (ahora es el dial con disco 3D). */
export function CoverGauge({ track, progress, size = 104 }: { track: Track; progress: number; size?: number }) {
  const duration = track.duration || 0;
  return <CoverDial track={track} position={progress * duration} duration={duration} playing size={size} />;
}

/** Título en la pantalla del radio: matriz de puntos que se desplaza si no cabe. */
export const RadioTitle = memo(function RadioTitle({ title, big = false, as: Heading = 'h2' }: { title: string; big?: boolean; as?: 'h1' | 'h2' }) {
  return (
    <div className={`lcd lcd-grid relative w-full overflow-hidden ${big ? 'rounded-2xl px-4 py-3' : 'rounded-xl px-3 py-2'}`}>
      {/* Reflejo del cristal del radio */}
      <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-[linear-gradient(180deg,rgb(255_255_255/0.05),transparent)]" aria-hidden="true" />
      <Heading className="relative">
        <DotMatrix className={`uppercase ${big ? 'text-[1.7rem] leading-[1.25]' : 'text-[1.28rem] leading-[1.25]'}`}>{title}</DotMatrix>
      </Heading>
    </div>
  );
});

/** Lámpara "suena / pausa": verde fijo sonando, ámbar intermitente en pausa. Sólo estado real. */
export function PlayLamp({ playing }: { playing: boolean }) {
  return (
    <span
      className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${playing ? 'bg-go shadow-[0_0_8px_rgb(52_211_153/0.95)]' : 'bg-amber animate-[telltale-blink_1.1s_steps(1)_infinite]'}`}
      aria-hidden="true"
    />
  );
}

/**
 * Posición extrapolada de la canción (se recalcula cada medio segundo mientras suena y
 * `active`: fuera de pantalla no hace falta repintar nada).
 */
export function usePosition(view: RiderView, session: RiderSession, active = true) {
  const now = view.snapshot?.now ?? null;
  const tick = useTicker(500, !!now?.isPlaying && active);
  return useMemo(() => session.position(), [session, tick, view.snapshot]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** Memorizado: no depende del avance de la canción, así que no se repinta cada medio segundo. */
export const Transport = memo(function Transport({ view, session, onTap }: { view: RiderView; session: RiderSession; onTap?: () => void }) {
  const now = view.snapshot?.now;
  if (!now || !view.snapshot?.settings.passengerControl) return null;
  const go = (a: 'prev' | 'toggle' | 'next') => () => {
    onTap?.();
    void session.control(a);
  };
  return (
    <div className="flex items-center justify-center gap-5">
      <WheelButton label="Anterior" onClick={go('prev')}>
        <SkipBack className="h-5 w-5" fill="currentColor" />
      </WheelButton>
      <WheelButton label={now.isPlaying ? 'Pausar' : 'Reproducir'} big onClick={go('toggle')}>
        {now.isPlaying ? <Pause className="h-7 w-7" fill="currentColor" /> : <Play className="ml-1 h-7 w-7" fill="currentColor" />}
      </WheelButton>
      <WheelButton label="Siguiente" onClick={go('next')}>
        <SkipForward className="h-5 w-5" fill="currentColor" />
      </WheelButton>
    </div>
  );
});

/** "Lo que suena" compacto de la web: dial a la izquierda, datos a la derecha, radio debajo. */
export function NowPlayingCard({ view, session }: { view: RiderView; session: RiderSession }) {
  const now = view.snapshot?.now ?? null;
  const box = useRef<HTMLElement>(null);
  // Al bajar a los resultados, el dial queda fuera de la vista: deja de repintarse (medido: con
  // la CPU frenada ×4 cada repintado eran ~55-65 ms, uno cada medio segundo durante el scroll).
  const visible = useInView(box);
  const position = usePosition(view, session, visible);

  return (
    <section ref={box} className="dash-panel grain relative overflow-hidden rounded-[24px] p-4" aria-label="Sonando en el carro">
      {/* Luz de instrumento que baña el panel desde el dial */}
      <span className="pointer-events-none absolute -top-16 -left-16 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgb(34_211_238/0.13),transparent_65%)]" aria-hidden="true" />
      <div className="relative flex items-center gap-4">
        <CoverDial track={now?.track ?? null} position={position} duration={now?.duration ?? 0} playing={!!now?.isPlaying} size={138} />
        <div className="min-w-0 flex-1">
          <p className="label-cluster flex items-center gap-2 text-cyan-soft/85">
            {now ? (
              <>
                <PlayLamp playing={now.isPlaying} /> {now.isPlaying ? 'Sonando en el carro' : 'En pausa'}
              </>
            ) : (
              'Cabina en silencio'
            )}
          </p>
          {now ? (
            <>
              <p className="mt-1.5 truncate text-[1.05rem] leading-tight font-semibold text-ink">{now.track.artist}</p>
              <p className="readout mt-1.5 flex items-baseline gap-1.5 leading-none">
                {/* Brillo con drop-shadow y no text-shadow: cada cifra del odómetro recorta su
                    propia caja y el text-shadow salía cortado en rectángulos. */}
                <span className="text-[1.7rem] font-bold text-ice [filter:drop-shadow(0_0_7px_rgb(34_211_238/0.6))]">
                  <LiveOdometer value={formatTime(position)} />
                </span>
                <span className="text-sm text-faint">/ {formatTime(now.duration)}</span>
              </p>
              {now.requestedBy && (
                <div className="mt-2">
                  <Tag tone={now.requestedBy === 'Piloto automático' ? 'go' : 'cyan'}>{now.requestedBy}</Tag>
                </div>
              )}
            </>
          ) : (
            <p className="mt-1.5 text-sm text-dim">Pide la primera canción: sonará al instante.</p>
          )}
        </div>
      </div>
      <div className="relative mt-3">
        <RadioTitle title={now ? now.track.title : 'Silencio en la cabina'} />
      </div>
      {now && (
        <div className="relative mt-3">
          <Transport view={view} session={session} />
        </div>
      )}
    </section>
  );
}

/** Estado del botón "Pedir" de una pista según la última foto. */
export function pickStateFor(view: RiderView, snapshot: Snapshot | null) {
  const pending = new Set(view.pending);
  const inRoom = new Set([...(snapshot?.queue.map((e) => keyOf(e.track)) ?? []), ...(snapshot?.now ? [keyOf(snapshot.now.track)] : [])]);
  return (t: Track): PickState => {
    const k = keyOf(t);
    if (inRoom.has(k)) return 'done';
    if (pending.has(k)) return 'sending';
    return 'idle';
  };
}

export const carTrack = (i: { id: string; title: string; artist: string; duration: number }): Track => ({
  id: i.id,
  title: i.title,
  artist: i.artist,
  duration: i.duration,
  source: 'local_car',
  audioUrl: '',
});
