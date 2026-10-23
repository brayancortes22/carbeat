import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check, Loader2, Play, Search, X } from 'lucide-react';
import { scoreOf, type LibraryItem, type QueueEntry } from '../../shared/protocol';
import { trackKey, type Track } from '../../shared/track';
import { GENRE_SHORTCUTS, searchMusic } from '../core/search';
import { useDebounced, useLatest } from '../hooks';
import { Cover, Key, Rocker, formatTime } from './controls';
import { PresetKeys } from './rider/PresetKeys';
import { TtIcon } from './Telltale';
import './rider/rider.css';

// --------------------------------------------------------- barra de LEDs

/** Progreso como una fila de LEDs del cuadro: se lee de un vistazo, como el nivel de gasolina. */
export function LedBar({ value, segments = 32, className = '' }: { value: number; segments?: number; className?: string }) {
  const lit = Math.round(Math.max(0, Math.min(1, value)) * segments);
  return (
    <div className={`flex h-2 gap-[3px] ${className}`} aria-hidden="true">
      {Array.from({ length: segments }, (_, i) => (
        <span
          key={i}
          className={`flex-1 rounded-[1px] transition-colors duration-300 ${
            i < lit ? 'bg-cyan shadow-[0_0_6px_rgb(34_211_238/0.8)]' : 'bg-cyan/10'
          }`}
        />
      ))}
    </div>
  );
}

// ------------------------------------------------------------- fila de pista

export function TrackRow({
  title,
  artist,
  cover,
  duration,
  index,
  meta,
  action,
  highlight = false,
}: {
  title: string;
  artist: string;
  cover?: string;
  duration?: number;
  index?: number;
  meta?: ReactNode;
  action?: ReactNode;
  /** Fila con luz ambiente (la canción que pediste tú). */
  highlight?: boolean;
}) {
  return (
    <div
      className={`relative flex items-center gap-3 rounded-xl px-2 py-2 transition-colors ${
        highlight
          ? 'bg-[radial-gradient(130%_160%_at_0%_50%,rgb(34_211_238/0.16),rgb(34_211_238/0.03)_55%,transparent_80%)] shadow-[inset_0_0_0_1px_rgb(34_211_238/0.28),0_0_26px_-12px_rgb(34_211_238/0.9)]'
          : 'hover:bg-white/[0.025]'
      }`}
    >
      {/* Tira de luz ambiente: respira despacio, como la de la puerta de un carro */}
      {highlight && <span className="mine-strip absolute top-2.5 bottom-2.5 left-0 w-[3px] rounded-full bg-cyan-soft shadow-[0_0_10px_2px_rgb(34_211_238/0.85)]" aria-hidden="true" />}
      {/* Número de pista como en la pantalla del radio; la siguiente en sonar, encendida */}
      {index !== undefined && (
        <span className={`dotmatrix w-6 shrink-0 text-center text-[0.95rem] leading-none ${index === 1 ? '' : 'opacity-55 [text-shadow:none]'}`}>{String(index).padStart(2, '0')}</span>
      )}
      {/* data-cover: de aquí sale la portada que "vuela" a la cola al pedir */}
      <span data-cover className="flex shrink-0 overflow-hidden rounded-lg shadow-[0_4px_10px_-4px_rgb(0_0_0/0.9),0_0_0_1px_rgb(255_255_255/0.06)]">
        <Cover src={cover} alt="" className="h-11 w-11" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[0.95rem] leading-tight font-semibold break-words text-ink">{title}</p>
        <p className="mt-0.5 flex min-w-0 items-center gap-2 truncate text-sm text-dim">
          <span className="truncate">{artist}</span>
          {duration ? <span className="readout shrink-0 text-faint">{formatTime(duration)}</span> : null}
        </p>
        {meta && <div className="mt-1 flex flex-wrap items-center gap-1.5">{meta}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function Tag({ children, tone = 'dim' }: { children: ReactNode; tone?: 'dim' | 'cyan' | 'amber' | 'go' }) {
  const tones = {
    dim: 'text-dim border-white/10',
    cyan: 'text-cyan-soft border-cyan/30',
    amber: 'text-amber border-amber/30',
    go: 'text-go border-go/30',
  };
  return <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-px font-display text-[0.65rem] font-semibold tracking-[0.12em] uppercase ${tones[tone]}`}>{children}</span>;
}

// ------------------------------------------------------------------ cola

/**
 * Qué filas han adelantado puestos desde la última foto. Se compara el orden relativo de las
 * que siguen en la cola: si la primera pasa a sonar, el resto "sube" un puesto pero no ha
 * adelantado a nadie, y eso no debe destellar.
 */
function useRisen(queue: QueueEntry[]) {
  const prev = useRef<string[]>([]);
  const version = useRef(0);
  const risen = useMemo(() => {
    const now = queue.map((e) => e.queueId);
    const both = new Set(now.filter((id) => prev.current.includes(id)));
    const before = prev.current.filter((id) => both.has(id));
    const after = now.filter((id) => both.has(id));
    const out = new Set<string>();
    after.forEach((id, i) => {
      if (i < before.indexOf(id)) out.add(id);
    });
    if (out.size) version.current += 1;
    return out;
  }, [queue]);
  useEffect(() => {
    prev.current = queue.map((e) => e.queueId);
  }, [queue]);
  return { risen, version: version.current };
}

export function QueueList({
  queue,
  me,
  onVote,
  onPlayNow,
  hostActions,
  empty,
}: {
  queue: QueueEntry[];
  me?: string;
  onVote?: (queueId: string, value: -1 | 0 | 1) => void;
  /** Pasajeros: «Sonar ya» de una canción de la cola (sólo si el carro lo permite). */
  onPlayNow?: (queueId: string) => void;
  hostActions?: (entry: QueueEntry) => ReactNode;
  empty: ReactNode;
}) {
  const reduce = useReducedMotion();
  // Sólo la primera vez las filas entran en cascada; las que llegan después entran solas.
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
  }, []);
  const { risen, version } = useRisen(queue);

  if (!queue.length) return <div className="px-2 py-10 text-center">{empty}</div>;
  return (
    <ol className="relative flex flex-col gap-1" aria-label="Cola de canciones" style={{ perspective: 900 }}>
      {/* popLayout: la fila que sale (pasó a sonar) deja el hueco al instante y las demás suben
          animadas. Sin él, la fila invisible ocupaba sitio hasta acabar su animación; en una
          pestaña en segundo plano (sin requestAnimationFrame) el hueco se quedaba (visto en captura). */}
      <AnimatePresence mode="popLayout">
        {queue.map((e, i) => {
          const mine = me ? ((e.votes[me] ?? 0) as -1 | 0 | 1) : 0;
          const isMine = !!me && e.requestedById === me;
          return (
            <motion.li
              key={e.queueId}
              layout={!reduce}
              className="relative rounded-xl"
              initial={reduce ? false : { opacity: 0, y: 22, scale: 0.94, rotateX: -28 }}
              animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -16, scale: 0.92, transition: { duration: 0.22 } }}
              transition={{
                type: 'spring',
                stiffness: 330,
                damping: 24,
                delay: mounted.current ? 0 : Math.min(i, 10) * 0.05,
                layout: { type: 'spring', stiffness: 420, damping: 34 },
              }}
            >
              {risen.has(e.queueId) && <span key={version} className="row-rise pointer-events-none absolute inset-0 rounded-xl" aria-hidden="true" />}
              <TrackRow
                index={i + 1}
                title={e.track.title}
                artist={e.track.artist}
                cover={e.track.coverUrl}
                duration={e.track.duration}
                highlight={isMine}
                meta={
                  <>
                    {e.autopilot ? (
                      <Tag tone="go">
                        <span className="h-3 w-3 [&_svg]:h-3 [&_svg]:w-3">
                          <TtIcon.Cruise />
                        </span>
                        Piloto automático
                      </Tag>
                    ) : (
                      <Tag tone={isMine ? 'cyan' : 'dim'}>{isMine ? 'La pediste tú' : e.requestedBy}</Tag>
                    )}
                    {e.track.source === 'local_car' && <Tag tone="amber">Del carro</Tag>}
                  </>
                }
                action={
                  <div className="flex items-center gap-2">
                    {hostActions?.(e)}
                    {onPlayNow && (
                      <Key size="md" variant="ghost" onClick={() => onPlayNow(e.queueId)} aria-label={`Sonar ya ${e.track.title}`}>
                        <Play className="h-4 w-4" fill="currentColor" /> Sonar ya
                      </Key>
                    )}
                    {onVote ? (
                      <Rocker score={scoreOf(e)} mine={mine} onVote={(v) => onVote(e.queueId, v)} />
                    ) : (
                      <span className="readout w-8 text-center text-sm font-bold text-ice">{scoreOf(e) > 0 ? `+${scoreOf(e)}` : scoreOf(e)}</span>
                    )}
                  </div>
                }
              />
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ol>
  );
}

// --------------------------------------------------------------- búsqueda

export type PickState = 'idle' | 'sending' | 'done';

/** La portada de la fila del botón pulsado (para la animación de "vuela a la cola"). */
const coverOf = (btn: Element) => btn.closest('li')?.querySelector('[data-cover]') ?? btn;

/**
 * Fila de resultado memorizada: cada foto nueva del carro (cada pocos segundos) volvía a
 * pintar las 20 filas con sus animaciones; con la CPU frenada ×4 eso daba fotogramas de
 * ~100-170 ms en mitad del scroll (medido). Ahora sólo se repinta la fila cuyo estado cambia.
 */
const ResultRow = memo(function ResultRow({
  t,
  st,
  i,
  pickLabel,
  onPick,
  onPlayNow,
  animate,
}: {
  t: Track;
  st: PickState;
  i: number;
  pickLabel: string;
  onPick: (t: Track, from?: Element) => void;
  onPlayNow?: (t: Track) => void;
  animate: boolean;
}) {
  return (
    <motion.li
      initial={animate ? { opacity: 0, y: 16, rotateX: -24 } : false}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 26, delay: Math.min(i, 12) * 0.04 }}
    >
      <TrackRow
        title={t.title}
        artist={t.artist}
        cover={t.coverUrl}
        duration={t.duration}
        action={
          <div className="flex items-center gap-2">
            {onPlayNow && (
              <Key size="md" variant="ghost" onClick={() => onPlayNow(t)} aria-label={`Sonar ya ${t.title}`}>
                <Play className="h-4 w-4" fill="currentColor" /> Sonar ya
              </Key>
            )}
            <Key
              size="md"
              variant={st === 'done' ? 'ghost' : 'primary'}
              disabled={st !== 'idle'}
              onClick={(e) => onPick(t, coverOf(e.currentTarget))}
              aria-label={`${pickLabel} ${t.title}`}
            >
              {st === 'sending' ? <Loader2 className="h-4 w-4 animate-spin" /> : st === 'done' ? <Check className="h-4 w-4 text-go" /> : pickLabel}
            </Key>
          </div>
        }
      />
    </motion.li>
  );
});

export function SearchPanel({
  onPick,
  onPlayNow,
  pickLabel = 'Pedir',
  stateOf,
  autoFocus = false,
}: {
  /** `from`: elemento de la portada pulsada, por si la pantalla quiere animar el pedido. */
  onPick: (t: Track, from?: Element) => void;
  /** Si se pasa, cada resultado ofrece además «Sonar ya» (suena de inmediato, sin pasar por la cola). */
  onPlayNow?: (t: Track) => void;
  pickLabel?: string;
  stateOf?: (t: Track) => PickState;
  autoFocus?: boolean;
}) {
  const [q, setQ] = useState('');
  const debounced = useDebounced(q, 380);
  const [res, setRes] = useState<{ q: string; tracks: Track[]; source: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const reduce = useReducedMotion();
  // Callback estable para las filas memorizadas (quien usa el panel pasa funciones nuevas en cada render).
  const latestPick = useLatest(onPick);
  const pick = useCallback((t: Track, from?: Element) => latestPick.current(t, from), [latestPick]);
  const latestPlayNow = useLatest(onPlayNow);
  const playNow = useCallback((t: Track) => latestPlayNow.current?.(t), [latestPlayNow]);

  useEffect(() => {
    const query = debounced.trim();
    if (query.length < 2) {
      setRes(null);
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    searchMusic(query, ctrl.signal).then((r) => {
      if (ctrl.signal.aborted) return;
      setRes({ q: query, tracks: r.tracks, source: r.source });
      setLoading(false);
    });
    return () => ctrl.abort();
  }, [debounced]);

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <label className="lcd lcd-grid relative flex items-center gap-2 rounded-xl px-3 focus-within:border-cyan/50">
        <Search className="h-4 w-4 shrink-0 text-cyan-soft/70" aria-hidden="true" />
        <span className="sr-only">Buscar canción o artista</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Canción o artista…"
          autoFocus={autoFocus}
          enterKeyHint="search"
          className="relative z-[1] h-12 min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-faint focus:outline-none"
        />
        {loading && <Loader2 className="relative z-[1] h-4 w-4 animate-spin text-cyan" aria-label="Buscando" />}
        {q && !loading && (
          <button type="button" onClick={() => setQ('')} aria-label="Borrar búsqueda" className="relative z-[1] -mr-2 flex h-11 w-11 items-center justify-center text-faint hover:text-ice">
            <X className="h-4 w-4" />
          </button>
        )}
      </label>

      <PresetKeys presets={GENRE_SHORTCUTS} active={q} onTune={setQ} />

      {res && (
        <div className="min-h-0">
          <p className="label-cluster mb-2 px-1" aria-live="polite">
            {res.tracks.length ? `${res.tracks.length} resultados${res.source === 'respaldo' ? ' · fuente de respaldo' : ''}` : 'Sin resultados'}
          </p>
          <ul className="flex flex-col gap-1" style={{ perspective: 900 }}>
            {res.tracks.map((t, i) => (
              <ResultRow key={`${res.q}|${t.id}`} t={t} st={stateOf?.(t) ?? 'idle'} i={i} pickLabel={pickLabel} onPick={pick} onPlayNow={onPlayNow ? playNow : undefined} animate={!reduce} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------ biblioteca

export function LibraryList({
  items,
  onPick,
  pickLabel = 'Pedir',
  stateOf,
}: {
  items: LibraryItem[];
  onPick: (i: LibraryItem, from?: Element) => void;
  pickLabel?: string;
  stateOf?: (i: LibraryItem) => PickState;
}) {
  const [filter, setFilter] = useState('');
  const shown = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return f ? items.filter((i) => `${i.title} ${i.artist}`.toLowerCase().includes(f)) : items;
  }, [items, filter]);
  return (
    <div className="flex flex-col gap-3">
      {items.length > 8 && (
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={`Filtrar ${items.length} canciones del carro…`}
          aria-label="Filtrar música del carro"
          className="lcd h-11 rounded-xl px-3 text-ink placeholder:text-faint focus:border-cyan/50 focus:outline-none"
        />
      )}
      <ul className="flex flex-col gap-1">
        {shown.map((i) => {
          const st = stateOf?.(i) ?? 'idle';
          return (
            <li key={i.id}>
              <TrackRow
                title={i.title}
                artist={i.artist}
                duration={i.duration}
                action={
                  <Key size="md" variant={st === 'done' ? 'ghost' : 'primary'} disabled={st !== 'idle'} onClick={(e) => onPick(i, coverOf(e.currentTarget))} aria-label={`${pickLabel} ${i.title}`}>
                    {st === 'sending' ? <Loader2 className="h-4 w-4 animate-spin" /> : st === 'done' ? <Check className="h-4 w-4 text-go" /> : pickLabel}
                  </Key>
                }
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export const keyOf = (t: Track) => trackKey(t);
